import { afterEach, describe, expect, it, vi } from "vitest";
import { g1ToMosaic, paintRows } from "../src/videotex/mosaic";
import { COLS, createScreen, plainText } from "../src/videotex/screen";
import { buildEyes, initialEyeState } from "../src/eyes/libEyes";
import { EyesController } from "../src/eyes/EyesController";
import { buildZyraEyes } from "../src/eyes/libZyraEyes";
import { targetShapes } from "../src/eyes/SmoothEyes";
import { scaleRows, sextantBounds } from "../src/videotex/scale";

const cell = (frame: ReturnType<typeof createScreen>, row: number, col: number) =>
  frame.cells[row * COLS + (col - 1)];

describe("mosaique Videotex G1", () => {
  it("convertit les octets G1 en sextants 2 x 3", () => {
    expect(g1ToMosaic(0x20)).toBe(0); // vide
    expect(g1ToMosaic(0x7f)).toBe(63); // plein
    expect(g1ToMosaic(0x21)).toBe(1); // haut gauche
    expect(g1ToMosaic(0x60)).toBe(32); // bas droite (bit 0x40)
    expect(g1ToMosaic(0x70)).toBe(48); // rangee du bas
  });
  it("peint des rangees minitel-face sur la grille", () => {
    const frame = createScreen("TEST");
    paintRows(frame, [[11, 7, "CYAN", [0x7f, 0x20]]]);
    expect(cell(frame, 11, 7)).toMatchObject({ mosaic: 63, fg: 6 });
    expect(cell(frame, 11, 8).mosaic).toBeUndefined();
  });
});

describe("yeux LibEyes", () => {
  it("dessine deux yeux ouverts avec pupille au centre", () => {
    const rows = buildEyes(initialEyeState, "BLANC");
    expect(rows).toHaveLength(10); // lignes 9 a 13 pour chaque oeil
    const left = rows.find(([row, col]) => row === 11 && col === 7)!;
    expect(left[3][3]).toBe(0x20); // pupille colonne 10
    const right = rows.find(([row, col]) => row === 11 && col === 24)!;
    expect(right[3][3]).toBe(0x20);
  });
  it("suit le regard et les humeurs", () => {
    const looking = buildEyes({ ...initialEyeState, gazeX: 1 });
    expect(looking.find(([row, col]) => row === 11 && col === 7)![3][4]).toBe(0x20);
    expect(buildEyes({ ...initialEyeState, eyeOpen: false })).toHaveLength(2);
    expect(buildEyes({ ...initialEyeState, mood: "happy" }).every(([row]) => row === 13)).toBe(true);
    expect(buildEyes({ ...initialEyeState, mood: "surprised" }).some(([row]) => row === 8)).toBe(true);
  });
  it("peint des yeux pleins, sans ligne vide entre le haut et le bas", () => {
    // minitel-face ne peignait que les lignes 9, 11 et 13 : trois barres au lieu d'un bloc.
    const moods = ["default", "happy", "angry", "surprised", "tired", "fear", "disgust", "love"] as const;
    const states = [
      ...moods.map((mood) => ({ ...initialEyeState, mood })),
      { ...initialEyeState, eyeState: "half" as const },
      { ...initialEyeState, eyeState: "wink_left" as const },
      { ...initialEyeState, eyeState: "wink_right" as const },
      { ...initialEyeState, gazeY: 1 },
    ];
    for (const state of states)
      for (const col of [7, 24]) {
        const rows = buildEyes(state)
          .filter(([, c, , bytes]) => c <= col && col < c + bytes.length)
          .map(([row]) => row);
        if (rows.length === 0) continue; // oeil ferme par le clin d'oeil
        const top = Math.min(...rows);
        const bottom = Math.max(...rows);
        for (let row = top; row <= bottom; row++) expect(rows, `${JSON.stringify(state)} col ${col}`).toContain(row);
      }
  });
});

describe("yeux Zyra", () => {
  it("dessine des capsules continues avec pupille", () => {
    const rows = buildZyraEyes(initialEyeState, "CYAN");
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual([9, 10, "CYAN", [0x70, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x70]]);
    expect(rows[2]).toEqual([11, 10, "CYAN", [0x23, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x23]]);
    expect(rows[1][3][3]).toBe(0x20);
  });
  it("dessine des capsules symetriques (gauche/droite et haut/bas)", () => {
    // Grille de sextants d'un oeil : chaque ligne doit etre son propre miroir,
    // et la capsule doit etre symetrique de haut en bas.
    for (const state of [initialEyeState, { ...initialEyeState, mood: "happy" as const }]) {
      const rows = buildZyraEyes(state, "CYAN").filter(([, col]) => col === 10);
      const grid: string[] = [];
      for (const [, , , bytes] of rows)
        for (let sub = 0; sub < 3; sub++)
          grid.push(bytes.map((b) => {
            const bits = g1ToMosaic(b);
            return (bits & (1 << (sub * 2)) ? "#" : ".") + (bits & (1 << (sub * 2 + 1)) ? "#" : ".");
          }).join(""));
      for (const line of grid) expect(line).toBe([...line].reverse().join(""));
      if (state.mood === "default") expect(grid).toEqual([...grid].reverse());
    }
  });
  it("prend les couleurs d'humeur en mode auto", () => {
    expect(buildZyraEyes({ ...initialEyeState, mood: "angry" }, "AUTO")[0][2]).toBe("ROUGE");
    expect(buildZyraEyes({ ...initialEyeState, mood: "love" }, "AUTO")[0][2]).toBe("MAGENTA");
    expect(buildZyraEyes({ ...initialEyeState, mood: "love" }, "VERT")[0][2]).toBe("VERT");
  });
  it("reprend calme, curieux et concentre de LibZyra", () => {
    // minitel-face LibZyra : calme et curieux sont des yeux ouverts (cyan, magenta),
    // concentre a exactement les yeux de la colere. Comparaison faite sur les
    // rangees de l'original le 2026-10-23 (9 humeurs, trois regards, identiques).
    const open = (mood: "default" | "calm" | "curious", gazeX = 0) =>
      buildZyraEyes({ ...initialEyeState, mood, gazeX }, "AUTO");
    const recolor = (rows: ReturnType<typeof open>, color: string) => rows.map(([r, c, , bytes]) => [r, c, color, bytes]);
    for (const gazeX of [-1, 0, 1]) {
      expect(open("calm", gazeX)).toEqual(recolor(open("default", gazeX), "CYAN"));
      expect(open("curious", gazeX)).toEqual(recolor(open("default", gazeX), "MAGENTA"));
      expect(buildZyraEyes({ ...initialEyeState, mood: "focused", gazeX }, "AUTO")).toEqual(
        buildZyraEyes({ ...initialEyeState, mood: "angry", gazeX }, "AUTO"),
      );
    }
    // Palette fixe : la couleur choisie l'emporte, calme et curieux ressemblent au neutre.
    expect(buildZyraEyes({ ...initialEyeState, mood: "curious" }, "VERT")).toEqual(
      buildZyraEyes(initialEyeState, "VERT"),
    );
  });
  it("laisse LibEyes ignorer les humeurs de Zyra, comme l'original", () => {
    for (const mood of ["calm", "curious", "focused"] as const)
      expect(buildEyes({ ...initialEyeState, mood })).toEqual(buildEyes(initialEyeState));
  });
  it("nomme les humeurs de Zyra a l'ecran", () => {
    const eyes = new EyesController({ style: "zyra" });
    for (const [mood, label] of [["calm", "CALME"], ["curious", "CURIEUX"], ["focused", "FOCUS"]] as const) {
      eyes.setMood(mood);
      expect(eyes.getSnapshot().moodLabel).toBe(label);
    }
  });
  it("garde le style LibEyes (blocs) au choix", () => {
    const eyes = new EyesController({ style: "libeyes", palette: "blanc" });
    expect(cell(eyes.getSnapshot().frame, 13, 7)).toMatchObject({ mosaic: 63, fg: 7 });
    eyes.setStyle("zyra");
    expect(cell(eyes.getSnapshot().frame, 13, 7).mosaic).toBeUndefined();
  });
});

describe("moteur des yeux", () => {
  afterEach(() => vi.useRealTimers());

  it("reagit aux touches Minitel et affiche l'humeur", () => {
    const eyes = new EyesController({ palette: "ambre" });
    expect(plainText(eyes.getSnapshot().frame)).toContain("HUMEUR : NEUTRE");
    expect(eyes.key("Envoi")).toBe(true);
    expect(eyes.getSnapshot().state.mood).toBe("happy");
    expect(plainText(eyes.getSnapshot().frame)).toContain("HUMEUR : JOIE");
    expect(cell(eyes.getSnapshot().frame, 11, 10).fg).toBe(3); // ambre = JAUNE
    expect(eyes.key("x")).toBe(false);
  });

  it("joue les sequences dans le temps", async () => {
    vi.useFakeTimers();
    const eyes = new EyesController();
    eyes.key("Sommaire"); // fall_asleep
    expect(eyes.getSnapshot().state.eyeState).toBe("half");
    await vi.advanceTimersByTimeAsync(1000);
    expect(eyes.getSnapshot().state.eyeState).toBe("closed");
    eyes.key("Retour"); // reveil
    await vi.advanceTimersByTimeAsync(1000);
    expect(eyes.getSnapshot().state).toMatchObject({ eyeState: null, moodOverride: null });
  });

  it("vit seul en mode autonome et s'arrete proprement", async () => {
    vi.useFakeTimers();
    const eyes = new EyesController({ random: () => 0 });
    const seen = new Set<string | null>();
    eyes.subscribe(() => seen.add(eyes.getSnapshot().state.eyeState));
    eyes.start();
    await vi.advanceTimersByTimeAsync(1200); // premier clignement a 1 s
    expect(seen.has("closed")).toBe(true);
    eyes.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("taille des yeux", () => {
  const bounds = (eyes: EyesController) => {
    const cells = eyes.getSnapshot().frame.cells
      .map((c, i) => (c.mosaic ? i : -1))
      .filter((i) => i >= 0 && Math.floor(i / COLS) < 22);
    const cols = cells.map((i) => i % COLS);
    const rows = cells.map((i) => Math.floor(i / COLS));
    return { w: Math.max(...cols) - Math.min(...cols) + 1, h: Math.max(...rows) - Math.min(...rows) + 1, left: Math.min(...cols) };
  };

  it("garde le dessin d'origine a x1", () => {
    const rows = buildZyraEyes(initialEyeState, "CYAN");
    const ref = sextantBounds(rows);
    const scaled = scaleRows(rows, 1, ref, 21);
    const a = createScreen("A"), b = createScreen("B");
    paintRows(a, rows);
    paintRows(b, scaled);
    expect(b.cells).toEqual(a.cells);
  });

  it("agrandit et reduit les yeux en restant dans l'ecran", () => {
    const eyes = new EyesController({ palette: "cyan" });
    const normal = bounds(eyes);
    eyes.setScale(1.5);
    const big = bounds(eyes);
    expect(big.w).toBeGreaterThan(normal.w * 1.3);
    expect(big.h).toBeGreaterThan(normal.h * 1.3);
    eyes.setScale(0.6);
    expect(bounds(eyes).w).toBeLessThan(normal.w);
    eyes.setScale(99);
    expect(eyes.getSnapshot().scale).toBe(eyes.getSnapshot().maxScale);
    const max = bounds(eyes);
    expect(max.left).toBeGreaterThanOrEqual(0);
    expect(max.w).toBeLessThanOrEqual(COLS);
    expect(plainText(eyes.getSnapshot().frame)).toContain("HUMEUR : NEUTRE");
  });

  it("ne change pas de taille selon l'humeur", () => {
    const eyes = new EyesController({ scale: 1.5 });
    const open = bounds(eyes);
    eyes.setMood("happy");
    expect(bounds(eyes).left).toBe(open.left);
  });

  it("borne la taille selon le style", () => {
    const eyes = new EyesController({ style: "zyra", scale: 1.9 });
    eyes.setStyle("libeyes");
    expect(eyes.getSnapshot().scale).toBeLessThanOrEqual(eyes.getSnapshot().maxScale);
    expect(eyes.getSnapshot().maxScale).toBeLessThan(1.9);
  });
});

describe("rendu classique (lisse)", () => {
  it("traduit les etats en formes d'yeux", () => {
    const [left, right] = targetShapes(initialEyeState);
    expect(left).toMatchObject({ open: 1, smile: 0, tilt: 0 });
    expect(targetShapes({ ...initialEyeState, mood: "happy" })[0].smile).toBe(1);
    expect(targetShapes({ ...initialEyeState, mood: "angry" })[0].tilt).toBe(1);
    expect(targetShapes({ ...initialEyeState, eyeState: "closed" })[1].open).toBe(0);
    const wink = targetShapes({ ...initialEyeState, eyeState: "wink_left" });
    expect([wink[0].open, wink[1].open]).toEqual([0, 1]);
    expect(right.dx).toBe(0);
    expect(targetShapes({ ...initialEyeState, gazeX: 1 })[0].dx).toBe(1);
  });
  it("a sa propre taille maximale et garde la mosaique en lecture", () => {
    const eyes = new EyesController({ render: "classique", scale: 99 });
    expect(eyes.getSnapshot().scale).toBe(1.7);
    eyes.setRender("mosaique");
    expect(eyes.getSnapshot().scale).toBeLessThanOrEqual(eyes.getSnapshot().maxScale);
    expect(eyes.getSnapshot().moodLabel).toBe("NEUTRE");
    expect(eyes.key("Delete")).toBe(true);
    expect(eyes.getSnapshot().moodLabel).toBe("COLERE");
  });
});
