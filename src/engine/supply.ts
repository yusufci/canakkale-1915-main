import type { GameState, ProvinceId, Side } from '../core/types.ts';
import { MAP, prov, provinceDist } from '../core/geo.ts';
import { commanderMods, templateStats } from './combat.ts';

/**
 * İkmal. HOI4'ün ikmal merkezi + akış + mesafe yıpranması modelinin
 * basitleştirilmiş hâli.
 *
 * Her tarafın ikmal merkezlerinden (liman, şehir, ada üssü) kontrol ettiği
 * iller boyunca kapasite yayılır; her adımda mesafeye göre azalır. Bir ildeki
 * toplam talep arzı aşarsa oradaki bütün birlikler orantılı olarak aç kalır.
 *
 * Çanakkale'de bu belirleyiciydi: İtilaf her şeyi denizden taşıdı, Osmanlı
 * cepheyi dar bir kara yolundan besledi.
 */

/** Her kilometrede ikmal kapasitesi bu oranda azalır. */
const DECAY_PER_KM = 0.016;
/** Deniz üzerinden ikmal daha ucuzdur ama limana bağlıdır. */
const SEA_DECAY_PER_KM = 0.006;

export interface SupplySnapshot {
  /** il -> taraf başına ulaşan ikmal kapasitesi (adam/gün). */
  readonly capacity: Readonly<Record<ProvinceId, Record<Side, number>>>;
  readonly demand: Readonly<Record<ProvinceId, Record<Side, number>>>;
}

/** Bu ilde o tarafın karaya çıkmış birliği var mı. */
function hasUnits(state: GameState, id: string, side: 'ottoman' | 'entente'): boolean {
  for (const u of Object.values(state.landUnits)) {
    if (u.location === id && u.side === side && !u.embarkedIn && u.strength > 0) return true;
  }
  return false;
}

export function computeSupply(state: GameState): SupplySnapshot {
  const capacity: Record<ProvinceId, Record<Side, number>> = {};
  const demand: Record<ProvinceId, Record<Side, number>> = {};
  for (const p of MAP.provinces) {
    capacity[p.id] = { ottoman: 0, entente: 0 };
    demand[p.id] = { ottoman: 0, entente: 0 };
  }

  for (const side of ['ottoman', 'entente'] as const) {
    // Dijkstra benzeri yayılım: en iyi kapasite kazanır.
    const best: Record<ProvinceId, number> = {};
    const queue: { id: ProvinceId; cap: number }[] = [];

    for (const p of MAP.provinces) {
      if (p.supplyHub <= 0) continue;
      if (state.provinces[p.id]?.controller !== side) continue;
      const cap = p.supplyHub;
      best[p.id] = cap;
      queue.push({ id: p.id, cap });
    }

    while (queue.length > 0) {
      queue.sort((a, b) => b.cap - a.cap);
      const node = queue.shift()!;
      if ((best[node.id] ?? 0) > node.cap) continue;
      const here = prov(node.id);
      for (const nb of here.neighbours) {
        const nbState = state.provinces[nb];
        if (!nbState) continue;
        const nbProv = prov(nb);
        // Düşman kontrolündeki karadan ikmal geçmez; deniz serbesttir
        // (deniz hâkimiyeti ayrı bir mesele, filo varlığıyla modellenir).
        //
        // İSTİSNA — kıyıdan ikmal: tartışmalı bir sahil ilinde kendi
        // birliğimiz varsa oraya denizden ikmal akar. Bu olmadan çıkarma
        // yapan birlik köprübaşında anında ikmalsiz kalıp eriyor; oysa
        // Gelibolu'da İtilaf baştan sona her şeyi denizden taşıdı.
        const beachhead =
          nbProv.isSea === false &&
          prov(node.id).isSea &&
          hasUnits(state, nb, side);
        if (!nbProv.isSea && !beachhead && nbState.controller !== side &&
            nbState.controller !== null) {
          continue;
        }
        const km = provinceDist(node.id, nb) / 1000;
        const decay = nbProv.isSea ? SEA_DECAY_PER_KM : DECAY_PER_KM;
        const next = node.cap * Math.max(0, 1 - km * decay);
        if (next <= 50) continue;
        if (next > (best[nb] ?? 0)) {
          best[nb] = next;
          queue.push({ id: nb, cap: next });
        }
      }
    }

    for (const [id, cap] of Object.entries(best)) {
      const slot = capacity[id];
      if (slot) slot[side] = cap;
    }
  }

  for (const u of Object.values(state.landUnits)) {
    if (u.embarkedIn) continue;
    const slot = demand[u.location];
    if (!slot) continue;
    const stats = templateStats(u.templateId);
    // Talep: mevcut asker + topçunun ağırlığı.
    slot[u.side] += u.strength + stats.guns * 220;
  }

  return { capacity, demand };
}

/** İkmal durumunu birimlere uygula; tedarik oranını ve yıpranmayı yazar. */
export function applySupply(state: GameState): void {
  const { capacity, demand } = computeSupply(state);

  for (const p of MAP.provinces) {
    const cap = capacity[p.id]!;
    const dem = demand[p.id]!;
    const st = state.provinces[p.id]!;
    const side = st.controller;
    if (!side) {
      st.supply = 0;
      continue;
    }
    st.supply = dem[side] > 0 ? Math.min(1, cap[side] / dem[side]) : cap[side] > 0 ? 1 : 0;
  }

  for (const u of Object.values(state.landUnits)) {
    if (u.embarkedIn) {
      // Gemideki birlik donanmadan beslenir.
      u.supplied = 0.9;
      continue;
    }
    const cap = capacity[u.location]![u.side];
    const dem = demand[u.location]![u.side];
    const mods = commanderMods(state, u.commanderId);
    const raw = dem > 0 ? cap / dem : 1;
    u.supplied = Math.max(0, Math.min(1, raw * (1 + mods.logistics)));

    if (u.supplied < 0.5) {
      // İkmalsiz birlik erir: önce organizasyon, sonra mevcut.
      const deficit = 0.5 - u.supplied;
      u.organisation = Math.max(0, u.organisation - u.maxOrganisation * deficit * 0.25);
      u.strength = Math.max(0, u.strength - Math.round(u.maxStrength * deficit * 0.012));
    }
  }
}

/** Taraf günlük insan gücü ve cephane gelirini havuza ekler. */
/**
 * Cephane havuzu tavanı. Osmanlı için kıtlık oyunun belkemiği: üretim yok,
 * ikmal Almanya'dan Sırbistan düşene (Kasım 1915) kadar gelmiyor. Tavan
 * olmazsa kullanılmayan cephane birikip kıtlığı anlamsızlaştırıyor.
 */
const AMMO_CAP: Record<Side, number> = { ottoman: 45000, entente: 600000 };
/** İnsan gücü havuzu tavanı — sonsuz yedek yok. */
const MANPOWER_CAP: Record<Side, number> = { ottoman: 120000, entente: 160000 };

export function accrueResources(state: GameState): void {
  for (const side of ['ottoman', 'entente'] as const) {
    const s = state.sides[side];
    s.manpower = Math.min(MANPOWER_CAP[side], s.manpower + s.manpowerPerDay);
    s.ammo = Math.min(AMMO_CAP[side], s.ammo + s.ammoPerDay);
  }
}
