import type {
  Commander,
  DayIndex,
  Fleet,
  Fort,
  GameState,
  LandUnit,
  Minefield,
  ProvinceState,
  Scenario,
  Ship,
  Side,
  SideState,
  UnitId,
  VictoryRules,
} from '../core/types.ts';
import { SIDE_OF_NATION } from '../core/types.ts';
import { MAP, makeProjection, prov, provinceAt } from '../core/geo.ts';
import { FORT_AMMO_PER_HEAVY_GUN, FORT_AMMO_PER_LIGHT_GUN, FORTS, HEAVY_CALIBRE } from '../data/forts.ts';
import { GUN_BY_ID } from '../data/guns.ts';
import { MINEFIELDS } from '../data/minefields.ts';
import { COMMANDERS } from '../data/commanders.ts';
import { AIR_WINGS, ENTENTE_LAND, FLEETS, OTTOMAN_LAND } from '../data/oob.ts';
import { EVENTS } from '../data/events.ts';
import { SHIP_CLASSES } from '../data/ships.ts';
import { TEMPLATE_BY_ID, TEMPLATES, aggregate } from '../data/units.ts';

export const START_DATE = '1915-02-19';
export const END_DATE = '1916-01-09';

const MS_PER_DAY = 86400000;

export function dayOf(iso: string, start = START_DATE): DayIndex {
  return Math.round((Date.parse(iso) - Date.parse(start)) / MS_PER_DAY);
}

export function isoOf(day: DayIndex, start = START_DATE): string {
  return new Date(Date.parse(start) + day * MS_PER_DAY).toISOString().slice(0, 10);
}

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const PROJ = makeProjection(MAP.origin);

/** Tabya mühimmatı: ağır namlular az, hafifler bol atış taşır. */
function fortAmmo(guns: Readonly<Record<string, number>>): number {
  let total = 0;
  for (const [gunId, n] of Object.entries(guns)) {
    const g = GUN_BY_ID[gunId];
    if (!g) throw new Error(`bilinmeyen top: ${gunId}`);
    total += n * (g.calibre >= HEAVY_CALIBRE ? FORT_AMMO_PER_HEAVY_GUN : FORT_AMMO_PER_LIGHT_GUN);
  }
  return total;
}

function buildForts(): Record<string, Fort> {
  const out: Record<string, Fort> = {};
  for (const f of FORTS) {
    const pos = PROJ.toMetres(f.lon, f.lat);
    const province = provinceAt(pos);
    if (!province) throw new Error(`${f.id} tabyası hiçbir ile düşmüyor`);
    const ammo = fortAmmo(f.guns);
    out[f.id] = {
      id: f.id,
      name: f.name,
      ...(f.nameEn ? { nameEn: f.nameEn } : {}),
      ...(f.fortNo ? { fortNo: f.fortNo } : {}),
      shore: f.shore,
      group: f.group,
      pos,
      province: province.id,
      mobile: f.mobile ?? false,
      guns: Object.entries(f.guns).map(([gunId, count]) => ({ gunId, count })),
      ammo,
      maxAmmo: ammo,
      integrity: 1,
      suppression: 0,
      // Dış tahkimat savaş öncesinden beri İtilaf haritalarında işaretliydi;
      // hareketli obüsler ve ara tahkimat ise bilinmiyordu.
      spotted: f.group === 'dis',
      src: f.src,
      ...(f.note ? { note: f.note } : {}),
    };
  }
  return out;
}

function buildMinefields(): Record<string, Minefield> {
  const out: Record<string, Minefield> = {};
  for (const m of MINEFIELDS) {
    const from = PROJ.toMetres(m.from[0], m.from[1]);
    const to = PROJ.toMetres(m.to[0], m.to[1]);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const province = provinceAt(mid);
    if (!province) throw new Error(`${m.id} mayın hattı hiçbir ile düşmüyor`);
    if (!province.isSea) throw new Error(`${m.id} mayın hattı karaya düşüyor: ${province.id}`);
    out[m.id] = {
      id: m.id,
      name: m.name,
      province: province.id,
      from,
      to,
      mines: m.mines,
      initialMines: m.mines,
      depth: m.depth,
      laidOn: dayOf(m.laidOn),
      side: 'ottoman',
      // Kepez hatları (1-10) aylardır yerinde ve İtilaf Şubat'tan beri
      // oraları tarıyor — konumları biliniyor. Nusret'in 8 Mart'ta döktüğü
      // 11. hat ise görülmedi; 18 Mart'ın sebebi tam olarak bu.
      spotted: Date.parse(m.laidOn) < Date.parse('1915-03-01'),
      src: m.src,
      ...(m.note ? { note: m.note } : {}),
    };
  }
  return out;
}

function buildCommanders(): Record<string, Commander> {
  const out: Record<string, Commander> = {};
  for (const c of COMMANDERS) {
    out[c.id] = {
      id: c.id,
      name: c.name,
      rank: c.rank,
      side: c.side,
      nation: c.nation,
      kind: c.kind,
      bio: c.bio,
      skill: c.skill,
      traits: c.traits,
      availableFrom: dayOf(c.from),
      src: c.src,
      assignedTo: null,
    };
  }
  return out;
}

function buildLandUnits(): Record<UnitId, LandUnit> {
  const out: Record<UnitId, LandUnit> = {};
  for (const u of [...OTTOMAN_LAND, ...ENTENTE_LAND]) {
    const tpl = TEMPLATE_BY_ID[u.templateId];
    if (!tpl) throw new Error(`bilinmeyen şablon: ${u.templateId}`);
    const agg = aggregate(tpl);
    const side = SIDE_OF_NATION[u.nation];
    prov(u.location); // doğrulama
    out[u.id] = {
      id: u.id,
      name: u.name,
      nation: u.nation,
      side,
      templateId: u.templateId,
      location: u.location,
      strength: agg.men,
      maxStrength: agg.men,
      organisation: agg.organisation,
      maxOrganisation: agg.organisation,
      entrenchment: side === 'ottoman' ? 2 : 0,
      experience: side === 'ottoman' ? 15 : 5,
      supplied: 1,
      commanderId: u.commanderId ?? null,
      order: null,
      moveProgress: 0,
      inCombat: false,
      embarkedIn: null,
    };
  }
  return out;
}

function buildFleets(): Record<UnitId, Fleet> {
  const out: Record<UnitId, Fleet> = {};
  for (const f of FLEETS) {
    const side = SIDE_OF_NATION[f.nation];
    const p = prov(f.location);
    if (!p.isSea) throw new Error(`${f.id} filosu kara iline konuldu: ${f.location}`);
    const ships: Ship[] = f.ships.map((s, i) => ({
      id: `${f.id}_s${i}`,
      name: s.name,
      nation: f.nation,
      cls: s.cls,
      hull: 1,
      ammo: 1,
      mines: SHIP_CLASSES[s.cls].mineCapacity,
      ...(s.note ? { historicalNote: s.note } : {}),
    }));
    out[f.id] = {
      id: f.id,
      name: f.name,
      nation: f.nation,
      side,
      location: f.location,
      ships,
      commanderId: f.commanderId ?? null,
      order: null,
      moveProgress: 0,
      embarked: [],
      inCombat: false,
    };
  }
  return out;
}

function buildAir() {
  const out: GameState['airWings'] = {};
  for (const a of AIR_WINGS) {
    prov(a.base);
    // Sonradan gelen filolar sahada YOK: uçak sayısı varış gününe kadar 0.
    // Aksi hâlde 1 Temmuz'da gelen bombardıman müfrezesi 19 Şubat'ta uçuyor.
    const later = a.arrives !== undefined && dayOf(a.arrives) > 0;
    out[a.id] = {
      id: a.id,
      name: a.name,
      nation: a.nation,
      side: SIDE_OF_NATION[a.nation],
      role: a.role,
      planes: later ? 0 : a.planes,
      maxPlanes: a.planes,
      base: a.base,
      // 1915 uçakları: pratik keşif yarıçapı ~60 km.
      range: 60000,
      order: null,
    };
  }
  return out;
}

function buildProvinceStates(): Record<string, ProvinceState> {
  const out: Record<string, ProvinceState> = {};
  for (const p of MAP.provinces) {
    const owner = p.startOwner;
    out[p.id] = {
      owner,
      controller: owner,
      supply: owner ? 1 : 0,
      // Boğazı kapatan tahkimat seviyesi: tabyası olan iller başlangıçta güçlü.
      fortLevel: 0,
      seen: { ottoman: owner === 'ottoman', entente: owner === 'entente' },
      lastSeen: { ottoman: owner === 'ottoman' ? 0 : -1, entente: owner === 'entente' ? 0 : -1 },
    };
  }
  return out;
}

const SIDES: Readonly<Record<Side, SideState>> = {
  ottoman: {
    side: 'ottoman',
    // 5. Ordu nihayetinde ~315.000 kişiye ulaştı; havuz takviye akışıdır.
    manpower: 60000,
    manpowerPerDay: 420,
    morale: 0.62,
    ammo: 24000,
    // Kronik darboğaz, ama tabyaları besleyebilecek kadar.
    ammoPerDay: 950,
    intel: 0.25,
  },
  entente: {
    side: 'entente',
    manpower: 90000,
    manpowerPerDay: 700,
    morale: 0.8,
    // "Düşman çok cephane, az insan harcıyor" — Liman von Sanders, 22.06.1915
    ammo: 400000,
    ammoPerDay: 3500,
    intel: 0.2,
  },
};

const VICTORY: VictoryRules = {
  // İtilaf bu üç deniz ilini ele geçirirse boğaz zorlanmış sayılır.
  ententeStraitProvinces: ['d_dar_bogaz', 'd_nagara', 'd_marmara_agzi'],
  // Üç büyük gemi kaybı tarihsel 18 Mart bilançosudur; altısında filo çekilir.
  ententeCapitalShipLimit: 6,
  // Kilitbahir platosu ve Çanakkale düşerse boğaz savunması çöker.
  ottomanMustHold: ['kilitbahir', 'canakkale'],
  lastDay: dayOf(END_DATE),
};

export const SCENARIO: Scenario = {
  id: 'canakkale_1915',
  name: 'Çanakkale 1915',
  desc:
    '19 Şubat 1915 — Birleşik Filo boğaz ağzında. 9 Ocak 1916\'ya kadar ' +
    'boğazı zorla ya da savun.',
  startDate: START_DATE,
  endDate: END_DATE,
  playerSide: 'ottoman',
  map: MAP,
  templates: TEMPLATES,
  landUnits: [...OTTOMAN_LAND, ...ENTENTE_LAND].map((u) => ({
    ...u,
    ...(u.arrives ? { arrivesOn: dayOf(u.arrives) } : {}),
  })),
  fleets: FLEETS.map((f) => ({ ...f, ...(f.arrives ? { arrivesOn: dayOf(f.arrives) } : {}) })),
  airWings: AIR_WINGS.map((a) => ({ ...a, ...(a.arrives ? { arrivesOn: dayOf(a.arrives) } : {}) })),
  forts: Object.values(buildForts()),
  minefields: Object.values(buildMinefields()),
  commanders: Object.values(buildCommanders()),
  events: EVENTS.map((e) => ({
    id: e.id,
    day: dayOf(e.date),
    date: e.date,
    title: e.title,
    body: e.body,
    kind: e.kind,
    src: e.src,
    ...(e.effect ? { effect: e.effect } : {}),
    ...(e.choices ? { choices: e.choices } : {}),
  })),
  sides: SIDES,
  victory: VICTORY,
};

/** Yeni oyun durumu. */
export function newGame(playerSide: Side = 'ottoman', seed = 19150318): GameState {
  const landUnits = buildLandUnits();
  const fleets = buildFleets();

  // Takviyeler sahada değil: varış gününe kadar sahneden çıkarılır.
  for (const u of SCENARIO.landUnits) {
    if (u.arrivesOn !== undefined && u.arrivesOn > 0) {
      const unit = landUnits[u.id];
      if (unit) unit.embarkedIn = 'bekleme';
    }
  }

  const commanders = buildCommanders();
  for (const u of Object.values(landUnits)) {
    if (u.commanderId && commanders[u.commanderId]) {
      commanders[u.commanderId]!.assignedTo = u.id;
    }
  }
  for (const f of Object.values(fleets)) {
    if (f.commanderId && commanders[f.commanderId]) {
      commanders[f.commanderId]!.assignedTo = f.id;
    }
  }

  return {
    day: 0,
    date: START_DATE,
    phase: 'emir',
    weather: 'acik',
    playerSide,
    provinces: buildProvinceStates(),
    landUnits,
    fleets,
    airWings: buildAir(),
    forts: buildForts(),
    minefields: buildMinefields(),
    commanders,
    sides: structuredClone(SIDES) as Record<Side, SideState>,
    reports: [],
    firedEvents: [],
    pendingEvents: [],
    rngState: seed,
    outcome: null,
  };
}
