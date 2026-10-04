import type {
  Fleet,
  GameState,
  LandOrderKind,
  LandUnit,
  NavalOrderKind,
  ProvinceId,
  Side,
} from '../core/types.ts';
import { findPath, prov } from '../core/geo.ts';
import { fleetSweepRate, liveShips } from './naval.ts';

/**
 * Oyuncu emirleri. Her emir için "verilebilir mi" kontrolü ayrı bir fonksiyon
 * olarak dışa açık — arayüz menüyü buna göre kısıtlar, motor da aynı kuralı
 * uygular, iki yerde ayrışmaz.
 */

export interface OrderOption<K> {
  readonly kind: K;
  readonly label: string;
  readonly hint: string;
  /** Hedef il gerektiriyor mu. */
  readonly needsTarget: boolean;
  readonly enabled: boolean;
  readonly why?: string;
}

export function landOrderOptions(
  state: GameState,
  u: LandUnit,
): readonly OrderOption<LandOrderKind>[] {
  const here = prov(u.location);
  const enemyAdjacent = here.neighbours.some((n) => {
    const st = state.provinces[n];
    return !prov(n).isSea && st?.controller && st.controller !== u.side;
  });
  const embarked = u.embarkedIn !== null && u.embarkedIn !== 'bekleme';
  const fresh = u.organisation > u.maxOrganisation * 0.3;

  return [
    {
      kind: 'bekle',
      label: 'Bekle',
      hint: 'Birlik yerinde kalır, organizasyonunu toparlar.',
      needsTarget: false,
      enabled: !embarked,
    },
    {
      kind: 'siperlen',
      label: 'Siperlen',
      hint: 'Hızlı siperlenir; savunma her seviyede +%6.',
      needsTarget: false,
      enabled: !embarked,
    },
    {
      kind: 'yuru',
      label: 'Yürü',
      hint: 'Dost ya da boş iller üzerinden hedefe yürür.',
      needsTarget: true,
      enabled: !embarked,
    },
    {
      kind: 'taarruz',
      label: 'Taarruz',
      hint: 'Komşu düşman iline saldırır. Siperini kaybeder.',
      needsTarget: true,
      enabled: !embarked && enemyAdjacent && fresh,
      ...(embarked
        ? { why: 'Birlik gemide.' }
        : !enemyAdjacent
          ? { why: 'Komşuda düşman yok.' }
          : !fresh
            ? { why: 'Organizasyon taarruz için yetersiz.' }
            : {}),
    },
    {
      kind: 'cikarma',
      label: 'Karaya Çık',
      hint: 'Gemideki birliği sahile çıkarır. Savunan ateşi altında kayıp verir.',
      needsTarget: true,
      enabled: embarked,
      ...(embarked ? {} : { why: 'Birlik gemide değil.' }),
    },
  ];
}

export function navalOrderOptions(
  state: GameState,
  f: Fleet,
): readonly OrderOption<NavalOrderKind>[] {
  const canSweep = fleetSweepRate(f) > 0;
  const canLay = liveShips(f).some((s) => s.mines > 0);
  const alive = liveShips(f).length > 0;
  const coastal = prov(f.location).neighbours.some((n) => !prov(n).isSea);
  // Burada yalnızca BİLİNEN hatlar sayılır: tespit edilmemiş hat için tarama
  // emri verilemez — oyuncu Nusret'in hattını göremediği için tarayamaz.
  const knownMines = Object.values(state.minefields).some(
    (m) => m.province === f.location && m.mines > 0 && m.spotted && m.side !== f.side,
  );

  return [
    {
      kind: 'demirle',
      label: 'Demirle',
      hint: 'Filo yerinde kalır; mühimmat ikmali yapar.',
      needsTarget: false,
      enabled: alive,
    },
    {
      kind: 'seyret',
      label: 'Seyret',
      hint: 'Deniz illeri üzerinden hedefe gider. Mayın riski vardır.',
      needsTarget: true,
      enabled: alive,
    },
    {
      kind: 'zorla_gec',
      label: 'Boğazı Zorla',
      hint:
        'Tabya ateşi altında ilerler. Her ilde hem mayın hem tabya düellosu ' +
        'yaşanır — 18 Mart manevrası.',
      needsTarget: true,
      enabled: alive,
    },
    {
      kind: 'bombardiman',
      label: 'Bombardıman',
      hint: 'Menzildeki tabyaları döver. Yakına sokulur, daha çok ateş yer.',
      needsTarget: false,
      enabled: alive && coastal,
      ...(coastal ? {} : { why: 'Menzilde kıyı yok.' }),
    },
    {
      kind: 'mayin_tara',
      label: 'Mayın Tara',
      hint:
        'Mayın temizler. Akıntı ve susturulmamış tabyalar verimi düşürür — ' +
        'sivil mürettebat ateş altında çalışmaz.',
      needsTarget: false,
      enabled: alive && canSweep && knownMines,
      ...(!canSweep
        ? { why: 'Filoda tarayıcı yok.' }
        : !knownMines
          ? { why: 'Bu ilde bilinen mayın hattı yok.' }
          : {}),
    },
    {
      kind: 'mayin_dok',
      label: 'Mayın Dök',
      hint: 'Gece mayın döker. Yeni hat düşman tarafından görülmez.',
      needsTarget: false,
      enabled: alive && canLay,
      ...(canLay ? {} : { why: 'Gemilerde mayın kalmadı.' }),
    },
    {
      kind: 'cikarma_destek',
      label: 'Çıkarma Desteği',
      hint: 'Komşu sahile çıkan birliklere topçu şemsiyesi açar.',
      needsTarget: false,
      enabled: alive && coastal,
      ...(coastal ? {} : { why: 'Menzilde kıyı yok.' }),
    },
  ];
}

export function issueLandOrder(
  state: GameState,
  unitId: string,
  kind: LandOrderKind,
  target: ProvinceId | null,
): string | null {
  const u = state.landUnits[unitId];
  if (!u) return 'Birlik bulunamadı.';
  const opt = landOrderOptions(state, u).find((o) => o.kind === kind);
  if (!opt?.enabled) return opt?.why ?? 'Bu emir verilemez.';

  if (kind === 'yuru') {
    if (!target) return 'Hedef il seçilmedi.';
    const path = findPath(
      u.location,
      target,
      (id) =>
        !prov(id).isSea &&
        (state.provinces[id]?.controller === u.side || state.provinces[id]?.controller == null),
    );
    if (!path) return 'Dost topraklardan hedefe yol yok.';
    u.order = { kind, target, path };
    return null;
  }
  if (kind === 'taarruz') {
    if (!target) return 'Hedef il seçilmedi.';
    if (!prov(u.location).neighbours.includes(target)) return 'Hedef komşu değil.';
    if (state.provinces[target]?.controller === u.side) return 'Burası zaten bizim.';
    u.order = { kind, target, path: [] };
    return null;
  }
  if (kind === 'cikarma') {
    if (!target) return 'Sahil seçilmedi.';
    const beach = prov(target);
    if (beach.isSea) return 'Hedef kara olmalı.';
    const fleet = Object.values(state.fleets).find((f) => f.id === u.embarkedIn);
    if (!fleet) return 'Birliğin bindiği filo bulunamadı.';
    if (!beach.neighbours.includes(fleet.location)) {
      return 'Filo bu sahile bitişik değil.';
    }
    u.order = { kind, target, path: [] };
    return null;
  }
  u.order = { kind, target: null, path: [] };
  return null;
}

export function issueNavalOrder(
  state: GameState,
  fleetId: string,
  kind: NavalOrderKind,
  target: ProvinceId | null,
): string | null {
  const f = state.fleets[fleetId];
  if (!f) return 'Filo bulunamadı.';
  const opt = navalOrderOptions(state, f).find((o) => o.kind === kind);
  if (!opt?.enabled) return opt?.why ?? 'Bu emir verilemez.';

  if (kind === 'seyret' || kind === 'zorla_gec') {
    if (!target) return 'Hedef seçilmedi.';
    if (!prov(target).isSea) return 'Hedef deniz ili olmalı.';
    const path = findPath(f.location, target, (id) => prov(id).isSea);
    if (!path) return 'Denizden hedefe yol yok.';
    f.order = { kind, target, path };
    return null;
  }
  f.order = { kind, target: target ?? f.location, path: [] };
  return null;
}

/** Bir birliği filoya bindir (çıkarma hazırlığı). */
export function embark(state: GameState, unitId: string, fleetId: string): string | null {
  const u = state.landUnits[unitId];
  const f = state.fleets[fleetId];
  if (!u || !f) return 'Birlik ya da filo yok.';
  if (u.side !== f.side) return 'Farklı taraflar.';
  if (!prov(u.location).neighbours.includes(f.location)) return 'Filo bitişik değil.';
  u.embarkedIn = f.id;
  u.order = null;
  if (!f.embarked.includes(u.id)) f.embarked.push(u.id);
  return null;
}

/** Oyuncunun kontrol ettiği birimler. */
export function playerUnits(state: GameState): {
  land: LandUnit[];
  fleets: Fleet[];
} {
  const side: Side = state.playerSide;
  return {
    land: Object.values(state.landUnits).filter(
      (u) => u.side === side && u.strength > 0 && u.embarkedIn !== 'bekleme',
    ),
    fleets: Object.values(state.fleets).filter(
      (f) => f.side === side && liveShips(f).length > 0,
    ),
  };
}
