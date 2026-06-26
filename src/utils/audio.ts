/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private volume: number = 0.5;

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  private playTone(freqs: number[], duration: number, type: OscillatorType = 'sine', slide: boolean = false) {
    this.init();
    if (!this.ctx || this.volume === 0) return;

    try {
      // Resume if suspended (browser security autoplays)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      if (freqs.length === 1) {
        osc.frequency.setValueAtTime(freqs[0], now);
      } else if (freqs.length > 1) {
        if (slide) {
          osc.frequency.setValueAtTime(freqs[0], now);
          osc.frequency.exponentialRampToValueAtTime(freqs[freqs.length - 1], now + duration);
        } else {
          // Play sequence of notes
          const noteDuration = duration / freqs.length;
          freqs.forEach((freq, index) => {
            osc.frequency.setValueAtTime(freq, now + index * noteDuration);
          });
        }
      }

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  playMenuSelect() {
    this.playTone([300, 450], 0.1, 'triangle');
  }

  playKeyBind() {
    this.playTone([600, 800], 0.15, 'sine');
  }

  playJump() {
    this.playTone([150, 600], 0.25, 'triangle', true);
  }

  playCollect() {
    this.playTone([523.25, 659.25, 783.99, 1046.50], 0.3, 'sine');
  }

  playHit() {
    this.playTone([220, 100], 0.3, 'sawtooth', true);
  }

  playGameOver() {
    this.playTone([300, 200, 150, 100], 0.8, 'sawtooth');
  }

  playLevelUp() {
    this.playTone([261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50], 0.6, 'sine');
  }
}

export const soundManager = new SoundEffectsManager();
