import { parseTags, stringifyTags, tagsFromInput, tagsToInput } from "@/lib/tags";

/** Split raw DB/UI value: JSON array, comma list, or plain string. */
export function splitPlaceTokens(raw: string | string[] | null | undefined): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((t) => String(t).trim()).filter(Boolean);
    }
  } catch {
    /* comma-separated legacy */
  }
  return tagsFromInput(text);
}

function buildAliasMap(groups: Record<string, string[]>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(groups)) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
}

/**
 * Same-meaning org names → one canonical Chinese/common label.
 * A small, generic starter set of widely known universities — extend it for your own network.
 */
const INSTITUTION_ALIASES = buildAliasMap({
  清华大学: ["清华", "Tsinghua", "Tsinghua University"],
  北京大学: ["北大", "Peking University", "PKU"],
  浙江大学: ["浙大", "ZJU", "Zhejiang University"],
  复旦大学: ["复旦", "Fudan", "Fudan University"],
  上海交通大学: ["上海交大", "SJTU", "Shanghai Jiao Tong University"],
  同济大学: ["同济", "Tongji", "Tongji University"],
  南京大学: ["南大", "NJU", "Nanjing University"],
  武汉大学: ["武大", "WHU", "Wuhan University"],
  中山大学: ["中大", "SYSU", "Sun Yat-sen University"],
  NUS: ["National University of Singapore", "新加坡国立大学", "N.U.S."],
  NTU: ["Nanyang Technological University", "南洋理工大学"],
  HKU: ["Hong Kong University", "University of Hong Kong", "香港大学"],
  CUHK: ["Chinese University of Hong Kong", "香港中文大学"],
  HKUST: ["Hong Kong University of Science and Technology", "香港科技大学"],
  MIT: ["Massachusetts Institute of Technology", "麻省理工"],
  Stanford: ["Stanford University", "斯坦福大学"],
  Harvard: ["Harvard University", "哈佛大学"],
  Caltech: ["CalTech", "California Institute of Technology"],
  Oxford: ["University of Oxford", "牛津大学"],
  Cambridge: ["University of Cambridge", "剑桥大学"],
  UCL: ["University College London", "伦敦大学学院"],
  ETH: ["ETH Zurich", "ETH Zürich", "Swiss Federal Institute of Technology"],
  "University of Tokyo": ["UTokyo", "东京大学"],
});

/** Same-meaning city/region names → one canonical label (generic starter set). */
const CITY_ALIASES = buildAliasMap({
  新加坡: ["Singapore", "SG", "S’pore", "S'pore"],
  香港: ["Hong Kong", "HK", "HongKong"],
  伦敦: ["London"],
  纽约: ["New York", "NYC"],
  旧金山: ["San Francisco", "SF"],
  东京: ["Tokyo"],
  首尔: ["Seoul"],
  巴黎: ["Paris"],
  柏林: ["Berlin"],
  美国: ["US", "USA", "United States", "America"],
  英国: ["UK", "United Kingdom"],
  北京: ["Beijing"],
  上海: ["Shanghai"],
  广州: ["Guangzhou"],
  深圳: ["Shenzhen"],
  杭州: ["Hangzhou"],
  成都: ["Chengdu"],
  武汉: ["Wuhan"],
  南京: ["Nanjing"],
  中国: ["China", "PRC"],
});

function normalizeWithMap(token: string, map: Map<string, string>): string {
  const trimmed = token.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return map.get(trimmed.toLowerCase()) || trimmed;
}

export function normalizeInstitution(token: string): string {
  return normalizeWithMap(token, INSTITUTION_ALIASES);
}

export function normalizeCity(token: string): string {
  return normalizeWithMap(token, CITY_ALIASES);
}

function uniqueNormalized(tokens: string[], normalize: (t: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const n = normalize(token);
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

export function parseInstitutions(raw: string | string[] | null | undefined): string[] {
  return uniqueNormalized(splitPlaceTokens(raw), normalizeInstitution);
}

export function parseCities(raw: string | string[] | null | undefined): string[] {
  return uniqueNormalized(splitPlaceTokens(raw), normalizeCity);
}

/** Merge institution + company legacy fields into normalized org tags. */
export function mergeInstitutionSources(
  institution: string | string[] | null | undefined,
  company?: string | string[] | null | undefined
): string[] {
  return uniqueNormalized(
    [...splitPlaceTokens(institution), ...splitPlaceTokens(company ?? null)],
    normalizeInstitution
  );
}

export function stringifyInstitutions(tags: string[]): string {
  return stringifyTags(uniqueNormalized(tags, normalizeInstitution));
}

export function stringifyCities(tags: string[]): string {
  return stringifyTags(uniqueNormalized(tags, normalizeCity));
}

export function institutionsToInput(raw: string | string[] | null | undefined): string {
  return tagsToInput(parseInstitutions(raw));
}

export function citiesToInput(raw: string | string[] | null | undefined): string {
  return tagsToInput(parseCities(raw));
}

export function institutionsFromInput(input: string): string[] {
  return uniqueNormalized(tagsFromInput(input), normalizeInstitution);
}

export function citiesFromInput(input: string): string[] {
  return uniqueNormalized(tagsFromInput(input), normalizeCity);
}

/** Display helpers */
export function formatPlaceTags(tags: string[]): string {
  return tags.join(" · ");
}

/** Accept API body values (array | comma string | JSON string). */
export function coerceInstitutionField(
  value: unknown,
  companyFallback?: unknown
): string | null {
  const fromValue = Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value
      : null;
  const fromCompany =
    companyFallback === undefined
      ? null
      : Array.isArray(companyFallback)
        ? companyFallback.map(String)
        : typeof companyFallback === "string"
          ? companyFallback
          : null;
  const tags = mergeInstitutionSources(fromValue, fromCompany);
  return tags.length ? stringifyInstitutions(tags) : null;
}

export function coerceCityField(value: unknown): string | null {
  const raw = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value : null;
  const tags = parseCities(raw);
  return tags.length ? stringifyCities(tags) : null;
}

/** For API responses that still expose legacy string fields as JSON storage. */
export function enrichContactPlaces<T extends { institution?: string | null; city?: string | null; company?: string | null }>(
  contact: T
): T & { institutions: string[]; cities: string[] } {
  return {
    ...contact,
    institutions: parseInstitutions(contact.institution),
    cities: parseCities(contact.city),
  };
}

// Re-export parseTags usage safety for callers that only need places
export { parseTags };
