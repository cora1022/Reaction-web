const SOUND_PATTERNS = Object.freeze({
  start: [
    { frequency: 294, delay: 0, duration: 0.07, volume: 0.035, type: 'triangle' },
    { frequency: 440, delay: 0.065, duration: 0.11, volume: 0.045, type: 'sine' },
  ],
  result: [
    { frequency: 620, delay: 0, duration: 0.055, volume: 0.04, type: 'triangle' },
    { frequency: 880, delay: 0.045, duration: 0.12, volume: 0.05, type: 'sine' },
  ],
  complete: [
    { frequency: 523, delay: 0, duration: 0.09, volume: 0.045, type: 'triangle' },
    { frequency: 659, delay: 0.075, duration: 0.1, volume: 0.05, type: 'triangle' },
    { frequency: 784, delay: 0.15, duration: 0.11, volume: 0.055, type: 'triangle' },
    { frequency: 1047, delay: 0.235, duration: 0.2, volume: 0.06, type: 'sine' },
  ],
});

export function getReactionSoundPattern(name) {
  return (SOUND_PATTERNS[name] ?? []).map((tone) => ({ ...tone }));
}

function defaultContextFactory() {
  const AudioContextApi = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AudioContextApi ? new AudioContextApi() : null;
}

export function createReactionSoundController({ contextFactory = defaultContextFactory } = {}) {
  let context = null;
  let master = null;

  function ensureContext() {
    if (context) return context;
    try {
      context = contextFactory();
      if (!context) return null;
      master = context.createGain();
      master.gain.value = 0.7;
      master.connect(context.destination);
      return context;
    } catch {
      context = null;
      master = null;
      return null;
    }
  }

  function play(name) {
    const pattern = getReactionSoundPattern(name);
    if (pattern.length === 0) return false;
    const audioContext = ensureContext();
    if (!audioContext || !master) return false;
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});

    pattern.forEach((tone) => {
      const start = audioContext.currentTime + tone.delay;
      const end = start + tone.duration;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.volume, start + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.012);
    });
    return true;
  }

  return { play };
}
