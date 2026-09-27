// Everything is synthesised; the project ships no audio files.

/** Pure: returns a predicate that is true at most once per minGap seconds. */
export function makeRateLimiter(minGap) {
  let last = -Infinity;
  return (now) => {
    if (now - last < minGap) return false;
    last = now;
    return true;
  };
}

let ctx = null;

// Browsers refuse to start an AudioContext before a user gesture. Creating it
// lazily on the first sound means the first sound follows a real input.
function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function tone({ freq, endFreq, type = "square", dur = 0.12, gain = 0.12, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.25, from = 3000, to = 200 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime;
  const frames = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur);
}

const growlAllowed = makeRateLimiter(1.2);
const heartbeatAllowed = makeRateLimiter(0.9);

export const sfx = {
  shoot(weaponId) {
    if (weaponId === "scattergun") {
      noise({ dur: 0.26, gain: 0.3, from: 4200, to: 160 });
      tone({ freq: 160, endFreq: 50, type: "sawtooth", dur: 0.16, gain: 0.14 });
    } else {
      tone({ freq: 640, endFreq: 180, type: "square", dur: 0.07, gain: 0.08 });
    }
  },

  demonDeath() {
    tone({ freq: 220, endFreq: 40, type: "sawtooth", dur: 0.2, gain: 0.14 });
    noise({ dur: 0.14, gain: 0.14, from: 1800, to: 120 });
  },

  hurt() {
    tone({ freq: 300, endFreq: 70, type: "sawtooth", dur: 0.3, gain: 0.2 });
  },

  pickup() {
    tone({ freq: 880, type: "triangle", dur: 0.07, gain: 0.12 });
    tone({ freq: 1320, type: "triangle", dur: 0.09, gain: 0.1, delay: 0.06 });
  },

  /** Rate-limited: a dozen grunts spawning must not produce a wall of noise. */
  growl(now) {
    if (!growlAllowed(now)) return;
    tone({ freq: 90, endFreq: 62, type: "sawtooth", dur: 0.34, gain: 0.1 });
  },

  bounce() {
    tone({ freq: 420, endFreq: 760, type: "triangle", dur: 0.09, gain: 0.09 });
  },

  spring() {
    tone({ freq: 360, endFreq: 1500, type: "square", dur: 0.22, gain: 0.12 });
  },

  gameOver() {
    tone({ freq: 380, endFreq: 60, type: "sawtooth", dur: 0.9, gain: 0.2 });
  },

  /** Low-health pulse. Rate-limited so it beats rather than drones. */
  heartbeat(now) {
    if (!heartbeatAllowed(now)) return;
    tone({ freq: 70, endFreq: 46, type: "sine", dur: 0.11, gain: 0.22 });
    tone({ freq: 62, endFreq: 40, type: "sine", dur: 0.13, gain: 0.16, delay: 0.17 });
  },
};
