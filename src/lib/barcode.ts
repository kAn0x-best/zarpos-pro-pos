// EAN-13 barkod üretimi ve SVG çizimi

const FIRST_DIGIT_PATTERN = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const R = L.map((s) =>
  s
    .split("")
    .map((c) => (c === "0" ? "1" : "0"))
    .join(""),
);

export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** Şirket + zaman tabanlı benzersiz EAN-13 barkod üretir (868 = dahili prefix). */
export function generateEan13(seed?: string): string {
  const base = seed ?? String(Date.now());
  const digits = base.replace(/\D/g, "").slice(-9).padStart(9, "0");
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  const first12 = ("868" + digits + rand).slice(0, 12);
  return first12 + ean13CheckDigit(first12);
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

function ean13Bits(code: string): string {
  const first = Number(code[0]);
  const pattern = FIRST_DIGIT_PATTERN[first] ?? FIRST_DIGIT_PATTERN[0]!;
  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    const d = Number(code[i]);
    bits += pattern[i - 1] === "L" ? L[d]! : G[d]!;
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])]!;
  bits += "101";
  return bits;
}

/** Barkodu SVG string olarak döndürür. Geçersiz kodlarda basit Code39-benzeri fallback yerine metin döner. */
export function barcodeSvg(code: string, opts?: { height?: number; width?: number }): string {
  const height = opts?.height ?? 60;
  const moduleW = opts?.width ?? 2;
  if (!isValidEan13(code)) {
    const w = Math.max(120, code.length * 10);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}"><text x="${w / 2}" y="${height / 2 + 5}" text-anchor="middle" font-family="monospace" font-size="14">${code}</text></svg>`;
  }
  const bits = ean13Bits(code);
  const w = bits.length * moduleW;
  const totalH = height + 16;
  let rects = "";
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") rects += `<rect x="${i * moduleW}" y="0" width="${moduleW}" height="${height}" fill="#000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${totalH}" viewBox="0 0 ${w} ${totalH}"><rect width="${w}" height="${totalH}" fill="#fff"/>${rects}<text x="${w / 2}" y="${totalH - 2}" text-anchor="middle" font-family="monospace" font-size="12" letter-spacing="2">${code}</text></svg>`;
}

export function barcodeDataUri(code: string, opts?: { height?: number; width?: number }): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(barcodeSvg(code, opts))}`;
}
