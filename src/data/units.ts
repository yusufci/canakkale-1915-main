import type {
  BattalionKind,
  BattalionProfile,
  DivisionTemplate,
  Terrain,
  TerrainProfile,
  Weather,
  WeatherProfile,
} from '../core/types.ts';

/**
 * Tabur profilleri. 1915 ölçeğinde: piyade taburu ≈ 800 kişi, Osmanlı alayı
 * 3 tabur, tümeni 3 alay + topçu. Entente tümenleri daha kalabalık ve çok
 * daha fazla topçuya sahipti — 12 Temmuz 1915'te üç saatte 60.000 mermi
 * attılar; Liman von Sanders'in raporu: "Düşman çok cephane, az insan
 * harcıyor. Biz pek çok insan, az cephane feda ediyoruz."
 *   https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 */
export const BATTALIONS: Readonly<Record<BattalionKind, BattalionProfile>> = {
  piyade: {
    id: 'piyade',
    name: 'Piyade Taburu',
    men: 800,
    width: 2,
    softAttack: 6,
    breakthrough: 2,
    defence: 14,
    organisation: 60,
    hp: 25,
    supplyUse: 0.6,
    guns: 0,
  },
  avci: {
    id: 'avci',
    name: 'Avcı Taburu',
    men: 700,
    width: 2,
    softAttack: 9,
    breakthrough: 4,
    defence: 12,
    organisation: 70,
    hp: 22,
    supplyUse: 0.7,
    guns: 0,
  },
  deniz_piyade: {
    id: 'deniz_piyade',
    name: 'Deniz Piyade Taburu',
    men: 750,
    width: 2,
    softAttack: 7,
    breakthrough: 3,
    defence: 11,
    organisation: 55,
    hp: 22,
    supplyUse: 0.7,
    guns: 0,
  },
  suvari: {
    id: 'suvari',
    name: 'Süvari Bölüğü',
    men: 400,
    width: 1,
    softAttack: 4,
    breakthrough: 3,
    defence: 6,
    organisation: 80,
    hp: 12,
    supplyUse: 0.5,
    guns: 0,
  },
  makineli: {
    id: 'makineli',
    name: 'Makineli Tüfek Bölüğü',
    men: 150,
    width: 1,
    softAttack: 12,
    breakthrough: 1,
    defence: 26,
    organisation: 30,
    hp: 6,
    supplyUse: 0.4,
    guns: 0,
  },
  istihkam: {
    id: 'istihkam',
    name: 'İstihkâm Bölüğü',
    men: 250,
    width: 0,
    softAttack: 2,
    breakthrough: 6,
    defence: 8,
    organisation: 40,
    hp: 8,
    supplyUse: 0.3,
    guns: 0,
  },
  sahra_topcu: {
    id: 'sahra_topcu',
    name: 'Sahra Topçu Bataryası',
    men: 220,
    width: 1,
    softAttack: 22,
    breakthrough: 8,
    defence: 5,
    organisation: 20,
    hp: 7,
    supplyUse: 1.4,
    guns: 4,
  },
  obus: {
    id: 'obus',
    name: 'Ağır Obüs Bataryası',
    men: 260,
    width: 1,
    softAttack: 34,
    breakthrough: 18,
    defence: 4,
    organisation: 15,
    hp: 7,
    supplyUse: 2.6,
    guns: 4,
  },
};

/** Tabur sayılarından tümen istatistiği topla. */
export function aggregate(t: DivisionTemplate) {
  let men = 0;
  let width = 0;
  let soft = 0;
  let brk = 0;
  let def = 0;
  let org = 0;
  let hp = 0;
  let supply = 0;
  let guns = 0;
  let count = 0;
  for (const [kind, n] of Object.entries(t.battalions) as [BattalionKind, number][]) {
    const b = BATTALIONS[kind];
    men += b.men * n;
    width += b.width * n;
    soft += b.softAttack * n;
    brk += b.breakthrough * n;
    def += b.defence * n;
    org += b.organisation * n;
    hp += b.hp * n;
    supply += b.supplyUse * n;
    guns += b.guns * n;
    count += n;
  }
  return {
    men,
    width,
    softAttack: soft,
    breakthrough: brk,
    defence: def,
    // Organizasyon tabur ORTALAMASIdır — büyük tümen daha çok org'a sahip olmaz.
    organisation: count > 0 ? org / count : 0,
    hp,
    supplyUse: supply,
    guns,
  };
}

export const TEMPLATES: readonly DivisionTemplate[] = [
  // ── Osmanlı ──────────────────────────────────────────────────────────
  {
    id: 'os_piyade_tumen',
    name: 'Osmanlı Piyade Tümeni',
    nation: 'osmanli',
    battalions: { piyade: 9, makineli: 2, sahra_topcu: 3, istihkam: 1 },
  },
  {
    id: 'os_piyade_alay',
    name: 'Osmanlı Piyade Alayı',
    nation: 'osmanli',
    battalions: { piyade: 3, makineli: 1 },
  },
  {
    id: 'os_suvari_tugay',
    name: 'Osmanlı Süvari Tugayı',
    nation: 'osmanli',
    battalions: { suvari: 6, makineli: 1 },
  },
  {
    id: 'os_agir_topcu',
    name: 'Ağır Obüs Alayı',
    nation: 'osmanli',
    battalions: { obus: 4, piyade: 1 },
  },
  // ── Alman ────────────────────────────────────────────────────────────
  {
    id: 'de_bahriye',
    name: 'Alman Bahriye Müfrezesi',
    nation: 'alman',
    battalions: { deniz_piyade: 1, makineli: 2, istihkam: 1 },
  },
  // ── İngiliz / ANZAC ──────────────────────────────────────────────────
  {
    id: 'uk_piyade_tumen',
    name: 'İngiliz Piyade Tümeni',
    nation: 'ingiliz',
    battalions: { piyade: 12, makineli: 3, sahra_topcu: 6, obus: 1, istihkam: 2 },
  },
  {
    id: 'uk_deniz_tumen',
    name: 'Kraliyet Deniz Tümeni',
    nation: 'ingiliz',
    battalions: { deniz_piyade: 9, makineli: 2, sahra_topcu: 2, istihkam: 1 },
  },
  {
    id: 'anzac_tumen',
    name: 'ANZAC Tümeni',
    nation: 'anzac',
    battalions: { avci: 9, piyade: 3, makineli: 3, sahra_topcu: 4, istihkam: 2 },
  },
  {
    id: 'hint_tugay',
    name: 'Hint Tugayı',
    nation: 'hint',
    battalions: { piyade: 4, makineli: 1, sahra_topcu: 1 },
  },
  // ── Fransız ──────────────────────────────────────────────────────────
  {
    id: 'fr_piyade_tumen',
    name: 'Fransız Piyade Tümeni',
    nation: 'fransiz',
    battalions: { piyade: 9, deniz_piyade: 2, makineli: 3, sahra_topcu: 6, istihkam: 2 },
  },
];

export const TEMPLATE_BY_ID: Readonly<Record<string, DivisionTemplate>> =
  Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/**
 * Arazi profilleri. `combatWidth` bu ilde aynı anda muharebeye girebilecek
 * azami cephe genişliğidir — Arıburnu'nun dar dereleri bir tümenden fazlasını
 * almaz, Truva Ovası tümen tümen yığmaya izin verir.
 */
export const TERRAINS: Readonly<Record<Terrain, TerrainProfile>> = {
  ova: { id: 'ova', name: 'Ova', attackMod: 0, moveCost: 1, combatWidth: 44, digInMod: 1, isSea: false },
  tepe: { id: 'tepe', name: 'Tepelik', attackMod: -0.25, moveCost: 1.4, combatWidth: 30, digInMod: 1.2, isSea: false },
  dag: { id: 'dag', name: 'Sırt / Dağ', attackMod: -0.45, moveCost: 2.2, combatWidth: 18, digInMod: 1.4, isSea: false },
  kayalik: { id: 'kayalik', name: 'Kayalık Dere', attackMod: -0.5, moveCost: 2.6, combatWidth: 14, digInMod: 1.6, isSea: false },
  bataklik: { id: 'bataklik', name: 'Bataklık / Tuzla', attackMod: -0.35, moveCost: 2.0, combatWidth: 22, digInMod: 0.5, isSea: false },
  sahil: { id: 'sahil', name: 'Sahil', attackMod: -0.2, moveCost: 1.1, combatWidth: 20, digInMod: 0.8, isSea: false },
  sehir: { id: 'sehir', name: 'Yerleşim', attackMod: -0.3, moveCost: 1.2, combatWidth: 26, digInMod: 1.5, isSea: false },
  bogaz: { id: 'bogaz', name: 'Dar Boğaz', attackMod: -0.4, moveCost: 1.6, combatWidth: 12, digInMod: 0, isSea: true },
  korfez: { id: 'korfez', name: 'Körfez', attackMod: -0.1, moveCost: 1.1, combatWidth: 28, digInMod: 0, isSea: true },
  acik_deniz: { id: 'acik_deniz', name: 'Açık Deniz', attackMod: 0, moveCost: 1, combatWidth: 60, digInMod: 0, isSea: true },
};

/**
 * Hava. 9 Mart 1915: "Sabah hava sisli, deniz durgun" — sis bombardımanı
 * durdurdu. 25 Kasım 1915: "Gece yağan yoğun yağmur önemli kayıplara yol açtı".
 */
export const WEATHERS: Readonly<Record<Weather, WeatherProfile>> = {
  acik: { id: 'acik', name: 'Açık', gunnery: 1.0, flying: 1.0, movement: 1.0, sweeping: 1.0 },
  puslu: { id: 'puslu', name: 'Puslu', gunnery: 0.6, flying: 0.3, movement: 0.95, sweeping: 0.8 },
  yagmur: { id: 'yagmur', name: 'Yağmurlu', gunnery: 0.75, flying: 0.2, movement: 0.8, sweeping: 0.7 },
  firtina: { id: 'firtina', name: 'Fırtına', gunnery: 0.35, flying: 0.0, movement: 0.6, sweeping: 0.2 },
};

/** Azami siperlenme seviyesi. */
export const MAX_ENTRENCHMENT = 8;
