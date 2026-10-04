import type {
  CombatReport,
  EventEffect,
  Fleet,
  GameState,
  LandUnit,
  ProvinceId,
  Side,
  Weather,
} from '../core/types.ts';
import { MAP, prov, provinceDist } from '../core/geo.ts';
import { TERRAINS, WEATHERS } from '../data/units.ts';
import {
  commanderMods,
  dailyRecovery,
  reinforce,
  resolveLandCombat,
  templateStats,
} from './combat.ts';
import {
  isCapital,
  layMines,
  liveShips,
  navalSupportFor,
  resolveMines,
  resolveNavalFire,
  resolveSweeping,
} from './naval.ts';
import { repairAir, resolveAir } from './air.ts';
import { accrueResources, applySupply } from './supply.ts';
import { SCENARIO, isoOf } from './scenario.ts';
import { planAi } from './ai.ts';
import { Rng } from './rng.ts';

/**
 * Bir turun (bir günün) çözümü. Sıra önemlidir ve sabittir:
 *
 *   1. Hava
 *   2. Yapay zekâ emirleri (oyuncu olmayan taraf)
 *   3. Hava harekâtı       — keşif istihbaratı sonraki adımları besler
 *   4. Deniz hareketi, mayınlar, tabya düelloları, tarama, mayın dökme
 *   5. Kara hareketi
 *   6. Kara muharebeleri
 *   7. İkmal
 *   8. Toparlanma, takviye, siperlenme
 *   9. Görüş
 *  10. Olaylar ve zafer kontrolü
 *
 * Deterministiktir: aynı durum + aynı emirler = aynı sonuç.
 */

/** Kara birliğinin bir günde alabileceği temel yol (metre). */
const LAND_SPEED_M = 9000;
/**
 * Filonun bir günde alabileceği temel yol (metre).
 * 15 knot × 24 saat = 660 km; manevra, gece duruşu ve tedbirli seyirle
 * fiilen günde ~120 km. Boğazdaki yavaşlama arazi maliyeti ve akıntıdan gelir.
 */
const FLEET_SPEED_M = 120000;
/** Bir tabyanın günlük bastırma toparlanması. */
const FORT_SUPPRESSION_RECOVERY = 0.45;
/** Tabyanın günlük onarımı (hasar görmüş beton ve kundak). */
const FORT_REPAIR = 0.012;

function rollWeather(prev: Weather, rng: Rng, day: number): Weather {
  // Mart–Nisan fırtınalı, yaz açık, Kasım–Aralık yine sert.
  const season = ((day + 50) % 365) / 365;
  const storminess = 0.22 + 0.25 * Math.cos(season * Math.PI * 2);
  if (rng.chance(0.55)) return prev; // hava inatçıdır
  const r = rng.next();
  if (r < storminess * 0.3) return 'firtina';
  if (r < storminess * 0.8) return 'yagmur';
  if (r < storminess * 1.6) return 'puslu';
  return 'acik';
}

export interface TurnResult {
  readonly reports: readonly CombatReport[];
  readonly state: GameState;
}

export function endTurn(state: GameState): TurnResult {
  if (state.outcome) return { reports: [], state };

  const rng = new Rng(state.rngState);
  const reports: CombatReport[] = [];

  state.phase = 'cozum';
  state.weather = rollWeather(state.weather, rng, state.day);

  planAi(state, rng);

  reports.push(...resolveAir(state, rng));
  reports.push(...resolveNavalPhase(state, rng));
  moveLandUnits(state);
  reports.push(...resolveLandPhase(state, rng));

  applySupply(state);
  accrueResources(state);
  repairAir(state);

  for (const u of Object.values(state.landUnits)) {
    if (u.embarkedIn) continue;
    dailyRecovery(state, u);
    reinforce(state, u);
  }
  for (const f of Object.values(state.forts)) {
    f.suppression = Math.max(0, f.suppression - FORT_SUPPRESSION_RECOVERY);
    if (f.integrity > 0.05 && f.integrity < 1) {
      f.integrity = Math.min(1, f.integrity + FORT_REPAIR);
    }
    // Mühimmat ikmali taraf havuzundan.
    if (f.ammo < f.maxAmmo) {
      const want = Math.min(f.maxAmmo - f.ammo, Math.ceil(f.maxAmmo * 0.012));
      const got = Math.min(want, state.sides.ottoman.ammo);
      f.ammo += got;
      state.sides.ottoman.ammo -= got;
    }
  }
  for (const f of Object.values(state.fleets)) {
    const atBase = isRepairWater(state, f.location, f.side);
    for (const s of liveShips(f)) {
      s.ammo = Math.min(1, s.ammo + (atBase ? 0.5 : 0.25));
      // Hasarlı gemi üs sularında onarılır; açık denizde çok yavaş toparlar.
      if (s.hull < 1) s.hull = Math.min(1, s.hull + (atBase ? 0.07 : 0.008));
    }
    // Batan gemiler kayıtta kalır (liveShips zaten süzüyor) — rapor için gerek.
  }

  updateVisibility(state);

  state.day += 1;
  state.date = isoOf(state.day);
  arriveReinforcements(state);
  fireEvents(state);
  checkVictory(state);

  state.phase = state.outcome ? 'bitti' : 'emir';
  state.rngState = rng.state;
  state.reports = [...reports, ...state.reports].slice(0, 300);
  return { reports, state };
}

// ───────────────────────────────────────────────────────── deniz ────────

function resolveNavalPhase(state: GameState, rng: Rng): CombatReport[] {
  const out: CombatReport[] = [];

  for (const f of Object.values(state.fleets)) {
    if (liveShips(f).length === 0) continue;
    f.inCombat = false;
    const order = f.order;
    if (!order) continue;

    // ── Hareket ──
    if (
      (order.kind === 'seyret' || order.kind === 'zorla_gec') &&
      order.path.length > 0
    ) {
      const mods = commanderMods(state, f.commanderId);
      let budget = FLEET_SPEED_M * (1 + mods.speed);
      const path = [...order.path];
      let hops = 0;
      while (path.length > 0 && budget > 0) {
        const next = path[0]!;
        const p = prov(next);
        if (!p.isSea) break;
        const step =
          provinceDist(f.location, next) * TERRAINS[p.terrain].moveCost +
          // Akıntıya karşı (Marmara'dan Ege'ye akar) yukarı gitmek pahalı.
          (p.current ?? 0) * 2400;
        // Bir gün en az bir il atlamaya yeter. Bu garanti olmazsa maliyeti
        // bütçeyi kıl payı aşan ilk adımda filo kalıcı olarak kilitleniyor.
        if (step > budget && hops > 0) break;
        hops++;
        budget -= step;
        f.location = next;
        path.shift();

        // Her yeni ile girişte mayın riski.
        const mine = resolveMines(state, f, rng);
        if (mine.report) {
          out.push(mine.report);
          f.inCombat = true;
        }
        if (liveShips(f).length === 0) break;
      }
      f.order = { ...order, path };
      if (path.length === 0) f.order = { kind: 'demirle', target: null, path: [] };
    }

    if (liveShips(f).length === 0) continue;

    // ── Durduğu yerdeki harekât ──
    // Tabya ateşi burada ÇÖZÜLMEZ; bütün filolar için tek seferde
    // resolveNavalFire içinde çözülür (bkz. naval.ts kalibrasyon notu).
    switch (f.order?.kind) {
      case 'mayin_tara': {
        const sweep = resolveSweeping(state, f, rng);
        if (sweep) out.push(sweep);
        const mine = resolveMines(state, f, rng);
        if (mine.report) out.push(mine.report);
        break;
      }
      case 'mayin_dok': {
        const rep = layMines(state, f, f.order.target ?? f.location);
        if (rep) out.push(rep);
        f.order = { kind: 'demirle', target: null, path: [] };
        break;
      }
      default:
        break;
    }
  }

  // Tabya-donanma ateşi: günde bir, bütün harita için.
  out.push(...resolveNavalFire(state, rng));

  // Batan gemilerin taşıdığı birlikler kaybolur.
  for (const f of Object.values(state.fleets)) {
    if (liveShips(f).length > 0) continue;
    for (const uid of f.embarked) {
      const u = state.landUnits[uid];
      if (u) u.strength = 0;
    }
    f.embarked = [];
  }

  return out;
}

// ────────────────────────────────────────────────────────── kara ────────

function moveLandUnits(state: GameState): void {
  for (const u of Object.values(state.landUnits)) {
    if (u.embarkedIn) continue;
    const order = u.order;
    if (!order) continue;

    if (order.kind === 'cikarma' && order.target) {
      // Çıkarma emri, karaya çıkarma fazında ele alınır.
      continue;
    }
    if (order.kind !== 'yuru' || order.path.length === 0) continue;

    const mods = commanderMods(state, u.commanderId);
    let budget = LAND_SPEED_M * (1 + mods.speed) * WEATHERS[state.weather].movement;
    const path = [...order.path];
    while (path.length > 0 && budget > 0) {
      const next = path[0]!;
      const p = prov(next);
      if (p.isSea) break;
      const st = state.provinces[next]!;
      // Düşman tutuyorsa yürüyüş değil taarruz gerekir.
      if (st.controller && st.controller !== u.side) break;
      const step = provinceDist(u.location, next) * TERRAINS[p.terrain].moveCost;
      if (step > budget) {
        u.moveProgress = Math.min(0.95, u.moveProgress + budget / step);
        budget = 0;
        break;
      }
      budget -= step;
      u.location = next;
      u.moveProgress = 0;
      u.entrenchment = 0;
      path.shift();
      if (!st.controller) {
        st.controller = u.side;
        st.owner ??= u.side;
      }
    }
    u.order = path.length > 0 ? { ...order, path } : { kind: 'bekle', target: null, path: [] };
  }
}

function resolveLandPhase(state: GameState, rng: Rng): CombatReport[] {
  const out: CombatReport[] = [];

  // Taarruz emirlerini hedef ile göre grupla.
  const attacks = new Map<ProvinceId, { side: Side; units: LandUnit[] }>();
  for (const u of Object.values(state.landUnits)) {
    if (u.embarkedIn || u.strength <= 0) continue;
    if (u.order?.kind !== 'taarruz' || !u.order.target) continue;
    const target = u.order.target;
    if (!prov(u.location).neighbours.includes(target)) continue;
    const slot = attacks.get(target);
    if (slot) {
      if (slot.side === u.side) slot.units.push(u);
    } else {
      attacks.set(target, { side: u.side, units: [u] });
    }
  }

  for (const [target, group] of attacks) {
    const st = state.provinces[target]!;
    const defenders = Object.values(state.landUnits).filter(
      (d) => d.location === target && d.side !== group.side && !d.embarkedIn && d.strength > 0,
    );

    if (defenders.length === 0) {
      // Boş il: bedava işgal.
      st.controller = group.side;
      for (const u of group.units) {
        u.location = target;
        u.entrenchment = 0;
        u.order = { kind: 'bekle', target: null, path: [] };
      }
      out.push({
        id: `isgal_${target}_${state.day}`,
        day: state.day,
        kind: 'kara',
        province: target,
        title: `${prov(target).name} direnişsiz alındı`,
        lines: [`${group.units.map((u) => u.name).join(', ')} ili ele geçirdi.`],
        losses: { ottoman: { men: 0, ships: 0, guns: 0 }, entente: { men: 0, ships: 0, guns: 0 } },
        winner: group.side,
      });
      continue;
    }

    const result = resolveLandCombat(
      state,
      {
        province: target,
        attacker: group.side,
        attackers: group.units,
        defenders,
        fortLevel: st.fortLevel,
        navalSupport: navalSupportFor(state, group.side, target),
        airSupport: airSupportFor(state, group.side, target),
      },
      rng,
    );
    out.push(result.report);

    if (result.defenderBroke) {
      st.controller = group.side;
      retreat(state, result.retreating, target);
      for (const u of group.units) {
        u.location = target;
        u.entrenchment = 0;
        u.order = { kind: 'bekle', target: null, path: [] };
      }
    } else if (result.attackerBroke) {
      for (const u of group.units) u.order = { kind: 'bekle', target: null, path: [] };
    }

    // Taarruz cephane yakar.
    const pool = state.sides[group.side];
    pool.ammo = Math.max(0, pool.ammo - group.units.length * 600);
  }

  // Çıkarmalar.
  out.push(...resolveLandings(state, rng));

  return out;
}

function airSupportFor(state: GameState, side: Side, target: ProvinceId): number {
  let n = 0;
  for (const w of Object.values(state.airWings)) {
    if (w.side !== side || w.role !== 'bombardiman' || w.planes <= 0) continue;
    if (w.order?.target !== target) continue;
    n += w.planes * 2.5;
  }
  return n * WEATHERS[state.weather].flying;
}

function retreat(state: GameState, units: LandUnit[], from: ProvinceId): void {
  for (const u of units) {
    const options = prov(from).neighbours.filter((n) => {
      const p = prov(n);
      const st = state.provinces[n];
      return !p.isSea && st && st.controller === u.side;
    });
    if (options.length === 0) {
      // Çekilecek yer yok: birlik teslim olur.
      u.strength = 0;
      u.organisation = 0;
      continue;
    }
    // En sağlam ikmalli komşuya çekil.
    options.sort((a, b) => (state.provinces[b]!.supply ?? 0) - (state.provinces[a]!.supply ?? 0));
    u.location = options[0]!;
    u.entrenchment = 0;
    u.order = { kind: 'bekle', target: null, path: [] };
  }
}

function resolveLandings(state: GameState, rng: Rng): CombatReport[] {
  const out: CombatReport[] = [];
  const byTarget = new Map<ProvinceId, LandUnit[]>();

  for (const u of Object.values(state.landUnits)) {
    if (u.order?.kind !== 'cikarma' || !u.order.target) continue;
    if (!u.embarkedIn || u.embarkedIn === 'bekleme') continue;
    const list = byTarget.get(u.order.target);
    if (list) list.push(u);
    else byTarget.set(u.order.target, [u]);
  }

  for (const [target, units] of byTarget) {
    const p = prov(target);
    const st = state.provinces[target]!;
    const side = units[0]!.side;
    const defenders = Object.values(state.landUnits).filter(
      (d) => d.location === target && d.side !== side && !d.embarkedIn && d.strength > 0,
    );

    const mods = commanderMods(state, units[0]!.commanderId);
    const support = navalSupportFor(state, side, target);
    const lines: string[] = [
      `${units.length} birlik ${p.name} sahiline çıkıyor.`,
      support > 0 ? `Deniz topçusu desteği ${support.toFixed(0)}.` : 'Deniz topçusu desteği yok.',
    ];
    const losses = {
      ottoman: { men: 0, ships: 0, guns: 0 },
      entente: { men: 0, ships: 0, guns: 0 },
    };

    // Sahile çıkarken savunanın ateşi altında kayıp verilir.
    let defFire = 0;
    for (const d of defenders) {
      const s = templateStats(d.templateId);
      defFire += s.defence * (d.strength / d.maxStrength) * (1 + d.entrenchment * 0.1);
    }
    const shield = 1 / (1 + support / 400);
    for (const u of units) {
      const hit = Math.round(
        u.strength * Math.min(0.4, defFire * 0.0009) * shield * rng.jitter(0.4) *
          (1 - mods.amphibious),
      );
      u.strength = Math.max(0, u.strength - hit);
      u.organisation = Math.max(0, u.organisation * 0.55);
      u.entrenchment = 0;
      u.embarkedIn = null;
      u.location = target;
      u.order = { kind: 'bekle', target: null, path: [] };
      losses[side].men += hit;
      lines.push(`${u.name}: ${hit} kayıp.`);
    }

    for (const f of Object.values(state.fleets)) {
      f.embarked = f.embarked.filter((id) => !units.some((u) => u.id === id));
    }

    if (defenders.length === 0) {
      st.controller = side;
      lines.push('Sahil boştu — köprübaşı kuruldu.');
    } else {
      lines.push('Köprübaşı savunanın hattı önünde tutuluyor; taarruz gerekiyor.');
    }

    out.push({
      id: `cikarma_${target}_${state.day}`,
      day: state.day,
      kind: 'kara',
      province: target,
      title: `${p.name} — çıkarma`,
      lines,
      losses,
      winner: defenders.length === 0 ? side : null,
    });
  }

  return out;
}

// ──────────────────────────────────────────────────────── görüş ────────

function updateVisibility(state: GameState): void {
  for (const side of ['ottoman', 'entente'] as const) {
    for (const p of MAP.provinces) {
      const st = state.provinces[p.id]!;
      const mine =
        st.controller === side ||
        Object.values(state.landUnits).some(
          (u) => u.side === side && u.location === p.id && !u.embarkedIn,
        ) ||
        Object.values(state.fleets).some((f) => f.side === side && f.location === p.id);
      // Komşuluktan da görülür.
      const adjacent = p.neighbours.some((n) => {
        const ns = state.provinces[n];
        return (
          ns?.controller === side ||
          Object.values(state.fleets).some((f) => f.side === side && f.location === n)
        );
      });
      if (mine || adjacent) {
        st.seen[side] = true;
        st.lastSeen[side] = state.day;
      }
    }
  }
}

// ─────────────────────────────────────── takviye, olay, zafer ──────────

function arriveReinforcements(state: GameState): void {
  for (const u of SCENARIO.landUnits) {
    if (u.arrivesOn === undefined || u.arrivesOn !== state.day) continue;
    const unit = state.landUnits[u.id];
    if (!unit) continue;
    unit.embarkedIn = null;
    unit.location = u.location;
  }
  for (const a of SCENARIO.airWings) {
    if (a.arrivesOn === undefined || a.arrivesOn !== state.day) continue;
    const wing = state.airWings[a.id];
    if (wing) wing.planes = wing.maxPlanes;
  }
}

function fireEvents(state: GameState): void {
  for (const e of SCENARIO.events) {
    if (e.day !== state.day || state.firedEvents.includes(e.id)) continue;
    state.firedEvents.push(e.id);
    state.pendingEvents.push(e);
    if (e.effect && !e.choices) applyEffect(state, e.effect);
  }
}

export function applyEffect(state: GameState, effect: EventEffect): void {
  for (const [side, v] of Object.entries(effect.morale ?? {}) as [Side, number][]) {
    state.sides[side].morale = Math.max(0, Math.min(1, state.sides[side].morale + v));
  }
  for (const [side, v] of Object.entries(effect.manpower ?? {}) as [Side, number][]) {
    state.sides[side].manpower = Math.max(0, state.sides[side].manpower + v);
  }
  for (const [side, v] of Object.entries(effect.fortAmmo ?? {}) as [Side, number][]) {
    if (side !== 'ottoman') continue;
    for (const f of Object.values(state.forts)) {
      f.ammo = Math.max(0, Math.round(f.ammo * (1 + v)));
    }
  }
}

function checkVictory(state: GameState): void {
  const v = SCENARIO.victory;

  const straitForced = v.ententeStraitProvinces.every(
    (id) => state.provinces[id]?.controller === 'entente',
  );
  if (straitForced) {
    state.outcome = {
      winner: 'entente',
      reason:
        'Birleşik Filo Dar Boğaz\'ı, Nağara\'yı ve Marmara ağzını geçti. ' +
        'Yol İstanbul\'a açık.',
      day: state.day,
    };
    return;
  }

  const capitalLost = countSunkCapitals(state);
  if (capitalLost >= v.ententeCapitalShipLimit) {
    state.outcome = {
      winner: 'ottoman',
      reason: `İtilaf ${capitalLost} büyük gemi kaybetti; filo Mudros'a çekildi.`,
      day: state.day,
    };
    return;
  }

  const mustHoldLost = v.ottomanMustHold.filter(
    (id) => state.provinces[id]?.controller === 'entente',
  );
  if (mustHoldLost.length === v.ottomanMustHold.length) {
    state.outcome = {
      winner: 'entente',
      reason: 'Kilitbahir platosu ve Çanakkale düştü; boğaz savunması çöktü.',
      day: state.day,
    };
    return;
  }

  if (state.sides.ottoman.morale <= 0) {
    state.outcome = { winner: 'entente', reason: 'Osmanlı direnci kırıldı.', day: state.day };
    return;
  }
  if (state.sides.entente.morale <= 0) {
    state.outcome = {
      winner: 'ottoman',
      reason: 'İtilaf kamuoyu ve kabinesi harekâtı terk etti.',
      day: state.day,
    };
    return;
  }

  if (state.day >= v.lastDay) {
    state.outcome = {
      winner: 'ottoman',
      reason: '9 Ocak 1916 — son İtilaf askeri Seddülbahir\'den ayrıldı. Çanakkale geçilmedi.',
      day: state.day,
    };
  }
}

/** Senaryo başındaki büyük gemi sayısıyla bugünkü farkı. */
function countSunkCapitals(state: GameState): number {
  let start = 0;
  for (const f of SCENARIO.fleets) {
    if (f.nation === 'osmanli' || f.nation === 'alman') continue;
    for (const s of f.ships) {
      if (s.cls === 'dretnot' || s.cls === 'pre_dretnot' || s.cls === 'muharebe_kruvazoru') {
        start++;
      }
    }
  }
  // Yalnız BATAN gemiler sayılır. Savaş dışı kalanlar Mudros'a çekilip
  // onarılıyor (18 Mart'ta Inflexible, Gaulois, Suffren ve Agamemnon böyle
  // yaptı) — geçici hasarla oyun bitmemeli.
  let now = 0;
  for (const f of Object.values(state.fleets)) {
    if (f.side !== 'entente') continue;
    now += f.ships.filter((s) => isCapital(s) && s.hull > 0).length;
  }
  return Math.max(0, start - now);
}

export { rollWeather as _rollWeather };

/**
 * Bu deniz ili bir dost ikmal üssüne bitişik mi — gemiler burada onarılır.
 * İtilaf için Mudros/Limni yönü ve Gökçeada, Osmanlı için Marmara kıyısı.
 */
function isRepairWater(state: GameState, sea: ProvinceId, side: Side): boolean {
  return prov(sea).neighbours.some((n) => {
    const p = prov(n);
    return (
      !p.isSea && p.supplyHub >= 20000 && state.provinces[n]?.controller === side
    );
  });
}

/** Filodaki toplam sağlam gemi — arayüz için. */
export function fleetSize(f: Fleet): number {
  return liveShips(f).length;
}
