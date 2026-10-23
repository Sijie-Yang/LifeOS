"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Label, Field, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ACCOUNT_TYPES,
  TRANSACTION_TYPES,
  CURRENCIES,
  INVESTMENT_TYPES,
  formatDate,
  toDateString,
  fmtMoney,
  cn,
} from "@/lib/utils";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, LineChart, Settings, Pencil, Tags, Minus, RefreshCw } from "lucide-react";
import { ADJUSTMENT_TYPES } from "@/lib/investment-adjust";
import { PRIMARY_BASE_CURRENCIES } from "@/lib/exchange-rates-fetch";
import { FinanceAccessGate, InvestmentPolicyBanner } from "@/components/finance/FinanceAccessGate";

type Tab = "overview" | "ledger" | "investments" | "trend";
const VALID_TABS: Tab[] = ["overview", "ledger", "investments", "trend"];

type Holding = {
  id: string;
  type: string;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currency: string;
  marketValue: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  marketValueBase: number;
  account: { id: string; name: string } | null;
  notes?: string | null;
};

type FinanceData = {
  settings: { baseCurrency: string; investmentPolicy?: string | null; financeAccessLimit?: number };
  exchangeRates: Array<{ currency: string; rateToBase: number; updatedAt?: string }>;
  ratesMeta?: {
    lastUpdated: string | null;
    isStale: boolean;
    autoRefreshSupported: boolean;
  };
  accounts: Array<{ id: string; name: string; type: string; balance: number; currency: string; color: string }>;
  categories: Array<{ id: string; name: string; type: string; color: string; budget: number | null; spent?: number; remaining?: number | null }>;
  holdings: Holding[];
  wealthHistory: Array<{ date: string; netWorth: number; cashTotal: number; investmentTotal: number; note?: string | null }>;
  currencyBreakdown: Array<{ currency: string; cash: number; investment: number; total: number; totalInBase: number }>;
  summary: {
    baseCurrency: string;
    netWorth: number;
    cashTotal: number;
    investmentTotal: number;
    monthIncome: number;
    monthExpense: number;
    monthBalance: number;
    transactionCount: number;
  };
  expenseByCategory: Array<{ id: string; name: string; budget: number | null; spent?: number }>;
  recentTransactions: Array<{
    id: string;
    amount: number;
    type: string;
    date: string;
    description: string | null;
    accountId: string;
    toAccountId: string | null;
    categoryId: string | null;
    projectId: string | null;
    category: { name: string } | null;
    account: { name: string; currency: string };
    toAccount: { name: string } | null;
    project: { id: string; name: string } | null;
  }>;
};

type ProjectOption = { id: string; name: string };

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "概览" },
  { key: "ledger", label: "记账" },
  { key: "investments", label: "投资" },
  { key: "trend", label: "财富趋势" },
];

const emptyTx = { accountId: "", toAccountId: "", categoryId: "", projectId: "", amount: "", type: "expense", date: toDateString(), description: "" };
const emptyAccount = { name: "", type: "cash", balance: "0", currency: "CNY", color: "#6366f1" };
const emptyCategory = { name: "", type: "expense", color: "#6366f1", budget: "" };
const emptyHolding = { type: "fund", symbol: "", name: "", shares: "", avgCost: "", currentPrice: "", currency: "CNY", accountId: "", notes: "" };
const emptyAdjust = { type: "buy" as "buy" | "sell" | "price", shares: "", price: "", date: toDateString(), note: "", accountId: "", reason: "", emotion: "" };

type AdjustmentRecord = {
  id: string;
  type: string;
  shares: number;
  price: number;
  amount: number;
  date: string;
  note: string | null;
  account?: { id: string; name: string; currency: string } | null;
};

function WealthChart({ data, baseCurrency }: { data: FinanceData["wealthHistory"]; baseCurrency: string }) {
  if (data.length === 0) return <p className="text-sm text-zinc-500 text-center py-8">暂无历史数据，点击「记录今日净值」开始追踪</p>;
  const max = Math.max(...data.map((d) => d.netWorth));
  const min = Math.min(...data.map((d) => d.netWorth));
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-48 pt-4">
      {data.map((d) => {
        const h = Math.max(8, ((d.netWorth - min) / range) * 100 + 8);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-zinc-400 truncate w-full text-center" title={fmtMoney(d.netWorth, baseCurrency)}>
              {d.date.slice(5)}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-indigo-300 transition-all"
              style={{ height: `${h}%` }}
              title={`${d.date}: ${fmtMoney(d.netWorth, baseCurrency)}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(() =>
    peekFetchCache<FinanceData>("/api/finance")
  );
  const [tab, setTab] = useState<Tab>("overview");
  const [txModal, setTxModal] = useState(false);
  const [accountModal, setAccountModal] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [holdingModal, setHoldingModal] = useState(false);
  const [settingsModal, setSettingsModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | null>(null);
  const [editingAccount, setEditingAccount] = useState<{ id: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ id: string } | null>(null);
  const [editingTx, setEditingTx] = useState<FinanceData["recentTransactions"][0] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [txForm, setTxForm] = useState(emptyTx);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [holdingForm, setHoldingForm] = useState(emptyHolding);
  const [baseCurrency, setBaseCurrency] = useState("CNY");
  const [rateForms, setRateForms] = useState<Record<string, string>>({});
  const [snapshotModal, setSnapshotModal] = useState(false);
  const [snapshotNote, setSnapshotNote] = useState("");
  const [priceHistory, setPriceHistory] = useState<Array<{ date: string; price: number }>>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Holding | null>(null);
  const [adjustForm, setAdjustForm] = useState(emptyAdjust);
  const [rateSourceDate, setRateSourceDate] = useState<string | null>(null);
  const [ratesRefreshing, setRatesRefreshing] = useState(false);
  const [financeAccess, setFinanceAccess] = useState<{ weekCount: number; limit: number } | null>(null);
  const [investmentPolicy, setInvestmentPolicy] = useState("");
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/finance"]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (shouldShowPageLoading(["/api/finance"])) setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<FinanceData>("/api/finance");
      setData(d);
      setBaseCurrency(d.settings.baseCurrency);
      const rates: Record<string, string> = {};
      d.exchangeRates.forEach((r) => { rates[r.currency] = String(r.rateToBase); });
      setRateForms(rates);
      fetchJson<ProjectOption[]>("/api/projects").then(setProjects).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/finance/access").then((r) => r.json()).then(setFinanceAccess).catch(() => null);
  }, [tab]);

  useEffect(() => {
    if (data?.settings?.investmentPolicy != null) {
      setInvestmentPolicy(data.settings.investmentPolicy || "");
    }
  }, [data?.settings?.investmentPolicy]);

  useEffect(() => { load(); }, [load]);

  const refreshRates = useCallback(async (silent = false) => {
    setRatesRefreshing(true);
    try {
      const res = await fetch("/api/finance/settings/refresh-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (!silent) alert(err.error || "刷新汇率失败");
        return;
      }
      const result = await res.json();
      setRateSourceDate(result.rateDate ?? null);
      await load();
    } catch (e) {
      if (!silent) alert(e instanceof Error ? e.message : "刷新汇率失败");
    } finally {
      setRatesRefreshing(false);
    }
  }, [baseCurrency, load]);

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam && VALID_TABS.includes(tabParam as Tab)) {
      setTab(tabParam as Tab);
    }
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url.toString());
  };

  const bc = data?.summary.baseCurrency ?? "CNY";

  const openTx = (type: "income" | "expense" | "transfer" = "expense", tx?: FinanceData["recentTransactions"][0]) => {
    if (tx) {
      setEditingTx(tx);
      setTxForm({
        accountId: tx.accountId,
        toAccountId: tx.toAccountId || "",
        categoryId: tx.categoryId || "",
        projectId: tx.projectId || "",
        amount: String(tx.amount),
        type: tx.type,
        date: tx.date,
        description: tx.description || "",
      });
    } else {
      setEditingTx(null);
      setTxForm({
        ...emptyTx,
        type,
        accountId: data?.accounts[0]?.id || "",
        categoryId: data?.categories.find((c) => c.type === type)?.id || "",
        toAccountId: "",
      });
    }
    setTxModal(true);
  };

  const saveTx = async () => {
    const payload = {
      ...txForm,
      amount: +txForm.amount,
      categoryId: txForm.categoryId || null,
      toAccountId: txForm.toAccountId || null,
      projectId: txForm.projectId || null,
    };
    if (editingTx) {
      await fetch(`/api/finance/transactions/${editingTx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setTxModal(false);
    setEditingTx(null);
    load();
  };

  const removeTx = async (id: string) => {
    if (!confirm("确定删除？账户余额将回滚。")) return;
    await fetch(`/api/finance/transactions/${id}`, { method: "DELETE" });
    load();
  };

  const saveAccount = async () => {
    const payload = { ...accountForm, balance: +accountForm.balance };
    if (editingAccount) {
      await fetch(`/api/finance/accounts/${editingAccount.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/finance/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setAccountModal(false);
    setEditingAccount(null);
    load();
  };

  const removeAccount = async (id: string) => {
    if (!confirm("确定删除此账户？关联交易将一并删除。")) return;
    await fetch(`/api/finance/accounts/${id}`, { method: "DELETE" });
    load();
  };

  const openAccount = (a?: FinanceData["accounts"][0]) => {
    if (a) {
      setEditingAccount({ id: a.id });
      setAccountForm({ name: a.name, type: a.type, balance: String(a.balance), currency: a.currency, color: a.color });
    } else {
      setEditingAccount(null);
      setAccountForm(emptyAccount);
    }
    setAccountModal(true);
  };

  const saveCategory = async () => {
    const payload = { ...categoryForm, budget: categoryForm.budget ? +categoryForm.budget : null };
    if (editingCategory) {
      await fetch(`/api/finance/categories/${editingCategory.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      await fetch("/api/finance/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    setCategoryModal(false);
    setEditingCategory(null);
    load();
  };

  const removeCategory = async (id: string) => {
    if (!confirm("确定删除此分类？")) return;
    await fetch(`/api/finance/categories/${id}`, { method: "DELETE" });
    load();
  };

  const openCategory = (c?: FinanceData["categories"][0]) => {
    if (c) {
      setEditingCategory({ id: c.id });
      setCategoryForm({ name: c.name, type: c.type, color: c.color, budget: c.budget != null ? String(c.budget) : "" });
    } else {
      setEditingCategory(null);
      setCategoryForm(emptyCategory);
    }
    setCategoryModal(true);
  };

  const openHolding = async (h?: Holding) => {
    if (h) {
      setEditingHolding(h);
      setHoldingForm({
        type: h.type, symbol: h.symbol, name: h.name, shares: String(h.shares),
        avgCost: String(h.avgCost), currentPrice: String(h.currentPrice), currency: h.currency,
        accountId: h.account?.id || "", notes: h.notes || "",
      });
      const detail = await fetch(`/api/finance/investments/${h.id}`).then((r) => r.json()).catch(() => ({}));
      if (Array.isArray(detail)) {
        setPriceHistory(detail);
        setAdjustments([]);
      } else {
        setPriceHistory(detail.priceHistory ?? []);
        setAdjustments(detail.adjustments ?? []);
      }
    } else {
      setEditingHolding(null);
      setHoldingForm({ ...emptyHolding });
      setPriceHistory([]);
      setAdjustments([]);
    }
    setHoldingModal(true);
  };

  const pickDefaultAccountId = (h: Holding) => {
    if (h.account?.id) return h.account.id;
    const match = data?.accounts.find((a) => a.currency === h.currency);
    return match?.id || data?.accounts[0]?.id || "";
  };

  const openAdjust = (h: Holding, type: "buy" | "sell" | "price") => {
    setAdjustTarget(h);
    setAdjustForm({
      type,
      shares: "",
      price: type === "price" ? String(h.currentPrice) : type === "buy" ? String(h.avgCost) : String(h.currentPrice),
      date: toDateString(),
      note: "",
      accountId: type === "price" ? "" : pickDefaultAccountId(h),
      reason: "",
      emotion: "",
    });
    setAdjustModal(true);
  };

  const saveAdjust = async () => {
    if (!adjustTarget) return;
    const payload: Record<string, unknown> = {
      type: adjustForm.type,
      date: adjustForm.date,
      note: adjustForm.note || null,
      price: +adjustForm.price,
    };
    if (adjustForm.type !== "price") {
      payload.shares = +adjustForm.shares;
      if (adjustForm.accountId) payload.accountId = adjustForm.accountId;
      payload.reason = adjustForm.reason?.trim() || null;
      payload.emotion = adjustForm.emotion?.trim() || null;
    }
    const res = await fetch(`/api/finance/investments/${adjustTarget.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "操作失败");
      return;
    }
    setAdjustModal(false);
    setAdjustTarget(null);
    load();
  };

  const saveHolding = async () => {
    const payload = {
      ...holdingForm,
      shares: +holdingForm.shares,
      avgCost: holdingForm.avgCost ? +holdingForm.avgCost : +holdingForm.currentPrice,
      currentPrice: +holdingForm.currentPrice,
      accountId: holdingForm.accountId || null,
    };
    if (editingHolding) {
      const { shares: _s, avgCost: _a, ...meta } = payload;
      const res = await fetch(`/api/finance/investments/${editingHolding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meta),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "保存失败");
        return;
      }
    } else {
      const res = await fetch("/api/finance/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "添加持仓失败");
        return;
      }
    }
    setHoldingModal(false);
    load();
  };

  const removeHolding = async (id: string) => {
    if (!confirm("确定删除此持仓？")) return;
    await fetch(`/api/finance/investments/${id}`, { method: "DELETE" });
    load();
  };

  const recordSnapshot = async () => {
    await fetch("/api/finance/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: snapshotNote.trim() || null }),
    });
    setSnapshotModal(false);
    setSnapshotNote("");
    load();
  };

  const saveSettings = async () => {
    const prevBase = data?.settings.baseCurrency;
    await fetch("/api/finance/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseCurrency }) });
    if (
      PRIMARY_BASE_CURRENCIES.includes(baseCurrency as (typeof PRIMARY_BASE_CURRENCIES)[number]) &&
      baseCurrency !== prevBase
    ) {
      await refreshRates(true);
    } else {
      for (const [currency, rate] of Object.entries(rateForms)) {
        if (currency === baseCurrency) continue;
        if (!rate) continue;
        await fetch("/api/finance/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency, rateToBase: +rate }) });
      }
    }
    setSettingsModal(false);
    load();
  };

  const summary = data?.summary;
  const expenseCats = data?.expenseByCategory.filter((c) => c.budget != null) ?? [];

  return (
    <>
      <PageHeader
        title="理财记账"
        description="多币种 · 基金股票 · 净资产趋势 — 统一折算为基准货币"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={() => setSettingsModal(true)}><Settings className="h-4 w-4" /> 汇率</Button>
            <Button variant="secondary" size="sm" onClick={() => setSnapshotModal(true)}><LineChart className="h-4 w-4" /> 记录净值</Button>
            <Button variant="secondary" size="sm" onClick={() => openAccount()}><Plus className="h-4 w-4" /> 账户</Button>
            <Button variant="secondary" size="sm" onClick={() => openCategory()}><Tags className="h-4 w-4" /> 分类</Button>
            <Button variant="secondary" size="sm" onClick={() => openTx("transfer")}>转账</Button>
            <Button variant="secondary" size="sm" onClick={() => openTx("income")}><TrendingUp className="h-4 w-4" /> 收入</Button>
            <Button size="sm" onClick={() => openTx("expense")}><TrendingDown className="h-4 w-4" /> 支出</Button>
          </div>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!data}>
      <FilterTabs
        tabs={TABS}
        value={tab}
        onChange={(k) => changeTab(k as Tab)}
        trailing={
          <span className="text-xs text-zinc-400">基准货币: {CURRENCIES[bc]?.label ?? bc}</span>
        }
      />

      {/* ── 概览 ── */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card className="col-span-2 lg:col-span-1">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-zinc-500 flex items-center gap-1"><Wallet className="h-3 w-3" /> 净资产</p>
                <p className="text-2xl font-semibold mt-1">{fmtMoney(summary?.netWorth ?? 0, bc)}</p>
              </CardContent>
            </Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-zinc-500">现金/存款</p><p className="text-xl font-semibold mt-1">{fmtMoney(summary?.cashTotal ?? 0, bc)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-zinc-500">投资市值</p><p className="text-xl font-semibold text-violet-600 mt-1">{fmtMoney(summary?.investmentTotal ?? 0, bc)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-zinc-500">本月收入</p><p className="text-xl font-semibold text-emerald-600 mt-1">{fmtMoney(summary?.monthIncome ?? 0, bc, { showSign: true })}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-zinc-500">本月支出</p><p className="text-xl font-semibold text-red-500 mt-1">-{fmtMoney(summary?.monthExpense ?? 0, bc).replace(/^\+?/, "")}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>多币种分布</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data?.currencyBreakdown.length === 0 && <p className="text-sm text-zinc-500">添加多币种账户或投资</p>}
                {data?.currencyBreakdown.map((row) => (
                  <div key={row.currency} className="flex items-center justify-between text-sm border-b border-zinc-50 pb-2">
                    <div>
                      <span className="font-medium">{CURRENCIES[row.currency]?.label ?? row.currency}</span>
                      <p className="text-xs text-zinc-400">现金 {fmtMoney(row.cash, row.currency)} · 投资 {fmtMoney(row.investment, row.currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{fmtMoney(row.total, row.currency)}</p>
                      <p className="text-xs text-zinc-400">≈ {fmtMoney(row.totalInBase, bc)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>账户</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data?.accounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => openAccount(a)}>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-zinc-400">{ACCOUNT_TYPES[a.type]}{a.type === "credit" ? " · 负债" : ""} · {a.currency}</p>
                    </div>
                    <span className={`text-sm font-semibold ${a.type === "credit" ? "text-red-500" : ""}`}>
                      {a.type === "credit" ? `-${fmtMoney(a.balance, a.currency).replace(/^\+?/, "")}` : fmtMoney(a.balance, a.currency)}
                    </span>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeAccount(a.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── 记账 ── */}
      {tab === "ledger" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>最近交易</CardTitle></CardHeader>
            <CardContent>
              {data?.recentTransactions.length === 0 ? <EmptyState title="暂无记录" description="记一笔收支" /> : (
                <div className="space-y-2">
                  {data?.recentTransactions.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-4 py-3 group">
                      <div className={`text-sm font-semibold w-28 shrink-0 ${t.type === "income" ? "text-emerald-600" : t.type === "transfer" ? "text-indigo-600" : "text-red-500"}`}>
                        {t.type === "transfer" ? "↔" : t.type === "income" ? "+" : "-"}{fmtMoney(t.amount, t.account.currency)}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openTx(undefined, t)}>
                        <p className="text-sm text-zinc-800 truncate">{t.description || (t.type === "transfer" ? `转至 ${t.toAccount?.name}` : "—")}</p>
                        <div className="flex gap-2 text-xs text-zinc-400 mt-0.5 flex-wrap">
                          <span>{formatDate(t.date)}</span>
                          {t.category && <Badge className="bg-zinc-100 text-zinc-600 text-[10px]">{t.category.name}</Badge>}
                          {t.project && <Badge className="bg-emerald-50 text-emerald-700 text-[10px]">{t.project.name}</Badge>}
                          <span>{t.account.name}{t.toAccount ? ` → ${t.toAccount.name}` : ""}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openTx(undefined, t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeTx(t.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          {expenseCats.length > 0 && (
            <Card>
              <CardHeader><CardTitle>预算进度</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {expenseCats.map((c) => {
                  const pct = c.budget ? Math.min(100, Math.round(((c.spent ?? 0) / c.budget) * 100)) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between text-xs mb-1"><span>{c.name}</span><span>{fmtMoney(c.spent ?? 0, bc)} / {fmtMoney(c.budget ?? 0, bc)}</span></div>
                      <ProgressBar value={pct} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>收支分类</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => openCategory()}><Plus className="h-3.5 w-3.5" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.categories.length === 0 && <p className="text-sm text-zinc-500">添加分类以追踪预算</p>}
              {data?.categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b border-zinc-50 group">
                  <button type="button" className="flex items-center gap-2 flex-1 text-left" onClick={() => openCategory(c)}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span>{c.name}</span>
                    <Badge className="bg-zinc-100 text-zinc-500 text-[10px]">{TRANSACTION_TYPES[c.type] ?? c.type}</Badge>
                  </button>
                  <div className="flex items-center gap-1">
                    {c.budget != null && <span className="text-xs text-zinc-400">预算 {fmtMoney(c.budget, bc)}</span>}
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => removeCategory(c.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 投资 ── */}
      {tab === "investments" && (
        <FinanceAccessGate active={tab === "investments"}>
        <>
          <InvestmentPolicyBanner
            policy={(data?.settings?.investmentPolicy ?? investmentPolicy) || null}
            weekCount={financeAccess?.weekCount}
            limit={financeAccess?.limit}
          />
          <div className="flex justify-end mb-4 gap-2">
            <Button size="sm" variant="secondary" onClick={async () => {
              const policy = prompt("投资原则（IPS）", investmentPolicy);
              if (policy == null) return;
              await fetch("/api/finance/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ investmentPolicy: policy }),
              });
              setInvestmentPolicy(policy);
              void load();
            }}>编辑原则</Button>
            <Button size="sm" onClick={() => openHolding()}><Plus className="h-4 w-4" /> 添加持仓</Button>
          </div>
          {data?.holdings.length === 0 ? (
            <EmptyState title="暂无投资持仓" description="添加股票或基金，手动更新现价追踪盈亏" />
          ) : (
            <div className="space-y-3">
              {data?.holdings.map((h) => (
                <Card key={h.id} className="cursor-pointer hover:border-zinc-300" onClick={() => openHolding(h)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-violet-100 text-violet-700">{INVESTMENT_TYPES[h.type]}</Badge>
                          <span className="font-mono text-xs text-zinc-500">{h.symbol}</span>
                          <span className="text-xs text-zinc-400">{h.currency}</span>
                        </div>
                        <h3 className="font-semibold text-zinc-900">{h.name}</h3>
                        <p className="text-xs text-zinc-500 mt-1">{h.shares} 份 · 成本 {fmtMoney(h.avgCost, h.currency)} · 现价 {fmtMoney(h.currentPrice, h.currency)}</p>
                      </div>
                      <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        <p className="font-semibold">{fmtMoney(h.marketValue, h.currency)}</p>
                        <p className="text-xs text-zinc-400">≈ {fmtMoney(h.marketValueBase, bc)}</p>
                        <p className={`text-sm font-medium mt-1 ${h.pnl >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {h.pnl >= 0 ? "+" : ""}{fmtMoney(h.pnl, h.currency)} ({h.pnlPct.toFixed(1)}%)
                        </p>
                        <div className="flex items-center justify-end gap-1 mt-2">
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => openAdjust(h, "buy")}>
                            <Plus className="h-3 w-3" /> 加仓
                          </Button>
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => openAdjust(h, "sell")}>
                            <Minus className="h-3 w-3" /> 减仓
                          </Button>
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => openAdjust(h, "price")}>
                            现价
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeHolding(h.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
        </FinanceAccessGate>
      )}

      {/* ── 趋势 ── */}
      {tab === "trend" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-indigo-500" /> 净资产趋势</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => setSnapshotModal(true)}>记录今日</Button>
            </CardHeader>
            <CardContent>
              <WealthChart data={data?.wealthHistory ?? []} baseCurrency={bc} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>历史快照</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-64 overflow-y-auto">
              {[...(data?.wealthHistory ?? [])].reverse().map((s) => (
                <div key={s.date} className="py-1 border-b border-zinc-50">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">{s.date}</span>
                    <span className="font-medium">{fmtMoney(s.netWorth, bc)}</span>
                  </div>
                  {s.note && <p className="text-xs text-zinc-400 mt-0.5">{s.note}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modals */}
      <Modal open={txModal} onClose={() => { setTxModal(false); setEditingTx(null); }} title={editingTx ? "编辑交易" : txForm.type === "income" ? "记收入" : txForm.type === "transfer" ? "转账" : "记支出"}>
        <Field><Label>类型</Label><Select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} disabled={!!editingTx}>{Object.entries(TRANSACTION_TYPES).filter(([k]) => k !== "transfer" || txForm.type === "transfer").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field className="mt-4"><Label>{txForm.type === "transfer" ? "转出账户" : "账户"}</Label><Select value={txForm.accountId} onChange={(e) => setTxForm({ ...txForm, accountId: e.target.value })}>{data?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</Select></Field>
        {txForm.type === "transfer" && (
          <Field className="mt-4"><Label>转入账户</Label><Select value={txForm.toAccountId} onChange={(e) => setTxForm({ ...txForm, toAccountId: e.target.value })}><option value="">选择...</option>{data?.accounts.filter((a) => a.id !== txForm.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
        )}
        {txForm.type !== "transfer" && (
          <Field className="mt-4"><Label>分类</Label><Select value={txForm.categoryId} onChange={(e) => setTxForm({ ...txForm, categoryId: e.target.value })}><option value="">无</option>{data?.categories.filter((c) => c.type === txForm.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        )}
        {txForm.type !== "transfer" && (
          <Field className="mt-4"><Label>关联项目</Label><Select value={txForm.projectId} onChange={(e) => setTxForm({ ...txForm, projectId: e.target.value })}><option value="">无</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        )}
        <Field className="mt-4"><Label>金额 *</Label><Input type="number" min="0" step="0.01" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} /></Field>
        <Field className="mt-4"><Label>日期</Label><Input type="date" value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} /></Field>
        <Field className="mt-4"><Label>备注</Label><Input value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={() => setTxModal(false)}>取消</Button><Button onClick={saveTx} disabled={!txForm.accountId || !txForm.amount || (txForm.type === "transfer" && !txForm.toAccountId)}>保存</Button></div>
      </Modal>

      <Modal open={accountModal} onClose={() => { setAccountModal(false); setEditingAccount(null); }} title={editingAccount ? "编辑账户" : "添加账户"}>
        <Field><Label>名称 *</Label><Input value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} /></Field>
        <Field className="mt-4"><Label>类型</Label><Select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field className="mt-4"><Label>币种</Label><Select value={accountForm.currency} onChange={(e) => setAccountForm({ ...accountForm, currency: e.target.value })}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{v.label} ({k})</option>)}</Select></Field>
        <Field className="mt-4"><Label>初始余额</Label><Input type="number" value={accountForm.balance} onChange={(e) => setAccountForm({ ...accountForm, balance: e.target.value })} /></Field>
        <Field className="mt-4"><Label>颜色</Label><Input type="color" value={accountForm.color} onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={() => { setAccountModal(false); setEditingAccount(null); }}>取消</Button><Button onClick={saveAccount} disabled={!accountForm.name}>{editingAccount ? "保存" : "添加"}</Button></div>
      </Modal>

      <Modal open={holdingModal} onClose={() => setHoldingModal(false)} title={editingHolding ? "更新持仓" : "添加持仓"} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field><Label>类型</Label><Select value={holdingForm.type} onChange={(e) => setHoldingForm({ ...holdingForm, type: e.target.value })}>{Object.entries(INVESTMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          <Field><Label>代码 *</Label><Input value={holdingForm.symbol} onChange={(e) => setHoldingForm({ ...holdingForm, symbol: e.target.value })} placeholder="AAPL / 110011" /></Field>
          <Field className="col-span-2"><Label>名称 *</Label><Input value={holdingForm.name} onChange={(e) => setHoldingForm({ ...holdingForm, name: e.target.value })} /></Field>
          {editingHolding ? (
            <>
              <Field><Label>持有份额</Label><Input value={holdingForm.shares} readOnly className="bg-zinc-50" /></Field>
              <Field><Label>成本价（每份）</Label><Input value={holdingForm.avgCost} readOnly className="bg-zinc-50" /></Field>
              <p className="col-span-2 text-xs text-zinc-500 -mt-2">份额与成本请用「加仓 / 减仓」调整，自动加权计算</p>
            </>
          ) : (
            <>
              <Field><Label>持有份额 *</Label><Input type="number" step="0.0001" value={holdingForm.shares} onChange={(e) => setHoldingForm({ ...holdingForm, shares: e.target.value })} /></Field>
              <Field><Label>币种</Label><Select value={holdingForm.currency} onChange={(e) => {
                const currency = e.target.value;
                const accountStillValid = !holdingForm.accountId || data?.accounts.some((a) => a.id === holdingForm.accountId && a.currency === currency);
                setHoldingForm({ ...holdingForm, currency, accountId: accountStillValid ? holdingForm.accountId : "" });
              }}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{k}</option>)}</Select></Field>
              <Field><Label>成本价（每份）</Label><Input type="number" step="0.01" value={holdingForm.avgCost} onChange={(e) => setHoldingForm({ ...holdingForm, avgCost: e.target.value })} /></Field>
            </>
          )}
          {editingHolding && (
            <Field><Label>币种</Label><Select value={holdingForm.currency} onChange={(e) => {
              const currency = e.target.value;
              const accountStillValid = !holdingForm.accountId || data?.accounts.some((a) => a.id === holdingForm.accountId && a.currency === currency);
              setHoldingForm({ ...holdingForm, currency, accountId: accountStillValid ? holdingForm.accountId : "" });
            }}>{Object.entries(CURRENCIES).map(([k, v]) => <option key={k} value={k}>{k}</option>)}</Select></Field>
          )}
          <Field><Label>现价（每份）{editingHolding ? "" : " *"}</Label><Input type="number" step="0.01" value={holdingForm.currentPrice} onChange={(e) => setHoldingForm({ ...holdingForm, currentPrice: e.target.value })} /></Field>
          {editingHolding && (
            <Field className="flex items-end">
              <Button variant="secondary" size="sm" className="w-full" onClick={() => { setHoldingModal(false); openAdjust(editingHolding, "price"); }}>
                快速更新现价
              </Button>
            </Field>
          )}
          <Field className="col-span-2">
            <Label>扣款账户（可选）</Label>
            <Select value={holdingForm.accountId} onChange={(e) => setHoldingForm({ ...holdingForm, accountId: e.target.value })}>
              <option value="">不记账户流水</option>
              {(data?.accounts.filter((a) => a.currency === holdingForm.currency) ?? []).map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {fmtMoney(a.balance, a.currency)}</option>
              ))}
            </Select>
            {(data?.accounts.filter((a) => a.currency === holdingForm.currency).length ?? 0) === 0 && (
              <p className="text-xs text-amber-600 mt-1">无 {holdingForm.currency} 账户；不选账户则只记录持仓</p>
            )}
          </Field>
          {!editingHolding && holdingForm.accountId && (
            <p className="col-span-2 text-xs text-zinc-500 -mt-2">建仓时将从所选账户扣款</p>
          )}
          <Field className="col-span-2"><Label>备注</Label><Textarea value={holdingForm.notes} onChange={(e) => setHoldingForm({ ...holdingForm, notes: e.target.value })} className="min-h-[60px]" /></Field>
        </div>
        {priceHistory.length > 1 && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 mb-2">价格历史</p>
            <div className="flex items-end gap-0.5 h-16">
              {priceHistory.map((p) => {
                const max = Math.max(...priceHistory.map((x) => x.price));
                const min = Math.min(...priceHistory.map((x) => x.price));
                const h = max === min ? 50 : ((p.price - min) / (max - min)) * 100;
                return (
                  <div key={p.date} className="flex-1 bg-violet-300 rounded-t min-w-0" style={{ height: `${Math.max(8, h)}%` }} title={`${p.date}: ${p.price}`} />
                );
              })}
            </div>
          </div>
        )}
        {adjustments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <p className="text-xs text-zinc-500 mb-2">变动记录</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {adjustments.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-zinc-50">
                  <div>
                    <span className={`font-medium ${a.type === "buy" ? "text-emerald-600" : a.type === "sell" ? "text-red-500" : "text-violet-600"}`}>
                      {ADJUSTMENT_TYPES[a.type] ?? a.type}
                    </span>
                    {a.type !== "price" && (
                      <span className="text-zinc-600 ml-2">{a.shares} 份 @ {a.price}</span>
                    )}
                    {a.type === "price" && <span className="text-zinc-600 ml-2">→ {a.price}</span>}
                    {a.note && <span className="text-zinc-400 ml-1">· {a.note}</span>}
                    {a.account && (
                      <span className="text-zinc-400 ml-1">· {a.account.name}</span>
                    )}
                  </div>
                  <span className="text-zinc-400 shrink-0 ml-2">{a.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={() => setHoldingModal(false)}>取消</Button><Button onClick={saveHolding} disabled={!holdingForm.symbol || !holdingForm.name || (!editingHolding && (!holdingForm.shares || !holdingForm.currentPrice))}>保存</Button></div>
      </Modal>

      <Modal
        open={adjustModal}
        onClose={() => { setAdjustModal(false); setAdjustTarget(null); }}
        title={
          adjustForm.type === "buy"
            ? `加仓 · ${adjustTarget?.name ?? ""}`
            : adjustForm.type === "sell"
              ? `减仓 · ${adjustTarget?.name ?? ""}`
              : `更新现价 · ${adjustTarget?.name ?? ""}`
        }
      >
        {adjustTarget && (
          <p className="text-sm text-zinc-500 mb-4">
            当前 {adjustTarget.shares} 份 · 成本 {fmtMoney(adjustTarget.avgCost, adjustTarget.currency)} · 现价 {fmtMoney(adjustTarget.currentPrice, adjustTarget.currency)}
          </p>
        )}
        {adjustForm.type !== "price" && (
          <>
            <Field>
              <Label>{adjustForm.type === "buy" ? "加仓份额 *" : "减仓份额 *"}</Label>
              <Input type="number" step="0.0001" min="0" value={adjustForm.shares} onChange={(e) => setAdjustForm({ ...adjustForm, shares: e.target.value })} />
            </Field>
            <Field className="mt-4">
              <Label>{adjustForm.type === "buy" ? "扣款账户" : "入账账户"}</Label>
              <Select value={adjustForm.accountId} onChange={(e) => setAdjustForm({ ...adjustForm, accountId: e.target.value })}>
                <option value="">不记账户流水</option>
                {(data?.accounts.filter((a) => a.currency === adjustTarget?.currency) ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name} · {fmtMoney(a.balance, a.currency)}</option>
                ))}
              </Select>
              {adjustTarget && (data?.accounts.filter((a) => a.currency === adjustTarget.currency).length ?? 0) === 0 && (
                <p className="text-xs text-amber-600 mt-1">无 {adjustTarget.currency} 账户，请先添加同币种账户</p>
              )}
              {adjustForm.accountId && adjustForm.shares && adjustForm.price && (
                <p className="text-xs text-zinc-500 mt-1">
                  {adjustForm.type === "buy" ? "将从账户扣款" : "将入账"} {fmtMoney(+adjustForm.shares * +adjustForm.price, adjustTarget?.currency ?? bc)}
                </p>
              )}
            </Field>
          </>
        )}
        <Field className={adjustForm.type === "price" ? "" : "mt-4"}>
          <Label>{adjustForm.type === "price" ? "新现价 *" : adjustForm.type === "buy" ? "成交单价 *" : "卖出单价 *"}</Label>
          <Input type="number" step="0.01" min="0" value={adjustForm.price} onChange={(e) => setAdjustForm({ ...adjustForm, price: e.target.value })} />
        </Field>
        {adjustForm.type !== "price" && adjustForm.shares && adjustForm.price && (
          <p className="text-xs text-zinc-500 mt-2">
            合计 {fmtMoney(+adjustForm.shares * +adjustForm.price, adjustTarget?.currency ?? bc)}
            {adjustForm.type === "buy" && adjustTarget && (
              <> · 加仓后成本约 {fmtMoney(
                (adjustTarget.shares * adjustTarget.avgCost + +adjustForm.shares * +adjustForm.price) /
                  (adjustTarget.shares + +adjustForm.shares),
                adjustTarget.currency
              )}</>
            )}
          </p>
        )}
        <Field className="mt-4"><Label>日期</Label><Input type="date" value={adjustForm.date} onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })} /></Field>
        {adjustForm.type !== "price" && (
          <>
            <Field className="mt-4">
              <Label>交易理由 *</Label>
              <Input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="为什么现在买/卖？" />
            </Field>
            <Field className="mt-4">
              <Label>当下情绪</Label>
              <Input value={adjustForm.emotion} onChange={(e) => setAdjustForm({ ...adjustForm, emotion: e.target.value })} placeholder="如：焦虑、FOMO、理性" />
            </Field>
          </>
        )}
        <Field className="mt-4"><Label>备注</Label><Input value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} placeholder="可选" /></Field>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => { setAdjustModal(false); setAdjustTarget(null); }}>取消</Button>
          <Button
            onClick={saveAdjust}
            disabled={
              !adjustForm.price ||
              (adjustForm.type !== "price" && !adjustForm.shares) ||
              (adjustForm.type !== "price" && !adjustForm.reason?.trim())
            }
          >
            确认{ADJUSTMENT_TYPES[adjustForm.type]}
          </Button>
        </div>
      </Modal>

      <Modal open={snapshotModal} onClose={() => setSnapshotModal(false)} title="记录今日净值">
        <Field>
          <Label>备注（可选）</Label>
          <Textarea value={snapshotNote} onChange={(e) => setSnapshotNote(e.target.value)} placeholder="如：发工资、还房贷、市场波动..." className="min-h-[80px]" />
        </Field>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setSnapshotModal(false)}>取消</Button>
          <Button onClick={recordSnapshot}>记录</Button>
        </div>
      </Modal>

      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="货币与汇率">
        <Field>
          <Label>基准货币</Label>
          <div className="flex gap-2 mt-1">
            {PRIMARY_BASE_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setBaseCurrency(code)}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  baseCurrency === code
                    ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                    : "border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                )}
              >
                {CURRENCIES[code]?.label ?? code}
                <span className="block text-[10px] font-normal opacity-70">{code}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            净资产统一折算为所选基准。切换基准后建议刷新汇率。
          </p>
        </Field>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
          <div className="text-xs text-zinc-500 min-w-0">
            <p>来源 Frankfurter · 欧央行参考价（工作日更新）</p>
            {(rateSourceDate || data?.ratesMeta?.lastUpdated) && (
              <p className="mt-0.5">
                {rateSourceDate && <>参考日 {rateSourceDate}</>}
                {data?.ratesMeta?.lastUpdated && (
                  <> · 本地更新 {new Date(data.ratesMeta.lastUpdated).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
                )}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={ratesRefreshing}
            onClick={() => void refreshRates()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", ratesRefreshing && "animate-spin")} />
            刷新
          </Button>
        </div>

        <p className="text-xs text-zinc-500 mt-4 mb-2">汇率：1 外币 = ? {baseCurrency}（可手动微调后保存）</p>
        {Object.entries(CURRENCIES).filter(([k]) => k !== baseCurrency).map(([k, v]) => (
          <Field key={k} className="mt-2">
            <Label>{v.label} ({k})</Label>
            <Input type="number" step="0.0001" placeholder="汇率" value={rateForms[k] ?? ""} onChange={(e) => setRateForms({ ...rateForms, [k]: e.target.value })} />
          </Field>
        ))}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setSettingsModal(false)}>取消</Button>
          <Button onClick={saveSettings}>保存</Button>
        </div>
      </Modal>

      <Modal open={categoryModal} onClose={() => { setCategoryModal(false); setEditingCategory(null); }} title={editingCategory ? "编辑分类" : "添加分类"}>
        <Field><Label>名称 *</Label><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></Field>
        <Field className="mt-4"><Label>类型</Label><Select value={categoryForm.type} onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}>{Object.entries(TRANSACTION_TYPES).filter(([k]) => k !== "transfer").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field className="mt-4"><Label>颜色</Label><Input type="color" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} /></Field>
        {categoryForm.type === "expense" && <Field className="mt-4"><Label>月度预算</Label><Input type="number" value={categoryForm.budget} onChange={(e) => setCategoryForm({ ...categoryForm, budget: e.target.value })} /></Field>}
        <div className="flex justify-end gap-2 mt-6"><Button variant="secondary" onClick={() => { setCategoryModal(false); setEditingCategory(null); }}>取消</Button><Button onClick={saveCategory} disabled={!categoryForm.name}>{editingCategory ? "保存" : "添加"}</Button></div>
      </Modal>
      </CachedContent>
    </>
  );
}
