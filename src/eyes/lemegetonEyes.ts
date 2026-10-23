import type { RowPatch, VideotexColor } from "../videotex/mosaic";

// Lemegeton's eyes as drawn by the Minitel_Sigil firmware (LemegetonEyes.h,
// the Minitel terminal of the Sigil mesh) : a port of web-eye-animation (MIT,
// CyberAgentAILab), the eye library of nitro-clicker/lemegeton.html. Two oval
// eyes, ten emotions played as short timelines, autonomous blinks and a
// wandering gaze, rasterised in G1 mosaic : 40 x 19 cells (rows 2 to 20), one
// cell = 2 x 3 pseudo-pixels, an 80 x 57 canvas. Timings and geometry are the
// firmware's, tuned in front of a real Minitel : the 3D one shows the same face.
// "visage" puts the eyes on a round head that drifts a little (style VISAGE).

export type EyeShape = "oval" | "rect" | "bowl";

interface Key {
  ms: number;
  sx: number;
  sy: number;
  /** Rotation in degrees, clockwise as in CSS. */
  rotL: number;
  rotR: number;
  /** Offset in pseudo-pixels. */
  dx: number;
  dy: number;
  shape: EyeShape;
}
type Pose = Omit<Key, "ms">;
const k = (ms: number, sx: number, sy: number, rotL: number, rotR: number, dx: number, dy: number, shape: EyeShape = "oval"): Key => ({
  ms, sx, sy, rotL, rotR, dx, dy, shape,
});
const REST: Pose = { sx: 1, sy: 1, rotL: 0, rotR: 0, dx: 0, dy: 0, shape: "oval" };

export const EMOTIONS = ["joy", "sadness", "surprise", "anger", "fear", "disgust", "confusion", "love", "sleepy", "excitement"] as const;
export type Emotion = (typeof EMOTIONS)[number];
export const EMOTION_LABELS: Record<Emotion, string> = {
  joy: "JOIE",
  sadness: "TRISTESSE",
  surprise: "SURPRISE",
  anger: "COLERE",
  fear: "PEUR",
  disgust: "DEGOUT",
  confusion: "CONFUSION",
  love: "AMOUR",
  sleepy: "SOMMEIL",
  excitement: "EXCITATION",
};
/** Colour carried by the emotion : on a slow display it reads before the shape. */
export const EMOTION_COLORS: Record<Emotion, VideotexColor> = {
  joy: "JAUNE",
  sadness: "BLEU",
  surprise: "BLANC",
  anger: "ROUGE",
  fear: "MAGENTA",
  disgust: "VERT",
  confusion: "CYAN",
  love: "MAGENTA",
  sleepy: "BLEU",
  excitement: "JAUNE",
};

// Timelines, in the order of web-eye-animation.js.
const TIMELINES: Record<Emotion, Key[]> = {
  joy: [k(200, 1, 0.12, 45, 45, 0, 0, "rect"), k(100, 1, 0.12, 45, 45, 0, -3, "rect"), k(100, 1, 0.12, 45, 45, 0, 0, "rect"), k(100, 1, 0.12, 45, 45, 0, -3, "rect"), k(100, 1, 0.12, 45, 45, 0, 0, "rect"), k(200, 1, 1, 0, 0, 0, 0)],
  sadness: [k(500, 1, 0.1, 0, 0, 0, 0), k(500, 1, 0.1, 0, 0, 0, 3), k(500, 1.5, 0.1, 0, 0, 0, 3), k(500, 1, 1, 0, 0, 0, 3), k(500, 1, 1, 0, 0, 0, 0)],
  surprise: [k(200, 1.5, 1.5, 0, 0, 0, 0), k(500, 1.5, 1.5, 0, 0, 0, 0), k(300, 1, 1, 0, 0, 0, 0)],
  anger: [k(200, 1, 0.5, -10, -10, 0, 0), k(100, 1, 0.5, -10, -10, 3, 0), k(100, 1, 0.5, -10, -10, 0, 0), k(100, 1, 0.5, -10, -10, 3, 0), k(100, 1, 0.5, -10, -10, 0, 0), k(200, 1, 1, 0, 0, 0, 0)],
  fear: [k(200, 1, 1.5, 0, 0, 0, 0), k(200, 1, 1.5, 0, 0, 0, -3), k(100, 0.8, 1.5, 0, 0, 0, -3), k(100, 1, 1.5, 0, 0, 0, -3), k(100, 0.8, 1.5, 0, 0, 0, -3), k(100, 1, 1.5, 0, 0, 0, -3), k(100, 0.8, 1.5, 0, 0, 0, -3), k(100, 1, 1.5, 0, 0, 0, -3), k(200, 1, 1, 0, 0, 0, -3), k(200, 1, 1, 0, 0, 0, 0)],
  disgust: [k(300, 1, 0.3, -5, -5, 0, 0), k(300, 1, 0.3, -5, -5, 0, 3), k(500, 1, 0.3, -5, -5, 0, 3), k(300, 1, 1, 0, 0, 0, 3), k(300, 1, 1, 0, 0, 0, 0)],
  confusion: [k(200, 1, 1, -20, 20, 0, 0), k(100, 1, 1, -20, 20, 0, 3), k(100, 1, 1, -20, 20, 0, 0), k(100, 1, 1, -20, 20, 0, 3), k(100, 1, 1, -20, 20, 0, 0), k(200, 1, 1, 0, 0, 0, 0)],
  love: [k(200, 1, 0.5, 0, 0, 0, 0, "bowl"), k(200, 1.2, 0.4, 0, 0, 0, 0, "bowl"), k(500, 1.2, 0.4, 0, 0, 0, 0, "bowl"), k(200, 1, 1, 0, 0, 0, 0)],
  sleepy: [k(500, 1, 0.3, 0, 0, 0, 0), k(500, 1, 0.3, 0, 0, 0, 3), k(500, 1, 0.3, 0, 0, 0, 3), k(200, 1, 0.1, 0, 0, 0, 3), k(200, 1, 0.3, 0, 0, 0, 3), k(500, 1, 1, 0, 0, 0, 3), k(500, 1, 1, 0, 0, 0, 0)],
  excitement: [k(200, 1.2, 1.2, 0, 0, 0, 0), k(100, 1.2, 1.2, 0, 0, 0, -3), k(100, 1.2, 1.2, 0, 0, 0, 0), k(100, 1.2, 1.2, 0, 0, 0, -3), k(100, 1.2, 1.2, 0, 0, 0, 0), k(100, 1.2, 1.2, 0, 0, 0, -3), k(100, 1.2, 1.2, 0, 0, 0, 0), k(500, 1.2, 1.2, 360, 360, 0, 0), k(200, 1, 1, 360, 360, 0, 0), k(0, 1, 1, 0, 0, 0, 0)],
};
const BLINK_SINGLE = [k(100, 1, 0.1, 0, 0, 0, 0), k(100, 1, 1, 0, 0, 0, 0)];
const BLINK_DOUBLE = [k(100, 1, 0.1, 0, 0, 0, 0), k(100, 1, 1, 0, 0, 0, 0), k(100, 1, 1, 0, 0, 0, 0), k(100, 1, 0.1, 0, 0, 0, 0), k(100, 1, 1, 0, 0, 0, 0)];

export const EYE_ROW0 = 2;
export const EYE_ROWS = 19;
const COLS = 40;
const EYE_CY = 28.5;
/** A pseudo-pixel is wider than high. */
const PIXEL_ASPECT = 1.2;
const GAZE_X_PX = 9;
const GAZE_Y_PX = 7;
const EYE_RX = 6;
const EYE_RY = 11;
const EYE_GAP = 28;
const GAZE_TWEEN_MS = 700;
/** The firmware stretches the gsap timelines and holds the pose, to be read on a Minitel. */
const TIME_SCALE = 2.5;
const HOLD_MS = 1200;
const HEAD_RX = 27;
const HEAD_RY = 25;
const HEAD_THICKNESS = 0.14;
/** Marge entre un oeil et l'anneau de la tete, en fraction du rayon (un demi pseudo-pixel). */
const HEAD_MARGIN = 0.02;
const HEAD_DRIFT_PX = 7;
/** Largest size factor that keeps the eyes (surprise, gaze) inside the canvas. */
export const LEMEGETON_MAX_SCALE = 1.2;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class LemegetonEyes {
  private pose: Pose = { ...REST };
  private hold: Pose = { ...REST };
  private from: Pose = { ...REST };
  private keys: Key[] | null = null;
  private index = 0;
  private segmentStart = 0;
  private returnAt = 0;
  private emotion: Emotion | null = null;
  private gaze = { x: 0, y: 0, tx: 0, ty: 0 };
  private head = { x: 0, y: 0, tx: 0, ty: 0 };
  private nextBlinkAt: number;
  private nextGazeAt: number;
  private nextHeadAt: number;
  private lastUpdate: number;
  private sleepy = false;
  /** The running timeline is the return to the rest pose. */
  private returning = false;

  constructor(private random: () => number = Math.random, now = 0) {
    this.nextBlinkAt = now + this.between(1000, 6001);
    this.nextGazeAt = now + this.between(2500, 6000);
    this.nextHeadAt = now + this.between(5000, 11000);
    this.lastUpdate = now;
  }

  /** Arduino random(a, b) : integer in [a, b). */
  private between(a: number, b: number) {
    return a + Math.floor(this.random() * (b - a));
  }

  get currentEmotion(): Emotion | null {
    return this.emotion;
  }
  /** An animation or a held pose is in progress. */
  get busy(): boolean {
    return this.keys !== null || this.returnAt !== 0;
  }

  private start(keys: Key[], now: number, returning = false) {
    this.keys = keys;
    this.returning = returning;
    this.index = 0;
    this.from = { ...this.pose };
    this.segmentStart = now;
  }
  /** The last request wins (unlike the web lib) : responsiveness first. */
  play(emotion: Emotion, now: number) {
    this.emotion = emotion;
    this.returnAt = 0;
    this.start(TIMELINES[emotion], now);
  }
  neutral(now: number) {
    this.emotion = null;
    this.returnToHold(now);
  }
  blink(twice: boolean, now: number) {
    this.start(twice ? BLINK_DOUBLE : BLINK_SINGLE, now);
  }
  setGaze(x: number, y: number) {
    this.gaze.tx = clamp(x, -1, 1);
    this.gaze.ty = clamp(y, -1, 1);
  }
  /** Looks at a point (the visitor's pointer) and keeps it for holdMs before wandering again. */
  lookAt(x: number, y: number, now: number, holdMs: number) {
    this.setGaze(x, y);
    this.nextGazeAt = Math.max(this.nextGazeAt, now + holdMs);
  }
  /** Half-closed rest pose (the mesh sleeps, or the Sommaire key). */
  setSleepy(sleepy: boolean, now: number) {
    if (sleepy === this.sleepy) return;
    this.sleepy = sleepy;
    this.hold = sleepy ? { ...REST, sy: 0.3, dy: 3 } : { ...REST };
    if (!this.keys) this.returnToHold(now);
  }
  get isSleepy() {
    return this.sleepy;
  }
  private returnToHold(now: number) {
    this.returnAt = 0;
    this.start([{ ms: 400, ...this.hold }], now, true);
  }

  /** Advance to `now` (ms). `autonomous` : blinks and wandering gaze. */
  update(now: number, autonomous: boolean, face: boolean) {
    if (this.keys) {
      const key = this.keys[this.index];
      const duration = key.ms * TIME_SCALE;
      const t = duration === 0 ? 1 : Math.min(1, (now - this.segmentStart) / duration);
      const e = easeOut(t);
      this.pose = {
        sx: lerp(this.from.sx, key.sx, e),
        sy: lerp(this.from.sy, key.sy, e),
        rotL: lerp(this.from.rotL, key.rotL, e),
        rotR: lerp(this.from.rotR, key.rotR, e),
        dx: lerp(this.from.dx, key.dx, e),
        dy: lerp(this.from.dy, key.dy, e),
        shape: key.shape,
      };
      if (t >= 1) {
        const { ms: _ms, ...pose } = key;
        void _ms;
        this.pose = pose;
        this.from = { ...pose };
        this.segmentStart = now;
        if (++this.index >= this.keys.length) {
          const wasReturn = this.returning;
          this.keys = null;
          this.returning = false;
          // Hold the pose : without this pause the expression vanishes unread.
          if (wasReturn) this.nextBlinkAt = now + this.between(1000, 6001);
          else if (this.emotion) this.returnAt = now + HOLD_MS;
        }
      }
    } else if (this.returnAt !== 0 && now >= this.returnAt) {
      this.emotion = null;
      this.returnToHold(now);
    } else if (this.returnAt === 0 && autonomous && now >= this.nextBlinkAt) {
      // Asleep, it still blinks, more rarely : a frozen screen says "broken".
      this.blink(!this.sleepy && this.between(0, 10) >= 6, now);
      this.nextBlinkAt = now + (this.sleepy ? this.between(6000, 13000) : this.between(1000, 6001));
    }
    // Wandering gaze : short moves from where it is, never edge to edge.
    if (autonomous && now >= this.nextGazeAt) {
      const amplitude = this.sleepy ? 0.45 : 1;
      let x = 0;
      let y = 0;
      if (this.between(0, 4) !== 0) {
        x = clamp(this.gaze.tx + this.between(-55, 56) / 100, -amplitude, amplitude);
        y = clamp(this.gaze.ty + this.between(-40, 41) / 100, -amplitude * 0.75, amplitude * 0.75);
      }
      this.setGaze(x, y);
      this.nextGazeAt = now + (this.sleepy ? this.between(5000, 10000) : this.between(2500, 6000));
    }
    // The head drifts, slower and rarer than the gaze.
    if (face && autonomous && now >= this.nextHeadAt) {
      this.head.tx = (this.between(-100, 101) / 100) * HEAD_DRIFT_PX;
      this.head.ty = (this.between(-100, 101) / 100) * HEAD_DRIFT_PX * 0.6;
      this.nextHeadAt = now + this.between(5000, 11000);
    }
    if (!face) this.head.tx = this.head.ty = 0;
    const dt = Math.min(200, now - this.lastUpdate);
    if (Math.abs(this.head.x - this.head.tx) > 0.15 || Math.abs(this.head.y - this.head.ty) > 0.15) {
      const a = Math.min(1, dt / 1600);
      this.head.x += (this.head.tx - this.head.x) * a;
      this.head.y += (this.head.ty - this.head.y) * a;
    }
    this.lastUpdate = now;
    if (Math.abs(this.gaze.x - this.gaze.tx) > 0.02 || Math.abs(this.gaze.y - this.gaze.ty) > 0.02) {
      const a = Math.min(1, dt / Math.max(120, GAZE_TWEEN_MS));
      this.gaze.x += (this.gaze.tx - this.gaze.x) * a;
      this.gaze.y += (this.gaze.ty - this.gaze.y) * a;
      if (Math.abs(this.gaze.x - this.gaze.tx) <= 0.02) this.gaze.x = this.gaze.tx;
      if (Math.abs(this.gaze.y - this.gaze.ty) <= 0.02) this.gaze.y = this.gaze.ty;
    }
  }

  /**
   * Sextant masks, one per cell (EYE_ROWS x 40), in the mosaic order of the
   * renderer : 1 top-left, 2 top-right, 4 middle-left, 8 middle-right,
   * 16 bottom-left, 32 bottom-right. The head ring passes in front.
   */
  cells(face: boolean, scale = 1): { eyes: number[][]; ring: number[][] } {
    // As in the firmware ; `scale` (size slider) only changes the eyes' radii.
    const styleScale = face ? 0.62 : 1;
    const gap = face ? EYE_GAP * 0.72 : EYE_GAP;
    const reachX = face ? 1.35 : 1;
    const reachY = face ? 1.2 : 1;
    // Decalage des yeux par rapport au centre de la tete (regard + pose) ; la derive de la tete
    // (head.x, head.y) deplace la tete ET les yeux ensemble.
    let ox = this.pose.dx + (this.gaze.x * GAZE_X_PX * reachX * styleScale) / 0.62;
    let oy = this.pose.dy + (this.gaze.y * GAZE_Y_PX * reachY * styleScale) / 0.62;
    const shape = this.pose.shape;
    const eye = (cx: number, cy: number, rotation: number) => {
      const a = (rotation * Math.PI) / 180;
      const rx = Math.max(0.7, EYE_RX * PIXEL_ASPECT * this.pose.sx * styleScale * scale);
      const ry = Math.max(0.7, EYE_RY * this.pose.sy * styleScale * scale);
      return { cx, cy, c: Math.cos(a), s: Math.sin(a), rx, ry, bbox: Math.max(rx, ry) + 1.5 };
    };
    const pair = (dx: number, dy: number) => {
      const cy = EYE_CY + this.head.y + dy;
      return [
        eye(40 + this.head.x - gap / 2 + dx, cy, this.pose.rotL),
        eye(40 + this.head.x + gap / 2 + dx, cy, this.pose.rotR),
      ];
    };
    // Rayon normalise d'un point par rapport a l'ovale de la tete : 1 = bord exterieur de l'anneau.
    const headRadius = (px: number, py: number) =>
      Math.hypot((px - (40 + this.head.x)) / HEAD_RX, (py - (EYE_CY + this.head.y)) / HEAD_RY);
    const inner = 1 - HEAD_THICKNESS - HEAD_MARGIN;
    /** Vrai si le contour de l'oeil (ovale, ou coins du rectangle et du bol) est dans la tete. */
    const insideHead = (g: ReturnType<typeof eye>) => {
      const points: [number, number][] =
        shape === "oval"
          ? Array.from({ length: 32 }, (_, i) => [g.rx * Math.cos((i / 32) * 2 * Math.PI), g.ry * Math.sin((i / 32) * 2 * Math.PI)])
          : [[-g.rx, -g.ry], [g.rx, -g.ry], [-g.rx, g.ry], [g.rx, g.ry]];
      return points.every(([u, v]) => {
        const dx = u * g.c - v * g.s;
        const dy = u * g.s + v * g.c;
        return headRadius(g.cx + dx / PIXEL_ASPECT, g.cy + dy) <= inner;
      });
    };
    if (face) {
      // Le regard et la pose ne doivent jamais faire sortir un oeil du cadre : on reduit le
      // decalage (recherche par dichotomie) jusqu'a ce que les deux yeux tiennent dans la tete.
      const fits = (t: number) => pair(ox * t, oy * t).every(insideHead);
      if (!fits(1)) {
        let lo = 0;
        let hi = 1;
        for (let i = 0; i < 14; i++) {
          const mid = (lo + hi) / 2;
          if (fits(mid)) lo = mid;
          else hi = mid;
        }
        ox *= lo;
        oy *= lo;
      }
    }
    const [left, right] = pair(ox, oy);
    const contains = (g: ReturnType<typeof eye>, px: number, py: number) => {
      const dx = (px - g.cx) * PIXEL_ASPECT;
      const dy = py - g.cy;
      if (Math.abs(dx) > g.bbox || Math.abs(dy) > g.bbox) return false;
      const u = dx * g.c + dy * g.s;
      const v = -dx * g.s + dy * g.c;
      const nu = u / g.rx;
      const nv = v / g.ry;
      if (shape === "rect") return Math.abs(nu) <= 1 && Math.abs(nv) <= 1;
      if (shape === "bowl") return v < 0 ? Math.abs(nu) <= 1 && nv >= -1 : nu * nu + nv * nv <= 1;
      return nu * nu + nv * nv <= 1;
    };
    const ring = (px: number, py: number) => {
      const nu = ((px - (40 + this.head.x)) * PIXEL_ASPECT) / (HEAD_RX * PIXEL_ASPECT);
      const nv = (py - (EYE_CY + this.head.y)) / HEAD_RY;
      const r = Math.sqrt(nu * nu + nv * nv);
      return r <= 1 && r >= 1 - HEAD_THICKNESS;
    };
    const eyes: number[][] = [];
    const rings: number[][] = [];
    for (let row = 0; row < EYE_ROWS; row++) {
      eyes.push(new Array(COLS).fill(0));
      rings.push(new Array(COLS).fill(0));
      for (let col = 0; col < COLS; col++) {
        for (let sub = 0; sub < 6; sub++) {
          const px = col * 2 + (sub % 2) + 0.5;
          const py = row * 3 + Math.floor(sub / 2) + 0.5;
          const bit = 1 << sub;
          if (face && ring(px, py)) rings[row][col] |= bit;
          // Filet de securite : meme si un oeil est trop grand pour la tete, il est coupe
          // a l'anneau et ne le recouvre jamais.
          else if ((contains(left, px, py) || contains(right, px, py)) && (!face || headRadius(px, py) <= inner)) {
            eyes[row][col] |= bit;
          }
        }
      }
    }
    return { eyes, ring: rings };
  }
}

/** Mosaic bits (renderer order) to a G1 byte : bit 5 (bottom-right) is 0x40, 0x20 always set. */
export function mosaicToG1(bits: number): number {
  return 0x20 | (bits & 0x1f) | ((bits & 0x20) << 1);
}

/** Rows for paintRows : eyes in their colour, the head ring in its own. */
export function lemegetonRows(cells: { eyes: number[][]; ring: number[][] }, eyeColor: VideotexColor, ringColor: VideotexColor = "BLEU"): RowPatch[] {
  const rows: RowPatch[] = [];
  cells.eyes.forEach((line, i) => {
    for (const [layer, color] of [
      [cells.ring[i], ringColor],
      [line, eyeColor],
    ] as const) {
      // One patch per run of lit cells (a colour holds until the next attribute).
      let start = -1;
      for (let col = 0; col <= COLS; col++) {
        const lit = col < COLS && layer[col] !== 0;
        if (lit && start < 0) start = col;
        if (!lit && start >= 0) {
          rows.push([EYE_ROW0 + i, start + 1, color, layer.slice(start, col).map(mosaicToG1)]);
          start = -1;
        }
      }
    }
  });
  return rows;
}
