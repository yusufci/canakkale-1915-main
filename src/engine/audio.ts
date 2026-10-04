/**
 * Çanakkale 1915 — Web Audio API Tabanlı Prosedürel Ses Motoru
 *
 * Dış ses dosyası (mp3/wav) indirme gereksinimi olmadan, sıfır ağ yükü ve
 * sıfır gecikmeyle çalışan fiziksel akustik sentez motoru.
 *
 * Akustik modellemeler:
 *  - Ağır Donanma & Tabya Topu: Sub-bass şok dalgası + distorsiyonlu gürültü patlaması + boğaz yankısı.
 *  - Hafif/Orta Batarya: Daha keskin namlu çatlaması ve kısa sönüm.
 *  - Su Altı Mayın İnfilakı: Boğuk alçak geçiren (lowpass) darbe + su püskürme hışırtısı.
 *  - Kurmay Telgrafı / Şalter: Pirinç kontak ve mekanik klik sesi.
 *  - Gemi Alarmı: İki tonlu metalik uyarı zili.
 *  - Dalga & Deniz Ambiyansı: Düşük frekanslı salınımlı filtreli pembe gürültü.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioNode | null = null;
  private muted = false;
  private volume = 0.7;
  private initialized = false;

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('canakkale_ses_kapali');
        if (saved === '1') this.muted = true;
      }
    } catch {
      // localStorage erişilemezse varsayılan değer
    }
  }

  /**
   * Kullanıcı ilk kez sayfaya tıkladığında veya tuşa bastığında çağrılır.
   * Tarayıcıların autoplay politikasını karşılamak için gereklidir.
   */
  init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;

      // Ambiyansı başlat
      if (!this.muted) {
        this.startSeaAmbience();
      }
    } catch {
      // Ses desteği olmayan ortamlarda sessizce devam et
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.init();
    this.muted = !this.muted;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('canakkale_ses_kapali', this.muted ? '1' : '0');
      }
    } catch {}

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }

    if (this.muted) {
      this.stopSeaAmbience();
    } else {
      this.startSeaAmbience();
    }

    return this.muted;
  }

  // ───────────────────────────────────────────────────────────── SENTEZ ────

  private createNoiseBuffer(duration = 1.0): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Ağır donanma topu veya kıyı tabyası (305mm - 381mm) atışı.
   * Derin sub-bass patlama + distorsiyonlu gürültü + tepelerden dönen yankı.
   */
  playHeavyCannon(power = 1.0): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    // 1. Sub-bass darbe (gövdeyi titreten hava şoku)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95 * power, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.35);

    oscGain.gain.setValueAtTime(0.85 * power, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.9);

    // 2. Namlu alevi ve barut patlaması (filtrelenmiş gürültü)
    const noise = this.createNoiseBuffer(1.4);
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650 * power, now);
      filter.frequency.exponentialRampToValueAtTime(90, now + 0.8);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7 * power, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      src.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      src.start(now);
      src.stop(now + 1.2);
    }
  }

  /** Orta/hafif kalibre top atışı (kruvazör, sahil bataryası, muhrip) */
  playLightGun(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    oscGain.gain.setValueAtTime(0.45, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.35);

    const noise = this.createNoiseBuffer(0.4);
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(1.5, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.4, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.3);
    }
  }

  /**
   * Su altı mayın infilakı.
   * Su kütlesi tarafından boğulan alçak frekanslı tok darbe + ardından gelen su fışkırma hışırtısı.
   */
  playMineExplosion(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.6);

    oscGain.gain.setValueAtTime(0.95, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.1);

    const noise = this.createNoiseBuffer(1.6);
    if (noise) {
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, now);
      filter.frequency.linearRampToValueAtTime(320, now + 0.3);
      filter.frequency.exponentialRampToValueAtTime(60, now + 1.5);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.2, now);
      nGain.gain.linearRampToValueAtTime(0.65, now + 0.25);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.masterGain);
      src.start(now);
      src.stop(now + 1.5);
    }
  }

  /** Karargâh emir onay klik sesi / pirinç şalter / telgraf */
  playOrderClick(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.035);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /** Gemi ağır hasar veya batma alarmı (çift tonlu metalik ikaz) */
  playShipAlarm(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 0 ? 540 : 420, t);

      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  }

  /** Kara çatışması (aralıklı piyade tüfek ateşi) */
  playInfantrySkirmish(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    const shots = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < shots; i++) {
      const delay = Math.random() * 0.55;
      const t = now + delay;

      const noise = this.createNoiseBuffer(0.1);
      if (!noise) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = noise;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200 + Math.random() * 600, t);
      filter.Q.setValueAtTime(3.0, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.08);
    }
  }

  /** Tur bitiş gongu (derin pirinç çan tınısı) */
  playTurnChime(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;

    const freqs = [174, 348, 522];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.15 * (174 / f), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.8);
    }
  }

  /** Zafer bildirimi */
  playVictory(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [220, 277.18, 329.63, 440];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.18;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.8);
    });
  }

  /** Yenilgi / hüzünlü kapanış bildirimi */
  playDefeat(): void {
    if (this.muted || !this.ctx || !this.masterGain) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [329.63, 293.66, 261.63, 220]; // Düşen minör tonlar
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.28;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }

  /** Çanakkale Boğazı arka plan deniz dalgası & rüzgar ambiyansı */
  private startSeaAmbience(): void {
    if (this.ambientSource || !this.ctx || !this.masterGain) return;

    try {
      const buffer = this.createNoiseBuffer(4.0);
      if (!buffer) return;

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(90, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      src.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      src.start();
      lfo.start();
      this.ambientSource = src;
    } catch {}
  }

  private stopSeaAmbience(): void {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.ambientSource = null;
  }
}

export const sound = new AudioEngine();
