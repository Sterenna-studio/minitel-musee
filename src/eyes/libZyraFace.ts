// Visage Zyra complet : halo, contour, nez et signal de minitel-face
// (src/libs/LibZyra.js), tels que les dessine la galerie du firmware
// Minitel_Sigil (Galerie.h, galZyraStructure / Eyebrows / Mouth), autour des
// yeux de libZyraEyes.ts. Couleurs fixes, celles de l'humeur ; taille x1.
//
// Le contour est centre une demi-case a droite des yeux et du nez : c'est le
// dessin d'origine, recopie tel quel (minitel-face, firmware) pour que les
// trois rendus restent identiques.
import type { RowPatch, VideotexColor } from "../videotex/mosaic";
import type { EyeState, Mood } from "./libEyes";
import { buildZyraEyes } from "./libZyraEyes";

const FULL = 0x7f;
const EMPTY = 0x20;
const LOW_THIRD = 0x70; // tiers bas : embout d'une barre en HAUT d'une forme
const HIGH_THIRD = 0x23; // tiers haut : embout d'une barre en BAS d'une forme
const MID_THIRD = 0x2c; // tiers milieu : embout d'une barre isolee
const UPPER_TWO = 0x2f; // deux tiers hauts : demi-case (sourcils, coins de bouche)

const fill = (n: number, byte = FULL) => Array<number>(n).fill(byte);
/** Barre pleine dont les deux bouts portent le meme embout (galCapsule). */
const capsule = (n: number, cap: number) => [cap, ...fill(n - 2), cap];

const STRUCTURE: RowPatch[] = [
  [4, 17, "BLEU", capsule(6, LOW_THIRD)],
  [5, 13, "CYAN", capsule(14, LOW_THIRD)],
  [6, 10, "CYAN", [LOW_THIRD, FULL, FULL, ...fill(16, EMPTY), FULL, FULL, LOW_THIRD]],
  [7, 9, "BLEU", fill(2)],
  [7, 31, "BLEU", fill(2)],
  [8, 8, "CYAN", fill(2)],
  [8, 32, "CYAN", fill(2)],
  [9, 8, "CYAN", fill(1)],
  [9, 33, "CYAN", fill(1)],
  [10, 7, "BLEU", fill(2)],
  [10, 33, "BLEU", fill(2)],
  [11, 7, "BLEU", fill(2)],
  [11, 33, "BLEU", fill(2)],
  [12, 8, "CYAN", fill(1)],
  [12, 33, "CYAN", fill(1)],
  [13, 9, "CYAN", fill(2)],
  [13, 31, "CYAN", fill(2)],
  [13, 19, "MAGENTA", capsule(3, MID_THIRD)], // nez
  [14, 10, "CYAN", fill(1)],
  [14, 31, "CYAN", fill(1)],
  [15, 10, "CYAN", fill(1)],
  [15, 31, "CYAN", fill(1)],
  [16, 11, "BLEU", fill(1)],
  [16, 30, "BLEU", fill(1)],
  [17, 12, "CYAN", capsule(18, HIGH_THIRD)],
  [18, 15, "BLEU", capsule(12, HIGH_THIRD)],
  // Signal en vague, volontairement alterne haut / bas.
  [20, 17, "MAGENTA", [UPPER_TWO, LOW_THIRD, UPPER_TWO, LOW_THIRD, UPPER_TWO, LOW_THIRD]],
];

/** Humeurs de la galerie du firmware ; peur et degout prennent les formes des yeux. */
type ZMood = "default" | "calm" | "happy" | "curious" | "focused" | "angry" | "surprised" | "tired" | "love";
function zyraMood(mood: Mood): ZMood {
  switch (mood) {
    case "fear":
      return "surprised";
    case "disgust":
      return "tired";
    case "neutral":
      return "default";
    default:
      return mood;
  }
}

function brows(mood: ZMood): RowPatch[] {
  let left = capsule(5, LOW_THIRD);
  let right = capsule(5, LOW_THIRD);
  let color: VideotexColor = "CYAN";
  if (mood === "happy" || mood === "love") {
    color = mood === "love" ? "MAGENTA" : "JAUNE";
  } else if (mood === "angry" || mood === "focused") {
    left = [FULL, FULL, UPPER_TWO, EMPTY, EMPTY];
    right = [EMPTY, EMPTY, UPPER_TWO, FULL, FULL];
    color = mood === "angry" ? "ROUGE" : "BLANC";
  } else if (mood === "tired") {
    left = fill(5, UPPER_TWO);
    right = fill(5, UPPER_TWO);
    color = "BLEU";
  }
  return [
    [7, 11, color, left],
    [7, 25, mood === "curious" ? "MAGENTA" : color, right],
  ];
}

function mouth(mood: ZMood): RowPatch[] {
  const upper = fill(13, EMPTY);
  const lower = fill(13, EMPTY);
  let color: VideotexColor;
  const span = (bytes: number[], byte: number) => {
    for (let i = 3; i <= 9; i++) bytes[i] = byte;
  };
  if (mood === "happy" || mood === "love") {
    upper[2] = upper[10] = LOW_THIRD;
    lower[2] = lower[10] = UPPER_TWO;
    span(lower, FULL);
    color = mood === "love" ? "MAGENTA" : "JAUNE";
  } else if (mood === "angry") {
    upper[2] = upper[10] = LOW_THIRD;
    span(upper, FULL);
    lower[2] = lower[10] = UPPER_TWO;
    color = "ROUGE";
  } else if (mood === "surprised") {
    upper[2] = upper[10] = LOW_THIRD;
    lower[2] = lower[10] = HIGH_THIRD;
    span(upper, FULL);
    span(lower, FULL);
    color = "MAGENTA";
  } else if (mood === "tired") {
    for (let i = 2; i <= 10; i += 2) lower[i] = UPPER_TWO;
    color = "BLEU";
  } else {
    lower[2] = lower[10] = MID_THIRD;
    span(lower, FULL);
    color = mood === "focused" ? "BLANC" : mood === "calm" ? "BLEU" : "CYAN";
  }
  return [
    [14, 15, color, upper],
    [15, 15, color, lower],
  ];
}

/** Rangees du visage Zyra complet, pretes pour paintRows. */
export function buildZyraFace(state: EyeState): RowPatch[] {
  const mood = zyraMood(state.moodOverride ?? state.mood);
  return [...STRUCTURE, ...brows(mood), ...buildZyraEyes(state, "AUTO"), ...mouth(mood)];
}
