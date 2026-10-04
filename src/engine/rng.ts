/**
 * Deterministik rastgelelik — mulberry32.
 *
 * Tur çözümünün tekrarlanabilir olması gerekiyor: aynı durum + aynı emirler
 * = aynı sonuç. Durum `GameState.rngState` içinde taşınır, kaydet/yükle ile
 * birlikte gider.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  get state(): number {
    return this.s;
  }

  /** [0,1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [lo, hi) kesirli. */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** [lo, hi] tamsayı. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** p olasılıkla true. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Ortalama 1 olan, ±spread oranında çarpan — muharebe gürültüsü. */
  jitter(spread: number): number {
    return 1 + (this.next() * 2 - 1) * spread;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('boş listeden seçim');
    return items[Math.floor(this.next() * items.length)]!;
  }
}
