import { X } from "lucide-react";
import { Tool } from "../components/Tool";
import { defaultEffects, type CrtEffects } from "../videotex/renderer";
import {
  EYE_PALETTES,
  EYE_RENDERS,
  EYE_STYLES,
  isFaceStyle,
  MIN_EYE_SCALE,
  type EyePaletteId,
  type EyeRenderId,
  type EyeStyleId,
} from "../eyes/EyesController";
import { furnitureLabel, type Furniture } from "../scene/furniture";
import { formatNumber, t, tFor, useLang, type MessageKey } from "../i18n";
import type { TerminalExperience } from "./useTerminalExperience";

const EFFECT_LABELS: Record<keyof CrtEffects, MessageKey> = {
  curvature: "settings.effect.curvature",
  scanlines: "settings.effect.scanlines",
  glow: "settings.effect.glow",
  vignette: "settings.effect.vignette",
  flicker: "settings.effect.flicker",
};

/** CRT effects, screen (3615 / eyes) and eye options, plus scene extras. */
export function SettingsPanel({
  experience,
  onClose,
  furniture,
  antenna,
}: {
  experience: TerminalExperience;
  onClose: () => void;
  /** Furniture choice, only for desk terminals. */
  furniture?: { pieces: Furniture[]; selected: string; onChoose: (id: string) => void };
  antenna?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  useLang();
  const { effects, setEffects, reducedMotion, screenMode, chooseScreen, eyesSnapshot } =
    experience;
  // Les visages Classic, Robot et Alien ont leurs couleurs et leur taille.
  const fixedFace = eyesSnapshot.render === "mosaique" && isFaceStyle(eyesSnapshot.style);
  return (
    <aside className="settings-panel">
      <div className="panel-title">
        <h2>{t("settings.title")}</h2>
        <Tool label={t("settings.close")} onClick={onClose}>
          <X size={18} />
        </Tool>
      </div>
      <label className="setting setting-master">
        <span>{t("settings.effects")}</span>
        <input
          type="checkbox"
          checked={Object.values(effects).some(Boolean)}
          onChange={(e) =>
            setEffects(
              e.target.checked
                ? { ...defaultEffects }
                : { curvature: false, scanlines: false, glow: false, vignette: false, flicker: false },
            )
          }
        />
      </label>
      {Object.entries(EFFECT_LABELS).map(([key, label]) => (
        <label className="setting" key={key}>
          <span>{t(label)}</span>
          <input
            type="checkbox"
            checked={effects[key as keyof CrtEffects]}
            disabled={key === "flicker" && reducedMotion}
            onChange={(e) =>
              setEffects((current) => ({
                ...current,
                [key]: e.target.checked,
              }))
            }
          />
        </label>
      ))}
      <fieldset className="setting-group">
        <legend>{t("settings.screen")}</legend>
        {(
          [
            ["3615", "settings.screen.3615"],
            ["yeux", "settings.screen.eyes"],
          ] as const
        ).map(([mode, label]) => (
          <label className="setting" key={mode}>
            <span>{t(label)}</span>
            <input
              type="radio"
              name="ecran"
              checked={screenMode === mode}
              onChange={() => chooseScreen(mode)}
            />
          </label>
        ))}
        {screenMode === "yeux" && (
          <label className="setting">
            <span>{t("settings.eyes.render")}</span>
            <select
              value={eyesSnapshot.render}
              onChange={(e) => experience.chooseRender(e.target.value as EyeRenderId)}
            >
              {EYE_RENDERS.map((render) => (
                <option key={render.id} value={render.id}>
                  {tFor(`eyes.render.${render.id}`, render.label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {screenMode === "yeux" && eyesSnapshot.render === "mosaique" && (
          <label className="setting">
            <span>{t("settings.eyes.style")}</span>
            <select
              value={eyesSnapshot.style}
              onChange={(e) => experience.chooseStyle(e.target.value as EyeStyleId)}
            >
              {EYE_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {tFor(`eyes.style.${style.id}`, style.label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {screenMode === "yeux" && !fixedFace && (
          <label className="setting setting-range">
            <span>{t("settings.eyes.size")}</span>
            <input
              type="range"
              min={MIN_EYE_SCALE}
              max={eyesSnapshot.maxScale}
              step={0.1}
              value={eyesSnapshot.scale}
              aria-valuetext={t("settings.eyes.sizeValue", { n: formatNumber(eyesSnapshot.scale) })}
              onChange={(e) => experience.chooseScale(Number(e.target.value))}
            />
            <output>×{formatNumber(eyesSnapshot.scale)}</output>
          </label>
        )}
        {screenMode === "yeux" && !fixedFace && (
          <label className="setting">
            <span>{t("settings.eyes.color")}</span>
            <select
              value={eyesSnapshot.palette}
              onChange={(e) => experience.choosePalette(e.target.value as EyePaletteId)}
            >
              {EYE_PALETTES.map((palette) => (
                <option key={palette.id} value={palette.id}>
                  {tFor(`eyes.palette.${palette.id}`, palette.label)}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>
      {furniture && (
        <label className="setting">
          <span>{t("settings.furniture")}</span>
          <select value={furniture.selected} onChange={(e) => furniture.onChoose(e.target.value)}>
            {furniture.pieces.map((item) => (
              <option key={item.id} value={item.id}>
                {furnitureLabel(item)}
              </option>
            ))}
          </select>
        </label>
      )}
      {antenna && (
        <label className="setting">
          <span>{t("settings.antenna")}</span>
          <input
            type="checkbox"
            checked={antenna.checked}
            onChange={(e) => antenna.onChange(e.target.checked)}
          />
        </label>
      )}
    </aside>
  );
}
