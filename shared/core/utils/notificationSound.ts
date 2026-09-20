import { Vibration, Platform } from 'react-native';

/**
 * Plays an audible notification chime and triggers device vibration
 * when a new order is received by the Cashier or Restaurant Owner.
 */
export function playOrderNotificationSound(enabled: boolean = true): void {
  if (!enabled) return;

  try {
    // 1. Mobile Device Vibration (Distinct double-pulse pattern)
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      Vibration.vibrate([0, 250, 100, 250]);
    }

    // 2. Web Audio Synthesizer (Zero-latency procedural chime)
    if (typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      if (AudioContextClass) {
        const ctx = new AudioContextClass();

        // High-pitch 3-tone cheerful restaurant chime (E5 -> G#5 -> B5)
        const playTone = (freq: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

          gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
          gain.gain.exponentialRampToValueAtTime(
            0.35,
            ctx.currentTime + startTime + 0.02
          );
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + startTime + duration
          );

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + startTime);
          osc.stop(ctx.currentTime + startTime + duration);
        };

        playTone(659.25, 0.0, 0.22); // E5
        playTone(830.61, 0.14, 0.22); // G#5
        playTone(987.77, 0.28, 0.4);  // B5
      }
    }
  } catch (err) {
    // Ignore audio context autoplay restrictions quietly
  }
}
