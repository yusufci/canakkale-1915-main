import type { CombatReport, GameState, ProvinceId } from '../core/types.ts';
import { dist, prov } from '../core/geo.ts';
import { WEATHERS } from '../data/units.ts';
import type { Rng } from './rng.ts';

/**
 * Hava harekâtı — 1915 ölçeği.
 *
 * 1915'te uçak üç işe yarıyordu: keşif, topçu gözetleme, sembolik bombardıman.
 * Keşif belirleyiciydi: Ark Royal'in uçakları 16-17 Mart'ta mayın tespit etti
 * ama Nusret'in yeni hattını göremedi — kampanyanın dönüm noktası bu körlük
 * oldu. 18 Mart sabahı Yüzbaşı Serno ve Schneider ise filoyu zamanında
 * raporladı.
 *   https://canakkalesavaslari.comu.edu.tr/canakkale-savaslari-kronolojisi.html
 */

/** Görev başına uçak kaybı (uçaksavar + arıza). */
const SORTIE_LOSS = 0.04;

export function resolveAir(state: GameState, rng: Rng): CombatReport[] {
  const reports: CombatReport[] = [];
  const flying = WEATHERS[state.weather].flying;

  for (const w of Object.values(state.airWings)) {
    if (w.planes <= 0 || !w.order?.target) continue;
    const target = w.order.target;
    const from = prov(w.base).center;
    const to = prov(target).center;
    if (dist(from, to) > w.range) continue;
    if (flying <= 0) continue;
    if (!rng.chance(flying)) continue;

    const strength = (w.planes / Math.max(1, w.maxPlanes)) * flying;
    const st = state.provinces[target];
    if (!st) continue;

    switch (w.role) {
      case 'kesif': {
        st.seen[w.side] = true;
        st.lastSeen[w.side] = state.day;
        const found: string[] = [];
        // Tabyaları ortaya çıkar — sabit olanlar kolay, hareketli obüsler zor.
        for (const f of Object.values(state.forts)) {
          if (f.province !== target || f.spotted) continue;
          const chance = (f.mobile ? 0.18 : 0.55) * strength;
          if (rng.chance(chance)) {
            f.spotted = true;
            found.push(f.name);
          }
        }
        // Mayın hatları: berrak suda görülebilir ama derindeki hat kaçar.
        for (const m of Object.values(state.minefields)) {
          if (m.province !== target || m.spotted || m.side === w.side || m.laidOn > state.day) continue;
          const chance = 0.3 * strength * Math.max(0.2, 1 - m.depth / 12);
          if (rng.chance(chance)) {
            m.spotted = true;
            found.push(`${m.name} (${m.mines} mayın)`);
          }
        }
        state.sides[w.side].intel = Math.min(1, state.sides[w.side].intel + 0.02 * strength);
        reports.push(
          airReport(state, w.id, target, 'Keşif uçuşu', [
            found.length > 0
              ? `Tespit edildi: ${found.join(', ')}`
              : 'Kayda değer bir şey görülmedi.',
          ]),
        );
        break;
      }
      case 'gozetleme':
        // Etkisi naval.airSpottingBonus içinde okunur; burada yalnız görüş.
        st.seen[w.side] = true;
        st.lastSeen[w.side] = state.day;
        break;
      case 'bombardiman': {
        const victims = Object.values(state.landUnits).filter(
          (u) => u.location === target && u.side !== w.side && !u.embarkedIn,
        );
        if (victims.length === 0) break;
        const lines: string[] = [];
        for (const u of victims) {
          const hit = Math.round(u.strength * 0.004 * strength * rng.jitter(0.5));
          u.strength = Math.max(0, u.strength - hit);
          u.organisation = Math.max(0, u.organisation - u.maxOrganisation * 0.03 * strength);
          lines.push(`${u.name}: ${hit} kayıp`);
        }
        reports.push(airReport(state, w.id, target, 'Hava bombardımanı', lines));
        break;
      }
      case 'avci': {
        const enemies = Object.values(state.airWings).filter(
          (e) => e.side !== w.side && e.planes > 0 && e.order?.target === target,
        );
        if (enemies.length === 0) break;
        const lines: string[] = [];
        for (const e of enemies) {
          if (rng.chance(0.25 * strength)) {
            e.planes = Math.max(0, e.planes - 1);
            lines.push(`${e.name} bir uçak kaybetti.`);
          }
        }
        if (lines.length > 0) reports.push(airReport(state, w.id, target, 'Hava muharebesi', lines));
        break;
      }
    }

    if (rng.chance(SORTIE_LOSS)) w.planes = Math.max(0, w.planes - 1);
  }

  return reports;
}

function airReport(
  state: GameState,
  wingId: string,
  target: ProvinceId,
  title: string,
  lines: string[],
): CombatReport {
  const w = state.airWings[wingId]!;
  return {
    id: `hava_${wingId}_${state.day}`,
    day: state.day,
    kind: 'hava',
    province: target,
    title: `${prov(target).name} — ${title} (${w.name})`,
    lines,
    losses: {
      ottoman: { men: 0, ships: 0, guns: 0 },
      entente: { men: 0, ships: 0, guns: 0 },
    },
    winner: null,
  };
}

/**
 * Günlük uçak onarımı. `planes > 0` şartı önemli: henüz cepheye gelmemiş
 * filolar 0 uçakla başlar ve bu şart olmazsa varış gününden önce dolarlar.
 */
export function repairAir(state: GameState): void {
  if (state.day % 5 !== 0) return;
  for (const w of Object.values(state.airWings)) {
    if (w.planes > 0 && w.planes < w.maxPlanes) w.planes += 1;
  }
}
