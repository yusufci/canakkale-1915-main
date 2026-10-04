import './style/app.css';
import type {
  GameState,
  HistoricalEvent,
  LandOrderKind,
  NavalOrderKind,
  ProvinceId,
  Side,
} from './core/types.ts';
import { MAP, prov } from './core/geo.ts';
import { WEATHERS } from './data/units.ts';
import { formatDate, newGame } from './engine/scenario.ts';
import { endTurn, applyEffect } from './engine/turn.ts';
import { issueLandOrder, issueNavalOrder } from './engine/orders.ts';
import { liveShips, minefieldsIn } from './engine/naval.ts';
import { MAP_MODES, MapView } from './render/map.ts';
import type { MapMode, Selection } from './render/map.ts';
import { Panel } from './ui/panel.ts';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`eksik eleman: #${id}`);
  return el as T;
};

const num = (n: number): string => Math.round(n).toLocaleString('tr-TR');
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Bekleyen emir hedefi — kullanıcı haritadan il seçecek. */
interface PendingOrder {
  kind: 'kara' | 'deniz';
  unitId: string;
  order: LandOrderKind | NavalOrderKind;
}

class Game {
  private state: GameState = newGame('ottoman');
  private view: MapView;
  private panel: Panel;
  private selection: Selection | null = null;
  private pending: PendingOrder | null = null;
  private eventQueue: HistoricalEvent[] = [];

  constructor() {
    this.view = new MapView({
      onSelect: (s) => this.select(s),
      onHover: (s, p) => this.hover(s, p),
      onTarget: (id) => this.applyTarget(id),
    });
    this.panel = new Panel($('panel'), {
      issueLand: (unitId, kind, needsTarget) =>
        this.beginOrder({ kind: 'kara', unitId, order: kind }, needsTarget),
      issueNaval: (fleetId, kind, needsTarget) =>
        this.beginOrder({ kind: 'deniz', unitId: fleetId, order: kind }, needsTarget),
      select: (s) => this.select(s),
      focus: (id) => this.view.centreOn(id),
    });
  }

  async start(): Promise<void> {
    // Taraf butonları HTML'de `disabled` geliyor. Harita dokusu (756 KB)
    // inmeden etkinleştirilmezler; yoksa buton görünür olduğu hâlde dinleyici
    // bağlanmadığı için ilk tıklama kayboluyor.
    await this.view.init($<HTMLCanvasElement>('harita'));
    // İmleç panellerin üstüne geçince harita ipucusu ekranda asılı kalmasın.
    for (const id of ['ustbar', 'panel', 'modlar', 'gunluk']) {
      $(id).addEventListener('pointerenter', () => {
        $('ipucu').hidden = true;
      });
    }
    this.buildModeButtons();
    this.bindChrome();
    this.view.setState(this.state);
    this.refresh();

    $('taraf-sec').setAttribute('aria-busy', 'false');
    for (const b of document.querySelectorAll<HTMLButtonElement>('.taraf')) {
      b.disabled = false;
    }
    $('acilis-durum').textContent =
      'Harita: AWS Terrain Tiles (SRTM) · Yer adları: OpenStreetMap (ODbL)';
  }

  newCampaign(side: Side): void {
    this.state = newGame(side);
    this.selection = null;
    this.pending = null;
    this.eventQueue = [];
    this.view.selection = null;
    this.view.targeting = false;
    this.view.setState(this.state);
    this.refresh();
    // Oyuncunun ilk bakışı kendi cephesine düşsün.
    this.view.centreOn(side === 'ottoman' ? 'd_dar_bogaz' : 'd_bogaz_agzi');
  }

  // ───────────────────────────────────────────────────────── arayüz ──

  private buildModeButtons(): void {
    const nav = $('modlar');
    nav.innerHTML = '';
    for (const m of MAP_MODES) {
      const b = document.createElement('button');
      b.className = 'mod';
      b.textContent = m.label;
      b.setAttribute('aria-pressed', String(this.view.mode === m.id));
      b.addEventListener('click', () => {
        this.view.mode = m.id as MapMode;
        for (const other of nav.querySelectorAll('.mod')) {
          other.setAttribute('aria-pressed', String(other === b));
        }
        this.view.draw();
      });
      nav.appendChild(b);
    }
  }

  private bindChrome(): void {
    $('tur-bitir').addEventListener('click', () => this.endTurn());

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !$<HTMLDivElement>('olay-katman').hidden === false) {
        e.preventDefault();
        this.endTurn();
      }
      if (e.code === 'Escape') this.cancelTargeting();
      const idx = Number(e.key);
      if (idx >= 1 && idx <= MAP_MODES.length) {
        const m = MAP_MODES[idx - 1]!;
        this.view.mode = m.id;
        for (const [i, b] of [...$('modlar').querySelectorAll('.mod')].entries()) {
          b.setAttribute('aria-pressed', String(i === idx - 1));
        }
        this.view.draw();
      }
    });

    $('gunluk-kapat').addEventListener('click', () => {
      const list = $('gunluk-liste');
      const hidden = list.style.display === 'none';
      list.style.display = hidden ? '' : 'none';
      $('gunluk-kapat').textContent = hidden ? 'gizle' : 'göster';
    });

    for (const b of document.querySelectorAll<HTMLButtonElement>('.taraf')) {
      b.addEventListener('click', () => {
        $('acilis').hidden = true;
        this.newCampaign(b.dataset.taraf as Side);
      });
    }

    $('son-yeniden').addEventListener('click', () => {
      $('son-katman').hidden = true;
      $('acilis').hidden = false;
    });
  }

  private select(sel: Selection | null): void {
    if (this.pending) return;
    this.selection = sel;
    this.view.selection = sel;
    this.panel.render(this.state, sel);
    this.view.draw();
  }

  private hover(sel: Selection | null, screen: { x: number; y: number }): void {
    const tip = $('ipucu');
    if (!sel) {
      tip.hidden = true;
      return;
    }
    const p = prov(sel.id);
    const st = this.state.provinces[sel.id]!;
    const side = this.state.playerSide;
    if (!st.seen[side]) {
      tip.innerHTML = `<b>${esc(p.name)}</b><i>bilgi yok</i>`;
    } else {
      const units = Object.values(this.state.landUnits).filter(
        (u) => u.location === sel.id && !u.embarkedIn && u.strength > 0,
      );
      const fleets = Object.values(this.state.fleets).filter(
        (f) => f.location === sel.id && liveShips(f).length > 0,
      );
      const mines = minefieldsIn(this.state, sel.id)
        .filter((m) => m.side === side || m.spotted)
        .reduce((n, m) => n + m.mines, 0);
      const bits: string[] = [];
      if (units.length) bits.push(`${num(units.reduce((n, u) => n + u.strength, 0))} asker`);
      if (fleets.length) bits.push(`${fleets.reduce((n, f) => n + liveShips(f).length, 0)} gemi`);
      if (mines) bits.push(`${mines} mayın`);
      bits.push(`ikmal %${Math.round(st.supply * 100)}`);
      tip.innerHTML = `<b>${esc(p.name)}</b><i>${esc(bits.join(' · '))}</i>`;
    }
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(screen.x + 16, window.innerWidth - r.width - 10)}px`;
    tip.style.top = `${Math.min(screen.y + 16, window.innerHeight - r.height - 10)}px`;
  }

  // ───────────────────────────────────────────────────────── emirler ──

  private beginOrder(p: PendingOrder, needsTarget: boolean): void {
    if (!needsTarget) {
      this.commitOrder(p, null);
      return;
    }
    this.pending = p;
    this.view.targeting = true;
    this.view.validTargets = this.targetsFor(p);
    this.view.draw();
    this.toast(`Haritadan hedef seç · İptal: Esc`);
  }

  private targetsFor(p: PendingOrder): Set<ProvinceId> {
    const s = this.state;
    const out = new Set<ProvinceId>();
    if (p.kind === 'kara') {
      const u = s.landUnits[p.unitId];
      if (!u) return out;
      if (p.order === 'taarruz') {
        for (const n of prov(u.location).neighbours) {
          if (!prov(n).isSea && s.provinces[n]?.controller !== u.side) out.add(n);
        }
      } else if (p.order === 'cikarma') {
        const f = u.embarkedIn ? s.fleets[u.embarkedIn] : null;
        if (f) for (const n of prov(f.location).neighbours) if (!prov(n).isSea) out.add(n);
      } else {
        for (const q of MAP.provinces) if (!q.isSea) out.add(q.id);
      }
    } else {
      for (const q of MAP.provinces) if (q.isSea) out.add(q.id);
    }
    return out;
  }

  private applyTarget(id: ProvinceId): void {
    const p = this.pending;
    if (!p) return;
    this.commitOrder(p, id);
  }

  private commitOrder(p: PendingOrder, target: ProvinceId | null): void {
    const err =
      p.kind === 'kara'
        ? issueLandOrder(this.state, p.unitId, p.order as LandOrderKind, target)
        : issueNavalOrder(this.state, p.unitId, p.order as NavalOrderKind, target);
    this.cancelTargeting();
    if (err) {
      this.toast(err);
      return;
    }
    this.panel.render(this.state, this.selection);
    this.view.draw();
  }

  private cancelTargeting(): void {
    this.pending = null;
    this.view.targeting = false;
    this.view.validTargets = new Set();
    this.view.draw();
  }

  private toast(msg: string): void {
    const tip = $('ipucu');
    tip.innerHTML = `<b>${esc(msg)}</b>`;
    tip.hidden = false;
    tip.style.left = '50%';
    tip.style.top = '84px';
    window.setTimeout(() => {
      tip.hidden = true;
    }, 2200);
  }

  // ─────────────────────────────────────────────────────────── tur ──

  private endTurn(): void {
    if (this.state.outcome) return;
    if (this.eventQueue.length > 0) return;
    this.cancelTargeting();
    endTurn(this.state);
    this.eventQueue = [...this.state.pendingEvents];
    this.state.pendingEvents = [];
    this.refresh();
    this.showNextEvent();
    if (this.state.outcome) this.showOutcome();
  }

  private refresh(): void {
    const s = this.state;
    $('tarih').textContent = formatDate(s.date).toLocaleUpperCase('tr-TR');
    const w = WEATHERS[s.weather];
    $('hava').textContent = `${w.name} · gün ${s.day}`;

    const me = s.sides[s.playerSide];
    const foe = s.sides[s.playerSide === 'ottoman' ? 'entente' : 'ottoman'];
    const myLand = Object.values(s.landUnits)
      .filter((u) => u.side === s.playerSide && !u.embarkedIn)
      .reduce((n, u) => n + u.strength, 0);
    const myShips = Object.values(s.fleets)
      .filter((f) => f.side === s.playerSide)
      .reduce((n, f) => n + liveShips(f).length, 0);
    const vp = MAP.provinces
      .filter((p) => s.provinces[p.id]!.controller === s.playerSide)
      .reduce((n, p) => n + p.victoryPoints, 0);
    const mines = Object.values(s.minefields)
      .filter((m) => m.side === s.playerSide && m.laidOn <= s.day)
      .reduce((n, m) => n + m.mines, 0);

    const metric = (name: string, value: string, cls = '', barPct?: number, barCls = '') =>
      `<div class="olcu"><span class="olcu-ad">${name}</span>
        <span class="olcu-deger ${cls}">${value}</span>
        ${
          barPct === undefined
            ? ''
            : `<span class="cubuk ${barCls}"><i style="width:${barPct}%"></i></span>`
        }</div>`;

    $('olculer').innerHTML = [
      metric('TARAF', s.playerSide === 'ottoman' ? 'OSMANLI' : 'İTİLAF', 'vurgu'),
      metric(
        'MORAL',
        `%${Math.round(me.morale * 100)}`,
        me.morale < 0.3 ? 'kotu' : '',
        me.morale * 100,
        s.playerSide === 'ottoman' ? 'osm' : 'ent',
      ),
      metric('SAHADA', num(myLand)),
      metric('İNSAN GÜCÜ', num(me.manpower)),
      metric('CEPHANE', num(me.ammo), me.ammo < 5000 ? 'kotu' : ''),
      metric('GEMİ', String(myShips)),
      metric('MAYIN', num(mines)),
      metric('ZAFER PUANI', String(vp), 'vurgu'),
      metric('DÜŞMAN MORALİ', `%${Math.round(foe.morale * 100)}`),
    ].join('');

    this.renderLog();
    this.view.setState(s);
    if (this.selection) this.panel.render(s, this.selection);
    $<HTMLButtonElement>('tur-bitir').disabled = s.outcome !== null;
  }

  private renderLog(): void {
    const list = $('gunluk-liste');
    const reports = this.state.reports.slice(0, 60);
    if (reports.length === 0) {
      list.innerHTML = `<div class="kayit"><div class="kayit-satir">
        Henüz rapor yok. Emirleri ver ve turu bitir.</div></div>`;
      return;
    }
    list.innerHTML = reports
      .map(
        (r) => `<div class="kayit ${r.kind}" data-il="${r.province}">
        <div class="kayit-bas"><span>${esc(r.title)}</span>
          <span class="kayit-gun">g${r.day}</span></div>
        ${r.lines
          .slice(0, 4)
          .map((l) => `<div class="kayit-satir">${esc(l)}</div>`)
          .join('')}
      </div>`,
      )
      .join('');
    for (const el of list.querySelectorAll<HTMLElement>('.kayit')) {
      el.addEventListener('click', () => {
        const id = el.dataset.il;
        if (id) {
          this.view.centreOn(id);
          this.select({ kind: 'il', id });
        }
      });
    }
  }

  private showNextEvent(): void {
    const e = this.eventQueue.shift();
    const layer = $('olay-katman');
    if (!e) {
      layer.hidden = true;
      return;
    }
    $('olay-tarih').textContent = formatDate(e.date).toLocaleUpperCase('tr-TR');
    $('olay-baslik').textContent = e.title;
    $('olay-govde').textContent = e.body;
    const src = $<HTMLAnchorElement>('olay-kaynak');
    src.href = e.src;
    src.textContent = e.src;

    const box = $('olay-secenek');
    box.innerHTML = '';
    if (e.choices && e.choices.length > 0) {
      for (const c of e.choices) {
        const b = document.createElement('button');
        b.className = 'secenek';
        b.innerHTML = `<b>${esc(c.label)}</b><span>${esc(c.desc)}</span>`;
        b.addEventListener('click', () => {
          applyEffect(this.state, c.effect);
          this.refresh();
          this.showNextEvent();
        });
        box.appendChild(b);
      }
    } else {
      const b = document.createElement('button');
      b.className = 'secenek';
      b.innerHTML = `<b>DEVAM</b>`;
      b.addEventListener('click', () => this.showNextEvent());
      box.appendChild(b);
    }
    layer.hidden = false;
  }

  private showOutcome(): void {
    const o = this.state.outcome;
    if (!o) return;
    $('son-baslik').textContent =
      o.winner === this.state.playerSide ? 'ZAFER' : 'YENİLGİ';
    $('son-govde').textContent = `${o.reason}\n\n${
      o.winner === 'ottoman' ? 'Osmanlı' : 'İtilaf'
    } galip — ${formatDate(this.state.date)}.`;
    $('son-katman').hidden = false;
  }
}

const game = new Game();
void game.start();
