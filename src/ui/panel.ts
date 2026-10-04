import type {
  Fleet,
  GameState,
  LandOrderKind,
  LandUnit,
  NavalOrderKind,
  ProvinceId,
} from '../core/types.ts';
import { prov } from '../core/geo.ts';
import { GUN_BY_ID } from '../data/guns.ts';
import { SHIP_CLASSES } from '../data/ships.ts';
import { TERRAINS } from '../data/units.ts';
import { commanderMods, templateStats } from '../engine/combat.ts';
import {
  CRIPPLED_HULL,
  fortRange,
  liveShips,
  minefieldsIn,
} from '../engine/naval.ts';
import { landOrderOptions, navalOrderOptions } from '../engine/orders.ts';
import type { Selection } from '../render/map.ts';
import { TRAITS } from '../data/commanders.ts';
import { sound } from '../engine/audio.ts';

/**
 * Sağ panel. Seçime göre il / birlik / filo / tabya ayrıntısı ve emir menüsü.
 * Emir butonlarının etkinliği motorla AYNI kuraldan gelir (engine/orders.ts),
 * böylece arayüz "verilebilir" deyip motor reddetmez.
 */

export interface PanelCallbacks {
  issueLand(unitId: string, kind: LandOrderKind, needsTarget: boolean): void;
  issueNaval(fleetId: string, kind: NavalOrderKind, needsTarget: boolean): void;
  select(sel: Selection): void;
  focus(id: ProvinceId): void;
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const num = (n: number): string => Math.round(n).toLocaleString('tr-TR');

function bar(value: number, max: number, cls = ''): string {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return `<div class="olcek ${cls}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

function row(label: string, value: string): string {
  return `<div class="satir"><span>${esc(label)}</span><span>${value}</span></div>`;
}

export class Panel {
  private el: HTMLElement;
  private cb: PanelCallbacks;

  constructor(el: HTMLElement, cb: PanelCallbacks) {
    this.el = el;
    this.cb = cb;
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  private onClick(e: MouseEvent): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    sound.playOrderClick();
    const act = t.dataset.act!;
    const needsTarget = t.dataset.target === '1';
    if (act === 'kara') {
      this.cb.issueLand(t.dataset.unit!, t.dataset.kind as LandOrderKind, needsTarget);
    } else if (act === 'deniz') {
      this.cb.issueNaval(t.dataset.fleet!, t.dataset.kind as NavalOrderKind, needsTarget);
    } else if (act === 'sec') {
      this.cb.select({ kind: t.dataset.kind as Selection['kind'], id: t.dataset.id! });
    } else if (act === 'odak') {
      this.cb.focus(t.dataset.id!);
    }
  }

  render(s: GameState, sel: Selection | null): void {
    if (!sel) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    switch (sel.kind) {
      case 'il':
        this.el.innerHTML = this.province(s, sel.id);
        break;
      case 'birlik':
        this.el.innerHTML = this.unit(s, sel.id);
        break;
      case 'filo':
        this.el.innerHTML = this.fleet(s, sel.id);
        break;
      case 'tabya':
        this.el.innerHTML = this.fort(s, sel.id);
        break;
    }
  }

  // ────────────────────────────────────────────────────────────── il ──

  private province(s: GameState, id: ProvinceId): string {
    const p = prov(id);
    const st = s.provinces[id]!;
    const terrain = TERRAINS[p.terrain];
    const seen = st.seen[s.playerSide];

    const units = Object.values(s.landUnits).filter(
      (u) => u.location === id && !u.embarkedIn && u.strength > 0,
    );
    const fleets = Object.values(s.fleets).filter(
      (f) => f.location === id && liveShips(f).length > 0,
    );
    const forts = Object.values(s.forts).filter(
      (f) => f.province === id && (st.controller === s.playerSide || f.spotted),
    );
    const mines = minefieldsIn(s, id).filter(
      (m) => m.side === s.playerSide || m.spotted,
    );

    const owner =
      st.controller === 'ottoman' ? 'Osmanlı' : st.controller === 'entente' ? 'İtilaf' : '—';

    let html = `<h3>${esc(p.name)}</h3>
      <div class="kicker">${esc(terrain.name.toLocaleUpperCase('tr-TR'))} · ${
        p.isSea ? 'DENİZ' : 'KARA'
      }</div>`;

    if (!seen) {
      html += `<p class="not">Bu il hakkında güncel bilgi yok. Son görülme:
        ${st.lastSeen[s.playerSide] < 0 ? 'hiç' : `gün ${st.lastSeen[s.playerSide]}`}.
        Keşif uçuşu gönder.</p>`;
      return html;
    }

    html += `<div class="bolum"><h4>DURUM</h4>
      ${row('Hâkimiyet', esc(owner))}
      ${row('Zafer puanı', String(p.victoryPoints))}
      ${p.isSea ? '' : row('Ortalama rakım', `${p.elevation} m`)}
      ${p.isSea ? '' : row('Zirve', `${p.peak} m`)}
      ${p.straitWidth ? row('Boğaz genişliği', `${num(p.straitWidth)} m`) : ''}
      ${p.current ? row('Akıntı', `${p.current.toFixed(1)} knot`) : ''}
      ${row('Cephe genişliği', String(terrain.combatWidth))}
      ${row('Saldırana etki', `%${Math.round(terrain.attackMod * 100)}`)}
      ${row('Hareket maliyeti', `×${terrain.moveCost.toFixed(1)}`)}
      ${p.supplyHub > 0 ? row('İkmal merkezi', `${num(p.supplyHub)} kişi`) : ''}
      <div style="margin-top:8px">
        <div class="satir"><span>İkmal</span><span>%${Math.round(st.supply * 100)}</span></div>
        ${bar(st.supply, 1, st.supply > 0.7 ? 'yesil' : st.supply > 0.4 ? '' : 'kirmizi')}
      </div>
    </div>`;

    if (units.length > 0) {
      html += `<div class="bolum"><h4>BİRLİKLER</h4>`;
      for (const u of units) {
        html += `<button class="liste-ogesi ${u.side === 'ottoman' ? 'osm' : 'ent'}"
          data-act="sec" data-kind="birlik" data-id="${u.id}">
          <span>${esc(u.name)}</span>
          <span class="ikinci">${num(u.strength)} · org %${Math.round(
            (u.organisation / u.maxOrganisation) * 100,
          )}</span></button>`;
      }
      html += `</div>`;
    }

    if (fleets.length > 0) {
      html += `<div class="bolum"><h4>FİLOLAR</h4>`;
      for (const f of fleets) {
        html += `<button class="liste-ogesi ${f.side === 'ottoman' ? 'osm' : 'ent'}"
          data-act="sec" data-kind="filo" data-id="${f.id}">
          <span>${esc(f.name)}</span>
          <span class="ikinci">${liveShips(f).length} gemi</span></button>`;
      }
      html += `</div>`;
    }

    if (forts.length > 0) {
      html += `<div class="bolum"><h4>TABYALAR</h4>`;
      for (const f of forts) {
        html += `<button class="liste-ogesi osm"
          data-act="sec" data-kind="tabya" data-id="${f.id}">
          <span>${esc(f.name)}</span>
          <span class="ikinci">%${Math.round(f.integrity * 100)} · ${num(f.ammo)} atış</span>
        </button>`;
      }
      html += `</div>`;
    }

    if (mines.length > 0) {
      html += `<div class="bolum"><h4>MAYIN HATLARI</h4>`;
      for (const m of mines) {
        html += row(m.name, `${m.mines}/${m.initialMines} mayın`);
      }
      html += `</div>`;
    }

    return html;
  }

  // ───────────────────────────────────────────────────────── birlik ──

  private unit(s: GameState, id: string): string {
    const u = s.landUnits[id];
    if (!u) return '<p class="not">Birlik bulunamadı.</p>';
    const stats = templateStats(u.templateId);
    const cmd = u.commanderId ? s.commanders[u.commanderId] : null;
    const mods = commanderMods(s, u.commanderId);
    const here = prov(u.location);

    let html = `<h3>${esc(u.name)}</h3>
      <div class="kicker">${esc(here.name.toLocaleUpperCase('tr-TR'))} · ${
        u.side === 'ottoman' ? 'OSMANLI' : 'İTİLAF'
      }</div>

      <div class="bolum"><h4>DURUM</h4>
        <div class="satir"><span>Mevcut</span><span>${num(u.strength)} / ${num(
          u.maxStrength,
        )}</span></div>
        ${bar(u.strength, u.maxStrength)}
        <div class="satir"><span>Organizasyon</span><span>${Math.round(
          u.organisation,
        )} / ${Math.round(u.maxOrganisation)}</span></div>
        ${bar(u.organisation, u.maxOrganisation, u.organisation < u.maxOrganisation * 0.3 ? 'kirmizi' : '')}
        <div class="satir"><span>İkmal</span><span>%${Math.round(u.supplied * 100)}</span></div>
        ${bar(u.supplied, 1, u.supplied < 0.5 ? 'kirmizi' : 'yesil')}
        ${row('Siperlenme', u.entrenchment.toFixed(1))}
        ${row('Tecrübe', `%${Math.round(u.experience)}`)}
      </div>

      <div class="bolum"><h4>MUHAREBE DEĞERLERİ</h4>
        ${row('Cephe genişliği', String(stats.width))}
        ${row('Yumuşak saldırı', String(stats.softAttack))}
        ${row('Savunma', String(stats.defence))}
        ${row('Delme', String(stats.breakthrough))}
        ${row('Top namlusu', String(stats.guns))}
        ${row('Günlük ikmal', `${stats.supplyUse.toFixed(1)} ton`)}
      </div>`;

    if (cmd) {
      html += `<div class="bolum"><h4>KOMUTAN</h4>
        ${row(`${cmd.rank} ${cmd.name}`, '')}
        ${row('Taarruz / Savunma', `${cmd.skill.attack} / ${cmd.skill.defence}`)}
        ${row('Planlama / İkmal', `${cmd.skill.planning} / ${cmd.skill.logistics}`)}
        <p class="not">${esc(cmd.bio)}</p>`;
      for (const tid of cmd.traits) {
        const t = TRAITS[tid];
        if (t) html += `<p class="not"><em>${esc(t.name)}</em> — ${esc(t.desc)}</p>`;
      }
      if (mods.attack || mods.defence) {
        html += row(
          'Net etki',
          `taarruz %${Math.round(mods.attack * 100)} · savunma %${Math.round(mods.defence * 100)}`,
        );
      }
      html += `<a class="kaynak" href="${esc(cmd.src)}" target="_blank" rel="noopener">${esc(
        cmd.src,
      )}</a></div>`;
    }

    if (u.side === s.playerSide) {
      html += `<div class="bolum"><h4>EMİR</h4><div class="emirler">`;
      for (const o of landOrderOptions(s, u)) {
        const on = u.order?.kind === o.kind;
        html += `<button class="emir" data-act="kara" data-unit="${u.id}"
          data-kind="${o.kind}" data-target="${o.needsTarget ? 1 : 0}"
          aria-pressed="${on}" ${o.enabled ? '' : 'disabled'}
          title="${esc(o.enabled ? o.hint : (o.why ?? o.hint))}">${esc(o.label)}</button>`;
      }
      html += `</div>`;
      if (u.order) {
        html += `<p class="not">Mevcut emir: <em>${esc(u.order.kind)}</em>${
          u.order.target ? ` → ${esc(prov(u.order.target).name)}` : ''
        }${u.order.path.length > 0 ? ` (${u.order.path.length} il)` : ''}</p>`;
      }
      html += `</div>`;
    }

    return html;
  }

  // ──────────────────────────────────────────────────────────── filo ──

  private fleet(s: GameState, id: string): string {
    const f = s.fleets[id];
    if (!f) return '<p class="not">Filo bulunamadı.</p>';
    const alive = liveShips(f);
    const cmd = f.commanderId ? s.commanders[f.commanderId] : null;

    let html = `<h3>${esc(f.name)}</h3>
      <div class="kicker">${esc(prov(f.location).name.toLocaleUpperCase('tr-TR'))} · ${
        alive.length
      } GEMİ</div>
      <div class="bolum"><h4>GEMİLER</h4>`;

    for (const sh of f.ships) {
      const cls = SHIP_CLASSES[sh.cls];
      const sunk = sh.hull <= 0;
      const crippled = !sunk && sh.hull <= CRIPPLED_HULL;
      const cardCls = sunk ? 'batti' : crippled ? 'hasarli' : '';
      const tag = sunk ? 'BATTI' : crippled ? 'SAVAŞ DIŞI' : `%${Math.round(sh.hull * 100)}`;
      const barCls = sunk ? 'kirmizi' : crippled ? 'kirmizi' : sh.hull > 0.6 ? 'yesil' : '';

      html += `<div class="gemi-karti ${cardCls}">
        <div class="gemi-baslik">
          <span>${esc(sh.name)}</span>
          <span style="${sunk || crippled ? 'color:var(--mine)' : 'color:var(--accent)'}">${tag}</span>
        </div>
        <div class="gemi-sinif">${esc(cls.name)}</div>
        ${bar(sh.hull, 1, barCls)}
        <div class="gemi-spek">
          <span>⚓ ${num(cls.displacement)} t</span>
          <span>🛡️ ${cls.armour} mm</span>
          ${cls.gunRange > 0 ? `<span>🎯 ${Math.round(cls.gunRange / 1000)} km</span>` : ''}
          <span>⚡ ${cls.speed} kn</span>
          ${sh.mines > 0 ? `<span>💣 ${sh.mines} mayın</span>` : ''}
        </div>
        ${sh.historicalNote ? `<p class="not" style="margin-top:3px">${esc(sh.historicalNote)}</p>` : ''}
      </div>`;
    }
    html += `</div>`;

    const mines = alive.reduce((n, sh) => n + sh.mines, 0);
    if (mines > 0) {
      html += `<div class="bolum"><h4>YÜK</h4>${row('Mayın', String(mines))}</div>`;
    }
    if (f.embarked.length > 0) {
      html += `<div class="bolum"><h4>TAŞINAN BİRLİKLER</h4>`;
      for (const uid of f.embarked) {
        const u = s.landUnits[uid];
        if (u) {
          html += `<button class="liste-ogesi ent" data-act="sec" data-kind="birlik" data-id="${u.id}">
            <span>${esc(u.name)}</span><span class="ikinci">${num(u.strength)}</span></button>`;
        }
      }
      html += `</div>`;
    }

    if (cmd) {
      html += `<div class="bolum"><h4>KOMUTAN</h4>
        ${row(`${cmd.rank} ${cmd.name}`, '')}
        <p class="not">${esc(cmd.bio)}</p></div>`;
    }

    if (f.side === s.playerSide) {
      html += `<div class="bolum"><h4>EMİR</h4><div class="emirler">`;
      for (const o of navalOrderOptions(s, f)) {
        const on = f.order?.kind === o.kind;
        html += `<button class="emir" data-act="deniz" data-fleet="${f.id}"
          data-kind="${o.kind}" data-target="${o.needsTarget ? 1 : 0}"
          aria-pressed="${on}" ${o.enabled ? '' : 'disabled'}
          title="${esc(o.enabled ? o.hint : (o.why ?? o.hint))}">${esc(o.label)}</button>`;
      }
      html += `</div>`;
      if (f.order) {
        html += `<p class="not">Mevcut emir: <em>${esc(f.order.kind)}</em>${
          f.order.target ? ` → ${esc(prov(f.order.target).name)}` : ''
        }</p>`;
      }
      html += `</div>`;
    }

    return html;
  }

  // ─────────────────────────────────────────────────────────── tabya ──

  private fort(s: GameState, id: string): string {
    const f = s.forts[id];
    if (!f) return '<p class="not">Tabya bulunamadı.</p>';

    let html = `<h3>${esc(f.name)}</h3>
      <div class="kicker">${f.fortNo ? esc(f.fortNo) + ' · ' : ''}${
        f.shore === 'rumeli' ? 'RUMELİ' : 'ANADOLU'
      } YAKASI</div>
      <div class="bolum"><h4>DURUM</h4>
        <div class="satir"><span>Bütünlük</span><span>%${Math.round(
          f.integrity * 100,
        )}</span></div>
        ${bar(f.integrity, 1, f.integrity < 0.3 ? 'kirmizi' : 'yesil')}
        <div class="satir"><span>Bastırılma</span><span>%${Math.round(
          f.suppression * 100,
        )}</span></div>
        ${bar(f.suppression, 1, 'kirmizi')}
        <div class="satir"><span>Mühimmat</span><span>${num(f.ammo)} / ${num(
          f.maxAmmo,
        )} atış</span></div>
        ${bar(f.ammo, f.maxAmmo, f.ammo < f.maxAmmo * 0.25 ? 'kirmizi' : '')}
        ${row('Etkili menzil', `${num(fortRange(f))} m`)}
        ${row('Hareketli', f.mobile ? 'evet' : 'hayır')}
      </div>
      <div class="bolum"><h4>TOPLAR</h4>`;

    for (const g of f.guns) {
      const spec = GUN_BY_ID[g.gunId];
      if (!spec) continue;
      html += row(
        `${g.count} × ${spec.name}`,
        `${num(spec.range)} m · ${spec.shell} kg`,
      );
    }
    html += `</div>`;

    if (f.note) html += `<div class="bolum"><p class="not">${esc(f.note)}</p></div>`;
    html += `<a class="kaynak" href="${esc(f.src)}" target="_blank" rel="noopener">${esc(
      f.src,
    )}</a>`;
    html += `<button class="emir" data-act="odak" data-id="${f.province}"
      style="margin-top:10px">Haritada göster</button>`;
    return html;
  }
}

export type { LandUnit, Fleet };
