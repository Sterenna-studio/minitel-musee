// Portage TypeScript des visages Classic, Robot et Alien de minitel-face
// (src/libs/LibClassic.js, LibRobot.js, LibAlien.js, g1.js). Ce sont les trois
// habillages d'une meme tete en mosaique G1 : les lignes sont les memes que
// celles du 3617 de Korigan, avec des couleurs fixes (peau, LED, iris).
// Les formes se decrivent par leur moitie gauche, la droite est le miroir exact
// (canon/VIDEOTEX.md, "Avant de dessiner une forme Videotex") ; chaque region
// possede des LIGNES ENTIERES, bords compris, pour que son remplacement ne troue
// jamais la silhouette.
import type { RowPatch, VideotexColor } from "../videotex/mosaic";
import type { EyeState, Mood } from "./libEyes";

export const FACE_STYLES = ["classic", "robot", "alien"] as const;
export type FaceStyleId = (typeof FACE_STYLES)[number];
export const isFaceStyle = (style: string): style is FaceStyleId =>
  (FACE_STYLES as readonly string[]).includes(style);

// ── g1.js : octets G1 et rangees symetriques par construction ──
// 0x01 haut-gauche, 0x02 haut-droit, 0x04 milieu-gauche, 0x08 milieu-droit,
// 0x10 bas-gauche, 0x40 bas-droit ; 0x20 est toujours present.
const FULL = 0x7f;
const EMPTY = 0x20;
const TOP = 0x23; // tiers haut
const MID = 0x2c; // tiers milieu
const BOT = 0x70; // tiers bas
// Case pleine traversee d'un trait sombre (sourcils, paupieres, narines).
const DARK_TOP = 0x7c;
const DARK_MID = 0x73;
const DARK_BOT = 0x2f;

/** Miroir gauche-droite d'un octet G1. */
export function mirrorG1(byte: number): number {
  let out = 0x20;
  if (byte & 0x01) out |= 0x02;
  if (byte & 0x02) out |= 0x01;
  if (byte & 0x04) out |= 0x08;
  if (byte & 0x08) out |= 0x04;
  if (byte & 0x10) out |= 0x40;
  if (byte & 0x40) out |= 0x10;
  return out;
}
const mirrorRow = (bytes: number[]) => bytes.slice().reverse().map(mirrorG1);
/** Moitie gauche, cases centrales symetriques, miroir de la moitie gauche. */
const sym = (left: number[], center: number[] = []) => [...left, ...center, ...mirrorRow(left)];
const fill = (width: number, byte = FULL) => Array<number>(width).fill(byte);
const E = EMPTY;

type Rows = RowPatch[];
const row = (r: number, col: number, color: VideotexColor, bytes: number[]): RowPatch => [r, col, color, bytes];

/** Etat des yeux d'un visage, deduit de EyeState comme les _resolve* de minitel-face. */
type Gaze = "open_left" | "open_center" | "open_right";
const gazeOf = (state: EyeState): Gaze =>
  state.gazeX < 0 ? "open_left" : state.gazeX > 0 ? "open_right" : "open_center";
const moodOf = (state: EyeState): Mood => state.moodOverride ?? state.mood;
const isClosed = (state: EyeState) => !state.eyeOpen || state.eyeState === "closed";

/**
 * Humeurs du canon (emotions.json, fallbacks.engines) ramenees a celles que
 * chaque visage possede : peur et confusion -> surprise, degout et tristesse ->
 * fatigue, amour -> joie ; calme et concentre ne sont pas des emotions, repos.
 */
const FALLBACK: Partial<Record<Mood, Mood>> = {
  fear: "surprised",
  disgust: "tired",
  love: "happy",
  calm: "default",
  focused: "default",
};
function nativeMood(mood: Mood, natives: readonly Mood[], rest: Mood): Mood {
  if (natives.includes(mood)) return mood;
  const mapped = FALLBACK[mood];
  return mapped && natives.includes(mapped) ? mapped : rest;
}

// ═══════════════════════════ Classic ═══════════════════════════
// Visage jaune plein, colonnes 12 a 24 (centre 18), lignes 7 a 17.
const C_SKIN: VideotexColor = "JAUNE";
const C_COL = 12;
const C_W = 13;

const C_STRUCTURE: Rows = [
  row(7, 13, C_SKIN, sym([0x7e, FULL, FULL, FULL, FULL], [FULL])), // haut arrondi
  row(8, 12, C_SKIN, fill(C_W)),
  row(12, 12, C_SKIN, sym([FULL, FULL, FULL, FULL, FULL, DARK_BOT], [FULL])), // narines
  row(13, 12, C_SKIN, fill(C_W)),
  row(16, 12, C_SKIN, fill(C_W)),
  row(17, 13, C_SKIN, sym([0x6f, FULL, FULL, FULL, FULL], [FULL])), // menton arrondi
];

// Yeux (ligne 11) : bord, oeil (13-15), entre-deux, oeil (21-23), bord.
// W blanc plein, N pupille noire, w blanc mi-clos, p pupille reduite.
const C_EYE_CELL: Record<string, [VideotexColor, number]> = {
  W: ["BLANC", FULL],
  N: ["NOIR", FULL],
  w: ["BLANC", DARK_TOP],
  p: ["BLANC", DARK_MID],
  L: [C_SKIN, DARK_MID],
};
function classicEyes(spec: string): Rows {
  const cells = (col: number): Rows =>
    [...spec].map((k, i) => row(11, col + i, C_EYE_CELL[k][0], [C_EYE_CELL[k][1]]));
  return [row(11, 12, C_SKIN, [FULL]), ...cells(13), row(11, 16, C_SKIN, fill(5)), ...cells(21), row(11, 24, C_SKIN, [FULL])];
}
const C_EYES = {
  open_center: classicEyes("WNW"),
  open_left: classicEyes("NWW"),
  open_right: classicEyes("WWN"),
  closed: classicEyes("LLL"), // paupiere : trait sombre sur la peau
  half: classicEyes("wNw"),
  tired: classicEyes("WNW"),
  surprised: classicEyes("WpW"),
};

// Bouche (lignes 14-15) : bord, zone de 11 cases (13-23), bord.
function classicMouth(row14: number[], row15: number[], color: VideotexColor = "ROUGE"): Rows {
  return [
    row(14, 12, C_SKIN, [FULL]), row(14, 13, color, row14), row(14, 24, C_SKIN, [FULL]),
    row(15, 12, C_SKIN, [FULL]), row(15, 13, color, row15), row(15, 24, C_SKIN, [FULL]),
  ];
}
const C_MOUTHS = {
  smile: classicMouth(sym([E, FULL, E, E, E], [E]), sym([E, E, FULL, FULL, FULL], [FULL])), // coins hauts
  frown: classicMouth(sym([E, E, FULL, FULL, FULL], [FULL]), sym([E, FULL, E, E, E], [E])), // coins bas
  flat: classicMouth(sym([E, BOT, BOT, BOT, BOT], [BOT]), fill(11, E)),
  open: classicMouth(sym([E, FULL, TOP, TOP, TOP], [TOP]), sym([E, FULL, BOT, BOT, BOT], [BOT])),
};

// Sourcils (lignes 9-10), traits sombres sur la peau, au-dessus des yeux.
function classicBrows(row9: number[] | null, row10: number[] | null): Rows {
  const line = (r: number, b: number[] | null) =>
    row(r, C_COL, C_SKIN, b ? [FULL, ...b, ...fill(5), ...mirrorRow(b), FULL] : fill(C_W));
  return [line(9, row9), line(10, row10)];
}
const C_BROWS = {
  default: classicBrows(null, [DARK_MID, DARK_MID, DARK_MID]),
  happy: classicBrows(null, [DARK_MID, DARK_TOP, DARK_MID]), // arques
  angry: classicBrows(null, [DARK_TOP, DARK_MID, DARK_BOT]), // fronces vers le nez
  tired: classicBrows(null, [DARK_BOT, DARK_MID, DARK_TOP]), // releves vers le nez
  surprised: classicBrows([DARK_BOT, DARK_MID, DARK_BOT], null), // montes d'une ligne
};
const C_MOODS = ["default", "happy", "angry", "tired", "surprised"] as const;

function classicFace(state: EyeState): Rows {
  const mood = nativeMood(moodOf(state), C_MOODS, "default") as (typeof C_MOODS)[number];
  let eyes = C_EYES[gazeOf(state)];
  if (isClosed(state)) eyes = C_EYES.closed;
  else if (state.eyeState === "half") eyes = C_EYES.half;
  else if (mood === "tired") eyes = C_EYES.tired;
  else if (mood === "surprised") eyes = C_EYES.surprised;
  const mouth = { default: "smile", happy: "smile", tired: "flat", angry: "frown", surprised: "open" }[mood] as
    keyof typeof C_MOUTHS;
  return [...C_STRUCTURE, ...C_BROWS[mood], ...eyes, ...C_MOUTHS[mouth]];
}

// ═══════════════════════════ Robot ═══════════════════════════
// Tete carree : cadre colonnes 11 a 25 (centre 18), lignes 6 a 16, bords continus.
// Les regions n'effacent que l'interieur (13 a 23).
const R_FRAME: VideotexColor = "CYAN";
const R_STRUCTURE: Rows = [
  // Antennes : un trait plein a cheval sur deux cases, de part et d'autre du centre.
  row(5, 15, "VERT", [0x6a, 0x35]),
  row(5, 20, "VERT", [0x6a, 0x35]),
  row(6, 11, R_FRAME, fill(15)),
  ...[7, 8, 9, 10, 11, 12, 13, 14, 15].flatMap((r) => [row(r, 11, R_FRAME, [FULL]), row(r, 25, R_FRAME, [FULL])]),
  row(16, 11, R_FRAME, fill(15)),
];

// Yeux LED 4 x 2 : colonnes 13-16 et 20-23, le regard identique pour les deux.
function robotEyes(top: number[], bottom: number[], topColor: VideotexColor = "VERT", bottomColor: VideotexColor = "CYAN"): Rows {
  return [
    row(8, 13, topColor, top), row(8, 20, topColor, top),
    row(9, 13, bottomColor, bottom), row(9, 20, bottomColor, bottom),
  ];
}
const R_EYES = {
  open_center: robotEyes([FULL, FULL, FULL, FULL], [FULL, E, E, FULL]),
  open_left: robotEyes([FULL, FULL, FULL, FULL], [E, E, FULL, FULL]),
  open_right: robotEyes([FULL, FULL, FULL, FULL], [FULL, FULL, E, E]),
  closed: robotEyes([E, E, E, E], [MID, MID, MID, MID], "CYAN", "CYAN"),
};

// Bouche LED, lignes 14-15, colonnes 13 a 23.
const robotMouth = (row14: number[], row15: number[], c14: VideotexColor = "VERT", c15: VideotexColor = c14): Rows =>
  [row(14, 13, c14, row14), row(15, 13, c15, row15)];
const R_MOUTHS = {
  idle: robotMouth(sym([E, MID, MID, MID, MID], [MID]), fill(11, E)),
  talk: robotMouth(sym([E, FULL, E, FULL, E], [FULL]), sym([E, FULL, E, FULL, E], [FULL]), "VERT", "CYAN"),
  happy: robotMouth(sym([E, FULL, E, E, E], [E]), sym([E, E, FULL, FULL, FULL], [FULL])), // coins hauts
  frown: robotMouth(sym([E, E, FULL, FULL, FULL], [FULL]), sym([E, FULL, E, E, E], [E]), "ROUGE"), // coins bas
};

// Jauge de statut (ligne 12, colonnes 13 a 23) : asymetrie voulue, une jauge
// se remplit de gauche a droite. C'est la region "sourcils" du Robot.
const gauge = (n: number, color: VideotexColor): Rows => [row(12, 13, color, [...fill(n), ...fill(11 - n, E)])];
const R_GAUGES = {
  default: gauge(1, "VERT"),
  happy: gauge(11, "VERT"),
  angry: gauge(11, "ROUGE"),
  tired: gauge(1, "CYAN"),
  surprised: gauge(5, "JAUNE"),
};
const R_MOODS = ["default", "happy", "angry", "tired", "surprised"] as const;

function robotFace(state: EyeState): Rows {
  const mood = nativeMood(moodOf(state), R_MOODS, "default") as (typeof R_MOODS)[number];
  // Le Robot n'a pas d'yeux mi-clos : il ferme les siens.
  const eyes = isClosed(state) || state.eyeState === "half" ? R_EYES.closed : R_EYES[gazeOf(state)];
  const mouth = { default: "idle", happy: "happy", angry: "frown", tired: "idle", surprised: "talk" }[mood] as
    keyof typeof R_MOUTHS;
  return [...R_STRUCTURE, ...R_GAUGES[mood], ...eyes, ...R_MOUTHS[mouth]];
}

// ═══════════════════════════ Alien ═══════════════════════════
// Tete ovoide verte, centree en colonne 18 : lignes 6 (9 cases) a 17 (7 cases).
const A_SKIN: VideotexColor = "VERT";
const A_IRIS: VideotexColor = "MAGENTA";

const A_STRUCTURE: Rows = [
  row(6, 14, A_SKIN, sym([0x7e, FULL, FULL, FULL], [FULL])), // sommet arrondi
  row(11, 12, A_SKIN, fill(13)),
  row(12, 12, A_SKIN, fill(13)),
  row(13, 12, A_SKIN, sym([FULL, FULL, FULL, FULL, FULL, DARK_BOT], [FULL])), // narines
  row(14, 12, A_SKIN, fill(13)),
  row(17, 15, A_SKIN, sym([0x6f, FULL, FULL], [FULL])), // menton arrondi
];

// Yeux en amande (lignes 9-10) : bord, oeil (13-17), arete (18), oeil (19-23), bord.
const almondTop = [BOT, FULL, FULL, FULL, BOT];
function almondBottom(pupil: number | null, pupilByte = E): number[] {
  const b = [TOP, FULL, FULL, FULL, TOP];
  if (pupil !== null) b[pupil] = pupilByte;
  return b;
}
function alienEyes(
  left9: number[], left10: number[],
  right9 = left9, right10 = left10,
  c9: VideotexColor = A_IRIS, c10: VideotexColor = A_IRIS,
): Rows {
  const line = (r: number, l: number[], rt: number[], c: VideotexColor): Rows => [
    row(r, 12, A_SKIN, [FULL]), row(r, 13, c, l), row(r, 18, A_SKIN, [FULL]), row(r, 19, c, rt), row(r, 24, A_SKIN, [FULL]),
  ];
  return [...line(9, left9, right9, c9), ...line(10, left10, right10, c10)];
}
const A_EYES = {
  open_center: alienEyes(almondTop, almondBottom(2)),
  open_left: alienEyes(almondTop, almondBottom(1)), // meme regard pour les deux yeux
  open_right: alienEyes(almondTop, almondBottom(3)),
  dilated: alienEyes(almondTop, [TOP, E, E, E, TOP]),
  // Pupille fendue : demi-case, en miroir d'un oeil a l'autre.
  slit: alienEyes(almondTop, almondBottom(2, 0x6a), almondTop, mirrorRow(almondBottom(2, 0x6a))),
  half_closed: alienEyes(fill(5), almondBottom(2), fill(5), almondBottom(2), A_SKIN, A_IRIS),
  closed: alienEyes(fill(5), fill(5, DARK_MID), fill(5), fill(5, DARK_MID), A_SKIN, A_SKIN),
};

// Bouche (lignes 15-16) : 15 = bord, 9 cases (14-22), bord ; 16 = bord, 7 cases (15-21), bord.
// Chaque segment : [colonne, couleur, octets], de gauche a droite.
type Segment = [number, VideotexColor, number[]];
function alienMouth(segs15: Segment[], segs16: Segment[]): Rows {
  return [...segs15.map(([c, color, b]) => row(15, c, color, b)), ...segs16.map(([c, color, b]) => row(16, c, color, b))];
}
const A_SKIN16: Segment[] = [[14, A_SKIN, fill(9)]];
const A_MOUTHS = {
  neutral: alienMouth([[13, A_SKIN, sym([FULL, FULL, DARK_MID, DARK_MID, DARK_MID], [DARK_MID])]], A_SKIN16),
  tired: alienMouth([[13, A_SKIN, sym([FULL, FULL, DARK_MID, FULL, DARK_MID], [FULL])]], A_SKIN16),
  smile: alienMouth( // coins hauts
    [[13, A_SKIN, [FULL]], [14, A_IRIS, [FULL]], [15, A_SKIN, fill(7)], [22, A_IRIS, [FULL]], [23, A_SKIN, [FULL]]],
    [[14, A_SKIN, [FULL]], [15, A_IRIS, fill(7)], [22, A_SKIN, [FULL]]],
  ),
  open: alienMouth(
    [[13, A_SKIN, [FULL]], [14, A_IRIS, sym([FULL, TOP, TOP, TOP], [TOP])], [23, A_SKIN, [FULL]]],
    [[14, A_IRIS, sym([FULL, BOT, BOT, BOT], [BOT])]],
  ),
  hiss: alienMouth(
    [[13, A_SKIN, [FULL]], [14, A_IRIS, sym([FULL, E, FULL, E], [FULL])], [23, A_SKIN, [FULL]]],
    A_SKIN16,
  ),
};

// Sourcils (lignes 7-8), traits sombres sur la peau, au-dessus des yeux (14-16, 20-22).
function alienBrows(
  row7Left: number[] | null, row8Left: number[] | null,
  row7Right = row7Left && mirrorRow(row7Left), row8Right = row8Left && mirrorRow(row8Left),
): Rows {
  const r7 = [FULL, ...(row7Left ?? fill(3)), ...fill(3), ...(row7Right ?? fill(3)), FULL]; // 13-23
  const r8 = [FULL, FULL, ...(row8Left ?? fill(3)), ...fill(3), ...(row8Right ?? fill(3)), FULL, FULL]; // 12-24
  return [row(7, 13, A_SKIN, r7), row(8, 12, A_SKIN, r8)];
}
const A_BROWS = {
  neutral: alienBrows(null, [DARK_MID, DARK_MID, DARK_MID]),
  happy: alienBrows(null, [DARK_MID, DARK_TOP, DARK_MID]),
  angry: alienBrows(null, [DARK_TOP, DARK_MID, DARK_BOT]),
  // Asymetrie voulue : un seul sourcil leve.
  curious: alienBrows(null, [DARK_MID, DARK_MID, DARK_MID], [DARK_BOT, DARK_BOT, DARK_BOT], null),
  surprised: alienBrows([DARK_BOT, DARK_MID, DARK_BOT], null),
  tired: alienBrows(null, [DARK_BOT, DARK_BOT, DARK_BOT]),
};
const A_MOODS = ["default", "neutral", "happy", "angry", "curious", "surprised", "tired"] as const;

function alienFace(state: EyeState): Rows {
  const mood = nativeMood(moodOf(state), A_MOODS, "neutral") as (typeof A_MOODS)[number];
  let eyes = A_EYES[gazeOf(state)];
  if (isClosed(state)) eyes = A_EYES.closed;
  else if (state.eyeState === "half") eyes = A_EYES.half_closed;
  else if (mood === "surprised") eyes = A_EYES.dilated;
  else if (mood === "angry") eyes = A_EYES.slit;
  else if (mood === "tired") eyes = A_EYES.half_closed;
  const mouth = (
    { default: "neutral", neutral: "neutral", curious: "neutral", happy: "smile", angry: "hiss", surprised: "open", tired: "tired" } as const
  )[mood];
  const brows = mood === "default" ? A_BROWS.neutral : A_BROWS[mood];
  return [...A_STRUCTURE, ...brows, ...eyes, ...A_MOUTHS[mouth]];
}

/** Rangees d'un visage, pretes pour paintRows. Les couleurs sont celles du visage. */
export function buildFace(style: FaceStyleId, state: EyeState): RowPatch[] {
  switch (style) {
    case "classic":
      return classicFace(state);
    case "robot":
      return robotFace(state);
    case "alien":
      return alienFace(state);
  }
}
