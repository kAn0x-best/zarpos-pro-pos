import { supabase } from "@/integrations/supabase/client";

export const BACKUP_TABLES = [
  "contacts",
  "products",
  "cash_shifts",
  "sales",
  "sale_items",
  "invoices",
  "invoice_items",
  "expenses",
  "transactions",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupFile = {
  format: "zarsoft-backup";
  version: 1;
  companyId: string;
  companyName: string;
  createdAt: string;
  tables: Record<string, unknown[]>;
};

export async function createBackup(companyId: string, companyName: string): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await supabase.from(t).select("*").eq("company_id", companyId);
    if (error) throw new Error(`${t}: ${error.message}`);
    tables[t] = data ?? [];
  }
  return {
    format: "zarsoft-backup",
    version: 1,
    companyId,
    companyName,
    createdAt: new Date().toISOString(),
    tables,
  };
}

export function backupRowCount(file: BackupFile): number {
  return Object.values(file.tables).reduce((a, r) => a + (r?.length ?? 0), 0);
}

export type BackupVerification = { ok: boolean; rows: number; issues: string[] };

/** Yedek dosyasının gerçekten bu şirketin verisini içerdiğini doğrular. */
export function verifyBackup(file: BackupFile, companyId: string): BackupVerification {
  const issues: string[] = [];
  if (file.companyId !== companyId) issues.push("Yedek başka bir şirkete ait.");
  for (const t of BACKUP_TABLES) {
    const rows = (file.tables[t] ?? []) as Record<string, unknown>[];
    if (!Array.isArray(file.tables[t])) {
      issues.push(`${t}: tablo eksik.`);
      continue;
    }
    const foreign = rows.filter((r) => r["company_id"] && r["company_id"] !== companyId).length;
    if (foreign > 0) issues.push(`${t}: ${foreign} kayıt farklı şirkete ait.`);
  }
  return { ok: issues.length === 0, rows: backupRowCount(file), issues };
}


export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (parsed?.format !== "zarsoft-backup" || !parsed.tables) {
    throw new Error("Geçersiz yedek dosyası.");
  }
  return parsed;
}

/** Yedeği geri yükler: satırlar mevcut şirkete upsert edilir (id çakışmaları güncellenir). */
export async function restoreBackup(file: BackupFile, companyId: string) {
  const report: { table: string; inserted: number; error?: string }[] = [];
  for (const t of BACKUP_TABLES) {
    const rows = (file.tables[t] ?? []) as Record<string, unknown>[];
    if (!rows.length) {
      report.push({ table: t, inserted: 0 });
      continue;
    }
    const mapped = rows.map((r) => ({ ...r, company_id: companyId }));
    const { error } = await supabase.from(t).upsert(mapped as never, { onConflict: "id" });
    report.push({ table: t, inserted: error ? 0 : mapped.length, ...(error ? { error: error.message } : {}) });
  }
  return report;
}
