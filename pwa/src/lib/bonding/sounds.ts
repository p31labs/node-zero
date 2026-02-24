/**
 * BONDING Audio Engine — 528Hz Just Intonation, ADSR, PhET-informed sonification.
 * Resume on first pointerdown; airlock (fade out on visibility hidden).
 */

type OscillatorType = "sine" | "triangle" | "square";

interface ElementProfile {
  freq: number;
  type: OscillatorType | "composite" | "halogen";
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

const ELEMENT_PROFILES: Record<number, ElementProfile> = {
  1: { freq: 528, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  2: { freq: 444, type: "sine", attack: 0.8, decay: 0.5, sustain: 0.8, release: 1.5 },
  6: { freq: 264, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  7: { freq: 247.5, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  8: { freq: 222, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  9: { freq: 198, type: "halogen", attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
  11: { freq: 165, type: "triangle", attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
  12: { freq: 148.5, type: "triangle", attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
  13: { freq: 140, type: "triangle", attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
  14: { freq: 132, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  15: { freq: 132, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  16: { freq: 123.75, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 },
  17: { freq: 111, type: "halogen", attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
  19: { freq: 88, type: "triangle", attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
  20: { freq: 82.5, type: "triangle", attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
  26: { freq: 66, type: "composite", attack: 0.1, decay: 0.4, sustain: 0.6, release: 1 },
  29: { freq: 60, type: "composite", attack: 0.1, decay: 0.4, sustain: 0.6, release: 1 },
  30: { freq: 56, type: "composite", attack: 0.1, decay: 0.4, sustain: 0.6, release: 1 },
  35: { freq: 50, type: "halogen", attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
  79: { freq: 33, type: "composite", attack: 0.1, decay: 0.4, sustain: 0.6, release: 1 },
};

function getProfile(atomicNumber: number): ElementProfile {
  return ELEMENT_PROFILES[atomicNumber] ?? { freq: 528, type: "sine", attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.5 };
}

function applyADSR(gainNode: GainNode, ctx: AudioContext, profile: ElementProfile, volume: number): void {
  const t = ctx.currentTime;
  const a = profile.attack;
  const d = profile.decay;
  const s = profile.sustain;
  const r = profile.release;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(volume, t + a);
  gainNode.gain.linearRampToValueAtTime(volume * s, t + a + d);
  gainNode.gain.setValueAtTime(volume * s, t + a + d);
  gainNode.gain.setValueAtTime(volume * s, t + a + d + 0.5);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + a + d + 0.5 + r);
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private muteGain = 1;
  private activeCount = 0;
  private boundResume: (() => void) | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);
      if (typeof document !== "undefined") {
        this.boundResume = () => this.ctx?.resume();
        document.addEventListener("pointerdown", this.boundResume!, { once: true });
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "hidden") this.fadeOut();
          else if (document.visibilityState === "visible") this.fadeIn();
        });
      }
    }
    return this.ctx;
  }

  private fadeOut(): void {
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.1);
    setTimeout(() => this.ctx?.suspend(), 200);
  }

  private fadeIn(): void {
    if (!this.ctx || !this.masterGain) return;
    this.ctx.resume();
    this.masterGain.gain.setTargetAtTime(this.muted ? 0.001 : 0.8 * this.muteGain, this.ctx.currentTime, 0.1);
  }

  private volume(): number {
    const n = Math.max(1, this.activeCount);
    return 0.8 / n;
  }

  playElement(atomicNumber: number): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const profile = getProfile(atomicNumber);
    const vol = this.volume();
    this.activeCount++;

    const gain = ctx.createGain();
    gain.connect(master);
    applyADSR(gain, ctx, profile, vol);

    if (profile.type === "sine") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + profile.attack + profile.decay + 0.5 + profile.release);
    } else if (profile.type === "triangle") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + profile.attack + profile.decay + 0.5 + profile.release);
    } else if (profile.type === "halogen") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 600;
      osc.connect(filter);
      filter.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + profile.attack + profile.decay + 0.3 + profile.release);
    } else if (profile.type === "composite") {
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(profile.freq, ctx.currentTime);
      osc1.connect(gain);
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(profile.freq / 2, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.value = 0.4;
      osc2.connect(subGain);
      subGain.connect(gain);
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      const end = ctx.currentTime + profile.attack + profile.decay + 0.5 + profile.release;
      osc1.stop(end);
      osc2.stop(end);
    }

    setTimeout(() => {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }, (profile.attack + profile.decay + 0.5 + profile.release) * 1000);
  }

  playBond(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    gain.connect(master);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(728, ctx.currentTime + 0.1);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  }

  playPing(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    [0, 0.1].forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.15);
    });
  }

  playAchievement(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const freqs = [264, 330, 396, 528];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.05 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.35);
    });
  }

  playError(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    gain.connect(master);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 100;
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  }

  playHover(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    gain.connect(master);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 800;
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  playTurnChange(): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    gain.connect(master);
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(-1, ctx.currentTime);
    panner.pan.linearRampToValueAtTime(1, ctx.currentTime + 0.5);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 444;
    osc.connect(panner);
    panner.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  }

  playMoleculeChord(atomicNumbers: number[]): void {
    const ctx = this.getCtx();
    const master = this.masterGain!;
    if (this.muted || ctx.state === "suspended") return;
    const freqs = [...new Set(atomicNumbers.map((n) => getProfile(n).freq))].sort((a, b) => a - b);
    let voices = freqs.slice(0, 4);
    while (voices.length < 4 && voices.length > 0) {
      voices = [...voices, voices[voices.length - 1]! * 2];
    }
    if (voices.length >= 2 && voices[1]! < voices[0]! * 1.2) {
      voices[1] = Math.min(voices[1]! * 2, 2000);
    }
    const vol = 0.2 / Math.max(voices.length, 1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(vol, ctx.currentTime + 2.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.2);
    gain.connect(master);
    voices.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 4.2);
    });
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0.001 : 0.8 * this.muteGain,
        this.ctx.currentTime,
        0.1
      );
    }
    return this.muted;
  }

  setMasterVolume(level: number): void {
    this.muteGain = Math.max(0, Math.min(1, level));
    if (!this.muted && this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.8 * this.muteGain, this.ctx.currentTime, 0.1);
    }
  }
}

export const audio = new AudioEngine();
