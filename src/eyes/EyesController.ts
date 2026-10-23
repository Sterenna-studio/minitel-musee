// Moteur des yeux de Lemegeton sur l'ecran Videotex. Reprend FaceRenderer de
// minitel-face : lecteur de sequences, mode autonome (clignements 1-6 s dont
// 40 % doubles, regard 2,2-5,2 s, reactions 9-16 s) et touches Minitel.
import { createScreen, text, type TerminalFrame } from "../videotex/screen";
import { paintRows, type VideotexColor } from "../videotex/mosaic";
import {
  buildEyes,
  initialEyeState,
  REACTIONS,
  SEQUENCES,
  type EyeState,
  type Mood,
  type SequenceName,
  type SequenceStep,
} from "./libEyes";
import { buildZyraEyes } from "./libZyraEyes";
import {
  EMOTIONS,
  EMOTION_COLORS,
  EMOTION_LABELS,
  LEMEGETON_MAX_SCALE,
  LemegetonEyes,
  lemegetonRows,
} from "./lemegetonEyes";
import { maxScale, scaleRows, sextantBounds, type SextantBox } from "../videotex/scale";

/** Palettes de l'overlay OBS (nitro-clicker COLOR_PRESETS) ramenees aux 8 couleurs Videotex. */
export const EYE_PALETTES = [
  { id: "cyan", label: "Cyan Lemegeton", color: "CYAN" },
  { id: "auto", label: "Auto (humeurs Zyra)", color: "AUTO" },
  { id: "phosphore", label: "Phosphore", color: "VERT" },
  { id: "ambre", label: "Ambre", color: "JAUNE" },
  { id: "rouge", label: "Rouge", color: "ROUGE" },
  { id: "nitro", label: "Nitro", color: "MAGENTA" },
  { id: "blanc", label: "Blanc", color: "BLANC" },
] as const satisfies readonly { id: string; label: string; color: VideotexColor | "AUTO" }[];
export type EyePaletteId = (typeof EYE_PALETTES)[number]["id"];

/**
 * Formes : capsules Zyra Eyes et yeux LibEyes (minitel-face), ovales
 * Lemegeton du firmware Minitel_Sigil (terminal de la mesh Sigil), seuls
 * ou sur une tete ronde.
 */
export const EYE_STYLES = [
  { id: "zyra", label: "Zyra (capsule)" },
  { id: "libeyes", label: "Blocs (LibEyes)" },
  { id: "lemegeton", label: "Lemegeton (yeux)" },
  { id: "lemegeton-visage", label: "Lemegeton (visage)" },
] as const;
export type EyeStyleId = (typeof EYE_STYLES)[number]["id"];
const isLemegeton = (style: EyeStyleId) => style === "lemegeton" || style === "lemegeton-visage";
/** Cadence du firmware (EYE_RENDER_MIN_MS) : une image toutes les 90 ms au plus. */
const LEMEGETON_FRAME_MS = 90;
/** The pointer keeps the gaze this long before the autonomous gaze resumes. */
export const FOLLOW_HOLD_MS = 2500;

/** Rendus : mosaique Videotex (formes minitel-face) ou classique lisse (overlay OBS). */
export const EYE_RENDERS = [
  { id: "mosaique", label: "Mosaique Videotex" },
  { id: "classique", label: "Classique (lisse)" },
] as const;
export type EyeRenderId = (typeof EYE_RENDERS)[number]["id"];
/** Taille maximale du rendu classique : ovales de 62 x 105 px a 150 px du centre. */
const SMOOTH_MAX_SCALE = 1.7;

/** Taille des yeux : facteur applique aux formes de minitel-face (x1 = d'origine). */
export const MIN_EYE_SCALE = 0.6;
/** Les yeux s'arretent avant la ligne d'humeur (ligne 22). */
const LAST_EYE_ROW = 21;
const references = new Map<EyeStyleId, SextantBox>();
/** Cadre des yeux ouverts au repos : reference fixe, pour que la taille ne saute pas selon l'humeur. */
function reference(style: EyeStyleId): SextantBox {
  let box = references.get(style);
  if (!box) {
    box = sextantBounds(style === "zyra" ? buildZyraEyes(initialEyeState, "BLANC") : buildEyes(initialEyeState));
    references.set(style, box);
  }
  return box;
}
/** Plus grande taille qui tient dans l'ecran pour ce style, arrondie au dixieme inferieur. */
export function maxEyeScale(style: EyeStyleId): number {
  if (isLemegeton(style)) return LEMEGETON_MAX_SCALE;
  return Math.floor(maxScale(reference(style), LAST_EYE_ROW) * 10) / 10;
}

const MOOD_LABELS: Record<Mood, string> = {
  default: "NEUTRE",
  happy: "JOIE",
  angry: "COLERE",
  surprised: "SURPRISE",
  tired: "FATIGUE",
  fear: "PEUR",
  disgust: "DEGOUT",
  love: "AMOUR",
  calm: "CALME",
  curious: "CURIEUX",
  focused: "FOCUS",
};

export interface EyesSnapshot {
  frame: TerminalFrame;
  state: EyeState;
  palette: EyePaletteId;
  style: EyeStyleId;
  render: EyeRenderId;
  scale: number;
  maxScale: number;
  /** Humeur affichee, en clair (lecture accessible). */
  moodLabel: string;
}

export interface EyesOptions {
  scale?: number;
  render?: EyeRenderId;
  palette?: EyePaletteId;
  style?: EyeStyleId;
  random?: () => number;
  /** Horloge en ms (tests). */
  now?: () => number;
}

const AUTO = {
  blink: [1000, 6000],
  gaze: [2200, 5200],
  reaction: [9000, 16000],
} as const;

export class EyesController {
  private state: EyeState = { ...initialEyeState };
  private palette: EyePaletteId;
  private style: EyeStyleId;
  private scale = 1;
  private render: EyeRenderId;
  private random: () => number;
  private listeners = new Set<() => void>();
  private snapshot: EyesSnapshot;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private sequenceToken = 0;
  private running = false;
  private autonomous = false;
  /** Yeux du firmware Minitel_Sigil : anime en continu, a son propre rythme. */
  private lemegeton: LemegetonEyes;
  private ticker: ReturnType<typeof setInterval> | undefined;
  private now: () => number;
  /** Until then, the gaze belongs to the pointer (follow). */
  private followUntil = 0;

  constructor(options: EyesOptions = {}) {
    this.palette = options.palette ?? "cyan";
    this.style = options.style ?? "zyra";
    this.render = options.render ?? "mosaique";
    this.scale = this.clampScale(options.scale ?? 1);
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => performance.now());
    this.lemegeton = new LemegetonEyes(this.random, this.now());
    this.snapshot = this.build();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): EyesSnapshot => this.snapshot;

  private build(): EyesSnapshot {
    const color = EYE_PALETTES.find((p) => p.id === this.palette)?.color ?? "CYAN";
    const frame = createScreen("YEUX DE LEMEGETON", "LEMEGETON");
    if (isLemegeton(this.style)) return this.buildLemegeton(frame, color);
    const rows =
      this.style === "zyra"
        ? buildZyraEyes(this.state, color)
        : buildEyes(this.state, color === "AUTO" ? "BLANC" : color);
    paintRows(
      frame,
      this.scale === 1 ? rows : scaleRows(rows, this.scale, reference(this.style), LAST_EYE_ROW),
    );
    const mood = this.state.moodOverride ?? this.state.mood;
    const label = `HUMEUR : ${MOOD_LABELS[mood]}`;
    text(frame, Math.floor((40 - label.length) / 2), 22, label, 4);
    return {
      frame,
      state: { ...this.state },
      palette: this.palette,
      style: this.style,
      render: this.render,
      scale: this.scale,
      maxScale: this.maxScale(),
      moodLabel: MOOD_LABELS[mood],
    };
  }
  private buildLemegeton(frame: TerminalFrame, color: VideotexColor | "AUTO"): EyesSnapshot {
    const emotion = this.lemegeton.currentEmotion;
    // Auto : la couleur portee par l'emotion, comme sur le Minitel physique.
    const eyeColor = color === "AUTO" ? (emotion ? EMOTION_COLORS[emotion] : "BLANC") : color;
    paintRows(frame, lemegetonRows(this.lemegeton.cells(this.style === "lemegeton-visage", this.scale), eyeColor));
    const label = emotion ? EMOTION_LABELS[emotion] : this.lemegeton.isSleepy ? "SOMMEIL" : "NEUTRE";
    const line = `HUMEUR : ${label}`;
    text(frame, Math.floor((40 - line.length) / 2), 22, line, 4);
    return {
      frame,
      state: { ...this.state },
      palette: this.palette,
      style: this.style,
      render: this.render,
      scale: this.scale,
      maxScale: this.maxScale(),
      moodLabel: label,
    };
  }
  /** Fait avancer les yeux Lemegeton tant qu'ils sont affiches ou animes. */
  private pump() {
    if (this.ticker || !isLemegeton(this.style)) return;
    this.ticker = setInterval(() => {
      this.lemegeton.update(this.now(), this.autonomous, this.style === "lemegeton-visage");
      this.emit();
      if (!this.autonomous && !this.lemegeton.busy) this.halt();
    }, LEMEGETON_FRAME_MS);
  }
  private halt() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = undefined;
  }
  /** Touches du firmware Minitel_Sigil : 0-9 emotions, Envoi joie, Suite clin d'oeil. */
  private lemegetonKey(name: string): boolean {
    const now = this.now();
    const digit = /^[0-9]$/.test(name) ? Number(name) : -1;
    if (digit >= 0) this.lemegeton.play(EMOTIONS[digit], now);
    else if (name === "Envoi") this.lemegeton.play("joy", now);
    else if (name === "Guide") this.lemegeton.play("surprise", now);
    else if (name === "Annulation") this.lemegeton.play("anger", now);
    else if (name === "Correction") this.lemegeton.play("sleepy", now);
    else if (name === "Suite") this.lemegeton.blink(false, now);
    else if (name === "Repetition") this.lemegeton.setGaze(this.random() * 2 - 1, this.random() * 1.2 - 0.6);
    else if (name === "Sommaire") this.lemegeton.setSleepy(true, now);
    else if (name === "Retour") {
      this.lemegeton.setSleepy(false, now);
      this.lemegeton.neutral(now);
    } else return false;
    this.pump();
    this.emit();
    return true;
  }

  private emit() {
    this.snapshot = this.build();
    this.listeners.forEach((listener) => listener());
  }
  private update(patch: Partial<EyeState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  setPalette(palette: EyePaletteId) {
    this.palette = palette;
    this.emit();
  }
  setStyle(style: EyeStyleId) {
    this.style = style;
    this.scale = this.clampScale(this.scale);
    if (!isLemegeton(style)) this.halt();
    else if (this.autonomous) this.pump();
    this.emit();
  }
  private maxScale() {
    return this.render === "classique" ? SMOOTH_MAX_SCALE : maxEyeScale(this.style);
  }
  private clampScale(scale: number) {
    if (!Number.isFinite(scale)) return 1;
    return Math.round(Math.max(MIN_EYE_SCALE, Math.min(this.maxScale(), scale)) * 10) / 10;
  }
  setRender(render: EyeRenderId) {
    this.render = render;
    this.scale = this.clampScale(this.scale);
    this.emit();
  }
  /** Taille globale des yeux, bornee pour rester dans l'ecran. */
  setScale(scale: number) {
    this.scale = this.clampScale(scale);
    this.emit();
  }
  setMood(mood: Mood) {
    this.update({ mood, moodOverride: null, eyeState: null, eyeOpen: true });
  }
  setGaze(x: number, y: number) {
    const clamp = (v: number) => Math.max(-1, Math.min(1, Math.round(v)));
    this.update({ gazeX: clamp(x), gazeY: clamp(y) });
  }

  /**
   * Leger suivi du pointeur : x, y de -1 a 1 sur la fenetre (y vers le bas).
   * Les yeux en mosaique ne tournent qu'au-dela d'un seuil (regard sur trois
   * positions) ; les yeux Lemegeton suivent en douceur, a 60 % de leur course.
   * Une sequence en cours garde la main.
   */
  follow(x: number, y: number) {
    const now = this.now();
    this.followUntil = now + FOLLOW_HOLD_MS;
    if (isLemegeton(this.style)) {
      this.lemegeton.lookAt(x * 0.6, y * 0.45, now, FOLLOW_HOLD_MS);
      return;
    }
    if (this.running) return;
    const step = (v: number, edge: number) => (Math.abs(v) < edge ? 0 : Math.sign(v));
    const gazeX = step(x, 0.35);
    const gazeY = step(y, 0.55);
    if (gazeX !== this.state.gazeX || gazeY !== this.state.gazeY) this.setGaze(gazeX, gazeY);
  }

  /** Joue une sequence ; une nouvelle sequence interrompt la precedente. */
  async play(name: SequenceName): Promise<void> {
    const token = ++this.sequenceToken;
    this.running = true;
    const steps: SequenceStep[] = SEQUENCES[name];
    for (const step of steps) {
      if (token !== this.sequenceToken) return;
      const patch: Partial<EyeState> = {};
      if (step.eyeState !== undefined) patch.eyeState = step.eyeState;
      if (step.moodOverride !== undefined) patch.moodOverride = step.moodOverride;
      if (step.gazeX !== undefined) patch.gazeX = step.gazeX;
      if (step.gazeY !== undefined) patch.gazeY = step.gazeY;
      this.update(patch);
      if (step.delayMs) await this.wait(step.delayMs);
    }
    if (token === this.sequenceToken) this.running = false;
  }

  /**
   * Touches Minitel, comme sur le Minitel physique (minitel-face, README) :
   * Envoi joie, Retour neutre ou reveil, Repetition regard circulaire,
   * Guide surprise, Annulation colere, Sommaire endormissement,
   * Correction fatigue, Suite clin d'oeil.
   */
  key(key: string): boolean {
    const name =
      { Enter: "Envoi", Escape: "Sommaire", Backspace: "Correction", Delete: "Annulation" }[key] ?? key;
    if (isLemegeton(this.style)) return this.lemegetonKey(name);
    switch (name) {
      case "Envoi":
        this.setMood("happy");
        return true;
      case "Retour":
        if (this.state.eyeState === "closed") void this.play("wake_up");
        else this.setMood("default");
        return true;
      case "Repetition":
        void this.play("look_around");
        return true;
      case "Guide":
        void this.play("surprised");
        return true;
      case "Annulation":
        this.setMood("angry");
        return true;
      case "Sommaire":
        void this.play("fall_asleep");
        return true;
      case "Correction":
        this.setMood("tired");
        return true;
      case "Suite":
        void this.play("wink");
        return true;
    }
    return false;
  }

  /** Mode autonome : clignements, regard et reactions spontanes. */
  start() {
    if (this.autonomous) return;
    this.autonomous = true;
    this.pump();
    this.scheduleBlink();
    this.scheduleGaze();
    this.scheduleReaction();
  }
  stop() {
    this.autonomous = false;
    this.sequenceToken++;
    this.running = false;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    if (!this.lemegeton.busy) this.halt();
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => this.later(resolve, ms));
  }
  private later(callback: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, ms);
    this.timers.add(timer);
  }
  private delay([min, max]: readonly [number, number]) {
    return Math.round(min + this.random() * (max - min));
  }
  private scheduleBlink() {
    this.later(() => {
      if (!this.autonomous) return;
      // Web-Eye-Animation : environ 60 % de clignements simples, 40 % doubles.
      if (!this.running) void this.play(this.random() >= 0.6 ? "double_blink" : "blink");
      this.scheduleBlink();
    }, this.delay(AUTO.blink));
  }
  private scheduleGaze() {
    this.later(() => {
      if (!this.autonomous) return;
      if (!this.running && this.now() >= this.followUntil) {
        const x = [-1, 0, 0, 1][Math.floor(this.random() * 4)];
        const y = [-1, 0, 0, 0, 1][Math.floor(this.random() * 5)];
        this.setGaze(x, y);
      }
      this.scheduleGaze();
    }, this.delay(AUTO.gaze));
  }
  private scheduleReaction() {
    this.later(() => {
      if (!this.autonomous) return;
      if (!this.running) void this.play(REACTIONS[Math.floor(this.random() * REACTIONS.length)]);
      this.scheduleReaction();
    }, this.delay(AUTO.reaction));
  }
}
