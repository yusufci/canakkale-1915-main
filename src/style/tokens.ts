/**
 * Görsel dil — @destanevreni'nin Çanakkale 1915 harita animasyonundan
 * birebir örneklenmiştir (ffmpeg kare örneklemesi, bkz. tools/README.md).
 *
 * Örneklenen kareler: t=35s (Nusret), t=75s (18 Mart), t=110s (final).
 */

export const C = {
  /** Sahne zemini — saf siyah. */
  void: 0x000000,
  /** Deniz. Örnek: #030810 (t=75 en sık deniz pikseli). */
  sea: 0x030810,
  seaDeep: 0x02060d,
  /** Sisli / görülmemiş deniz. */
  seaFog: 0x01040a,

  /** Kara — aydınlatılmamış (sis altında / uzak). Örnek: #19150f */
  land: 0x1a1610,
  /** Kara — normal. Örnek: #372a15 */
  landMid: 0x372a15,
  /** Kara — vurgulu / seçili. Örnek: #57411b (final karesi) */
  landLit: 0x57411b,

  /** Kıyı çizgisi — sönük amber. */
  coast: 0xd9a441,
  /** Ana vurgu rengi. Örnek: #ffc354 — videonun imza sarısı. */
  accent: 0xffc354,
  accentDim: 0x8a6a2e,
  accentGlow: 0xffd98a,

  /** Mayın işareti. Örnek: #e05547 / #e45443 */
  mine: 0xe4544a,
  mineDim: 0x7a2a24,
  /** Düşman / tehlike dolgusu (taranmış çokgen). */
  hostile: 0xc23b2e,

  /** Gemi gövdesi. Örnek: #586d90 */
  ship: 0x5d7296,
  shipLight: 0xa8c2e4,
  /** Projektör hüzmesi. Örnek: #34393f */
  searchlight: 0x34393f,

  /** Osmanlı tarafı. */
  ottoman: 0xd94f3d,
  ottomanDim: 0x5c231c,
  /** İtilaf tarafı. */
  entente: 0x6e8fc0,
  ententeDim: 0x25384f,

  text: 0xe8e2d4,
  textDim: 0x8b8578,
  textFaint: 0x4a4740,
  panel: 0x07080a,
  panelEdge: 0x1d1c17,

  good: 0x7fc08a,
  warn: 0xe0a33c,
  bad: 0xd9513f,
} as const;

/** CSS tarafı için `#rrggbb`. */
export function css(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function rgba(c: number, a: number): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

export const FONT = {
  /** Harita etiketleri, sayılar, tüm veri — videodaki mono dil. */
  mono: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, 'Cascadia Mono', 'Menlo', monospace",
  /** Başlıklar — videodaki kalın grotesk. */
  display: "'Archivo', 'Inter', 'Helvetica Neue', system-ui, sans-serif",
} as const;

/** Harita katman sırası (Pixi container zIndex). */
export const LAYER = {
  relief: 10,
  sea: 20,
  provinceFill: 30,
  provinceEdge: 40,
  supply: 45,
  coast: 50,
  minefield: 60,
  frontline: 65,
  fort: 70,
  unit: 80,
  path: 85,
  label: 90,
  overlay: 100,
} as const;
