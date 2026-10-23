// Portage TypeScript des yeux de minitel-face/src/libs/LibZyra.js, utilises
// seuls par LibZyraEyes (Sterenna) : capsule continue de 7 x 3 cellules aux
// coins arrondis (demi-blocs), pupille creusee, couleurs selon l'humeur.
// Les humeurs propres a LibEyes (peur, degout) sont rapprochees des formes Zyra ;
// celles propres a Zyra (calme, curieux, concentre) sont reprises de LibZyra.
import type { RowPatch, VideotexColor } from "../videotex/mosaic";
import type { EyeState } from "./libEyes";

const FULL = 0x7f;
const EMPTY = 0x20;
const TOP = 0x70;
const BOTTOM = 0x2f;
// Coins arrondis de la capsule. En G1, 0x70 remplit le TIERS BAS de la cellule
// et 0x2F les DEUX TIERS HAUTS : LibZyra place [TOP ... BOTTOM] sur une meme
// rangee, ce qui arrondit le bout gauche et cisaille le bout droit. Ici les deux
// bouts d'une rangee recoivent le meme coin, symetrique entre haut et bas.
const ROUND_TOP = 0x70; // rangee du haut : seul le tiers bas est allume
const ROUND_BOTTOM = 0x23; // rangee du bas : seul le tiers haut est allume
const LEFT = 10;
const RIGHT = 24;
const repeat = (byte: number, count: number) => Array(count).fill(byte);

function pupilRow(gazeX: number) {
  const bytes = repeat(FULL, 7);
  bytes[3 + Math.max(-1, Math.min(1, gazeX || 0))] = EMPTY;
  return bytes;
}
const both = (rows: [number, VideotexColor, number[]][]): RowPatch[] => [
  ...rows.map(([row, color, bytes]): RowPatch => [row, LEFT, color, [...bytes]]),
  ...rows.map(([row, color, bytes]): RowPatch => [row, RIGHT, color, [...bytes]]),
];

const openEyes = (gazeX: number, c: VideotexColor) =>
  both([
    [9, c, [ROUND_TOP, FULL, FULL, FULL, FULL, FULL, ROUND_TOP]],
    [10, c, pupilRow(gazeX)],
    [11, c, [ROUND_BOTTOM, FULL, FULL, FULL, FULL, FULL, ROUND_BOTTOM]],
  ]);
const closedEyes = (c: VideotexColor) =>
  both([
    [9, c, repeat(EMPTY, 7)],
    [10, c, repeat(TOP, 7)],
    [11, c, repeat(EMPTY, 7)],
  ]);
const halfEyes = (gazeX: number, c: VideotexColor) =>
  both([
    [9, c, repeat(EMPTY, 7)],
    [10, c, pupilRow(gazeX)],
    [11, c, repeat(BOTTOM, 7)],
  ]);
const happyEyes = (c: VideotexColor) =>
  both([
    [9, c, repeat(EMPTY, 7)],
    [10, c, [ROUND_TOP, FULL, FULL, FULL, FULL, FULL, ROUND_TOP]],
    [11, c, repeat(FULL, 7)],
  ]);
function angryEyes(gazeX: number, c: VideotexColor): RowPatch[] {
  return [
    [9, LEFT, c, [EMPTY, EMPTY, TOP, FULL, FULL, FULL, FULL]],
    [10, LEFT, c, pupilRow(gazeX)],
    [11, LEFT, c, repeat(BOTTOM, 7)],
    [9, RIGHT, c, [FULL, FULL, FULL, FULL, TOP, EMPTY, EMPTY]],
    [10, RIGHT, c, pupilRow(gazeX)],
    [11, RIGHT, c, repeat(BOTTOM, 7)],
  ];
}
const surprisedEyes = (c: VideotexColor) =>
  both([
    [9, c, repeat(FULL, 7)],
    [10, c, [FULL, FULL, EMPTY, EMPTY, EMPTY, FULL, FULL]],
    [11, c, repeat(FULL, 7)],
  ]);
const loveEyes = (c: VideotexColor) =>
  both([
    [9, c, [FULL, FULL, EMPTY, FULL, FULL, EMPTY, FULL]],
    [10, c, repeat(FULL, 7)],
    [11, c, [EMPTY, FULL, FULL, FULL, FULL, FULL, EMPTY]],
  ]);
function winkEyes(gazeX: number, side: "left" | "right", open: VideotexColor, shut: VideotexColor) {
  const opened = openEyes(gazeX, open);
  const closed = closedEyes(shut);
  return side === "right"
    ? [...opened.slice(0, 3), ...closed.slice(3)]
    : [...closed.slice(0, 3), ...opened.slice(3)];
}

/**
 * Yeux Zyra. `color` fixe la couleur de toutes les formes ; "AUTO" reprend les
 * couleurs d'humeur de LibZyra (joie jaune, colere rouge, amour magenta...).
 */
export function buildZyraEyes(state: EyeState, color: VideotexColor | "AUTO"): RowPatch[] {
  const pick = (auto: VideotexColor) => (color === "AUTO" ? auto : color);
  const { gazeX } = state;
  if (!state.eyeOpen || state.eyeState === "closed") return closedEyes(pick("CYAN"));
  if (state.eyeState === "half") return halfEyes(gazeX, pick("CYAN"));
  if (state.eyeState === "wink_left") return winkEyes(gazeX, "left", pick("BLANC"), pick("CYAN"));
  if (state.eyeState === "wink_right") return winkEyes(gazeX, "right", pick("BLANC"), pick("CYAN"));
  const mood = state.moodOverride ?? state.mood;
  if (mood === "happy") return happyEyes(pick("JAUNE"));
  if (mood === "angry" || mood === "focused") return angryEyes(gazeX, pick("ROUGE"));
  if (mood === "surprised" || mood === "fear") return surprisedEyes(pick("BLANC"));
  if (mood === "tired" || mood === "disgust") return halfEyes(gazeX, pick("BLEU"));
  if (mood === "love") return loveEyes(pick("MAGENTA"));
  if (mood === "curious") return openEyes(gazeX, pick("MAGENTA"));
  if (mood === "calm") return openEyes(gazeX, pick("CYAN"));
  return openEyes(gazeX, pick("BLANC"));
}
