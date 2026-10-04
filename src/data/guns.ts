import type { GunProfile } from '../core/types.ts';

/**
 * Çanakkale Müstahkem Mevki topçusu.
 *
 * Kaynak: Piotr Nykiel, "Naval Operations in the Dardanelles 1915"
 *   https://www.navyingallipoli.com/Artillery_Heavy.asp
 *   https://www.navyingallipoli.com/Artillery_Field.asp
 * Menziller kaynaktaki "yeni tip mermi" değerleridir; eski tip mermi menzili
 * `oldRange` olarak not düşülmüştür — 1915'te stokun büyük kısmı eski tipti.
 *
 * `penetration` ve `rof` değerleri kaynakta verilmediği için namlu uzunluğu
 * (L/kalibre) ve mermi ağırlığından türetilmiş OYUN değerleridir.
 */

export interface DardanellesGun extends GunProfile {
  /** Eski tip mermiyle menzil (m) — mühimmat kıtlığında kullanılan. */
  readonly oldRange?: number;
  /** Tarihsel not. */
  readonly note?: string;
  readonly src: string;
}

const NYKIEL_HEAVY = 'https://www.navyingallipoli.com/Artillery_Heavy.asp';
const NYKIEL_FIELD = 'https://www.navyingallipoli.com/Artillery_Field.asp';

export const GUNS: readonly DardanellesGun[] = [
  {
    id: 'krupp_355_35',
    name: '355 mm L/35 Krupp istihkâm topu',
    calibre: 355,
    range: 16900,
    oldRange: 10800,
    shell: 725,
    penetration: 420,
    rof: 0.25,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_280_22',
    name: '280 mm L/22 Krupp istihkâm topu',
    calibre: 280,
    range: 8000,
    oldRange: 7600,
    shell: 233.5,
    penetration: 180,
    rof: 0.4,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_260_22',
    name: '260 mm L/22 Krupp istihkâm topu',
    calibre: 260,
    range: 7800,
    oldRange: 7400,
    shell: 200,
    penetration: 160,
    rof: 0.4,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_240_35',
    name: '240 mm L/35 Krupp istihkâm topu',
    calibre: 240,
    range: 14800,
    oldRange: 11000,
    shell: 215,
    penetration: 260,
    rof: 0.5,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_240_22',
    name: '240 mm L/22 Krupp istihkâm topu',
    calibre: 240,
    range: 7200,
    shell: 180,
    penetration: 140,
    rof: 0.5,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_210_22',
    name: '210 mm L/22 Krupp istihkâm topu',
    calibre: 210,
    range: 6800,
    shell: 120,
    penetration: 110,
    rof: 0.6,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_210_64_havan',
    name: '210 mm L/6.4 havan',
    calibre: 210,
    range: 3500,
    shell: 91,
    penetration: 40,
    rof: 0.8,
    src: 'https://www.navyingallipoli.com/Fort_Asian_Mecidiye.asp',
  },
  {
    id: 'vickers_150_45',
    name: '150 mm L/45 Vickers deniz topu',
    calibre: 150,
    range: 12000,
    shell: 45.4,
    penetration: 150,
    rof: 5,
    note: 'Mesudiye zırhlısından sökülüp Rumeli Mesudiye Bataryasına konuldu.',
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_150_40',
    name: '150 mm L/40 deniz topu',
    calibre: 150,
    range: 11000,
    shell: 45,
    penetration: 140,
    rof: 5,
    src: 'https://www.navyingallipoli.com/Fort_Asian_Dardanos.asp',
  },
  {
    id: 'krupp_150_26',
    name: '150 mm L/26 Krupp istihkâm topu',
    calibre: 150,
    range: 7000,
    shell: 35.5,
    penetration: 70,
    rof: 3,
    src: NYKIEL_HEAVY,
  },
  {
    id: 'krupp_87_24',
    name: '87 mm L/24 (takviyeli namlu)',
    calibre: 87,
    range: 4500,
    shell: 6.8,
    penetration: 25,
    rof: 6,
    src: 'https://www.navyingallipoli.com/Fort_Bolayir_Ay.asp',
  },
  {
    id: 'krupp_90',
    name: '90 mm Krupp topu',
    calibre: 90,
    range: 5000,
    shell: 7.5,
    penetration: 28,
    rof: 6,
    src: 'https://www.navyingallipoli.com/Fort_Bolayir_Merkez.asp',
  },
  {
    id: 'aa_37',
    name: '37 mm uçaksavar',
    calibre: 37,
    range: 2000,
    shell: 0.5,
    penetration: 5,
    rof: 60,
    src: 'https://www.navyingallipoli.com/Fort_Asian_Orhaniye.asp',
  },
  // ── Hareketli obüs ve sahra bataryaları ────────────────────────────────
  {
    id: 'skoda_149_20',
    name: '149,1 mm L/20 Škoda M.14 obüsü',
    calibre: 149.1,
    range: 9800,
    shell: 42,
    penetration: 60,
    rof: 2,
    src: NYKIEL_FIELD,
  },
  {
    id: 'krupp_150_17_obus',
    name: '150 mm L/17 Krupp obüsü',
    calibre: 150,
    range: 8500,
    shell: 42,
    penetration: 55,
    rof: 2,
    src: NYKIEL_FIELD,
  },
  {
    id: 'krupp_120_obus',
    name: '120 mm obüs',
    calibre: 120,
    range: 6500,
    shell: 20,
    penetration: 35,
    rof: 3,
    src: NYKIEL_FIELD,
  },
  {
    id: 'krupp_77_27',
    name: '77 mm L/27 Krupp sahra topu',
    calibre: 77,
    range: 4000,
    shell: 6.8,
    penetration: 20,
    rof: 8,
    src: NYKIEL_FIELD,
  },
  {
    id: 'krupp_75_30',
    name: '75 mm L/30 Krupp sahra topu',
    calibre: 75,
    range: 8000,
    shell: 6.35,
    penetration: 22,
    rof: 10,
    src: NYKIEL_FIELD,
  },
  {
    id: 'schneider_65_20',
    name: '65 mm L/20 Fransız dağ topu',
    calibre: 65,
    range: 3500,
    shell: 4.4,
    penetration: 12,
    rof: 10,
    src: NYKIEL_FIELD,
  },
];

export const GUN_BY_ID: Readonly<Record<string, DardanellesGun>> = Object.fromEntries(
  GUNS.map((g) => [g.id, g]),
);
