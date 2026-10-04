import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import type { GameState, Province, ProvinceId, Side, Vec2 } from '../core/types.ts';
import { MAP, RELIEF_BOX, dist, pointInPolygon, prov } from '../core/geo.ts';
import { C, LAYER } from '../style/tokens.ts';
import { fortRange, liveShips, minefieldsIn } from '../engine/naval.ts';
import { TERRAINS } from '../data/units.ts';

/**
 * Harita çizimi — @destanevreni'nin animasyonundaki görsel dil:
 * siyah zemin, neredeyse siyah lacivert deniz, haki kara, amber kıyı çizgisi,
 * mono büyük harf etiketler, kırmızı mayın noktaları, mavi-gri gemi işaretleri.
 */

export type MapMode = 'siyasi' | 'arazi' | 'tedarik' | 'deniz' | 'mayin';

export const MAP_MODES: readonly { id: MapMode; label: string }[] = [
  { id: 'siyasi', label: 'SİYASİ' },
  { id: 'arazi', label: 'ARAZİ' },
  { id: 'tedarik', label: 'İKMAL' },
  { id: 'deniz', label: 'DENİZ' },
  { id: 'mayin', label: 'MAYIN' },
];

export interface Selection {
  kind: 'il' | 'birlik' | 'filo' | 'tabya';
  id: string;
}

export interface MapCallbacks {
  onSelect(sel: Selection | null): void;
  onHover(sel: Selection | null, screen: { x: number; y: number }): void;
  /** Emir hedefi seçildi (hedef bekleme kipindeyken tıklama). */
  onTarget(province: ProvinceId): void;
}

/** Açılış kadrajına dahil edilmeyen iller — uzak üsler ve açık deniz. */
const OUT_OF_FRAME: ReadonlySet<string> = new Set([
  'bozcaada',
  'gokceada',
  'd_ege_acik',
  'd_gokceada_acigi',
  'd_bozcaada_acigi',
  'd_besike',
  'd_saros',
  'bolayir',
  'lapseki',
  'gelibolu',
  'd_gelibolu_onu',
]);

const LABEL_STYLE = new TextStyle({
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  fontWeight: '500',
  fill: C.text,
  letterSpacing: 2.2,
});

const LABEL_MINOR = new TextStyle({
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  fill: C.textDim,
  letterSpacing: 1.6,
});

const COUNTER_STYLE = new TextStyle({
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  fontWeight: '700',
  fill: C.text,
  letterSpacing: 0.4,
});

export class MapView {
  readonly app = new Application();

  private world = new Container();
  private gRelief = new Container();
  private gFill = new Graphics();
  private gEdge = new Graphics();
  private gCoast = new Graphics();
  private gMines = new Graphics();
  private gForts = new Graphics();
  private gPaths = new Graphics();
  private gUnits = new Container();
  private gLabels = new Container();
  private gOverlay = new Graphics();

  private labelPool: Text[] = [];
  private counterPool: Container[] = [];

  mode: MapMode = 'siyasi';
  selection: Selection | null = null;
  /** Emir hedefi bekleniyor — tıklama hedef seçer. */
  targeting = false;
  /** Hedef seçimi için geçerli iller; boşsa hepsi. */
  validTargets: ReadonlySet<ProvinceId> = new Set();

  private state: GameState | null = null;
  private cb: MapCallbacks;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private hovered: ProvinceId | null = null;
  private dragging = false;
  private dragFrom = { x: 0, y: 0 };
  private dragMoved = 0;

  constructor(cb: MapCallbacks) {
    this.cb = cb;
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas,
      antialias: true,
      backgroundColor: C.void,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
      resizeTo: window,
      preference: 'webgl',
    });

    this.gRelief.zIndex = LAYER.relief;
    this.gFill.zIndex = LAYER.provinceFill;
    this.gEdge.zIndex = LAYER.provinceEdge;
    this.gCoast.zIndex = LAYER.coast;
    this.gMines.zIndex = LAYER.minefield;
    this.gForts.zIndex = LAYER.fort;
    this.gPaths.zIndex = LAYER.path;
    this.gUnits.zIndex = LAYER.unit;
    this.gLabels.zIndex = LAYER.label;
    this.gOverlay.zIndex = LAYER.overlay;

    // Rölyef dokusu yalnız indirilen yükseklik kutusunu kaplıyor; kadraj dışarı
    // taştığında arkada saf siyah kalıyordu. Altına geniş bir deniz zemini serilir.
    const backdrop = new Graphics();
    const b = MAP.bounds;
    const pad = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    backdrop
      .rect(b.minX - pad, b.minY - pad, (b.maxX - b.minX) + pad * 2, (b.maxY - b.minY) + pad * 2)
      .fill({ color: C.sea });
    backdrop.zIndex = LAYER.relief - 1;

    this.world.sortableChildren = true;
    this.world.addChild(
      backdrop,
      this.gRelief,
      this.gFill,
      this.gEdge,
      this.gCoast,
      this.gMines,
      this.gForts,
      this.gPaths,
      this.gUnits,
      this.gLabels,
      this.gOverlay,
    );
    this.app.stage.addChild(this.world);

    await this.loadRelief();
    this.fitToMap();
    this.bindInput(canvas);
    window.addEventListener('resize', () => this.fitToMap(true));
  }

  /**
   * Rölyef dokusu: R/G kanalı yükseklik, B kanalı kara maskesi.
   * Kanvasta videodaki haki rampasına çevrilir — GPU shader'a gerek yok,
   * doku bir kez CPU'da boyanıp Sprite olarak kullanılır.
   */
  private async loadRelief(): Promise<void> {
    const tex: Texture = await Assets.load('relief.png');
    const src = tex.source.resource as HTMLImageElement | ImageBitmap;
    const w = RELIEF_BOX.width;
    const h = RELIEF_BOX.height;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    // Yükseklikleri önce ayrı bir diziye çöz — tepe gölgelemesi için komşu
    // piksellere bakmak gerekiyor, aynı tamponu hem okuyup hem yazamayız.
    const elev = new Float32Array(w * h);
    const landMask = new Float32Array(w * h);
    for (let i = 0, px = 0; i < d.length; i += 4, px++) {
      elev[px] = d[i]! * 256 + d[i + 1]! - 1000;
      landMask[px] = d[i + 2]! / 255;
    }

    // Tepe gölgelemesi: kuzeybatıdan gelen ışık. Videodaki kara, düz bir haki
    // leke değil; sırtlar ve dereler seçiliyor. Conkbayırı ile Kocaçimen'in
    // Arıburnu'na nasıl hâkim olduğu ancak bununla okunuyor.
    const SUN = { x: -0.72, y: -0.6, z: 0.35 };
    const zScale = 2.6;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = y * w + x;
        const i = px * 4;
        if (landMask[px]! < 0.45) {
          // Deniz — videodaki #030810. Kıyıya yaklaşınca bir tık açılır.
          const t = landMask[px]! / 0.45;
          d[i] = 3 + t * 5;
          d[i + 1] = 8 + t * 8;
          d[i + 2] = 16 + t * 12;
          d[i + 3] = 255;
          continue;
        }
        const xm = x > 0 ? px - 1 : px;
        const xp = x < w - 1 ? px + 1 : px;
        const ym = y > 0 ? px - w : px;
        const yp = y < h - 1 ? px + w : px;
        const dx = (elev[xp]! - elev[xm]!) * zScale;
        const dy = (elev[yp]! - elev[ym]!) * zScale;
        const len = Math.hypot(dx, dy, 120) || 1;
        const shade = Math.max(
          0.35,
          Math.min(1.5, ((-dx * SUN.x - dy * SUN.y + 120 * SUN.z) / len) * 2.1),
        );
        // Taban renk: #1a1610 → #57411b (videodan örneklenen haki rampası).
        const t = Math.min(1, Math.max(0, elev[px]!) / 500) ** 0.8;
        // 0.78: videodaki kara, gölgelemeden sonra bu kadar koyu.
        d[i] = Math.round(Math.min(255, (26 + t * 61) * shade * 0.78));
        d[i + 1] = Math.round(Math.min(255, (22 + t * 43) * shade * 0.78));
        d[i + 2] = Math.round(Math.min(255, (16 + t * 11) * shade * 0.8));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const sprite = new Sprite(Texture.from(cv));
    sprite.x = RELIEF_BOX.minX;
    sprite.y = RELIEF_BOX.minY;
    sprite.width = RELIEF_BOX.maxX - RELIEF_BOX.minX;
    sprite.height = RELIEF_BOX.maxY - RELIEF_BOX.minY;
    this.gRelief.addChild(sprite);
  }

  /**
   * Açılış çerçevesi. Harita sınırlarının tamamına sığdırmak Trakya ve Biga
   * içlerini de kadraja sokup boğazı minik bırakıyor; onun yerine zafer puanı
   * olan iller (yani fiilî muharebe alanı) çerçevelenir.
   */
  private theatreBox(): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of MAP.provinces) {
      // Adalar ve açık deniz çerçeveye girmez: Gökçeada ile Bozcaada kadrajı
      // iki katına çıkarıp boğazı görünmez hâle getiriyor. Oyun boğazda geçiyor.
      if (OUT_OF_FRAME.has(p.id)) continue;
      if (p.victoryPoints === 0 && p.supplyHub === 0) continue;
      for (const v of p.polygon) {
        if (v.x < minX) minX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.x > maxX) maxX = v.x;
        if (v.y > maxY) maxY = v.y;
      }
    }
    const padX = (maxX - minX) * 0.06;
    const padY = (maxY - minY) * 0.06;
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
  }

  private fitToMap(keepZoom = false): void {
    const b = this.theatreBox();
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    const fit = Math.min(
      (sw - 520) / (b.maxX - b.minX),
      (sh - 110) / (b.maxY - b.minY),
    );
    if (!keepZoom) this.zoom = fit;
    // Paneller sağda ve üstte yer kapladığı için merkez hafifçe sola kayar.
    this.panX = (sw - 340) / 2 + 150 - ((b.minX + b.maxX) / 2) * this.zoom;
    this.panY = (sh + 62) / 2 - ((b.minY + b.maxY) / 2) * this.zoom;
    this.applyTransform();
  }

  private applyTransform(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(this.panX, this.panY);
  }

  private toWorld(sx: number, sy: number): Vec2 {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = { contains: () => true };

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const before = this.toWorld(e.offsetX, e.offsetY);
        const k = Math.exp(-e.deltaY * 0.0014);
        this.zoom = Math.min(0.06, Math.max(0.0035, this.zoom * k));
        const after = this.toWorld(e.offsetX, e.offsetY);
        this.panX += (after.x - before.x) * this.zoom;
        this.panY += (after.y - before.y) * this.zoom;
        this.applyTransform();
        this.draw();
      },
      { passive: false },
    );

    this.app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragging = true;
      this.dragMoved = 0;
      this.dragFrom = { x: e.global.x, y: e.global.y };
    });

    this.app.stage.on('pointerup', (e: FederatedPointerEvent) => {
      this.dragging = false;
      if (this.dragMoved > 6) return;
      this.handleClick(e.global.x, e.global.y);
    });

    this.app.stage.on('pointerupoutside', () => {
      this.dragging = false;
    });

    this.app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (this.dragging) {
        const dx = e.global.x - this.dragFrom.x;
        const dy = e.global.y - this.dragFrom.y;
        this.dragMoved += Math.abs(dx) + Math.abs(dy);
        this.panX += dx;
        this.panY += dy;
        this.dragFrom = { x: e.global.x, y: e.global.y };
        this.applyTransform();
        return;
      }
      const p = this.pick(e.global.x, e.global.y);
      if (p?.id !== this.hovered) {
        this.hovered = p?.id ?? null;
        this.draw();
      }
      this.cb.onHover(p ? { kind: 'il', id: p.id } : null, {
        x: e.global.x,
        y: e.global.y,
      });
    });
  }

  private pick(sx: number, sy: number): Province | null {
    const w = this.toWorld(sx, sy);
    let best: Province | null = null;
    let bestD = Infinity;
    for (const p of MAP.provinces) {
      const d = dist(w, p.center);
      if (d < bestD && pointInPolygon(w, p.polygon)) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  private handleClick(sx: number, sy: number): void {
    const p = this.pick(sx, sy);
    if (!p) {
      this.cb.onSelect(null);
      return;
    }
    if (this.targeting) {
      this.cb.onTarget(p.id);
      return;
    }
    const st = this.state;
    if (st) {
      // Önce ildeki kendi birimini seç — oynanışta istenen bu.
      const unit = Object.values(st.landUnits).find(
        (u) => u.location === p.id && !u.embarkedIn && u.strength > 0 && u.side === st.playerSide,
      );
      if (unit) {
        this.cb.onSelect({ kind: 'birlik', id: unit.id });
        return;
      }
      const fleet = Object.values(st.fleets).find(
        (f) => f.location === p.id && f.side === st.playerSide && liveShips(f).length > 0,
      );
      if (fleet) {
        this.cb.onSelect({ kind: 'filo', id: fleet.id });
        return;
      }
    }
    this.cb.onSelect({ kind: 'il', id: p.id });
  }

  setState(s: GameState): void {
    this.state = s;
    this.draw();
  }

  centreOn(id: ProvinceId): void {
    const c = prov(id).center;
    this.panX = this.app.screen.width / 2 - c.x * this.zoom;
    this.panY = this.app.screen.height / 2 - c.y * this.zoom;
    this.applyTransform();
  }

  // ───────────────────────────────────────────────────────── çizim ────

  draw(): void {
    const s = this.state;
    if (!s) return;
    this.drawProvinces(s);
    this.drawCoast();
    this.drawMines(s);
    this.drawForts(s);
    this.drawUnits(s);
    this.drawPaths(s);
    this.drawLabels(s);
  }

  private fillFor(s: GameState, p: Province): { colour: number; alpha: number } {
    const st = s.provinces[p.id]!;
    const seen = st.seen[s.playerSide];

    switch (this.mode) {
      case 'siyasi': {
        // Videoda zemin rölyeftir; taraf rengi sadece karada ve hafif.
        if (!seen || !st.controller) return { colour: C.land, alpha: 0 };
        if (p.isSea) return { colour: C.sea, alpha: 0 };
        return {
          colour: st.controller === 'ottoman' ? C.ottoman : C.entente,
          alpha: 0.13,
        };
      }
      case 'arazi': {
        const t = TERRAINS[p.terrain];
        return { colour: t.isSea ? C.sea : C.landMid, alpha: p.isSea ? 0.08 : 0.3 };
      }
      case 'tedarik': {
        const v = st.supply;
        return {
          colour: v > 0.75 ? 0x7fc08a : v > 0.4 ? C.accent : C.mine,
          alpha: 0.1 + 0.3 * (1 - Math.min(1, v)),
        };
      }
      case 'deniz': {
        if (!p.isSea) return { colour: C.land, alpha: 0.12 };
        const current = p.current ?? 0;
        return { colour: C.entente, alpha: 0.06 + current * 0.06 };
      }
      case 'mayin': {
        if (!p.isSea) return { colour: C.land, alpha: 0.12 };
        const mines = minefieldsIn(s, p.id)
          .filter((m) => m.side !== s.playerSide ? m.spotted : true)
          .reduce((n, m) => n + m.mines, 0);
        if (mines === 0) return { colour: C.sea, alpha: 0 };
        return { colour: C.mine, alpha: Math.min(0.42, 0.07 + mines / 420) };
      }
    }
  }

  private drawProvinces(s: GameState): void {
    this.gFill.clear();
    this.gEdge.clear();
    const hairline = 1 / this.zoom;

    for (const p of MAP.provinces) {
      const poly = p.polygon;
      if (poly.length < 3) continue;
      const pts: number[] = [];
      for (const v of poly) pts.push(v.x, v.y);

      const { colour, alpha } = this.fillFor(s, p);
      if (alpha > 0) this.gFill.poly(pts).fill({ color: colour, alpha });

      // Savaş sisi: görülmemiş KARA koyulaşır. Denize uygulanmıyor, yoksa
      // haritanın yarısı siyah bir leke oluyor.
      if (!p.isSea && !s.provinces[p.id]!.seen[s.playerSide]) {
        this.gFill.poly(pts).fill({ color: C.void, alpha: 0.42 });
      }

      const selected = this.selection?.kind === 'il' && this.selection.id === p.id;
      const hovered = this.hovered === p.id;
      const targetable = this.targeting && (this.validTargets.size === 0 || this.validTargets.has(p.id));

      if (targetable) {
        this.gEdge.poly(pts).stroke({ width: hairline * 2.2, color: C.accent, alpha: 0.9 });
      } else if (selected) {
        this.gEdge.poly(pts).stroke({ width: hairline * 2.4, color: C.accentGlow, alpha: 1 });
      } else if (hovered) {
        this.gEdge.poly(pts).stroke({ width: hairline * 1.6, color: C.accent, alpha: 0.6 });
      } else if (this.mode !== 'siyasi' || p.victoryPoints > 0) {
        this.gEdge.poly(pts).stroke({ width: hairline, color: C.accentDim, alpha: 0.28 });
      }
    }
  }

  private drawCoast(): void {
    this.gCoast.clear();
    const w = Math.max(60, 1.5 / this.zoom);
    for (const ring of MAP.coastRings) {
      if (ring.length < 3) continue;
      const pts: number[] = [];
      for (const v of ring) pts.push(v.x, v.y);
      // Önce geniş sönük bir hale, üstüne ince parlak çizgi — videodaki
      // amber kıyı şeridi bu iki geçişle oluşuyor.
      this.gCoast.poly(pts, true).stroke({ width: w * 2.6, color: C.coast, alpha: 0.16 });
      this.gCoast.poly(pts, true).stroke({ width: w, color: C.coast, alpha: 0.95 });
    }
  }

  private drawMines(s: GameState): void {
    this.gMines.clear();
    const r = Math.max(260, 3.1 / this.zoom);
    for (const m of Object.values(s.minefields)) {
      if (m.mines <= 0 || m.laidOn > s.day) continue;
      const mine = m.side === s.playerSide;
      if (!mine && !m.spotted) continue;

      const n = Math.max(2, Math.min(32, Math.round(m.mines / 2)));
      const colour = mine ? C.mine : C.hostile;
      const alpha = mine ? 0.95 : 0.78;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        this.gMines
          .circle(m.from.x + (m.to.x - m.from.x) * t, m.from.y + (m.to.y - m.from.y) * t, r)
          .fill({ color: colour, alpha });
      }
      if (!mine) {
        this.gMines
          .moveTo(m.from.x, m.from.y)
          .lineTo(m.to.x, m.to.y)
          .stroke({ width: Math.max(90, 1 / this.zoom), color: C.mineDim, alpha: 0.5 });
      }
    }
  }

  private drawForts(s: GameState): void {
    this.gForts.clear();
    const half = Math.max(320, 4.2 / this.zoom);
    const hairline = Math.max(70, 1 / this.zoom);

    for (const f of Object.values(s.forts)) {
      const own = s.provinces[f.province]?.controller === s.playerSide;
      if (!own && !f.spotted) continue;

      const dead = f.integrity <= 0.05;
      const colour = dead ? C.textFaint : own ? C.accent : C.hostile;
      this.gForts
        .rect(f.pos.x - half, f.pos.y - half, half * 2, half * 2)
        .stroke({ width: hairline * 1.6, color: colour, alpha: dead ? 0.5 : 1 })
        .fill({ color: colour, alpha: dead ? 0.1 : 0.3 * f.integrity });

      // Seçili tabyanın menzil çemberi.
      if (this.selection?.kind === 'tabya' && this.selection.id === f.id) {
        this.gForts
          .circle(f.pos.x, f.pos.y, fortRange(f))
          .stroke({ width: hairline * 1.4, color: C.accent, alpha: 0.5 });
      }
    }
  }

  private drawPaths(s: GameState): void {
    this.gPaths.clear();
    const w = Math.max(110, 1.6 / this.zoom);
    const drawPath = (from: ProvinceId, path: readonly ProvinceId[], colour: number) => {
      if (path.length === 0) return;
      let prev = prov(from).center;
      for (const id of path) {
        const c = prov(id).center;
        this.gPaths.moveTo(prev.x, prev.y).lineTo(c.x, c.y);
        prev = c;
      }
      this.gPaths.stroke({ width: w, color: colour, alpha: 0.75 });
      this.gPaths.circle(prev.x, prev.y, w * 2.4).fill({ color: colour, alpha: 0.9 });
    };

    for (const u of Object.values(s.landUnits)) {
      if (u.side !== s.playerSide || !u.order) continue;
      if (u.order.kind === 'yuru') drawPath(u.location, u.order.path, C.accent);
      if (u.order.kind === 'taarruz' && u.order.target) {
        drawPath(u.location, [u.order.target], C.mine);
      }
      if (u.order.kind === 'cikarma' && u.order.target) {
        drawPath(u.location, [u.order.target], C.accentGlow);
      }
    }
    for (const f of Object.values(s.fleets)) {
      if (f.side !== s.playerSide || !f.order) continue;
      if (f.order.path.length > 0) {
        drawPath(f.location, f.order.path, f.order.kind === 'zorla_gec' ? C.mine : C.shipLight);
      }
    }
  }

  private drawUnits(s: GameState): void {
    // Havuzu yeniden kullan — her turda yüzlerce Text yaratmak pahalı.
    let used = 0;
    const take = (): Container => {
      let c = this.counterPool[used];
      if (!c) {
        c = new Container();
        const g = new Graphics();
        const t = new Text({ text: '', style: COUNTER_STYLE });
        t.anchor.set(0.5);
        c.addChild(g, t);
        this.counterPool.push(c);
        this.gUnits.addChild(c);
      }
      c.visible = true;
      used++;
      return c;
    };

    const scale = 1 / this.zoom;

    // ── Kara birlikleri: ildeki yığın tek sayaçta ──
    const stacks = new Map<ProvinceId, { side: Side; men: number; n: number; combat: boolean }>();
    for (const u of Object.values(s.landUnits)) {
      if (u.embarkedIn || u.strength <= 0) continue;
      if (!s.provinces[u.location]?.seen[s.playerSide] && u.side !== s.playerSide) continue;
      const cur = stacks.get(u.location);
      if (cur && cur.side === u.side) {
        cur.men += u.strength;
        cur.n++;
        cur.combat ||= u.inCombat;
      } else if (!cur) {
        stacks.set(u.location, {
          side: u.side,
          men: u.strength,
          n: 1,
          combat: u.inCombat,
        });
      }
    }

    for (const [id, st] of stacks) {
      const c = take();
      const p = prov(id);
      c.position.set(p.center.x, p.center.y);
      c.scale.set(scale);
      const g = c.children[0] as Graphics;
      const t = c.children[1] as Text;
      const col = st.side === 'ottoman' ? C.ottoman : C.entente;
      const w = 34;
      const h = 17;
      g.clear()
        .rect(-w / 2, -h / 2, w, h)
        .fill({ color: C.panel, alpha: 0.92 })
        .stroke({ width: 1.2, color: st.combat ? C.mine : col, alpha: 1 });
      // Piyade sembolü (çapraz).
      g.moveTo(-w / 2 + 3, -h / 2 + 3)
        .lineTo(-w / 2 + 11, h / 2 - 3)
        .moveTo(-w / 2 + 11, -h / 2 + 3)
        .lineTo(-w / 2 + 3, h / 2 - 3)
        .stroke({ width: 1, color: col, alpha: 0.85 });
      t.text = st.men >= 1000 ? `${Math.round(st.men / 1000)}B` : String(st.men);
      t.x = 6;
      t.y = 0;
      if (st.n > 1) t.text += `·${st.n}`;
    }

    // ── Filolar: videodaki eğik gemi işareti ──
    for (const f of Object.values(s.fleets)) {
      const alive = liveShips(f);
      if (alive.length === 0) continue;
      if (f.side !== s.playerSide && !s.provinces[f.location]?.seen[s.playerSide]) continue;
      const c = take();
      const p = prov(f.location);
      c.position.set(p.center.x, p.center.y);
      c.scale.set(scale);
      const g = c.children[0] as Graphics;
      const t = c.children[1] as Text;
      const col = f.side === 'ottoman' ? C.ottoman : C.ship;
      g.clear();
      // Birkaç küçük gemi silueti, hafif ofsetli — videodaki filo gösterimi.
      const show = Math.min(5, alive.length);
      for (let i = 0; i < show; i++) {
        const ox = (i % 3) * 11 - 11;
        const oy = Math.floor(i / 3) * 8 - 4;
        g.poly([ox - 6, oy, ox + 1, oy - 3, ox + 7, oy, ox + 1, oy + 3])
          .fill({ color: col, alpha: 0.92 })
          .stroke({ width: 0.8, color: C.shipLight, alpha: 0.8 });
      }
      t.text = String(alive.length);
      t.x = 0;
      t.y = 13;
    }

    for (let i = used; i < this.counterPool.length; i++) {
      this.counterPool[i]!.visible = false;
    }
  }

  private drawLabels(s: GameState): void {
    let used = 0;
    const take = (style: TextStyle): Text => {
      let t = this.labelPool[used];
      if (!t) {
        t = new Text({ text: '', style });
        t.anchor.set(0.5, 0);
        this.labelPool.push(t);
        this.gLabels.addChild(t);
      }
      t.style = style;
      t.visible = true;
      used++;
      return t;
    };

    const scale = 1 / this.zoom;
    // Ekran uzayında basit çakışma testi: Arıburnu çevresinde altı il birkaç
    // kilometreye sığıyor ve etiketler üst üste binip okunmaz hâle geliyordu.
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const overlaps = (x: number, y: number, w: number, h: number): boolean =>
      placed.some(
        (r) =>
          Math.abs(r.x - x) * 2 < r.w + w && Math.abs(r.y - y) * 2 < r.h + h,
      );

    // Önemli iller önce yerleşsin ki çakışmada onlar kazansın.
    const ordered = [...MAP.provinces].sort(
      (a, b) => b.victoryPoints + b.supplyHub / 1e5 - (a.victoryPoints + a.supplyHub / 1e5),
    );
    for (const p of ordered) {
      if (!p.labelled) continue;
      if (p.isSea && this.mode !== 'deniz' && this.mode !== 'mayin' && p.victoryPoints === 0) {
        continue;
      }
      if (!s.provinces[p.id]!.seen[s.playerSide] && p.victoryPoints === 0) continue;
      const major = p.victoryPoints >= 3 || p.supplyHub > 0;
      if (!major && this.zoom < 0.0075) continue;

      const text = p.name.toLocaleUpperCase('tr-TR');
      const sx = p.center.x * this.zoom + this.panX;
      const sy = p.center.y * this.zoom + this.panY + 15;
      const bw = text.length * (major ? 8.4 : 6.9);
      const bh = major ? 15 : 12;
      if (overlaps(sx, sy, bw, bh)) continue;
      placed.push({ x: sx, y: sy, w: bw, h: bh });

      const t = take(major ? LABEL_STYLE : LABEL_MINOR);
      t.text = text;
      t.position.set(p.center.x, p.center.y + 15 / this.zoom);
      t.scale.set(scale);
    }

    for (let i = used; i < this.labelPool.length; i++) this.labelPool[i]!.visible = false;
  }

  /** Dar boğaz ölçek çubuğu ve kaynak notu — videodaki alt yazı. */
  drawFootnote(): void {
    this.gOverlay.clear();
  }
}
