import { afterEach, describe, expect, it, vi } from "vitest";
import { g1ToMosaic } from "../src/videotex/mosaic";
import { EYE_ROWS, LemegetonEyes, lemegetonRows, mosaicToG1 } from "../src/eyes/lemegetonEyes";
import { EyesController } from "../src/eyes/EyesController";

// Mirror of a sextant mask around the vertical axis of its cell.
const mirror = (m: number) =>
  ((m & 1) << 1) | ((m & 2) >> 1) | ((m & 4) << 1) | ((m & 8) >> 1) | ((m & 16) << 1) | ((m & 32) >> 1);
const lit = (cells: number[][]) => cells.flat().filter((m) => m !== 0).length;

describe("yeux Lemegeton (firmware Minitel_Sigil)", () => {
  it("conversion mosaïque ↔ G1 sur les 64 motifs", () => {
    for (let m = 0; m < 64; m++) {
      const byte = mosaicToG1(m);
      expect(byte & 0x20).toBe(0x20);
      expect(g1ToMosaic(byte)).toBe(m);
    }
  });

  it("au repos : deux ovales symétriques, rangées 2 à 20", () => {
    const eyes = new LemegetonEyes(() => 0.5, 0);
    const { eyes: cells, ring } = eyes.cells(false);
    expect(cells).toHaveLength(EYE_ROWS);
    expect(lit(cells)).toBeGreaterThan(40);
    expect(lit(ring)).toBe(0);
    for (const line of cells) for (let c = 0; c < 40; c++) expect(line[39 - c]).toBe(mirror(line[c]));
    const rows = lemegetonRows({ eyes: cells, ring }, "BLANC");
    expect(Math.min(...rows.map((r) => r[0]))).toBeGreaterThanOrEqual(2);
    expect(Math.max(...rows.map((r) => r[0]))).toBeLessThanOrEqual(20);
  });

  it("émotion : jouée, tenue, puis retour au neutre", () => {
    const eyes = new LemegetonEyes(() => 0.5, 0);
    const rest = lit(eyes.cells(false).eyes);
    eyes.play("joy", 0);
    // Joy squeezes the eyes into thin tilted bars.
    eyes.update(500, false, false);
    expect(lit(eyes.cells(false).eyes)).toBeLessThan(rest);
    expect(eyes.currentEmotion).toBe("joy");
    // Timeline 800 ms x 2.5, then a 1.2 s hold, then a 400 ms x 2.5 return.
    for (let t = 500; t <= 6000; t += 90) eyes.update(t, false, false);
    expect(eyes.currentEmotion).toBeNull();
    expect(eyes.busy).toBe(false);
    expect(lit(eyes.cells(false).eyes)).toBe(rest);
  });

  it("visage : un contour de tête, les yeux plus petits", () => {
    const eyes = new LemegetonEyes(() => 0.5, 0);
    const face = eyes.cells(true);
    expect(lit(face.ring)).toBeGreaterThan(60);
    expect(lit(face.eyes)).toBeLessThan(lit(eyes.cells(false).eyes));
  });
});

describe("visage : les yeux restent dans le cadre de la tête", () => {
  // Géométrie de la tête, comme dans lemegetonEyes.ts (ovale 27 x 25, anneau de 14 %).
  const HEAD = { rx: 27, ry: 25, thickness: 0.14 };
  const pixels = (layer: number[][]) => {
    const out: [number, number][] = [];
    layer.forEach((line, row) =>
      line.forEach((mask, col) => {
        for (let sub = 0; sub < 6; sub++)
          if (mask & (1 << sub)) out.push([col * 2 + (sub % 2) + 0.5, row * 3 + Math.floor(sub / 2) + 0.5]);
      }),
    );
    return out;
  };
  /** Pixels d'oeil sur l'anneau ou au-delà. Le centre de la tete (qui dérive) se lit sur l'anneau. */
  const overflow = (cells: ReturnType<LemegetonEyes["cells"]>) => {
    const ring = pixels(cells.ring);
    const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
    const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
    return pixels(cells.eyes).filter(([x, y]) => Math.hypot((x - cx) / HEAD.rx, (y - cy) / HEAD.ry) > 1 - HEAD.thickness).length;
  };
  const emotions = ["joy", "sadness", "surprise", "anger", "fear", "disgust", "confusion", "love", "sleepy", "excitement"] as const;

  it("aucun pixel d'oeil sur l'anneau ni au-delà, quelle que soit l'émotion, le regard ou la taille", () => {
    for (const emotion of emotions)
      for (const scale of [0.6, 1.2])
        for (const [gx, gy] of [[0, 0], [-1, 1], [1, 1], [-1, -1], [1, -1]]) {
          const eyes = new LemegetonEyes(() => 0.5, 0);
          eyes.setGaze(gx, gy);
          eyes.play(emotion, 0);
          for (let now = 0; now < 6000; now += 100) {
            eyes.update(now, false, true);
            expect(overflow(eyes.cells(true, scale)), `${emotion} x${scale} regard ${gx},${gy} à ${now} ms`).toBe(0);
          }
        }
  }, 30000);

  it("garde les yeux dans le cadre pendant que la tête dérive (mode autonome)", () => {
    for (const seed of [0.05, 0.3, 0.5, 0.8, 0.95]) {
      const eyes = new LemegetonEyes(() => seed, 0);
      for (let now = 0; now < 120000; now += 90) {
        eyes.update(now, true, true);
        expect(overflow(eyes.cells(true, 1.2)), `graine ${seed} à ${now} ms`).toBe(0);
      }
    }
  });

  it("le regard déplace quand même les yeux (borné, pas supprimé)", () => {
    const centered = new LemegetonEyes(() => 0.5, 0);
    const looking = new LemegetonEyes(() => 0.5, 0);
    looking.setGaze(1, 0);
    looking.update(5000, false, true);
    expect(JSON.stringify(looking.cells(true).eyes)).not.toBe(JSON.stringify(centered.cells(true).eyes));
  });
});

describe("contrôleur : style Lemegeton", () => {
  afterEach(() => vi.useRealTimers());
  it("touches du firmware : chiffres = émotions, Retour = neutre", () => {
    vi.useFakeTimers();
    let now = 0;
    const controller = new EyesController({ style: "lemegeton", palette: "auto", random: () => 0.5, now: () => now });
    expect(controller.getSnapshot().moodLabel).toBe("NEUTRE");
    controller.key("3");
    expect(controller.getSnapshot().moodLabel).toBe("COLERE");
    // Auto palette : anger is red.
    const red = controller.getSnapshot().frame.cells.filter((cell) => cell.mosaic && cell.fg === 1).length;
    expect(red).toBeGreaterThan(0);
    controller.key("Retour");
    now = 2000;
    vi.advanceTimersByTime(2000);
    expect(controller.getSnapshot().moodLabel).toBe("NEUTRE");
    controller.stop();
  });
});

describe("suivi du pointeur", () => {
  afterEach(() => vi.useRealTimers());

  it("yeux en mosaïque : trois positions, au-delà d'un seuil", () => {
    const eyes = new EyesController({ style: "zyra" });
    eyes.follow(0.9, 0);
    expect(eyes.getSnapshot().state).toMatchObject({ gazeX: 1, gazeY: 0 });
    eyes.follow(0.1, 0.2);
    expect(eyes.getSnapshot().state).toMatchObject({ gazeX: 0, gazeY: 0 });
    eyes.follow(-0.8, 0.9);
    expect(eyes.getSnapshot().state).toMatchObject({ gazeX: -1, gazeY: 1 });
  });

  it("le regard autonome attend que le pointeur se taise", async () => {
    vi.useFakeTimers();
    // random() = 0 : the autonomous gaze would look left (-1) at 2.2 s.
    const eyes = new EyesController({ style: "zyra", random: () => 0, now: () => Date.now() });
    eyes.start();
    eyes.follow(1, 0);
    // Async : the blink sequences await their timers.
    await vi.advanceTimersByTimeAsync(2400);
    expect(eyes.getSnapshot().state.gazeX).toBe(1);
    await vi.advanceTimersByTimeAsync(5300);
    expect(eyes.getSnapshot().state.gazeX).toBe(-1);
    eyes.stop();
  });

  it("yeux Lemegeton : le regard glisse vers le pointeur", () => {
    let now = 0;
    const eyes = new LemegetonEyes(() => 0.5, now);
    eyes.lookAt(0.6, 0, now, 2500);
    for (; now <= 1500; now += 90) eyes.update(now, true, false);
    const { eyes: cells } = eyes.cells(false);
    // Both pupils moved right : the picture is no longer mirror-symmetric.
    const symmetric = cells.every((line) => line.every((m, c) => line[39 - c] === mirror(m)));
    expect(symmetric).toBe(false);
  });
});
