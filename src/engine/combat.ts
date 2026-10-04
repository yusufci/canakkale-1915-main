import type {
  CombatMods,
  CombatReport,
  GameState,
  LandUnit,
  ProvinceId,
  Side,
} from '../core/types.ts';
import { prov } from '../core/geo.ts';
import { BATTALIONS, MAX_ENTRENCHMENT, TEMPLATE_BY_ID, TERRAINS, WEATHERS, aggregate } from '../data/units.ts';
import { TRAITS } from '../data/commanders.ts';
import type { Rng } from './rng.ts';

/**
 * Kara muharebesi — HOI4'ün cephe genişliği / organizasyon / siperlenme /
 * tahkimat sistemleri bir GÜNLÜK tura uyarlanmıştır.
 *
 * Temel fikir HOI4 ile aynı:
 *   · İl arazisi aynı anda muharebeye girebilecek cephe genişliğini sınırlar;
 *     fazlası ihtiyattadır ve ne hasar verir ne alır. Arıburnu'nun dereleri
 *     bir tümenden fazlasını almaz — tarihsel olarak da almadı.
 *   · Asıl kırılma organizasyondan olur, insan kaybından değil. Org sıfırlanan
 *     taraf çekilir.
 *   · Siper ve tahkimat savunanı doğrudan çarpanla güçlendirir.
 *
 * HOI4'ten FARK: saatlik tick yerine tek bir günlük çözüm var. Bu yüzden
 * hasar katsayıları 24 saatlik birikimi temsil edecek şekilde ölçeklenmiştir.
 */

/** Bir günde verilebilecek azami organizasyon hasarı oranı. */
const ORG_DAMAGE_PER_DAY = 0.42;
/** Bir günde verilebilecek azami dayanıklılık (insan) hasarı oranı. */
const STR_DAMAGE_PER_DAY = 0.055;
/** Siper seviyesi başına savunma çarpanı. */
const ENTRENCH_PER_LEVEL = 0.06;
/** Tahkimat seviyesi başına savunma çarpanı. */
const FORT_PER_LEVEL = 0.12;
/** Topçu desteğinin mermi başına katkısı. */
const GUN_SUPPORT = 0.9;

export const NO_MODS: CombatMods = {
  attack: 0,
  defence: 0,
  orgRecovery: 0,
  speed: 0,
  digIn: 0,
  gunnery: 0,
  logistics: 0,
  amphibious: 0,
};

/** Komutanın yetenek + özelliklerinden toplam çarpanlar. */
export function commanderMods(state: GameState, commanderId: string | null): CombatMods {
  const m = { ...NO_MODS };
  if (!commanderId) return m;
  const c = state.commanders[commanderId];
  if (!c || c.availableFrom > state.day) return m;
  // Yetenek 1..7; 4 nötr. Her puan %4 değer.
  m.attack += (c.skill.attack - 4) * 0.04;
  m.defence += (c.skill.defence - 4) * 0.04;
  m.orgRecovery += (c.skill.planning - 4) * 0.05;
  m.logistics += (c.skill.logistics - 4) * 0.05;
  m.gunnery += (c.skill.attack - 4) * 0.03;
  for (const id of c.traits) {
    const t = TRAITS[id];
    if (!t) continue;
    for (const [k, v] of Object.entries(t.mods) as [keyof CombatMods, number][]) {
      m[k] += v;
    }
  }
  return m;
}

export interface UnitStats {
  men: number;
  width: number;
  softAttack: number;
  breakthrough: number;
  defence: number;
  organisation: number;
  hp: number;
  supplyUse: number;
  guns: number;
}

const STATS_CACHE: Record<string, UnitStats> = {};

export function templateStats(templateId: string): UnitStats {
  const hit = STATS_CACHE[templateId];
  if (hit) return hit;
  const tpl = TEMPLATE_BY_ID[templateId];
  if (!tpl) throw new Error(`bilinmeyen şablon: ${templateId}`);
  const s = aggregate(tpl);
  STATS_CACHE[templateId] = s;
  return s;
}

/** Birimin mevcut durumuna göre etkin muharebe değerleri. */
export function effective(u: LandUnit) {
  const base = templateStats(u.templateId);
  const strRatio = u.maxStrength > 0 ? u.strength / u.maxStrength : 0;
  const orgRatio = u.maxOrganisation > 0 ? u.organisation / u.maxOrganisation : 0;
  // Tecrübe %100'de +%25 değer.
  const expMul = 1 + (u.experience / 100) * 0.25;
  const k = strRatio * (0.35 + 0.65 * orgRatio) * (0.4 + 0.6 * u.supplied) * expMul;
  return {
    attack: base.softAttack * k,
    breakthrough: base.breakthrough * k,
    defence: base.defence * k,
    width: base.width,
    guns: base.guns * strRatio,
    strRatio,
  };
}

export interface CombatSide {
  side: Side;
  units: LandUnit[];
  /** Cephe genişliği sınırını aşmayan, fiilen çarpışan birimler. */
  engaged: LandUnit[];
  power: number;
  guns: number;
  mods: CombatMods;
}

function assemble(
  state: GameState,
  units: LandUnit[],
  side: Side,
  widthLimit: number,
  attacking: boolean,
): CombatSide {
  // Örgütü en sağlam olan önce cepheye girer.
  const sorted = [...units].sort((a, b) => b.organisation - a.organisation);
  const engaged: LandUnit[] = [];
  let used = 0;
  for (const u of sorted) {
    const w = templateStats(u.templateId).width;
    if (used + w > widthLimit && engaged.length > 0) continue;
    engaged.push(u);
    used += w;
  }

  let power = 0;
  let guns = 0;
  const mods = { ...NO_MODS };
  let cmdCount = 0;
  for (const u of engaged) {
    const e = effective(u);
    power += attacking ? e.attack : e.defence;
    guns += e.guns;
    if (u.commanderId) {
      const cm = commanderMods(state, u.commanderId);
      for (const k of Object.keys(mods) as (keyof CombatMods)[]) mods[k] += cm[k];
      cmdCount++;
    }
  }
  if (cmdCount > 1) {
    for (const k of Object.keys(mods) as (keyof CombatMods)[]) mods[k] /= cmdCount;
  }
  return { side, units, engaged, power, guns, mods };
}

export interface CombatInput {
  province: ProvinceId;
  attacker: Side;
  attackers: LandUnit[];
  defenders: LandUnit[];
  /** İlin tahkimat seviyesi. */
  fortLevel: number;
  /** Saldırana eklenen deniz bombardımanı gücü. */
  navalSupport: number;
  /** Saldırana eklenen hava bombardımanı gücü. */
  airSupport: number;
}

export interface CombatOutcome {
  report: CombatReport;
  /** Savunan çekildi mi — çekildiyse il el değiştirir. */
  defenderBroke: boolean;
  attackerBroke: boolean;
  /** Çekilmek zorunda kalan birimler. */
  retreating: LandUnit[];
}

export function resolveLandCombat(
  state: GameState,
  input: CombatInput,
  rng: Rng,
): CombatOutcome {
  const p = prov(input.province);
  const terrain = TERRAINS[p.terrain];
  const weather = WEATHERS[state.weather];
  const defender: Side = input.attacker === 'ottoman' ? 'entente' : 'ottoman';

  const atk = assemble(state, input.attackers, input.attacker, terrain.combatWidth, true);
  const def = assemble(state, input.defenders, defender, terrain.combatWidth, false);

  // ── Çarpanlar ────────────────────────────────────────────────────────
  const avgEntrench =
    def.engaged.length > 0
      ? def.engaged.reduce((s, u) => s + u.entrenchment, 0) / def.engaged.length
      : 0;

  const atkAmmo = ammoFactor(state, input.attacker);
  const defAmmo = ammoFactor(state, defender);

  const atkMul =
    (1 + terrain.attackMod) *
    (1 + atk.mods.attack) *
    weather.movement *
    (1 + atk.guns * GUN_SUPPORT * atkAmmo * 0.01);
  const defMul =
    (1 + def.mods.defence) *
    (1 + avgEntrench * ENTRENCH_PER_LEVEL) *
    (1 + input.fortLevel * FORT_PER_LEVEL) *
    (1 + def.guns * GUN_SUPPORT * defAmmo * 0.01);

  const A = Math.max(
    0.01,
    (atk.power + input.navalSupport + input.airSupport) * atkMul * rng.jitter(0.18),
  );
  const D = Math.max(0.01, def.power * defMul * rng.jitter(0.18));

  // Oran tabanlı yıpratma: üstün taraf daha çok verir, daha az alır.
  const atkShare = A / (A + D);
  const defShare = 1 - atkShare;

  const lines: string[] = [];
  const losses = {
    ottoman: { men: 0, ships: 0, guns: 0 },
    entente: { men: 0, ships: 0, guns: 0 },
  };

  const applied = (
    group: CombatSide,
    incoming: number,
    orgRecoveryMod: number,
  ): { menLost: number; broke: boolean } => {
    let menLost = 0;
    let broke = false;
    const n = group.engaged.length || 1;
    for (const u of group.engaged) {
      const orgHit = u.maxOrganisation * ORG_DAMAGE_PER_DAY * incoming * rng.jitter(0.25) / n;
      u.organisation = Math.max(0, u.organisation - orgHit * (1 - orgRecoveryMod * 0.3));
      const strHit = Math.round(
        u.maxStrength * STR_DAMAGE_PER_DAY * incoming * rng.jitter(0.3) / n,
      );
      const real = Math.min(u.strength, strHit);
      u.strength -= real;
      menLost += real;
      u.inCombat = true;
      // Muharebe tecrübe kazandırır.
      u.experience = Math.min(100, u.experience + 0.6);
      if (u.organisation <= 0.5) broke = true;
    }
    return { menLost, broke };
  };

  const defHit = applied(def, atkShare * 2, def.mods.orgRecovery);
  const atkHit = applied(atk, defShare * 2, atk.mods.orgRecovery);

  losses[defender].men += defHit.menLost;
  losses[input.attacker].men += atkHit.menLost;

  // Saldıran siperini kaybeder; savunan muharebede siper kazanamaz.
  for (const u of atk.engaged) u.entrenchment = Math.max(0, u.entrenchment - 1);

  const defenderBroke = defHit.broke && !atkHit.broke;
  const attackerBroke = atkHit.broke;

  lines.push(
    `Arazi: ${terrain.name} (cephe ${terrain.combatWidth}) · Hava: ${weather.name}`,
    `Saldıran ${atk.engaged.length}/${atk.units.length} birlik cephede, güç ${A.toFixed(0)}`,
    `Savunan ${def.engaged.length}/${def.units.length} birlik cephede, güç ${D.toFixed(0)}`,
  );
  if (avgEntrench > 0.5) lines.push(`Siperlenme ${avgEntrench.toFixed(1)} → savunma +%${(avgEntrench * ENTRENCH_PER_LEVEL * 100).toFixed(0)}`);
  if (input.fortLevel > 0) lines.push(`Tahkimat ${input.fortLevel} → savunma +%${(input.fortLevel * FORT_PER_LEVEL * 100).toFixed(0)}`);
  if (input.navalSupport > 0) lines.push(`Deniz topçusu desteği +${input.navalSupport.toFixed(0)}`);
  if (input.airSupport > 0) lines.push(`Hava desteği +${input.airSupport.toFixed(0)}`);
  if (atkAmmo < 0.9) lines.push(`Saldıranın cephanesi kıt (×${atkAmmo.toFixed(2)})`);
  if (defAmmo < 0.9) lines.push(`Savunanın cephanesi kıt (×${defAmmo.toFixed(2)})`);
  lines.push(
    `Kayıp — saldıran ${atkHit.menLost}, savunan ${defHit.menLost}`,
    defenderBroke
      ? 'Savunan hattı kırıldı, çekiliyor.'
      : attackerBroke
        ? 'Taarruz kırıldı.'
        : 'Hat tutuyor; muharebe sürüyor.',
  );

  const report: CombatReport = {
    id: `kara_${input.province}_${state.day}`,
    day: state.day,
    kind: 'kara',
    province: input.province,
    title: `${p.name} — kara muharebesi`,
    lines,
    losses,
    winner: defenderBroke ? input.attacker : attackerBroke ? defender : null,
  };

  return {
    report,
    defenderBroke,
    attackerBroke,
    retreating: defenderBroke ? def.units : attackerBroke ? atk.units : [],
  };
}

/** Taraf cephane havuzunun muharebe verimine etkisi (0.35 .. 1). */
export function ammoFactor(state: GameState, side: Side): number {
  const s = state.sides[side];
  const need = 2500;
  return Math.max(0.35, Math.min(1, s.ammo / need));
}

/** Muharebe dışı günlük toparlanma: organizasyon, siper, takviye. */
export function dailyRecovery(state: GameState, u: LandUnit): void {
  const mods = commanderMods(state, u.commanderId);
  if (u.inCombat) {
    u.inCombat = false;
    return;
  }
  const rate = 0.14 * (1 + mods.orgRecovery) * (0.3 + 0.7 * u.supplied);
  u.organisation = Math.min(u.maxOrganisation, u.organisation + u.maxOrganisation * rate);

  const terrain = TERRAINS[prov(u.location).terrain];
  if (!u.order || u.order.kind === 'bekle' || u.order.kind === 'siperlen') {
    const dig = (u.order?.kind === 'siperlen' ? 0.9 : 0.35) * terrain.digInMod * (1 + mods.digIn);
    u.entrenchment = Math.min(MAX_ENTRENCHMENT, u.entrenchment + dig);
  }
}

/** Takviye: insan gücü havuzundan eksik kadro doldurulur. */
export function reinforce(state: GameState, u: LandUnit): void {
  const gap = u.maxStrength - u.strength;
  if (gap <= 0) return;
  const pool = state.sides[u.side];
  // Günde kadronun en çok %3'ü, ikmal ve havuzla sınırlı.
  const want = Math.min(gap, Math.ceil(u.maxStrength * 0.03 * u.supplied));
  const got = Math.min(want, pool.manpower);
  if (got <= 0) return;
  u.strength += got;
  pool.manpower -= got;
  // Yeni erler tecrübeyi seyreltir.
  u.experience = Math.max(0, u.experience * (1 - got / Math.max(1, u.strength)) * 0.98 + 0);
}

/** Bir tümenin kaç top namlusu taşıdığı — rapor ve ikmal için. */
export function gunCount(templateId: string): number {
  const tpl = TEMPLATE_BY_ID[templateId];
  if (!tpl) return 0;
  let n = 0;
  for (const [kind, c] of Object.entries(tpl.battalions)) {
    n += BATTALIONS[kind as keyof typeof BATTALIONS].guns * (c ?? 0);
  }
  return n;
}
