import type { Metadata } from "next";
import { RootShell } from "@/components/layout/RootShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeOS — 个人管理系统",
  description: "联系人、项目、习惯打卡与时间表 — 让习惯驱动项目落地",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <RootShell>{children}</RootShell>
      </body>
    </html>
  );
}
