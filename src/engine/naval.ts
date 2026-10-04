import type {
  CombatReport,
  Fleet,
  Fort,
  GameState,
  Minefield,
  ProvinceId,
  Ship,
  Side,
} from '../core/types.ts';
import { dist, distToSegment, prov } from '../core/geo.ts';
import { GUN_BY_ID } from '../data/guns.ts';
import { SHIP_CLASSES } from '../data/ships.ts';
import { WEATHERS } from '../data/units.ts';
import { commanderMods } from './combat.ts';
import type { Rng } from './rng.ts';

/**
 * Deniz harbi: tabya düellosu, mayın hatları, mayın tarama, çıkarma desteği.
 *
 * Kampanyanın mekaniği buydu: donanma tabyaları susturmadan tarayıcıları
 * içeri sokamıyor, tarayıcılar mayınları temizlemeden zırhlılar ilerleyemiyordu.
 * 18 Mart'ta Nusret'in hattı bu döngünün dışında kaldığı için üç zırhlı battı.
 */

/**
 * KALİBRASYON — 18 Mart 1915 gerçek bilançosuna göre ayarlandı:
 *   · Bütün iç tahkimat, 10 muharebe gemisine yedi saat ateş etti.
 *   · Hiçbir gemi tabya ateşiyle BATMADI. Dördü (Inflexible, Gaulois,
 *     Suffren, Agamemnon) savaş dışı kaldı — yani ~%40-60 gövde hasarı.
 *   · Batan üç zırhlının üçü de MAYINA gitti.
 * Dolayısıyla tabya ateşi yıpratıcı ama öldürücü değil; mayın öldürücü.
 */

/** Bir tabyanın bir günde harcayabileceği mühimmat oranı. */
const FORT_DAILY_FIRE = 0.1;
/**
 * Tabya gücü biriminin günlük gövde hasarına çevrimi. İç tahkimatın toplam
 * gücü ≈ 40 birim; 40 × 0.016 ≈ 0.64 gövde/gün, 10 gemiye dağılınca gemi
 * başına ~%6 — yedi saatlik muharebede dördünün savaş dışı kalmasıyla uyumlu.
 */
const FORT_DAMAGE_PER_POWER = 0.016;
/** Tek bir geminin bir günde tabya ateşinden alabileceği azami gövde hasarı. */
const FORT_DAMAGE_CAP = 0.5;
/** Hasar normalizasyonunda referans deplasman (pre-dretnot). */
const REF_DISPLACEMENT = 13000;
/** Donanma ateşinin tabya bütünlüğüne etkisi — beton yıkmak zordur. */
const NAVAL_VS_FORT = 0.00006;
/** Donanma ateşinin tabyayı geçici bastırma etkisi — asıl işe yarayan bu. */
const NAVAL_SUPPRESS = 0.0016;
/** 100 mayınlık bir hattın içinden geçen gemi başına çarpma olasılığı. */
const MINE_BASE_RISK = 0.055;
/** Tarama düzeninde dikkatli ilerleyen filo için mayın riski çarpanı. */
const SWEEPING_MINE_RISK = 0.45;
/** Tabyaların üstüne giden filonun aldığı hasar çarpanı — 18 Mart manevrası. */
const PRESSING_DAMAGE = 2.5;
/** Bu gövde oranının altındaki gemi savaş dışıdır: ateş edemez, çekilmeli. */
export const CRIPPLED_HULL = 0.15;
/** Tabya ateşi gövdeyi bu seviyenin altına indiremez — batırmaz, sakat bırakır. */
const CRIPPLED_FLOOR = 0.05;

export function shipHp(s: Ship): number {
  return SHIP_CLASSES[s.cls].displacement * s.hull;
}

export function isCapital(s: Ship): boolean {
  return s.cls === 'dretnot' || s.cls === 'pre_dretnot' || s.cls === 'muharebe_kruvazoru';
}

/** Tabyanın etkili menzili — en uzun menzilli sağlam namlu. */
export function fortRange(f: Fort): number {
  let r = 0;
  for (const g of f.guns) {
    if (g.count <= 0) continue;
    const spec = GUN_BY_ID[g.gunId];
    if (spec && spec.range > r) r = spec.range;
  }
  return r;
}

/**
 * Tabyanın normalize ateş gücü.
 * Referans: 240 mm L/35 (215 kg mermi, 260 delme, 0.5 atış/dk) ≈ 1.0 birim.
 * Anadolu Hamidiye (2×355 + 7×240/35) ≈ 12.6; iç tahkimatın tamamı ≈ 40.
 */
export function fortPower(f: Fort): number {
  let p = 0;
  for (const g of f.guns) {
    const spec = GUN_BY_ID[g.gunId];
    if (!spec) continue;
    p +=
      g.count *
      (spec.shell / 200) *
      (spec.penetration / 150) *
      Math.max(0.3, Math.min(2, spec.rof));
  }
  return p * f.integrity * (1 - f.suppression);
}

/** Filonun ham ateş gücü. Savaş dışı gemiler ateş edemez. */
export function fleetPower(f: Fleet): number {
  let p = 0;
  for (const s of f.ships) {
    if (s.hull <= CRIPPLED_HULL) continue;
    p += SHIP_CLASSES[s.cls].gunPower * s.hull * s.ammo;
  }
  return p;
}

export function fleetSweepRate(f: Fleet): number {
  let r = 0;
  for (const s of f.ships) {
    if (s.hull <= CRIPPLED_HULL) continue;
    r += SHIP_CLASSES[s.cls].sweepRate * s.hull;
  }
  return r;
}

/** Yüzen gemiler (sakatlar dahil). */
export function liveShips(f: Fleet): Ship[] {
  return f.ships.filter((s) => s.hull > 0);
}

/** Muharebeye girebilecek gemiler — sakatlar hariç. */
export function readyShips(f: Fleet): Ship[] {
  return f.ships.filter((s) => s.hull > CRIPPLED_HULL);
}

/** Bu ildeki hedefi menzilinde tutan, ateş edebilecek tabyalar. */
export function fortsCovering(state: GameState, seaProvince: ProvinceId): Fort[] {
  const target = prov(seaProvince).center;
  return Object.values(state.forts).filter(
    (f) => f.integrity > 0.05 && f.ammo > 0 && dist(f.pos, target) <= fortRange(f),
  );
}

/** Bu ilde BUGÜN fiilen suda olan mayın hatları. */
export function minefieldsIn(state: GameState, seaProvince: ProvinceId): Minefield[] {
  return Object.values(state.minefields).filter(
    (m) => m.province === seaProvince && m.mines > 0 && m.laidOn <= state.day,
  );
}

// ─────────────────────────────────────────────────── tabya düellosu ──────

/**
 * Tabya-donanma ateşi GÜNDE BİR KEZ, TÜM harita için birlikte çözülür.
 *
 * Neden filo filo değil: bir tabyanın günlük ateş gücü sabittir. Filo başına
 * ayrı çözülürse menzile giren her filo tabyanın TAM çıktısını yer; beş filo
 * sokan taraf beş kat hasar alır. İlk sürümde tam bu oldu ve 19 Şubat'ta
 * Ark Royal ile Amethyst battı — tarihte ikisi de kampanyayı atlattı.
 * Burada her tabya ateşini menzilindeki filolara PAYLAŞTIRIR.
 */
export function resolveNavalFire(state: GameState, rng: Rng): CombatReport[] {
  const weather = WEATHERS[state.weather];

  const engaged = Object.values(state.fleets).filter((f) => liveShips(f).length > 0);
  if (engaged.length === 0) return [];

  /** fleetId -> gelen tabya hasarı (normalize güç birimi). */
  const incoming: Record<string, number> = {};
  /** fleetId -> menzilindeki düşman tabyaları. */
  const covering: Record<string, Fort[]> = {};
  for (const f of engaged) {
    incoming[f.id] = 0;
    covering[f.id] = fortsCovering(state, f.location).filter(
      (x) => sideOfFort(state, x) !== f.side,
    );
  }

  // ── Tabyalar ateş eder, menzildeki filolara paylaştırarak ──────────
  for (const fort of Object.values(state.forts)) {
    if (fort.integrity <= 0.05 || fort.ammo <= 0) continue;
    const targets = engaged.filter((f) => covering[f.id]!.includes(fort));
    if (targets.length === 0) continue;

    const spend = Math.min(fort.ammo, Math.ceil(fort.maxAmmo * FORT_DAILY_FIRE));
    fort.ammo -= spend;
    const output = fortPower(fort) * (spend / Math.max(1, fort.maxAmmo * FORT_DAILY_FIRE));

    // Yaklaşan filoya daha çok ateş ayrılır; uzaktakine daha az.
    const weights = targets.map((f) => {
      const range = dist(fort.pos, prov(f.location).center);
      const rangeFactor = Math.max(0.2, 1 - range / Math.max(1, fortRange(fort)));
      return rangeFactor * (pressingFleet(f) ? 1.6 : 1);
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    targets.forEach((f, i) => {
      incoming[f.id]! += output * (weights[i]! / total) * weather.gunnery * rng.jitter(0.3);
    });
  }

  // ── Hasarı uygula ve donanmanın karşılığını hesapla ────────────────
  const reports: CombatReport[] = [];
  for (const f of engaged) {
    const forts = covering[f.id]!;
    if (forts.length === 0) continue;

    const alive = liveShips(f);
    const pressing = pressingFleet(f);
    const mods = commanderMods(state, f.commanderId);
    const spotting = airSpottingBonus(state, f.side, f.location);
    const lines: string[] = [];
    const losses = {
      ottoman: { men: 0, ships: 0, guns: 0 },
      entente: { men: 0, ships: 0, guns: 0 },
    };

    // Donanma → tabya: beton yıkmak zor, bastırmak kolay.
    const navalFire =
      fleetPower(f) * weather.gunnery * (1 + mods.gunnery + spotting) * (pressing ? 1.45 : 1);
    const share = navalFire / forts.length;
    for (const fort of forts) {
      fort.integrity = Math.max(0, fort.integrity - share * NAVAL_VS_FORT * rng.jitter(0.35));
      fort.suppression = Math.min(0.92, fort.suppression + share * NAVAL_SUPPRESS);
      fort.spotted = true;
      if (fort.integrity <= 0.05) {
        lines.push(`${fort.name} susturuldu.`);
        losses.ottoman.guns += fort.guns.reduce((n, g) => n + g.count, 0);
      }
    }
    for (const s of alive) s.ammo = Math.max(0, s.ammo - (pressing ? 0.16 : 0.08));

    // Tabya → donanma: günlük hasar bütçesi gemilere PAYLAŞTIRILIR.
    // (İlk sürümde bütçe gemi sayısıyla çarpılıyordu; 15 tekneli tarama
    //  filosu 15 kat hasar alıp iki günde yok oluyordu.)
    const fortFire = incoming[f.id]!;
    const budget = fortFire * FORT_DAMAGE_PER_POWER * (pressing ? PRESSING_DAMAGE : 1);
    const weights = alive.map(
      (s) =>
        REF_DISPLACEMENT /
        SHIP_CLASSES[s.cls].displacement /
        (1 + SHIP_CLASSES[s.cls].armour / 150),
    );
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    alive.forEach((s, i) => {
      const hullLoss = Math.min(
        FORT_DAMAGE_CAP,
        budget * (weights[i]! / wsum) * rng.jitter(0.4),
      );
      // Kıyı topçusu zırhlı BATIRMAZ, savaş dışı bırakır. 18 Mart'ta
      // Inflexible, Gaulois, Suffren ve Agamemnon savaş dışı kaldı ama
      // hiçbiri tabya ateşiyle batmadı — batan üçünü de mayın batırdı.
      const before = s.hull;
      s.hull = Math.max(CRIPPLED_FLOOR, s.hull - hullLoss);
      if (before > CRIPPLED_HULL && s.hull <= CRIPPLED_HULL) {
        losses[f.side].ships += 1;
        lines.push(`${s.name} savaş dışı kaldı (gövde %${Math.round(s.hull * 100)}).`);
      } else if (s.hull < 0.45 && hullLoss > 0.005) {
        lines.push(`${s.name} ağır hasarlı (gövde %${Math.round(s.hull * 100)}).`);
      }
    });

    if (budget <= 0.0005 && navalFire <= 0.5) continue;

    lines.unshift(
      `${forts.length} tabya menzilde · donanma ateşi ${navalFire.toFixed(0)} · ` +
        `tabya ateşi ${fortFire.toFixed(1)} birim`,
    );
    if (spotting > 0) {
      lines.push(`Hava gözetlemesi isabeti +%${Math.round(spotting * 100)} artırdı.`);
    }

    f.inCombat = true;
    reports.push({
      id: `tabya_${f.id}_${state.day}`,
      day: state.day,
      kind: 'tabya',
      province: f.location,
      title: `${prov(f.location).name} — tabya düellosu`,
      lines,
      losses,
      winner: null,
    });
  }

  return reports;
}

/** Filo tabyaların üstüne mi gidiyor — yakın mesafe hem vurur hem yer. */
function pressingFleet(f: Fleet): boolean {
  return f.order?.kind === 'bombardiman' || f.order?.kind === 'zorla_gec';
}

function sideOfFort(state: GameState, f: Fort): Side {
  return state.provinces[f.province]?.controller ?? 'ottoman';
}

// ───────────────────────────────────────────────────────── mayınlar ──────

export interface MineResult {
  report: CombatReport | null;
  shipsSunk: Ship[];
}

/** Filo mayınlı bir ile girdiğinde her gemi için çarpma riski. */
export function resolveMines(state: GameState, fleet: Fleet, rng: Rng): MineResult {
  const fields = minefieldsIn(state, fleet.location).filter((m) => m.side !== fleet.side);
  if (fields.length === 0) return { report: null, shipsSunk: [] };

  // Tarama düzenindeki filo yavaş ve dikkatli ilerler.
  const care = fleet.order?.kind === 'mayin_tara' ? SWEEPING_MINE_RISK : 1;
  const lines: string[] = [];
  const sunk: Ship[] = [];
  const losses = {
    ottoman: { men: 0, ships: 0, guns: 0 },
    entente: { men: 0, ships: 0, guns: 0 },
  };

  for (const s of liveShips(fleet)) {
    const spec = SHIP_CLASSES[s.cls];
    for (const m of fields) {
      // Risk hattın mayın sayısıyla orantılı; 100 mayınlık hat referans.
      const risk = MINE_BASE_RISK * (m.mines / 100) * (1 - spec.mineResistance * 0.5) * care;
      if (!rng.chance(Math.min(0.5, risk))) continue;

      m.mines -= 1;
      m.spotted = true;
      const blow = (1 - spec.mineResistance) * rng.range(0.45, 1.3);
      s.hull = Math.max(0, s.hull - blow);
      if (s.hull <= 0) {
        sunk.push(s);
        losses[fleet.side].ships += 1;
        losses[fleet.side].men += Math.round(spec.crew * rng.range(0.2, 0.95));
        lines.push(
          `${s.name} ${m.name} üzerinde mayına çarptı ve battı.` +
            (s.historicalNote ? ` — ${s.historicalNote}` : ''),
        );
      } else {
        lines.push(
          `${s.name} ${m.name} üzerinde mayına çarptı; gövde %${Math.round(s.hull * 100)}.`,
        );
      }
      break; // Bir gemi bir turda tek mayın yer.
    }
  }

  if (lines.length === 0) return { report: null, shipsSunk: [] };

  return {
    report: {
      id: `mayin_${fleet.id}_${state.day}`,
      day: state.day,
      kind: 'mayin',
      province: fleet.location,
      title: `${prov(fleet.location).name} — mayın hattı`,
      lines,
      losses,
      winner: sunk.length > 0 ? (fleet.side === 'ottoman' ? 'entente' : 'ottoman') : null,
    },
    shipsSunk: sunk,
  };
}

/**
 * Mayın tarama. Tarihsel darboğaz birebir modellenmiştir:
 *   · 4 knotlık akıntı tarayıcıları yavaşlatır,
 *   · sivil mürettebatlı zırhsız balıkçı tekneleri ateş altında çalışmaz.
 * Menzildeki susturulmamış tabya varsa verim çöker.
 */
export function resolveSweeping(state: GameState, fleet: Fleet, rng: Rng): CombatReport | null {
  const rate = fleetSweepRate(fleet);
  if (rate <= 0) return null;
  const fields = minefieldsIn(state, fleet.location).filter((m) => m.side !== fleet.side);
  if (fields.length === 0) return null;

  const p = prov(fleet.location);
  const weather = WEATHERS[state.weather];
  const current = p.current ?? 0;
  // 9 knotlık tarayıcı 4 knotlık akıntıya karşı neredeyse duruyor.
  const currentFactor = Math.max(0.1, 1 - current / 5.5);

  const hostileForts = fortsCovering(state, fleet.location).filter(
    (f) => sideOfFort(state, f) !== fleet.side && f.integrity > 0.2 && f.ammo > 0,
  );
  const suppression = hostileForts.reduce((s, f) => s + (1 - f.suppression), 0);
  const nerveFactor = Math.max(0.05, 1 / (1 + suppression * 1.6));

  const mods = commanderMods(state, fleet.commanderId);
  const swept = Math.floor(
    rate * currentFactor * weather.sweeping * nerveFactor * (1 + mods.logistics) * rng.jitter(0.25),
  );

  const lines: string[] = [
    `Tarama kapasitesi ${rate.toFixed(0)} · akıntı ${current.toFixed(1)} kn (×${currentFactor.toFixed(2)})`,
  ];
  if (hostileForts.length > 0) {
    lines.push(
      `${hostileForts.length} tabya hâlâ ateş ediyor — sivil mürettebat ` +
        `çalışmıyor (×${nerveFactor.toFixed(2)})`,
    );
  }

  let total = 0;
  let left = swept;
  for (const m of fields) {
    if (left <= 0) break;
    const take = Math.min(left, m.mines);
    m.mines -= take;
    left -= take;
    total += take;
    m.spotted = true;
    if (take > 0) lines.push(`${m.name}: ${take} mayın tarandı, ${m.mines} kaldı.`);
  }
  if (total === 0) lines.push('Hiç mayın temizlenemedi.');

  return {
    id: `tarama_${fleet.id}_${state.day}`,
    day: state.day,
    kind: 'deniz',
    province: fleet.location,
    title: `${p.name} — mayın tarama`,
    lines,
    losses: {
      ottoman: { men: 0, ships: 0, guns: 0 },
      entente: { men: 0, ships: 0, guns: 0 },
    },
    winner: null,
  };
}

/**
 * Mayın dökme — Nusret mekaniği. Yeni hat düşmanın gözünden gizlidir;
 * keşif uçağı ya da tarayıcı bulana kadar haritada görünmez.
 */
export function layMines(
  state: GameState,
  fleet: Fleet,
  target: ProvinceId,
): CombatReport | null {
  const p = prov(target);
  if (!p.isSea) return null;
  const layers = liveShips(fleet).filter((s) => s.mines > 0);
  if (layers.length === 0) return null;

  let laid = 0;
  for (const s of layers) {
    laid += s.mines;
    s.mines = 0;
  }
  if (laid === 0) return null;

  const id = `hat_saha_${state.day}_${target}`;
  const c = p.center;
  const span = 1300;
  state.minefields[id] = {
    id,
    name: `Yeni Hat (${state.date})`,
    province: target,
    from: { x: c.x - span, y: c.y - span },
    to: { x: c.x + span, y: c.y + span },
    mines: laid,
    initialMines: laid,
    depth: 4.5,
    laidOn: state.day,
    side: fleet.side,
    spotted: false,
    src: 'oyun içi harekât',
  };

  return {
    id: `dokme_${fleet.id}_${state.day}`,
    day: state.day,
    kind: 'deniz',
    province: target,
    title: `${p.name} — mayın döküldü`,
    lines: [
      `${fleet.name} karanlıkta ${laid} mayın döktü.`,
      'Hat düşman tarafından henüz tespit edilmedi.',
    ],
    losses: {
      ottoman: { men: 0, ships: 0, guns: 0 },
      entente: { men: 0, ships: 0, guns: 0 },
    },
    winner: null,
  };
}

/** Hava gözetlemesinin bu ildeki deniz atışına katkısı. */
export function airSpottingBonus(
  state: GameState,
  side: Side,
  target: ProvinceId,
): number {
  let bonus = 0;
  for (const w of Object.values(state.airWings)) {
    if (w.side !== side || w.role !== 'gozetleme' || w.planes <= 0) continue;
    if (w.order?.target !== target) continue;
    bonus += 0.1 * (w.planes / Math.max(1, w.maxPlanes));
  }
  return Math.min(0.35, bonus) * WEATHERS[state.weather].flying;
}

/** Filonun kıyı iline verebileceği bombardıman desteği. */
export function navalSupportFor(
  state: GameState,
  side: Side,
  landProvince: ProvinceId,
): number {
  const p = prov(landProvince);
  let support = 0;
  for (const f of Object.values(state.fleets)) {
    if (f.side !== side) continue;
    if (!p.neighbours.includes(f.location)) continue;
    if (f.order?.kind !== 'bombardiman' && f.order?.kind !== 'cikarma_destek') continue;
    const mods = commanderMods(state, f.commanderId);
    support += fleetPower(f) * 0.22 * (1 + mods.gunnery);
  }
  return support * WEATHERS[state.weather].gunnery;
}

/** Bir mayın hattının bir noktaya uzaklığı (çizim ve tespit için). */
export function mineFieldDistance(m: Minefield, at: { x: number; y: number }): number {
  return distToSegment(at, m.from, m.to);
}

