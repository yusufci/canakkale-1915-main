import type { GameMap, LonLat, Province, ProvinceId, Terrain, Vec2 } from './types.ts';
import rawMap from '../data/map.json';

const M_PER_DEG_LAT = 110574.0;
const DEG = Math.PI / 180;

/**
 * Yerel eşdikdörtgen izdüşüm. Tiyatro 60×90 km olduğundan bu izdüşümün
 * hatası metre altındadır ve tüm mesafeler doğrudan metre cinsindendir.
 * Ekran düzeni: doğu +x, KUZEY -y.
 */
export function makeProjection(origin: LonLat) {
  const kx = Math.cos(origin.lat * DEG) * 111320.0;
  return {
    toMetres(lon: number, lat: number): Vec2 {
      return { x: (lon - origin.lon) * kx, y: -(lat - origin.lat) * M_PER_DEG_LAT };
    },
    toLonLat(p: Vec2): LonLat {
      return { lon: origin.lon + p.x / kx, lat: origin.lat - p.y / M_PER_DEG_LAT };
    },
  };
}

interface RawProvince {
  id: string;
  name: string;
  isSea: boolean;
  terrain: string;
  center: Vec2;
  polygon: Vec2[];
  elevation: number;
  peak: number;
  areaKm2: number;
  victoryPoints: number;
  supplyHub: number;
  startOwner: string | null;
  neighbours: string[];
  beachAccess: string[];
  lon: number;
  lat: number;
  geoSrc: string;
  straitWidth?: number;
  current?: number;
  beach?: boolean;
}

interface RawMap {
  origin: LonLat;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  relief: {
    image: string;
    width: number;
    height: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  provinces: RawProvince[];
  coastRings: [number, number][][];
}

const RAW = rawMap as unknown as RawMap;

/** Küçük iller harita etiketi taşımaz; büyük/önemli olanlar taşır. */
function isLabelled(p: RawProvince): boolean {
  return p.victoryPoints >= 2 || p.areaKm2 > 60 || p.supplyHub > 0;
}

const PROVINCES: Province[] = RAW.provinces.map((p) => ({
  id: p.id,
  name: p.name,
  labelled: isLabelled(p),
  isSea: p.isSea,
  terrain: p.terrain as Terrain,
  center: p.center,
  polygon: p.polygon,
  elevation: p.elevation,
  peak: p.peak,
  neighbours: p.neighbours,
  beachAccess: p.beachAccess,
  victoryPoints: p.victoryPoints,
  supplyHub: p.supplyHub,
  startOwner: p.startOwner === 'ottoman' || p.startOwner === 'entente' ? p.startOwner : null,
  ...(p.straitWidth !== undefined ? { straitWidth: p.straitWidth } : {}),
  ...(p.current !== undefined ? { current: p.current } : {}),
}));

export const MAP: GameMap = {
  origin: RAW.origin,
  provinces: PROVINCES,
  coastRings: RAW.coastRings.map((r) => r.map(([x, y]) => ({ x, y }))),
  bounds: RAW.bounds,
  relief: {
    width: RAW.relief.width,
    height: RAW.relief.height,
    minX: RAW.relief.minX,
    minY: RAW.relief.minY,
    cell: (RAW.relief.maxX - RAW.relief.minX) / RAW.relief.width,
    data: new Int16Array(0), // doku GPU'da; CPU tarafında örneklenmiyor
  },
  landmarks: PROVINCES.filter((p) => !p.isSea && p.victoryPoints > 0).map((p) => ({
    name: p.name,
    pos: p.center,
    kind: p.terrain === 'sehir' ? 'sehir' : p.terrain === 'dag' ? 'tepe' : 'koy',
    minZoom: p.victoryPoints >= 4 ? 0 : 0.6,
  })),
};

export const RELIEF_BOX = RAW.relief;

export const PROVINCE: Readonly<Record<ProvinceId, Province>> = Object.fromEntries(
  PROVINCES.map((p) => [p.id, p]),
);

/** İl kimliğini al; yoksa anlaşılır hata ver (sessiz undefined yerine). */
export function prov(id: ProvinceId): Province {
  const p = PROVINCE[id];
  if (!p) throw new Error(`bilinmeyen il: ${id}`);
  return p;
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** İki il merkezi arasındaki metre cinsinden mesafe. */
export function provinceDist(a: ProvinceId, b: ProvinceId): number {
  return dist(prov(a).center, prov(b).center);
}

/** Nokta çokgenin içinde mi (ray casting). */
export function pointInPolygon(pt: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Metre konumundan ili bul; hiçbirine düşmezse null. */
export function provinceAt(pt: Vec2): Province | null {
  // Merkeze yakınlıktan sıralayıp ilk kapsayanı al — çokgen testi pahalı.
  let best: Province | null = null;
  let bestD = Infinity;
  for (const p of PROVINCES) {
    const d = dist(pt, p.center);
    if (d < bestD && pointInPolygon(pt, p.polygon)) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Bir noktanın doğru parçasına en kısa uzaklığı (metre). */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-9) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

/**
 * İl grafiğinde en kısa yol (A*, kenar maliyeti merkez mesafesi × arazi).
 * `passable` ile kara/deniz ayrımı ve düşman kontrolü süzülür.
 */
export function findPath(
  from: ProvinceId,
  to: ProvinceId,
  passable: (id: ProvinceId) => boolean,
  cost: (id: ProvinceId) => number = () => 1,
): ProvinceId[] | null {
  if (from === to) return [];
  const open = new Map<ProvinceId, number>([[from, 0]]);
  const g = new Map<ProvinceId, number>([[from, 0]]);
  const prev = new Map<ProvinceId, ProvinceId>();
  const closed = new Set<ProvinceId>();
  const target = prov(to).center;

  while (open.size > 0) {
    let cur: ProvinceId | null = null;
    let curF = Infinity;
    for (const [id, f] of open) {
      if (f < curF) {
        curF = f;
        cur = id;
      }
    }
    if (cur === null) break;
    open.delete(cur);
    if (cur === to) {
      const path: ProvinceId[] = [];
      for (let n: ProvinceId | undefined = to; n && n !== from; n = prev.get(n)) path.unshift(n);
      return path;
    }
    closed.add(cur);
    const gCur = g.get(cur)!;
    for (const nb of prov(cur).neighbours) {
      if (closed.has(nb)) continue;
      if (nb !== to && !passable(nb)) continue;
      const step = provinceDist(cur, nb) * cost(nb);
      const gNext = gCur + step;
      if (gNext < (g.get(nb) ?? Infinity)) {
        g.set(nb, gNext);
        prev.set(nb, cur);
        open.set(nb, gNext + dist(prov(nb).center, target));
      }
    }
  }
  return null;
}
