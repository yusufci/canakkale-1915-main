import type { Fleet, GameState, LandUnit, ProvinceId, Side } from '../core/types.ts';
import { MAP, findPath, prov } from '../core/geo.ts';
import { fleetSweepRate, fortsCovering, liveShips, minefieldsIn } from './naval.ts';
import { effective } from './combat.ts';
import { dayOf } from './scenario.ts';
import type { Rng } from './rng.ts';

/**
 * Karşı taraf yapay zekâsı.
 *
 * Tasarım: tarihsel senaryoyu taklit eden, ama körü körüne takip etmeyen bir
 * "niyet" makinesi. İtilaf önce boğazı donanmayla zorlar; tarayıcılar
 * ilerleyemez ve ağır kayıp verirse kara harekâtına geçer. Osmanlı tarafı
 * tehdit altındaki kıyıya ihtiyat kaydırır ve mayın döker.
 */

const LANDING_DAY = dayOf('1915-04-25');

/**
 * Üsse çekilip onarılan filolar. Histerezis için gerekli: %55'in altında
 * çekilir, %92'ye kadar geri dönmez — aksi halde filo eşikte gidip gelir.
 */
const REPAIRING = new Set<string>();

/**
 * Seçilmiş çıkarma sahili. Her filo için yeniden kura çekilirse nakliye
 * filosu bir sahile, destek filosu başkasına gider ve çıkarma hiç olmaz;
 * harekât hedefi bir kez seçilip sahil alınana kadar korunur.
 */
let committedBeach: ProvinceId | null = null;

/** Filonun muharebe gemilerinin ortalama gövde sağlığı. */
function fleetHealth(f: Fleet): number {
  const ships = liveShips(f);
  if (ships.length === 0) return 0;
  return ships.reduce((n, s) => n + s.hull, 0) / ships.length;
}

/** İtilaf'ın hedeflediği boğaz ekseni — güneyden Marmara'ya. */
const STRAIT_AXIS: readonly ProvinceId[] = [
  'd_bogaz_agzi',
  'd_erenkoy',
  'd_kepez',
  'd_sarisiglar',
  'd_dar_bogaz',
  'd_nagara',
  'd_marmara_agzi',
];

/** İtilaf'ın çıkarma yapmayı deneyeceği sahiller. */
const BEACHES: readonly ProvinceId[] = [
  'seddulbahir',
  'morto',
  'tekke_burnu',
  'ariburnu',
  'kabatepe',
  'suvla',
  'kumkale',
];

export function planAi(state: GameState, rng: Rng): void {
  const ai: Side = state.playerSide === 'ottoman' ? 'entente' : 'ottoman';
  if (ai === 'entente') planEntente(state, rng);
  else planOttoman(state, rng);
}

// ─────────────────────────────────────────────────────── İTİLAF ────────

function planEntente(state: GameState, rng: Rng): void {
  const fleets = Object.values(state.fleets).filter(
    (f) => f.side === 'entente' && liveShips(f).length > 0,
  );
  const lostCapitals = countLostCapitals(state);
  // Üç büyük gemi kaybından sonra donanma ihtiyatlı davranır (18 Mart dersi).
  const navalPhase = lostCapitals < 3 && state.day < LANDING_DAY;

  // Harekât hedefi tur başında BİR KEZ seçilir ve alınana kadar korunur.
  if (
    committedBeach === null ||
    state.provinces[committedBeach]?.controller === 'entente'
  ) {
    committedBeach = pickBeach(state, rng);
  }
  const beach = committedBeach;
  const landingSea = beach ? landingWaterFor(beach) : undefined;

  for (const f of fleets) {
    if (f.order && f.order.path.length > 0) continue;

    // ── Yıpranan filo üsse çekilir ──
    // İlk sürümde filo ateş altında demirli kalıp haftalar içinde eriyordu.
    // Tarihsel davranış: hasarlı gemi Mudros'a döner, onarılır, geri gelir.
    const health = fleetHealth(f);
    const repairing = REPAIRING.has(f.id);
    if (health < 0.55 || (repairing && health < 0.92)) {
      REPAIRING.add(f.id);
      const base = 'd_ege_acik';
      if (f.location === base) {
        f.order = { kind: 'demirle', target: null, path: [] };
      } else {
        const path = seaPath(state, f.location, base);
        f.order = path
          ? { kind: 'seyret', target: base, path }
          : { kind: 'demirle', target: null, path: [] };
      }
      continue;
    }
    REPAIRING.delete(f.id);

    const sweepers = fleetSweepRate(f) > 4;
    if (sweepers) {
      // Tarayıcılar en güneydeki mayınlı ile gider.
      const target = STRAIT_AXIS.find((id) => minefieldsIn(state, id).length > 0);
      if (target) {
        if (f.location === target) {
          f.order = { kind: 'mayin_tara', target, path: [] };
        } else {
          const path = seaPath(state, f.location, target);
          f.order = path
            ? { kind: 'seyret', target, path }
            : { kind: 'demirle', target: null, path: [] };
        }
        continue;
      }
    }

    // ── Nakliye görevi her şeyin önünde gelir ──
    // Yüklü filo asla bombardımana gönderilmez; yoksa asker gemide kalır
    // ve çıkarma hiç olmaz.
    if (f.embarked.length > 0 && landingSea) {
      if (f.location === landingSea) {
        f.order = { kind: 'cikarma_destek', target: beach ?? null, path: [] };
      } else {
        const path = seaPath(state, f.location, landingSea);
        f.order = path
          ? { kind: 'seyret', target: landingSea, path }
          : { kind: 'demirle', target: null, path: [] };
      }
      continue;
    }

    // Çıkarma günü geldiyse ve üste bekleyen asker varsa, boş bir filo
    // nakliye görevine ayrılır.
    if (state.day >= LANDING_DAY) {
      const waiting = Object.values(state.landUnits).find(
        (u) =>
          u.side === 'entente' &&
          u.strength > 0 &&
          !u.embarkedIn &&
          isBase(u.location),
      );
      if (waiting) {
        const pickup = prov(waiting.location).neighbours.find((n) => prov(n).isSea);
        if (pickup) {
          if (f.location === pickup) {
            f.order = { kind: 'demirle', target: null, path: [] };
          } else {
            const path = seaPath(state, f.location, pickup);
            f.order = path
              ? { kind: 'seyret', target: pickup, path }
              : { kind: 'demirle', target: null, path: [] };
          }
          continue;
        }
      }
    }

    if (navalPhase) {
      // Muharebe filosu: mayınları temizlenmiş en ileri ile sokulup tabya döver.
      const front = furthestClearProvince(state);
      if (f.location !== front) {
        const path = seaPath(state, f.location, front);
        if (path) {
          f.order = { kind: 'seyret', target: front, path };
          continue;
        }
      }
      const hostile = fortsCovering(state, f.location).filter(
        (x) => state.provinces[x.province]?.controller === 'ottoman',
      );
      f.order =
        hostile.length > 0
          ? { kind: 'bombardiman', target: f.location, path: [] }
          : { kind: 'demirle', target: null, path: [] };
      continue;
    }

    // Çıkarma desteği: sahile bitişik sularda topçu şemsiyesi.
    if (landingSea && f.location !== landingSea) {
      const path = seaPath(state, f.location, landingSea);
      if (path) {
        f.order = { kind: 'seyret', target: landingSea, path };
        continue;
      }
    }
    f.order = { kind: 'cikarma_destek', target: beach ?? null, path: [] };
  }

  // ── Kara birlikleri ──
  const land = Object.values(state.landUnits).filter(
    (u) => u.side === 'entente' && u.strength > 0 && u.embarkedIn !== 'bekleme',
  );
  if (state.day >= LANDING_DAY) {
    for (const u of land) {
      if (u.embarkedIn) {
        // Gemide: filo sahile bitişikse karaya çık.
        const f = state.fleets[u.embarkedIn];
        const reachable = f
          ? prov(f.location).neighbours.filter(
              (n) => BEACHES.includes(n) && state.provinces[n]?.controller !== 'entente',
            )
          : [];
        // Harekât hedefi varsa ona çık; yoksa ulaşılabilen ilk sahile.
        const target =
          beach && reachable.includes(beach) ? beach : reachable[0];
        u.order = target ? { kind: 'cikarma', target, path: [] } : null;
        continue;
      }
      if (isBase(u.location)) {
        // Adada bekliyor: bitişik bir dost filoya bin.
        // Tarama filosu asker taşımaz — işi mayın temizlemek.
        const ride = Object.values(state.fleets).find(
          (f) =>
            f.side === 'entente' &&
            liveShips(f).length > 0 &&
            fleetSweepRate(f) <= 4 &&
            f.embarked.length < 3 &&
            prov(u.location).neighbours.includes(f.location),
        );
        if (ride) {
          u.embarkedIn = ride.id;
          u.order = null;
          if (!ride.embarked.includes(u.id)) ride.embarked.push(u.id);
          continue;
        }
        u.order = { kind: 'bekle', target: null, path: [] };
        continue;
      }
      planLandUnit(state, u, 'entente');
    }
  } else {
    // Çıkarma gününden önce birlikler adalarda bekler.
    for (const u of land) {
      if (!u.embarkedIn) u.order = { kind: 'siperlen', target: null, path: [] };
    }
  }

  // ── Hava ──
  for (const w of Object.values(state.airWings)) {
    if (w.side !== 'entente' || w.planes <= 0) continue;
    if (w.role === 'kesif') {
      const unknown = STRAIT_AXIS.find((id) =>
        minefieldsIn(state, id).some((m) => !m.spotted),
      );
      w.order = { kind: 'kesif', target: unknown ?? furthestClearProvince(state) };
    } else if (w.role === 'gozetleme') {
      const fleet = fleets.find((f) => f.order?.kind === 'bombardiman');
      w.order = { kind: 'gozetleme', target: fleet?.location ?? null };
    } else if (w.role === 'bombardiman') {
      w.order = { kind: 'bombardiman', target: bestEnemyStack(state, 'entente') };
    }
  }
}

// ──────────────────────────────────────────────────────── OSMANLI ──────

function planOttoman(state: GameState, rng: Rng): void {
  // Mayın gemileri: boşalmış ya da hiç mayını olmayan en kritik ile dök.
  for (const f of Object.values(state.fleets)) {
    if (f.side !== 'ottoman' || liveShips(f).length === 0) continue;
    const carries = liveShips(f).some((s) => s.mines > 0);
    if (!carries) {
      f.order = { kind: 'demirle', target: null, path: [] };
      continue;
    }
    const target = weakestMinedProvince(state);
    if (!target) {
      f.order = { kind: 'demirle', target: null, path: [] };
      continue;
    }
    if (f.location === target) {
      f.order = { kind: 'mayin_dok', target, path: [] };
    } else {
      const path = seaPath(state, f.location, target);
      f.order = path
        ? { kind: 'seyret', target, path }
        : { kind: 'demirle', target: null, path: [] };
    }
  }

  for (const u of Object.values(state.landUnits)) {
    if (u.side !== 'ottoman' || u.strength <= 0 || u.embarkedIn) continue;
    planLandUnit(state, u, 'ottoman');
  }

  for (const w of Object.values(state.airWings)) {
    if (w.side !== 'ottoman' || w.planes <= 0) continue;
    const enemyFleet = Object.values(state.fleets).find(
      (f) => f.side === 'entente' && liveShips(f).length > 0,
    );
    w.order = { kind: 'kesif', target: enemyFleet?.location ?? 'd_bogaz_agzi' };
  }

  void rng;
}

// ───────────────────────────────────────────────── ortak kara mantığı ───

function planLandUnit(state: GameState, u: LandUnit, side: Side): void {
  const here = prov(u.location);
  const enemy: Side = side === 'ottoman' ? 'entente' : 'ottoman';

  // Komşuda zayıf düşman varsa taarruz et.
  let bestTarget: ProvinceId | null = null;
  let bestRatio = 0;
  for (const nb of here.neighbours) {
    const np = prov(nb);
    if (np.isSea) continue;
    const st = state.provinces[nb];
    if (st?.controller !== enemy) continue;
    const mine = stackPower(state, u.location, side, 'attack');
    const theirs = stackPower(state, nb, enemy, 'defence');
    const ratio = theirs > 0 ? mine / theirs : 99;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestTarget = nb;
    }
  }

  const healthy = u.organisation > u.maxOrganisation * 0.55 && u.supplied > 0.5;
  if (bestTarget && bestRatio > 1.45 && healthy) {
    u.order = { kind: 'taarruz', target: bestTarget, path: [] };
    return;
  }

  // Düşman komşudaysa siperlen.
  const threatened = here.neighbours.some((n) => state.provinces[n]?.controller === enemy);
  if (threatened || u.entrenchment < 3) {
    u.order = { kind: 'siperlen', target: null, path: [] };
    return;
  }

  // Tehdit altındaki en değerli dost ile yürü.
  const reinforceTarget = mostThreatened(state, side, u.location);
  if (reinforceTarget && reinforceTarget !== u.location) {
    const path = findPath(
      u.location,
      reinforceTarget,
      (id) => !prov(id).isSea && state.provinces[id]?.controller === side,
    );
    if (path && path.length > 0) {
      u.order = { kind: 'yuru', target: reinforceTarget, path };
      return;
    }
  }
  u.order = { kind: 'siperlen', target: null, path: [] };
}

/**
 * Yığın gücü. `mode` muharebe çözümüyle AYNI tabanı kullanmalı: saldıran
 * yalnız saldırı değerini, savunan yalnız savunma değerini (siper ve
 * tahkimat çarpanlarıyla) kullanır.
 *
 * İlk sürümde ikisinin toplamı alınıyordu; yapay zekâ kendi gücünü iki kat
 * fazla sanıp 1'e 3 kaybedeceği taarruzları aylarca tekrarladı.
 */
function stackPower(
  state: GameState,
  id: ProvinceId,
  side: Side,
  mode: 'attack' | 'defence' = 'attack',
): number {
  const fortLevel = state.provinces[id]?.fortLevel ?? 0;
  let p = 0;
  for (const u of Object.values(state.landUnits)) {
    if (u.location !== id || u.side !== side || u.embarkedIn) continue;
    const e = effective(u);
    p +=
      mode === 'attack'
        ? e.attack
        : e.defence * (1 + u.entrenchment * 0.06) * (1 + fortLevel * 0.12);
  }
  return p;
}

function mostThreatened(state: GameState, side: Side, from: ProvinceId): ProvinceId | null {
  const enemy: Side = side === 'ottoman' ? 'entente' : 'ottoman';
  let best: ProvinceId | null = null;
  let bestScore = 0;
  for (const p of MAP.provinces) {
    if (p.isSea) continue;
    const st = state.provinces[p.id];
    if (st?.controller !== side) continue;
    const pressure = p.neighbours.reduce(
      (n, nb) => n + (state.provinces[nb]?.controller === enemy ? stackPower(state, nb, enemy) : 0),
      0,
    );
    if (pressure <= 0) continue;
    const held = stackPower(state, p.id, side);
    const score = (pressure - held) * (1 + p.victoryPoints);
    if (score > bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best === from ? null : best;
}

function bestEnemyStack(state: GameState, side: Side): ProvinceId | null {
  const enemy: Side = side === 'ottoman' ? 'entente' : 'ottoman';
  let best: ProvinceId | null = null;
  let bestMen = 0;
  for (const u of Object.values(state.landUnits)) {
    if (u.side !== enemy || u.embarkedIn) continue;
    const men = stackPower(state, u.location, enemy, 'defence');
    if (men > bestMen) {
      bestMen = men;
      best = u.location;
    }
  }
  return best;
}

function seaPath(state: GameState, from: ProvinceId, to: ProvinceId): ProvinceId[] | null {
  return findPath(
    from,
    to,
    (id) => prov(id).isSea,
    (id) => {
      const m = minefieldsIn(state, id);
      // Bilinen mayın hattı pahalı; bilinmeyen bedava görünür — ve öldürür.
      const known = m.filter((x) => x.spotted).reduce((n, x) => n + x.mines, 0);
      return 1 + known * 0.05;
    },
  );
}

/** İtilaf'ın güvenle ulaşabildiği en kuzey boğaz ili. */
function furthestClearProvince(state: GameState): ProvinceId {
  let last: ProvinceId = STRAIT_AXIS[0]!;
  for (const id of STRAIT_AXIS) {
    const known = minefieldsIn(state, id).filter((m) => m.spotted);
    if (known.length > 0) break;
    last = id;
  }
  return last;
}

/** Osmanlı için takviye mayın dökmeye en muhtaç boğaz ili. */
function weakestMinedProvince(state: GameState): ProvinceId | null {
  let best: ProvinceId | null = null;
  let fewest = Infinity;
  for (const id of STRAIT_AXIS) {
    const st = state.provinces[id];
    if (st?.controller === 'entente') continue;
    const mines = minefieldsIn(state, id).reduce((n, m) => n + m.mines, 0);
    if (mines < fewest) {
      fewest = mines;
      best = id;
    }
  }
  return best;
}

function pickBeach(state: GameState, rng: Rng): ProvinceId | null {
  const free = BEACHES.filter((b) => {
    const st = state.provinces[b];
    return st && st.controller !== 'entente';
  });
  if (free.length === 0) return null;
  // En zayıf savunulan sahili tercih et, biraz da kura.
  free.sort(
    (a, b) =>
      stackPower(state, a, 'ottoman', 'defence') -
      stackPower(state, b, 'ottoman', 'defence'),
  );
  return rng.chance(0.75) ? free[0]! : rng.pick(free);
}

function countLostCapitals(state: GameState): number {
  let n = 0;
  for (const f of Object.values(state.fleets)) {
    if (f.side !== 'entente') continue;
    n += f.ships.filter(
      (s) =>
        s.hull <= 0 &&
        (s.cls === 'dretnot' || s.cls === 'pre_dretnot' || s.cls === 'muharebe_kruvazoru'),
    ).length;
  }
  return n;
}

/** Filonun sağ gemi sayısı — AI ve arayüz. */
export function aliveCount(f: Fleet): number {
  return liveShips(f).length;
}

/** İtilaf'ın yükleme yaptığı ada üsleri. */
function isBase(id: ProvinceId): boolean {
  return id === 'bozcaada' || id === 'gokceada';
}

/** Bir sahile çıkarma yapmak için filonun durması gereken deniz ili. */
function landingWaterFor(beach: ProvinceId): ProvinceId | undefined {
  const p = prov(beach);
  return p.beachAccess[0] ?? p.neighbours.find((n) => prov(n).isSea);
}
