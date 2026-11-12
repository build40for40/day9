// Hear the Century: 1920 to now as sound. Every trend makes the noise of the thing itself
// (jackets zip, boots stomp, skirts swish), or in Weighted mode a note whose pitch and
// timbre follow how heavy the clothes are. All synthesised, no sample files.

import { FAMILIES, FIRST_YEAR, NOW_YEAR, clamp, familyOf, token, type Family, type Nerds, type Trend } from "../data";
import { FONT, reducedMotion, stage } from "../stage";
import type { View } from "../view";

type Mode = "wardrobe" | "weighted";
const LENGTHS = [30, 60, 120] as const;
const SPAN = NOW_YEAR - FIRST_YEAR + 1;
const SLOTS = 4;
const MAX_PER_YEAR = 4;
const LOOKAHEAD = 0.15;
const FAMILY_ORDER: Family[] = ["clothes", "scenes", "kit", "face"];
const PAN: Record<Family, number> = { clothes: -0.4, scenes: 0, kit: 0.4, face: -0.15 };
// Root note per decade, 1920s to 2020s, so the century changes key as it goes.
const ROOTS = [0, 5, 3, 7, 0, 10, 5, 3, 7, 0, 5];
const KEYS = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const PENTATONIC = [0, 2, 4, 7, 9];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const rootFor = (year: number) => ROOTS[clamp(Math.floor((year - FIRST_YEAR) / 10), 0, ROOTS.length - 1)];
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const words = (trend: Trend) => ` ${[trend.id, trend.name, ...(trend.aliases ?? [])].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

/* ---------------- the synth ---------------- */

class Synth {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly reverb: ConvolverNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly curves = new Map<number, Float32Array<ArrayBuffer>>();

  constructor() {
    this.ctx = new AudioContext();
    const ctx = this.ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(compressor).connect(ctx.destination);

    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this.reverb = ctx.createConvolver();
    const length = ctx.sampleRate * 2.4;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const channel = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) channel[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
    }
    this.reverb.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.reverb.connect(wet).connect(this.master);
  }

  /** A gain with an attack, a hold and an exponential release. */
  env(t: number, peak: number, attack: number, hold: number, release: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    return g;
  }

  /** Filtered noise. `sweep` is a list of [seconds after t, frequency]. */
  noise(t: number, out: AudioNode, o: { dur: number; peak: number; type: BiquadFilterType; sweep: [number, number][]; q?: number; attack?: number; hold?: number }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = o.type;
    filter.Q.value = o.q ?? 1;
    filter.frequency.setValueAtTime(o.sweep[0][1], t);
    for (const [at, f] of o.sweep.slice(1)) filter.frequency.exponentialRampToValueAtTime(f, t + at);
    const attack = o.attack ?? 0.004;
    const hold = o.hold ?? 0;
    const g = this.env(t, o.peak, attack, hold, Math.max(0.01, o.dur - attack - hold));
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  /** An oscillator note, optionally gliding to `to`, optionally through a filter. */
  tone(t: number, out: AudioNode, o: { freq: number; to?: number; type?: OscillatorType; dur: number; peak: number; attack?: number; hold?: number; filter?: { type: BiquadFilterType; freq: number; to?: number; q?: number }; detune?: number }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const attack = o.attack ?? 0.003;
    const hold = o.hold ?? 0;
    const g = this.env(t, o.peak, attack, hold, Math.max(0.01, o.dur - attack - hold));
    let node: AudioNode = osc;
    if (o.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = o.filter.type;
      filter.Q.value = o.filter.q ?? 1;
      filter.frequency.setValueAtTime(o.filter.freq, t);
      if (o.filter.to) filter.frequency.exponentialRampToValueAtTime(o.filter.to, t + o.dur);
      node = node.connect(filter);
    }
    node.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  click(t: number, out: AudioNode, freq: number, peak: number, q = 8) {
    this.noise(t, out, { dur: 0.018, peak, type: "bandpass", sweep: [[0, freq]], q, attack: 0.001 });
  }

  /** A bell: a sine carrier frequency modulated by another sine whose depth decays. */
  bell(t: number, out: AudioNode, freq: number, peak: number, decay: number, ratio = 1.41) {
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const depth = ctx.createGain();
    carrier.frequency.value = freq;
    mod.frequency.value = freq * ratio;
    depth.gain.setValueAtTime(freq * 1.2, t);
    depth.gain.exponentialRampToValueAtTime(1, t + decay);
    mod.connect(depth).connect(carrier.frequency);
    const g = this.env(t, peak, 0.002, 0, decay);
    carrier.connect(g).connect(out);
    carrier.start(t);
    mod.start(t);
    carrier.stop(t + decay + 0.05);
    mod.stop(t + decay + 0.05);
  }

  /** Overdriven oscillators, for power chords and grunge. */
  chord(t: number, out: AudioNode, freqs: number[], o: { dur: number; peak: number; drive: number; cutoff: number; attack?: number }) {
    const ctx = this.ctx;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.curve(o.drive);
    shaper.oversample = "2x";
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = o.cutoff;
    const g = this.env(t, o.peak, o.attack ?? 0.006, o.dur * 0.3, o.dur * 0.7);
    const sum = ctx.createGain();
    sum.gain.value = 0.4;
    sum.connect(shaper).connect(filter).connect(g).connect(out);
    freqs.forEach((f, i) => {
      for (const detune of [-8, 8]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = f;
        osc.detune.value = detune + i;
        osc.connect(sum);
        osc.start(t);
        osc.stop(t + o.dur + 0.05);
      }
    });
  }

  private curve(drive: number) {
    let curve = this.curves.get(drive);
    if (!curve) {
      curve = new Float32Array(new ArrayBuffer(1024 * 4));
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * drive);
      }
      this.curves.set(drive, curve);
    }
    return curve;
  }

  kick(t: number, out: AudioNode, peak: number) {
    this.tone(t, out, { freq: 150, to: 45, dur: 0.16, peak });
  }

  close() {
    this.ctx.close().catch(() => {});
  }
}

/* ---------------- what each trend sounds like ---------------- */

type Play = (s: Synth, t: number, out: AudioNode, v: number) => void;
interface Sound { name: string; play: Play }

const SOUNDS = {
  zip: {
    name: "zip",
    play: (s, t, out, v) => {
      for (let i = 0; i < 14; i++) s.click(t + 0.3 * (i / 13) ** 0.7, out, 2400 + i * 200, 0.22 * v, 10);
      s.noise(t, out, { dur: 0.32, peak: 0.3 * v, type: "bandpass", sweep: [[0, 1200], [0.3, 5200]], q: 2.5 });
    },
  },
  stomp: {
    name: "boot stomp",
    play: (s, t, out, v) => {
      for (const [at, k] of [[0, 1], [0.24, 0.7]] as const) {
        s.tone(t + at, out, { freq: 140, to: 42, dur: 0.26, peak: 0.85 * v * k });
        s.noise(t + at, out, { dur: 0.09, peak: 0.45 * v * k, type: "lowpass", sweep: [[0, 900], [0.09, 200]] });
      }
    },
  },
  clickClack: {
    name: "click clack",
    play: (s, t, out, v) => {
      for (const [at, f] of [[0, 3200], [0.17, 2700], [0.34, 3100]] as const) {
        s.click(t + at, out, f, 0.7 * v, 6);
        s.tone(t + at, out, { freq: f * 0.7, dur: 0.035, peak: 0.12 * v });
      }
    },
  },
  swish: {
    name: "swish",
    play: (s, t, out, v) => s.noise(t, out, { dur: 0.55, peak: 0.5 * v, type: "bandpass", sweep: [[0, 400], [0.25, 2600], [0.55, 650]], q: 1.2, attack: 0.15 }),
  },
  rustle: {
    name: "denim rustle",
    play: (s, t, out, v) => {
      for (let i = 0; i < 6; i++) s.noise(t + i * 0.065 + (i % 2) * 0.012, out, { dur: 0.1, peak: 0.34 * v, type: "lowpass", sweep: [[0, 1500], [0.1, 650]], q: 0.8 });
    },
  },
  whisper: {
    name: "silky whisper",
    play: (s, t, out, v) => s.noise(t, out, { dur: 0.8, peak: 0.2 * v, type: "highpass", sweep: [[0, 2500], [0.8, 4200]], q: 0.7, attack: 0.3 }),
  },
  jingle: {
    name: "jingle",
    play: (s, t, out, v) => [2093, 2637, 3136, 3951].forEach((f, i) => s.bell(t + i * 0.05, out, f, 0.12 * v, 0.5, 2.01)),
  },
  pop: {
    name: "hat pop",
    play: (s, t, out, v) => {
      s.tone(t, out, { freq: 520, to: 160, dur: 0.09, peak: 0.6 * v });
      s.click(t, out, 1200, 0.2 * v);
    },
  },
  psst: {
    name: "hairspray psst",
    play: (s, t, out, v) => s.noise(t, out, { dur: 0.6, peak: 0.28 * v, type: "highpass", sweep: [[0, 5000], [0.6, 6500]], q: 0.5, attack: 0.02, hold: 0.35 }),
  },
  snip: {
    name: "scissor snip",
    play: (s, t, out, v) => {
      for (const [at, f] of [[0, 6500], [0.07, 5200]] as const) {
        s.click(t + at, out, f, 0.5 * v, 14);
        s.tone(t + at, out, { freq: f * 0.6, dur: 0.025, peak: 0.08 * v });
      }
    },
  },
  compact: {
    name: "compact click",
    play: (s, t, out, v) => {
      s.click(t, out, 1800, 0.5 * v);
      s.tone(t + 0.005, out, { freq: 1100, dur: 0.05, peak: 0.18 * v });
    },
  },
  clasp: {
    name: "clasp snap",
    play: (s, t, out, v) => {
      s.click(t, out, 2600, 0.75 * v, 5);
      s.tone(t, out, { freq: 900, type: "square", dur: 0.04, peak: 0.12 * v, filter: { type: "lowpass", freq: 2000 } });
    },
  },
  fold: {
    name: "specs fold",
    play: (s, t, out, v) => {
      s.click(t, out, 3000, 0.4 * v);
      s.click(t + 0.07, out, 3600, 0.4 * v);
    },
  },
  slap: {
    name: "sandal slap",
    play: (s, t, out, v) => {
      s.noise(t, out, { dur: 0.05, peak: 0.6 * v, type: "lowpass", sweep: [[0, 1800]] });
      s.noise(t + 0.2, out, { dur: 0.05, peak: 0.5 * v, type: "lowpass", sweep: [[0, 1600]] });
    },
  },
  wool: {
    name: "woolly rub",
    play: (s, t, out, v) => s.noise(t, out, { dur: 0.5, peak: 0.34 * v, type: "lowpass", sweep: [[0, 650], [0.5, 380]], attack: 0.14 }),
  },
  soft: {
    name: "soft swish",
    play: (s, t, out, v) => s.noise(t, out, { dur: 0.38, peak: 0.28 * v, type: "bandpass", sweep: [[0, 800], [0.38, 1600]], q: 0.8, attack: 0.1 }),
  },
  // Subculture stings.
  power: {
    name: "power chord",
    play: (s, t, out, v) => s.chord(t, out, [82.4, 123.5, 164.8], { dur: 0.55, peak: 0.22 * v, drive: 6, cutoff: 2400 }),
  },
  jangle: {
    name: "jangly strum",
    play: (s, t, out, v) =>
      [196, 247, 294, 392, 494].forEach((f, i) => s.tone(t + i * 0.028, out, { freq: f, type: "sawtooth", dur: 0.55, peak: 0.07 * v, filter: { type: "lowpass", freq: 3800, to: 1200 } })),
  },
  disco: {
    name: "hi-hat and clap",
    play: (s, t, out, v) => {
      for (const at of [0, 0.125, 0.25, 0.375]) s.noise(t + at, out, { dur: 0.04, peak: 0.22 * v, type: "highpass", sweep: [[0, 8000]] });
      for (const at of [0.12, 0.135, 0.15]) s.noise(t + at, out, { dur: 0.03, peak: 0.35 * v, type: "bandpass", sweep: [[0, 1500]], q: 2 });
      s.noise(t + 0.15, out, { dur: 0.16, peak: 0.2 * v, type: "bandpass", sweep: [[0, 1400]], q: 1.5 });
    },
  },
  rave: {
    name: "four on the floor",
    play: (s, t, out, v) => {
      for (let i = 0; i < 4; i++) s.kick(t + i * 0.13, out, 0.65 * v);
      s.tone(t, out, { freq: 110, type: "sawtooth", dur: 0.5, peak: 0.08 * v, filter: { type: "lowpass", freq: 300, to: 2500, q: 12 } });
    },
  },
  tambourine: {
    name: "tambourine",
    play: (s, t, out, v) => {
      for (let i = 0; i < 3; i++) {
        s.noise(t + i * 0.12, out, { dur: 0.09, peak: 0.25 * v, type: "highpass", sweep: [[0, 7000]] });
        s.bell(t + i * 0.12, out, 5200 + i * 300, 0.05 * v, 0.18, 1.7);
      }
    },
  },
  gothBell: {
    name: "cathedral bell",
    play: (s, t, out, v) => {
      s.bell(t, out, 220, 0.2 * v, 2.2, 2.76);
      s.bell(t, s.reverb, 220, 0.25 * v, 2.2, 2.76);
    },
  },
  grunge: {
    name: "fuzzy chord",
    play: (s, t, out, v) => s.chord(t, out, [73.4, 110, 146.8], { dur: 0.75, peak: 0.2 * v, drive: 14, cutoff: 1300, attack: 0.02 }),
  },
  boomBap: {
    name: "boom bap",
    play: (s, t, out, v) => {
      s.kick(t, out, 0.8 * v);
      s.noise(t + 0.2, out, { dur: 0.13, peak: 0.4 * v, type: "bandpass", sweep: [[0, 1800]], q: 1 });
      s.tone(t + 0.2, out, { freq: 190, to: 150, dur: 0.08, peak: 0.25 * v });
      s.kick(t + 0.33, out, 0.6 * v);
    },
  },
  slapBass: {
    name: "slap bass",
    play: (s, t, out, v) => {
      for (const [at, f] of [[0, 82.4], [0.16, 110]] as const) {
        s.click(t + at, out, 2000, 0.2 * v);
        s.tone(t + at, out, { freq: f, type: "triangle", dur: 0.22, peak: 0.45 * v, filter: { type: "lowpass", freq: 1600, to: 300 } });
      }
    },
  },
  trumpet: {
    name: "muted trumpet",
    play: (s, t, out, v) => {
      for (const [at, f] of [[0, 392], [0.13, 466]] as const) s.tone(t + at, out, { freq: f, type: "square", dur: 0.11, peak: 0.12 * v, attack: 0.01, filter: { type: "bandpass", freq: 1100, q: 5 } });
    },
  },
  drumFill: {
    name: "drum fill",
    play: (s, t, out, v) => {
      s.tone(t, out, { freq: 210, to: 120, dur: 0.14, peak: 0.45 * v });
      s.tone(t + 0.11, out, { freq: 160, to: 95, dur: 0.16, peak: 0.45 * v });
    },
  },
} satisfies Record<string, Sound>;

type SoundId = keyof typeof SOUNDS;

const STINGS: [RegExp, SoundId][] = [
  [/ (pop punk|punk|skinhead|heavy metal) /, "power"],
  [/ (grunge|soft grunge|kinderwhore) /, "grunge"],
  [/ (mod|britpop|indie sleaze|swinging london|new wave|two tone|hipster) /, "jangle"],
  [/ (disco|glam rock|new romantic|peacock revolution) /, "disco"],
  [/ (rave|y2k|e girl|brat|dopamine dressing) /, "rave"],
  [/ (hippie|boho|cottagecore|vintage) /, "tambourine"],
  [/ (goth|emo|scene|dark academia|neo medieval) /, "gothBell"],
  [/ (hip hop|streetwear|chav|football casuals|skater|athleisure) /, "boomBap"],
  [/ (teddy boys|rockabilly|greasers|pin up|western wear) /, "slapBass"],
  [/ (flappers|zazou|spiv|beatniks|neo edwardian|ivy league) /, "trumpet"],
];

const FOOTWEAR: [RegExp, SoundId][] = [
  [/ (heels?|stiletto|platform|wedge|court shoes|kitten) /, "clickClack"],
  [/ (sandals?|flats|birkenstocks|flip flops|jelly shoes|crocs) /, "slap"],
  [/ (boots?|sneakers?|trainers?|shoes|converse|vans|air jordans|brogues|loafers|creepers|winklepickers|moccasins|mary janes|doc martens|wellies) /, "stomp"],
];
const ACCESSORIES: [RegExp, SoundId][] = [
  [/ (jewellery|jewelry|choker|bangles?|bracelets?|earrings?|pearls|chain|beads|necklace|studs|spikes|safety pins|piercing|dog collar) /, "jingle"],
  [/ (hat|caps?|beret|beanie|fedora|trilby|homburg|stetson|cloche|pillbox|bowler|snapback) /, "pop"],
  [/ (bag|fanny pack|handbag|clutch) /, "clasp"],
  [/ (glasses|sunglasses|shades|wayfarers|aviator) /, "fold"],
  [/ (tights|fishnets|stockings|socks|leg warmers|gloves) /, "whisper"],
];
const CLOTHES: [RegExp, SoundId][] = [
  [/ (sequins|rhinestones|metallics|glitter) /, "jingle"],
  [/ (miniskirt|minidress|fringe) /, "swish"],
  [/ (houndstooth|pinstripe|tartan|tweed|argyle|fair isle) /, "wool"],
  [/ (crop top|tank top|t shirt|tube top|halter top|blouse|seersucker|logomania) /, "soft"],
  [/ (jeans|denim|cargo|corduroy|overalls|workwear|chinos|utility|military|camouflage|levis|trousers|pants) /, "rustle"],
  [/ (jacket|coat|parka|bomber|puffer|windbreaker|blazer|anorak|cape|leather|pvc) /, "zip"],
  [/ (silk|chiffon|bias|satin|sheer|lace|camisole|lingerie|slip|velvet) /, "whisper"],
  [/ (skirt|dress|gown|petticoat|kaftan|maxi|midi|mini|culottes|palazzo|new look|a line|hourglass|peplum) /, "swish"],
  [/ (sweater|knit|cardigan|jumper|hoodie|turtleneck|fleece|tracksuit|sweatpants|tweed|fur|wool|fair isle|argyle|polo neck|faux fur) /, "wool"],
];

const HAIR_SPRAY = / (bouffant|beehive|big hair|perm|crimped|feathered|quiff|pompadour|finger waves|victory rolls|spiked|mohawk|frosted|curtain bangs|rachel) /;
const own = (trend: Trend) => ` ${[trend.id, trend.name].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

/** Match the trend's own name first, then its aliases, so a stray alias can't hijack it. */
function lookup(trend: Trend, table: [RegExp, SoundId][]) {
  for (const text of [own(trend), words(trend)]) for (const [pattern, id] of table) if (pattern.test(text)) return SOUNDS[id];
  return undefined;
}

export function soundFor(trend: Trend): Sound {
  switch (trend.category) {
    case "subculture":
      return lookup(trend, STINGS) ?? SOUNDS.drumFill;
    case "hair":
      return HAIR_SPRAY.test(words(trend)) ? SOUNDS.psst : SOUNDS.snip;
    case "makeup":
      return SOUNDS.compact;
    case "footwear":
      return lookup(trend, FOOTWEAR) ?? SOUNDS.stomp;
    case "accessory":
      return lookup(trend, ACCESSORIES) ?? SOUNDS.soft;
    default:
      return lookup(trend, CLOTHES) ?? SOUNDS.soft;
  }
}

/* ---------------- how heavy the clothes are ---------------- */

const WEIGHTS: [RegExp, number][] = [
  [/ (puffer|fur coat|fur) /, 0.95],
  [/ (coat|parka|trench|leather|boots?|combat|work boots|doc martens) /, 0.9],
  [/ (tweed|wool|duffle|military|workwear|overalls) /, 0.85],
  [/ (jacket|blazer|suit|bomber|varsity|harrington) /, 0.75],
  [/ (jeans|denim|corduroy|cargo|sweater|cardigan|jumper|knit|hoodie|turtleneck|fleece) /, 0.7],
  [/ (trousers|chinos|kilt|flannel|tracksuit|sweatpants|velvet) /, 0.6],
  [/ (dress|skirt|shirt|blouse|maxi|midi|kaftan) /, 0.4],
  [/ (t shirt|tank top|polo|leggings|yoga) /, 0.3],
  [/ (mini|miniskirt|minidress|shorts|hot pants|halter|tube top) /, 0.22],
  [/ (slip|silk|chiffon|satin|sheer|lace|camisole|crop top|lingerie|stockings|fishnets) /, 0.15],
  [/ (bikini|sandals?|flip flops|ballet flats|jelly) /, 0.06],
];
const CATEGORY_WEIGHT: Record<string, number> = { garment: 0.5, silhouette: 0.5, fabric: 0.5, pattern: 0.4, colour: 0.35, accessory: 0.3, footwear: 0.6, hair: 0.25, makeup: 0.12, subculture: 0.6 };

export function weightOf(trend: Trend) {
  for (const text of [own(trend), words(trend)]) for (const [pattern, weight] of WEIGHTS) if (pattern.test(text)) return weight;
  return CATEGORY_WEIGHT[trend.category] ?? 0.5;
}
const weightName = (w: number) => (w > 0.66 ? "heavy and low" : w > 0.33 ? "mid weight" : "light and bright");

function playWeighted(s: Synth, t: number, out: AudioNode, trend: Trend, year: number, v: number) {
  const w = weightOf(trend);
  const root = rootFor(year);
  const degree = PENTATONIC[hash(trend.id) % PENTATONIC.length];
  const midi = 40 + Math.round((1 - w) * 3) * 12 + root + degree;
  const type: OscillatorType = w > 0.65 ? "sawtooth" : w > 0.35 ? "triangle" : "sine";
  const attack = 0.004 + w * 0.08;
  const dur = 0.25 + w * 1.3;
  const cutoff = 450 + (1 - w) ** 1.5 * 6000;
  const peak = (w > 0.65 ? 0.14 : 0.2) * v;
  s.tone(t, out, { freq: hz(midi), type, dur, peak, attack, filter: { type: "lowpass", freq: cutoff, to: cutoff * (0.5 + (1 - w) * 0.4), q: 1 } });
  if (w > 0.65) s.tone(t, out, { freq: hz(midi), type, dur, peak: peak * 0.6, attack, detune: 9, filter: { type: "lowpass", freq: cutoff } });
  else if (w < 0.3) s.tone(t + 0.02, out, { freq: hz(midi + 12), dur: dur * 0.6, peak: peak * 0.35 });
  s.tone(t, s.reverb, { freq: hz(midi), type: "sine", dur, peak: peak * 0.5, attack });
}

/* ---------------- the score ---------------- */

interface Note { year: number; slot: number; trend: Trend; family: Family; loud: number; kind: "arrives" | "peaks"; sound: Sound }

function score(nerds: Nerds): Note[] {
  const maxFame = Math.max(...nerds.trends.map((t) => nerds.fame(t)), 1);
  const byYear = new Map<number, Omit<Note, "slot">[]>();
  const add = (year: number, note: Omit<Note, "slot">) => {
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(note);
  };
  for (const trend of nerds.trends) {
    const loud = 0.45 + 0.55 * (nerds.fame(trend) / maxFame);
    const family = familyOf(trend.category);
    const sound = soundFor(trend);
    const arrivals: number[] = [];
    for (let year = FIRST_YEAR; year <= NOW_YEAR; year++) {
      const before = year === FIRST_YEAR ? 0 : nerds.presence(trend, year - 1);
      if (nerds.presence(trend, year) >= 0.5 && before < 0.5) arrivals.push(year);
    }
    for (const year of arrivals) add(year, { year, trend, family, loud, kind: "arrives", sound });
    // Its strongest year: the middle of its longest run near full strength.
    let best = { start: 0, length: 0 };
    let start = 0;
    for (let year = FIRST_YEAR; year <= NOW_YEAR + 1; year++) {
      const on = year <= NOW_YEAR && nerds.presence(trend, year) > 0.8;
      if (on && !start) start = year;
      if (!on && start) {
        if (year - start > best.length) best = { start, length: year - start };
        start = 0;
      }
    }
    const peak = best.length ? best.start + Math.floor(best.length / 2) : 0;
    if (peak && !arrivals.includes(peak)) add(peak, { year: peak, trend, family, loud: loud * 0.85, kind: "peaks", sound });
  }
  const notes: Note[] = [];
  for (const [, list] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    list
      .sort((a, b) => b.loud * (b.kind === "arrives" ? 1.2 : 1) - a.loud * (a.kind === "arrives" ? 1.2 : 1))
      .slice(0, MAX_PER_YEAR)
      .forEach((note, slot) => notes.push({ ...note, slot }));
  }
  return notes;
}

/* ---------------- the view ---------------- */

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const chipOn = "border-nof-pink bg-nof-pink text-nof-pink-ink font-semibold";
const chipOff = "border-nof-line bg-nof-panel text-nof-text hover:border-nof-muted";

const view: View = {
  id: "hear",
  tab: "trends",
  title: "Hear the Century",
  blurb: "A hundred years of fashion you can listen to. Jackets zip, boots stomp, skirts swish, punks get a power chord",
  how: "Press play with your sound on. Tap the roll to jump to a year. Wardrobe plays the clothes themselves, Weighted turns them into notes, heavy coats low and dark, bikinis high and bright.",
  sources: ["wikipedia"],
  order: 9,
  mount(host, context) {
    const { nerds } = context;
    const notes = score(nerds);
    const byYear = new Map<number, Note[]>();
    for (const note of notes) {
      if (!byYear.has(note.year)) byYear.set(note.year, []);
      byYear.get(note.year)!.push(note);
    }
    const still = reducedMotion();
    const colours = {
      night: token("--color-nof-night", "#0e0d12"),
      line: token("--color-nof-line", "#302c3a"),
      text: token("--color-nof-text", "#f2eee6"),
      sub: token("--color-nof-sub", "#cfc9d6"),
      muted: token("--color-nof-muted", "#a39fae"),
      pink: token("--color-nof-pink", "#ff6fa8"),
      raised: token("--color-nof-raised", "#211e29"),
    };
    const familyColour = Object.fromEntries(FAMILY_ORDER.map((f) => [f, token(FAMILIES[f].token)])) as Record<Family, string>;

    let mode: Mode = context.params.mode === "weighted" ? "weighted" : "wardrobe";
    let length: number = LENGTHS.find((l) => String(l) === context.params.length) ?? 60;
    let year = clamp(Number(context.params.year) || FIRST_YEAR, FIRST_YEAR, NOW_YEAR);
    let playing = false;
    let synth: Synth | undefined;
    let timer = 0;
    let anchorYear = year;
    let anchorTime = 0;
    let nextSlot = 0;
    let bed: { stop(t: number): void } | undefined;
    let bedDecade = -1;
    const muted = new Set<Family>();
    const lit: { time: number; note: Note; label: string }[] = [];

    const secPerYear = () => length / SPAN;
    const slotTime = (slot: number) => anchorTime + (slot / SLOTS - anchorYear) * secPerYear();
    const label = (note: Note) => (mode === "wardrobe" ? note.sound.name : weightName(weightOf(note.trend)));

    /* DOM */
    const root = el("div", "flex flex-col font-nof-body text-nof-text");
    host.append(root);
    const canvasBox = el("div", "relative cursor-pointer");
    root.append(canvasBox);
    const controls = el("div", "flex flex-col gap-3 border-t border-nof-line p-4");
    root.append(controls);

    const rowOne = el("div", "flex flex-wrap items-center gap-3");
    const play = el("button", "rounded-full bg-nof-pink px-6 py-3 text-lg font-bold text-nof-pink-ink", "▶ Play");
    play.type = "button";
    const modes = el("div", "flex overflow-hidden rounded-full border border-nof-line text-sm");
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "Sound mode");
    const modeButtons = (["wardrobe", "weighted"] as Mode[]).map((m) => {
      const b = el("button", "px-4 py-2 transition", m === "wardrobe" ? "Wardrobe" : "Weighted");
      b.type = "button";
      b.addEventListener("click", () => {
        mode = m;
        context.setParam("mode", m === "wardrobe" ? null : m);
        paintControls();
      });
      modes.append(b);
      return { m, b };
    });
    const lengths = el("div", "flex gap-1 text-sm");
    lengths.setAttribute("aria-label", "How long the century takes");
    const lengthButtons = LENGTHS.map((l) => {
      const b = el("button", "rounded-full border px-3 py-1.5 transition", l === 30 ? "30s" : l === 60 ? "1 min" : "2 min");
      b.type = "button";
      b.addEventListener("click", () => {
        const now = currentYear();
        length = l;
        context.setParam("length", l === 60 ? null : String(l));
        if (playing && synth) anchor(now);
        paintControls();
      });
      lengths.append(b);
      return { l, b };
    });
    rowOne.append(play, modes);
    if (!context.compact) rowOne.append(lengths);

    const scrub = el("input", "w-full accent-nof-pink");
    scrub.type = "range";
    scrub.min = String(FIRST_YEAR);
    scrub.max = String(NOW_YEAR);
    scrub.step = "1";
    scrub.value = String(year);
    scrub.setAttribute("aria-label", "Year");
    controls.append(rowOne, scrub);

    const mutes = el("div", "flex flex-wrap gap-2 text-sm");
    const muteButtons = FAMILY_ORDER.map((f) => {
      const b = el("button", "flex items-center gap-2 rounded-full border px-3 py-1.5 transition");
      b.type = "button";
      const dot = el("span", "size-2.5 rounded-full");
      dot.style.backgroundColor = `var(${FAMILIES[f].token})`;
      b.append(dot, el("span", "", FAMILIES[f].label));
      b.addEventListener("click", () => {
        muted.has(f) ? muted.delete(f) : muted.add(f);
        paintControls();
      });
      mutes.append(b);
      return { f, b };
    });
    if (!context.compact) controls.append(mutes);
    const note = el("p", "text-xs text-nof-muted", "Turn your sound on. Every sound is made in your browser from the data, nothing recorded.");
    controls.append(note);

    function paintControls() {
      play.textContent = playing ? "❚❚ Pause" : "▶ Play";
      play.setAttribute("aria-pressed", String(playing));
      for (const { m, b } of modeButtons) {
        b.className = `px-4 py-2 transition ${m === mode ? "bg-nof-text text-nof-night font-semibold" : "text-nof-sub hover:bg-nof-raised"}`;
        b.setAttribute("aria-pressed", String(m === mode));
      }
      for (const { l, b } of lengthButtons) b.className = `rounded-full border px-3 py-1.5 transition ${l === length ? chipOn : chipOff}`;
      for (const { f, b } of muteButtons) {
        b.className = `flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${muted.has(f) ? "border-nof-line text-nof-muted line-through opacity-60" : chipOff}`;
        b.setAttribute("aria-pressed", String(!muted.has(f)));
      }
    }

    /* audio */
    function currentYear() {
      if (!playing || !synth) return year;
      return clamp(anchorYear + (synth.ctx.currentTime - anchorTime) / secPerYear(), FIRST_YEAR, NOW_YEAR + 0.999);
    }

    function anchor(from: number) {
      if (!synth) return;
      anchorYear = from;
      anchorTime = synth.ctx.currentTime + 0.05;
      nextSlot = Math.ceil(from * SLOTS - 1e-6);
      lit.length = 0;
      bedDecade = -1;
    }

    function setBed(decadeYear: number, t: number) {
      if (!synth) return;
      const s = synth;
      bed?.stop(t);
      const midi = 36 + 12 + rootFor(decadeYear);
      const gain = s.ctx.createGain();
      const level = mode === "weighted" ? 0.03 : 0.014;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level, t + 1.2);
      const filter = s.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 700;
      gain.connect(filter).connect(s.master);
      const oscs = [0, 7, 12].map((step, i) => {
        const osc = s.ctx.createOscillator();
        osc.type = i === 0 ? "sine" : "triangle";
        osc.frequency.value = hz(midi + step);
        osc.detune.value = (i - 1) * 4;
        osc.connect(gain);
        osc.start(t);
        return osc;
      });
      bed = {
        stop(at: number) {
          gain.gain.cancelScheduledValues(at);
          gain.gain.setValueAtTime(gain.gain.value || level, at);
          gain.gain.linearRampToValueAtTime(0.0001, at + 1.2);
          oscs.forEach((o) => o.stop(at + 1.3));
        },
      };
    }

    function schedule() {
      if (!synth || !playing) return;
      const s = synth;
      const horizon = s.ctx.currentTime + LOOKAHEAD;
      while (slotTime(nextSlot) < horizon) {
        const slotYear = Math.floor(nextSlot / SLOTS);
        const slot = nextSlot % SLOTS;
        const t = Math.max(s.ctx.currentTime, slotTime(nextSlot));
        if (slotYear > NOW_YEAR) {
          stop(true);
          return;
        }
        const decade = Math.floor(slotYear / 10) * 10;
        if (slot === 0 && decade !== bedDecade) {
          bedDecade = decade;
          setBed(slotYear, t);
        }
        for (const n of byYear.get(slotYear) ?? []) {
          if (n.slot !== slot || muted.has(n.family)) continue;
          const pan = s.ctx.createStereoPanner();
          pan.pan.value = PAN[n.family];
          const out = s.ctx.createGain();
          out.gain.value = n.loud * (n.kind === "arrives" ? 1 : 0.8);
          out.connect(pan).connect(s.master);
          if (mode === "wardrobe") n.sound.play(s, t, out, 1);
          else playWeighted(s, t, out, n.trend, slotYear, 1);
          lit.push({ time: t, note: n, label: label(n) });
          if (lit.length > 40) lit.shift();
        }
        nextSlot++;
      }
    }

    async function start() {
      try {
        synth ??= new Synth();
      } catch {
        note.textContent = "Your browser won't make sounds here. Try another one, or turn off any audio blocker.";
        return;
      }
      if (synth.ctx.state === "suspended") await synth.ctx.resume();
      if (year >= NOW_YEAR) year = FIRST_YEAR;
      playing = true;
      anchor(year);
      clearInterval(timer);
      timer = window.setInterval(schedule, 25);
      schedule();
      paintControls();
    }

    function stop(finished = false) {
      year = finished ? FIRST_YEAR : Math.floor(currentYear());
      playing = false;
      clearInterval(timer);
      timer = 0;
      if (synth) bed?.stop(synth.ctx.currentTime);
      bed = undefined;
      bedDecade = -1;
      scrub.value = String(year);
      context.setParam("year", year === FIRST_YEAR ? null : String(year));
      paintControls();
    }

    function jump(to: number) {
      year = clamp(Math.round(to), FIRST_YEAR, NOW_YEAR);
      scrub.value = String(year);
      if (playing) {
        if (synth) bed?.stop(synth.ctx.currentTime);
        anchor(year);
      } else {
        lit.length = 0;
        context.setParam("year", year === FIRST_YEAR ? null : String(year));
      }
      s.draw();
    }

    play.addEventListener("click", () => (playing ? stop() : start()));
    scrub.addEventListener("input", () => jump(Number(scrub.value)));
    scrub.addEventListener("change", () => context.setParam("year", scrub.value === String(FIRST_YEAR) ? null : scrub.value));

    /* canvas */
    let rollTop = 0;
    let rollLeft = 0;
    let rollWidth = 1;
    const xOf = (y: number) => rollLeft + ((y - FIRST_YEAR) / SPAN) * rollWidth;

    const s = stage(canvasBox, {
      height: context.compact ? "min(52vh, 420px)" : "min(64vh, 560px)",
      label: "Hear the Century: a piano roll of trends from 1920 to now. Each one lights up and makes its sound as it comes into style.",
      animate: true,
      render({ ctx, width: w, height: h }) {
        const nowYear = currentYear();
        const shown = Math.floor(nowYear);
        if (playing && String(shown) !== scrub.value) scrub.value = String(Math.min(shown, NOW_YEAR));
        const audioNow = synth?.ctx.currentTime ?? 0;
        const small = w < 520;

        ctx.fillStyle = colours.night;
        ctx.fillRect(0, 0, w, h);

        // Year, big, in its colour.
        const colour = nerds.colour(Math.min(shown, NOW_YEAR));
        const size = Math.min(w * (small ? 0.3 : 0.2), h * 0.3);
        ctx.font = FONT.display(size, 900);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = colour;
        ctx.fillText(String(Math.min(shown, NOW_YEAR)), 16, 16 + size * 0.8);
        ctx.lineWidth = 1;
        ctx.strokeStyle = colours.text;
        ctx.globalAlpha = 0.25;
        ctx.strokeText(String(Math.min(shown, NOW_YEAR)), 16, 16 + size * 0.8);
        ctx.globalAlpha = 1;
        ctx.font = FONT.mono(small ? 10 : 11);
        ctx.fillStyle = colours.muted;
        const decade = Math.floor(Math.min(shown, NOW_YEAR) / 10) * 10;
        ctx.fillText(`${decade}S · ${mode === "wardrobe" ? "THE WARDROBE" : `KEY OF ${KEYS[rootFor(decade)]}`} · ${length === 120 ? "2 MIN" : length === 60 ? "1 MIN" : "30 S"} CENTURY`, 18, 16 + size * 0.8 + 22);

        // What's sounding now.
        const listTop = small ? 16 + size * 0.8 + 44 : 22;
        const listX = small ? 18 : w * 0.5;
        const recent = playing ? lit.filter((l) => l.time <= audioNow && audioNow - l.time < 2.2).slice(-(small ? 3 : 5)) : [];
        if (!recent.length && !playing) {
          const quiet = byYear.get(Math.min(shown, NOW_YEAR)) ?? [];
          ctx.font = FONT.body(small ? 13 : 15, 500);
          ctx.fillStyle = colours.muted;
          if (quiet.length) {
            ctx.fillText("Press play to hear:", listX, listTop + 14);
            quiet.slice(0, small ? 3 : 4).forEach((n, i) => {
              ctx.fillStyle = familyColour[n.family];
              ctx.beginPath();
              ctx.arc(listX + 5, listTop + 40 + i * 26 - 5, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = colours.sub;
              ctx.fillText(`${n.trend.name} · ${label(n)}`, listX + 16, listTop + 40 + i * 26);
            });
          } else ctx.fillText("Nothing new this year. Even fashion has a lie in.", listX, listTop + 14);
        }
        recent.reverse().forEach((l, i) => {
          const age = audioNow - l.time;
          const fade = clamp(1 - age / 2.2, 0, 1);
          const pulse = still ? 1 : 1 + 0.25 * Math.max(0, 1 - age * 4);
          const y = listTop + i * (small ? 30 : 38) + 16;
          ctx.globalAlpha = 0.25 + fade * 0.75;
          ctx.fillStyle = familyColour[l.note.family];
          ctx.beginPath();
          ctx.arc(listX + 7, y - 6, 6 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = FONT.display(small ? 17 : 22, 700, true);
          ctx.fillStyle = colours.text;
          ctx.fillText(l.note.trend.name, listX + 22, y);
          const nameWidth = ctx.measureText(l.note.trend.name).width;
          ctx.font = FONT.mono(small ? 10 : 12);
          ctx.fillStyle = colours.pink;
          const tag = `· ${l.label}${l.note.kind === "peaks" ? " · peak" : ""}`;
          if (listX + 22 + nameWidth + 10 + ctx.measureText(tag).width < w - 12) ctx.fillText(tag, listX + 22 + nameWidth + 10, y);
          else ctx.fillText(tag, listX + 22, y + 14);
          ctx.globalAlpha = 1;
        });

        // The piano roll: one lane per family, a dot per note.
        rollTop = h * (small ? 0.6 : 0.56);
        rollLeft = 16;
        rollWidth = w - 32;
        const laneH = (h - rollTop - 30) / FAMILY_ORDER.length;
        FAMILY_ORDER.forEach((f, i) => {
          ctx.fillStyle = colours.raised;
          ctx.globalAlpha = muted.has(f) ? 0.25 : 0.5;
          ctx.fillRect(rollLeft, rollTop + i * laneH + 1, rollWidth, laneH - 2);
          ctx.globalAlpha = 1;
        });
        for (const n of notes) {
          const lane = FAMILY_ORDER.indexOf(n.family);
          const x = xOf(n.year + n.slot / SLOTS);
          const y = rollTop + lane * laneH + laneH * (0.2 + 0.6 * ((hash(n.trend.id) % 97) / 96));
          const played = n.year + n.slot / SLOTS <= nowYear;
          ctx.globalAlpha = muted.has(n.family) ? 0.12 : played ? 0.95 : 0.35;
          ctx.fillStyle = familyColour[n.family];
          ctx.fillRect(x, y - 1.5, Math.max(2, rollWidth / SPAN / SLOTS * 1.6), 3);
        }
        ctx.globalAlpha = 1;
        // Decade ticks.
        ctx.font = FONT.mono(small ? 9 : 10);
        ctx.fillStyle = colours.muted;
        ctx.textAlign = "center";
        for (let y = 1920; y <= NOW_YEAR; y += small ? 20 : 10) ctx.fillText(String(y), clamp(xOf(y), rollLeft + 14, rollLeft + rollWidth - 14), h - 10);
        // Milestones.
        if (context.born) {
          for (const m of nerds.milestones(context.born)) {
            const x = xOf(m.year + 0.5);
            ctx.strokeStyle = colours.sub;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(x, rollTop - 4);
            ctx.lineTo(x, h - 24);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
          ctx.font = FONT.mono(9);
          ctx.fillStyle = colours.sub;
          ctx.fillText("YOU", xOf(context.born + 0.5), rollTop - 8);
        }
        // Playhead.
        const px = xOf(nowYear);
        ctx.strokeStyle = colours.pink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, rollTop - 6);
        ctx.lineTo(px, h - 24);
        ctx.stroke();
        ctx.textAlign = "left";
      },
    });

    s.canvas.addEventListener("pointerdown", (event) => {
      const rect = s.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      jump(FIRST_YEAR + ((x - rollLeft) / rollWidth) * SPAN);
    });

    paintControls();

    return {
      update(params) {
        if (params.mode) mode = params.mode === "weighted" ? "weighted" : "wardrobe";
        const l = LENGTHS.find((n) => String(n) === params.length);
        if (l && l !== length) {
          const now = currentYear();
          length = l;
          if (playing) anchor(now);
        }
        if (params.year && Number(params.year) !== Math.floor(currentYear())) jump(Number(params.year));
        paintControls();
      },
      destroy() {
        clearInterval(timer);
        playing = false;
        synth?.close();
        synth = undefined;
        s.destroy();
        root.remove();
      },
    };
  },
};

export default view;
