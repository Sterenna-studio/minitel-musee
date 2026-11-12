import { afterEach, describe, expect, it, vi } from "vitest";
import { g1ToMosaic, paintRows } from "../src/videotex/mosaic";
import { COLS, createScreen, plainText } from "../src/videotex/screen";
import { buildEyes, initialEyeState, type EyeState, type Mood } from "../src/eyes/libEyes";
import { EyesController } from "../src/eyes/EyesController";
import { buildZyraEyes } from "../src/eyes/libZyraEyes";
import { buildFace, FACE_STYLES } from "../src/eyes/libFaces";
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

describe("visages Classic, Robot, Alien", () => {
  const faces = FACE_STYLES;
  const moods: Mood[] = [
    "default", "neutral", "happy", "angry", "surprised", "tired",
    "fear", "disgust", "love", "calm", "curious", "focused",
  ];
  const states = (mood: Mood) => ({ ...initialEyeState, mood });
  const painted = (style: (typeof faces)[number], state: EyeState) => {
    const frame = createScreen("T");
    paintRows(frame, buildFace(style, state));
    return frame;
  };
  const mirrorMosaic = (m: number) =>
    ((m & 1) << 1) | ((m & 2) >> 1) | ((m & 4) << 1) | ((m & 8) >> 1) | ((m & 16) << 1) | ((m & 32) >> 1);

  it("n'emploie que des octets G1 et reste dans l'ecran, sous la ligne d'humeur", () => {
    for (const style of faces)
      for (const mood of moods)
        for (const gazeX of [-1, 0, 1])
          for (const rows of [buildFace(style, { ...states(mood), gazeX }), buildFace(style, { ...states(mood), eyeOpen: false })])
            for (const [row, col, , bytes] of rows) {
              expect(row).toBeGreaterThanOrEqual(1);
              expect(row).toBeLessThanOrEqual(21);
              expect(col).toBeGreaterThanOrEqual(1);
              expect(col + bytes.length - 1).toBeLessThanOrEqual(COLS);
              for (const byte of bytes) expect((byte >= 0x20 && byte <= 0x3f) || (byte >= 0x60 && byte <= 0x7f)).toBe(true);
            }
  });

  it("peint chaque ligne de la tete, sans trou, avec la meme silhouette pour toutes les humeurs", () => {
    for (const style of faces) {
      const headRows = (state: EyeState) => {
        const frame = painted(style, state);
        const rows: number[] = [];
        for (let r = 1; r <= 21; r++)
          if (Array.from({ length: COLS }, (_, i) => frame.cells[r * COLS + i]).some((c) => c.mosaic))
            rows.push(r);
        return rows;
      };
      const reference = headRows(initialEyeState);
      expect(reference.length).toBeGreaterThan(9);
      // Lignes consecutives : aucune ligne de la tete n'est restee vide.
      reference.forEach((r, i) => i > 0 && expect(r).toBe(reference[i - 1] + 1));
      for (const mood of moods) {
        expect(headRows(states(mood))).toEqual(reference);
        expect(headRows({ ...states(mood), eyeOpen: false })).toEqual(reference);
      }
    }
  });

  it("dessine des formes symetriques autour de la colonne 18", () => {
    // Asymetries voulues : la jauge du Robot (ligne 12, elle se remplit de gauche a droite)
    // et le sourcil unique de l'Alien curieux (lignes 7-8).
    for (const style of faces)
      for (const mood of moods) {
        const frame = painted(style, states(mood));
        for (let r = 1; r <= 21; r++) {
          if (style === "robot" && r === 12) continue;
          if (style === "alien" && mood === "curious" && (r === 7 || r === 8)) continue;
          for (let c = 1; c <= 17; c++) {
            const a = frame.cells[r * COLS + (c - 1)];
            const z = frame.cells[r * COLS + (36 - c - 1)];
            expect(`${style} ${mood} ${r}/${c}: ${mirrorMosaic(a.mosaic ?? 0)}`).toBe(`${style} ${mood} ${r}/${c}: ${z.mosaic ?? 0}`);
            if (a.mosaic) expect(a.fg).toBe(z.fg);
          }
        }
      }
  });

  it("suit le regard avec les deux yeux et ferme les yeux", () => {
    for (const style of faces) {
      const centre = JSON.stringify(buildFace(style, initialEyeState));
      expect(JSON.stringify(buildFace(style, { ...initialEyeState, gazeX: -1 }))).not.toBe(centre);
      expect(JSON.stringify(buildFace(style, { ...initialEyeState, gazeX: 1 }))).not.toBe(centre);
      expect(JSON.stringify(buildFace(style, { ...initialEyeState, eyeState: "closed" }))).not.toBe(centre);
      expect(JSON.stringify(buildFace(style, { ...initialEyeState, eyeOpen: false }))).toBe(
        JSON.stringify(buildFace(style, { ...initialEyeState, eyeState: "closed" })),
      );
    }
  });

  it("ramene les humeurs du canon a celles de chaque visage", () => {
    const same = (style: (typeof faces)[number], a: Mood, b: Mood) =>
      expect(buildFace(style, states(a))).toEqual(buildFace(style, states(b)));
    for (const style of faces) {
      same(style, "fear", "surprised");
      same(style, "disgust", "tired");
      same(style, "love", "happy");
    }
    same("alien", "calm", "neutral");
    same("alien", "neutral", "default");
    // Seul l'Alien a un sourcil curieux ; les deux autres visages restent au repos.
    expect(buildFace("alien", states("curious"))).not.toEqual(buildFace("alien", states("neutral")));
    same("classic", "curious", "default");
    same("robot", "curious", "default");
  });

  it("garde les couleurs du visage, sans palette ni zoom", () => {
    const robot = new EyesController({ style: "robot", palette: "rouge", scale: 1.5 });
    const snap = robot.getSnapshot();
    expect(snap.scale).toBe(1);
    expect(snap.maxScale).toBe(1);
    expect(cell(snap.frame, 6, 11)).toMatchObject({ mosaic: 63, fg: 6 }); // cadre cyan
    expect(cell(snap.frame, 8, 13)).toMatchObject({ mosaic: 63, fg: 2 }); // LED verte
    const classic = new EyesController({ style: "classic", palette: "nitro" });
    expect(cell(classic.getSnapshot().frame, 8, 12)).toMatchObject({ mosaic: 63, fg: 3 }); // peau jaune
    const alien = new EyesController({ style: "alien" });
    expect(cell(alien.getSnapshot().frame, 8, 12)).toMatchObject({ mosaic: 63, fg: 2 }); // peau verte
    // Revenir a un style de yeux redonne la taille.
    alien.setStyle("zyra");
    alien.setScale(1.5);
    expect(alien.getSnapshot().scale).toBe(1.5);
  });

  it("joue clignements, humeurs et touches Minitel sur les visages", async () => {
    vi.useFakeTimers();
    for (const style of faces) {
      const eyes = new EyesController({ style });
      const open = JSON.stringify(eyes.getSnapshot().frame.cells);
      const blink = eyes.play("blink");
      await vi.advanceTimersByTimeAsync(10);
      expect(JSON.stringify(eyes.getSnapshot().frame.cells)).not.toBe(open);
      await vi.advanceTimersByTimeAsync(200);
      await blink;
      expect(JSON.stringify(eyes.getSnapshot().frame.cells)).toBe(open);
      eyes.key("Enter");
      expect(plainText(eyes.getSnapshot().frame)).toContain("HUMEUR : JOIE");
    }
    const alien = new EyesController({ style: "alien" });
    alien.setMood("neutral");
    expect(alien.getSnapshot().moodLabel).toBe("NEUTRE");
    vi.useRealTimers();
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
