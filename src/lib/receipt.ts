import { money } from "@/lib/format";

export type ReceiptLine = {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  vatRate: number;
};

export type ReceiptData = {
  companyName: string;
  taxOffice?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptNo: string;
  cashier: string;
  createdAt: Date;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  vatTotal: number;
  total: number;
  paidCash: number;
  paidCard: number;
  paidCredit: number;
  change: number;
  customerName?: string | null;
};

const WIDTH = 42; // 80mm termal yazıcı karakter genişliği

function center(text: string) {
  const t = text.slice(0, WIDTH);
  const pad = Math.max(0, Math.floor((WIDTH - t.length) / 2));
  return " ".repeat(pad) + t;
}

function twoCol(left: string, right: string) {
  const r = right.slice(0, WIDTH);
  const l = left.slice(0, Math.max(0, WIDTH - r.length - 1));
  return l + " ".repeat(Math.max(1, WIDTH - l.length - r.length)) + r;
}

const RULE = "-".repeat(WIDTH);

/** ESC/POS uyumlu düz metin fiş içeriği üretir. */
export function buildReceiptText(d: ReceiptData): string {
  const out: string[] = [];
  out.push(center(d.companyName.toUpperCase()));
  if (d.address) out.push(center(d.address));
  if (d.phone) out.push(center("Tel: " + d.phone));
  if (d.taxOffice || d.taxNumber)
    out.push(center(`${d.taxOffice ?? ""} ${d.taxNumber ?? ""}`.trim()));
  out.push(RULE);
  out.push(twoCol("Fiş No: " + d.receiptNo, d.createdAt.toLocaleDateString("tr-TR")));
  out.push(
    twoCol(
      "Kasiyer: " + d.cashier,
      d.createdAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    ),
  );
  if (d.customerName) out.push("Müşteri: " + d.customerName);
  out.push(RULE);
  for (const l of d.lines) {
    out.push(l.name.slice(0, WIDTH));
    out.push(twoCol(`  ${l.qty} x ${money(l.unitPrice)}  %${l.vatRate}`, money(l.total)));
  }
  out.push(RULE);
  out.push(twoCol("ARA TOPLAM", money(d.subtotal)));
  if (d.discount > 0) out.push(twoCol("İNDİRİM", "-" + money(d.discount)));
  out.push(twoCol("KDV TOPLAM", money(d.vatTotal)));
  out.push(twoCol("*** TOPLAM ***", money(d.total)));
  out.push(RULE);
  if (d.paidCash > 0) out.push(twoCol("NAKİT", money(d.paidCash)));
  if (d.paidCard > 0) out.push(twoCol("KREDİ KARTI", money(d.paidCard)));
  if (d.paidCredit > 0) out.push(twoCol("VERESİYE", money(d.paidCredit)));
  if (d.change > 0) out.push(twoCol("PARA ÜSTÜ", money(d.change)));
  out.push(RULE);
  out.push(center("Bizi tercih ettiğiniz için teşekkürler"));
  out.push(center("ZarSoft POS"));
  return out.join("\n");
}

/** ESC/POS komut baytları (yazıcıya ham gönderim için). */
export function buildEscPosBytes(d: ReceiptData): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);
  const text = (s: string) => {
    for (const ch of new TextEncoder().encode(s)) bytes.push(ch);
  };
  push(ESC, 0x40); // init
  push(ESC, 0x61, 0x01); // center
  push(ESC, 0x21, 0x30); // double size
  text(d.companyName.toUpperCase() + "\n");
  push(ESC, 0x21, 0x00);
  push(ESC, 0x61, 0x00); // left
  text(buildReceiptText(d).split("\n").slice(1).join("\n") + "\n\n\n");
  push(GS, 0x56, 0x42, 0x00); // cut
  return new Uint8Array(bytes);
}

export function printReceiptText(content: string, title = "Fiş") {
  const w = window.open("", "_blank", "width=420,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: "Courier New", monospace; font-size: 12px; white-space: pre; line-height: 1.35; }
  </style></head><body>${content.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function printHtml(html: string, title = "Yazdır") {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color:#111; padding:24px; }
    table { width:100%; border-collapse: collapse; margin-top:16px; }
    th,td { border:1px solid #ddd; padding:8px; font-size:13px; text-align:left; }
    th { background:#f3f4f6; }
    .right { text-align:right; }
    h1 { font-size:20px; margin:0 0 4px; }
    .muted { color:#666; font-size:12px; }
    .totals { margin-top:16px; width:320px; margin-left:auto; }
    .totals td { border:none; padding:4px 0; }
    .label { display:inline-block; padding:3px 10px; border-radius:999px; background:#eee; font-size:12px; }
    @media print { .no-print { display:none; } }
  </style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}
