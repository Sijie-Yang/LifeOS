import { Prisma } from "@prisma/client";

export const BACKUP_MODELS = Prisma.dmmf.datamodel.models;
export type BackupRows = Record<string, Record<string, unknown>[]>;
export type FullBackup = { format: "lifeos"; version: "2.0"; exportedAt: string; tables: BackupRows };

export function validateFullBackup(input: unknown): FullBackup {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("无效备份：需要 LifeOS JSON 文件");
  const body = input as Record<string, unknown>;
  if (body.format !== "lifeos" || body.version !== "2.0") throw new Error("此文件不是完整的 LifeOS 2.0 备份。旧版备份不能覆盖恢复，请先在副本中迁移。");
  if (typeof body.exportedAt !== "string" || !Number.isFinite(Date.parse(body.exportedAt))) throw new Error("备份时间无效");
  if (!body.tables || typeof body.tables !== "object" || Array.isArray(body.tables)) throw new Error("备份缺少数据表");
  let tables = body.tables as BackupRows;
  // The immediately preceding 2.0 schema had no EventTimer table. Restore its complete 57-table snapshot safely.
  if (!Object.hasOwn(tables, "EventTimer") && Object.keys(tables).length === BACKUP_MODELS.length - 1 && BACKUP_MODELS.every((m) => m.name === "EventTimer" || Array.isArray(tables[m.name]))) {
    tables = { ...tables, EventTimer: [] };
  }
  if (Object.keys(tables).length !== BACKUP_MODELS.length) throw new Error("备份表数量与当前版本不符，请使用匹配版本恢复");
  for (const model of BACKUP_MODELS) {
    const rows = tables[model.name];
    if (!Array.isArray(rows)) throw new Error(`备份缺少表：${model.name}`);
    const fields = model.fields.filter((f) => f.kind !== "object");
    const names = new Set(fields.map((f) => f.name));
    const ids = new Set<unknown>();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !row.id) throw new Error(`${model.name} 存在无效记录`);
      if (ids.has(row.id)) throw new Error(`${model.name} 存在重复 ID`);
      ids.add(row.id);
      if (Object.keys(row).some((key) => !names.has(key))) throw new Error(`${model.name} 包含当前版本不支持的字段`);
      for (const field of fields) {
        const value = row[field.name];
        if (value === undefined) throw new Error(`${model.name}.${field.name} 缺失`);
        if (value === null) { if (field.isRequired) throw new Error(`${model.name}.${field.name} 不能为空`); continue; }
        const valid = field.type === "String" ? typeof value === "string" : field.type === "Boolean" ? typeof value === "boolean" :
          field.type === "Int" ? Number.isSafeInteger(value) : field.type === "Float" ? typeof value === "number" && Number.isFinite(value) :
          field.type === "DateTime" ? typeof value === "string" && Number.isFinite(Date.parse(value)) : false;
        if (!valid) throw new Error(`${model.name}.${field.name} 类型无效`);
      }
    }
  }
  return { ...body, tables } as FullBackup;
}
