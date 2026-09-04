import { supabase } from "@/integrations/supabase/client";
import { num } from "@/lib/format";

export type Account = {
  id: string;
  company_id: string;
  name: string;
  type: string;
  balance: number;
  is_default: boolean;
};

export type MovementSource = "pos" | "zreport" | "manual" | "expense";

/** Şirketin kasa ve banka hesaplarını getirir, yoksa oluşturur. */
export async function ensureAccounts(companyId: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("company_id", companyId)
    .order("type");
  if (error) throw error;
  const list = (data ?? []) as Account[];
  const missing: { company_id: string; name: string; type: string; is_default: boolean }[] = [];
  if (!list.some((a) => a.type === "cash"))
    missing.push({ company_id: companyId, name: "Kasa", type: "cash", is_default: true });
  if (!list.some((a) => a.type === "bank"))
    missing.push({ company_id: companyId, name: "Banka", type: "bank", is_default: true });
  if (!missing.length) return list;
  const { data: created } = await supabase.from("accounts").insert(missing).select("*");
  return [...list, ...((created ?? []) as Account[])];
}

export function pickAccount(accounts: Account[], type: "cash" | "bank"): Account | null {
  return accounts.find((a) => a.type === type && a.is_default) ?? accounts.find((a) => a.type === type) ?? null;
}

/** Hesap hareketi işler ve hesap bakiyesini günceller. */
export async function postMovement(input: {
  companyId: string;
  account: Account;
  direction: "in" | "out";
  amount: number;
  description: string;
  reference?: string | null;
  source: MovementSource;
}): Promise<number> {
  const amount = Number(num(input.amount).toFixed(2));
  if (amount <= 0) return num(input.account.balance);
  const { error } = await supabase.from("account_movements").insert({
    company_id: input.companyId,
    account_id: input.account.id,
    direction: input.direction,
    amount,
    description: input.description,
    reference: input.reference ?? null,
    source: input.source,
  });
  if (error) throw error;
  const next = Number(
    (num(input.account.balance) + (input.direction === "in" ? amount : -amount)).toFixed(2),
  );
  const { error: balErr } = await supabase
    .from("accounts")
    .update({ balance: next })
    .eq("id", input.account.id);
  if (balErr) throw balErr;
  input.account.balance = next;
  return next;
}

/** POS satışındaki nakit ve kart tutarlarını kasa/banka hesaplarına yansıtır. */
export async function postSalePayments(args: {
  companyId: string;
  accounts: Account[];
  paidCash: number;
  paidCard: number;
  receiptNo: string;
}) {
  const cashAcc = pickAccount(args.accounts, "cash");
  const bankAcc = pickAccount(args.accounts, "bank");
  if (cashAcc && args.paidCash > 0) {
    await postMovement({
      companyId: args.companyId,
      account: cashAcc,
      direction: "in",
      amount: args.paidCash,
      description: "POS nakit satış",
      reference: args.receiptNo,
      source: "pos",
    });
  }
  if (bankAcc && args.paidCard > 0) {
    await postMovement({
      companyId: args.companyId,
      account: bankAcc,
      direction: "in",
      amount: args.paidCard,
      description: "POS kart satış (banka)",
      reference: args.receiptNo,
      source: "pos",
    });
  }
}

/** Gün sonu kasa kapanışını muhasebe kaydı olarak işler (kasa farkı dahil). */
export async function postShiftClosing(args: {
  companyId: string;
  accounts: Account[];
  shiftId: string;
  difference: number;
}) {
  const cashAcc = pickAccount(args.accounts, "cash");
  if (!cashAcc) return;
  const diff = Number(num(args.difference).toFixed(2));
  const ref = `Z-${args.shiftId.slice(0, 8)}`;
  if (Math.abs(diff) >= 0.01) {
    await postMovement({
      companyId: args.companyId,
      account: cashAcc,
      direction: diff > 0 ? "in" : "out",
      amount: Math.abs(diff),
      description: diff > 0 ? "Gün sonu kasa fazlası" : "Gün sonu kasa açığı",
      reference: ref,
      source: "zreport",
    });
  } else {
    await supabase.from("account_movements").insert({
      company_id: args.companyId,
      account_id: cashAcc.id,
      direction: "in",
      amount: 0,
      description: "Gün sonu kasa kapanışı (fark yok)",
      reference: ref,
      source: "zreport",
    });
  }
}
