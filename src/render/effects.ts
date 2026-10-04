import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Vec2 } from '../core/types.ts';
import { C } from '../style/tokens.ts';

/**
 * Harita üzeri dinamik muharebe efektleri.
 * Namlu alevleri, balistik mermi rotaları, mayın şok dalgaları,
 * su sıçramaları ve duman parçacıkları.
 */

interface Tracer {
  from: Vec2;
  to: Vec2;
  progress: number; // 0..1
  speed: number;
  color: number;
}

interface Explosion {
  pos: Vec2;
  radius: number;
  maxRadius: number;
  color: number;
  alpha: number;
  duration: number;
  age: number;
}

interface FloatingText {
  pos: Vec2;
  text: string;
  color: number;
  age: number;
  duration: number;
}

const HIT_TEXT_STYLE = new TextStyle({
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  fontWeight: '700',
  fill: C.accentGlow,
  letterSpacing: 1,
});

export class EffectsLayer {
  readonly container = new Container();
  private g = new Graphics();
  private textPool: Text[] = [];

  private tracers: Tracer[] = [];
  private explosions: Explosion[] = [];
  private floatingTexts: FloatingText[] = [];

  constructor() {
    this.container.addChild(this.g);
  }

  /**
   * Tabyadan donanmaya ya da filolar arası balistik top atışı izi.
   */
  addTracer(from: Vec2, to: Vec2, color: number = C.accentGlow): void {
    this.tracers.push({
      from,
      to,
      progress: 0,
      speed: 0.045 + Math.random() * 0.02,
      color,
    });
    // Başlangıç noktasında küçük namlu alevi
    this.addExplosion(from, 400, color, 0.4);
  }

  /**
   * Mayın patlaması veya top mermisi isabet patlaması / şok dalgası.
   */
  addExplosion(pos: Vec2, maxRadius = 1200, color: number = C.mine, duration = 0.8): void {
    this.explosions.push({
      pos,
      radius: 50,
      maxRadius,
      color,
      alpha: 1.0,
      duration,
      age: 0,
    });
  }

  /**
   * Harita üzerinde süzülen hasar / ikaz metni.
   */
  addFloatingText(pos: Vec2, text: string, color: number = C.mine): void {
    this.floatingTexts.push({
      pos: { x: pos.x, y: pos.y },
      text,
      color,
      age: 0,
      duration: 1.6,
    });
  }

  /**
   * Her animasyon karesinde güncellenir.
   * @param dt Geçen süre (saniye cinsinden, yakl. 0.016s)
   */
  update(dt: number, zoom: number): void {
    this.g.clear();
    const scale = 1 / zoom;

    // 1. Mermi İzleri (Tracers)
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]!;
      t.progress += t.speed;
      if (t.progress >= 1.0) {
        // Varış noktası patlaması
        this.addExplosion(t.to, 900, t.color, 0.6);
        this.tracers.splice(i, 1);
        continue;
      }

      // Parabolik balistik kavis
      const curX = t.from.x + (t.to.x - t.from.x) * t.progress;
      const curY = t.from.y + (t.to.y - t.from.y) * t.progress;
      const arc = Math.sin(t.progress * Math.PI) * -800; // Yükselme kavisi

      const prevProg = Math.max(0, t.progress - 0.15);
      const prevX = t.from.x + (t.to.x - t.from.x) * prevProg;
      const prevY = t.from.y + (t.to.y - t.from.y) * prevProg + Math.sin(prevProg * Math.PI) * -800;

      this.g.moveTo(prevX, prevY)
        .lineTo(curX, curY + arc)
        .stroke({ width: Math.max(80, 2.5 * scale), color: t.color, alpha: 0.95 });

      // Parlak mermi başlığı
      this.g.circle(curX, curY + arc, Math.max(120, 3.5 * scale))
        .fill({ color: 0xffffff, alpha: 1.0 });
    }

    // 2. Patlamalar & Şok Dalgaları (Explosions)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i]!;
      ex.age += dt;
      const factor = ex.age / ex.duration;
      if (factor >= 1.0) {
        this.explosions.splice(i, 1);
        continue;
      }

      const curRadius = ex.radius + (ex.maxRadius - ex.radius) * Math.sqrt(factor);
      const alpha = (1.0 - factor) * 0.9;

      // Genişleyen şok halkası
      this.g.circle(ex.pos.x, ex.pos.y, curRadius)
        .stroke({ width: Math.max(60, 2 * scale), color: ex.color, alpha });

      // İç patlama parıltısı
      if (factor < 0.3) {
        this.g.circle(ex.pos.x, ex.pos.y, curRadius * 0.5)
          .fill({ color: 0xffffff, alpha: (0.3 - factor) * 2.5 });
      }
    }

    // 3. Yükselen Hasar Metinleri (Floating Texts)
    let textIdx = 0;
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i]!;
      ft.age += dt;
      const factor = ft.age / ft.duration;
      if (factor >= 1.0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      let textNode = this.textPool[textIdx];
      if (!textNode) {
        textNode = new Text({ text: '', style: HIT_TEXT_STYLE });
        textNode.anchor.set(0.5, 0.5);
        this.container.addChild(textNode);
        this.textPool.push(textNode);
      }

      textNode.visible = true;
      textNode.text = ft.text;
      textNode.style.fill = ft.color;
      textNode.alpha = Math.max(0, 1.0 - factor * 0.9);
      // Yukarı doğru süzülme
      textNode.position.set(ft.pos.x, ft.pos.y - factor * 1400);
      textNode.scale.set(scale * 1.3);

      textIdx++;
    }

    // Kullanılmayan metinleri gizle
    for (let j = textIdx; j < this.textPool.length; j++) {
      this.textPool[j]!.visible = false;
    }
  }

  hasActiveEffects(): boolean {
    return this.tracers.length > 0 || this.explosions.length > 0 || this.floatingTexts.length > 0;
  }
}
