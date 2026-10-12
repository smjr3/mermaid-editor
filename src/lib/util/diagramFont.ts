/**
 * Local: the diagram's font (the inspector's 「フォント」 row).
 *
 * mermaid reads the font from the config: the top-level `fontFamily` and the theme
 * variable `themeVariables.fontFamily`; both are written, so every diagram type and
 * every theme picks it up. A theme preset (themePresets.ts) brings a font of its own
 * in its variables: 「標準」 here gives that font back instead of dropping it, and a
 * font chosen here is written over it.
 */
import { getThemePreset, presetOf } from './themePresets';

export const fontChoices = ['default', 'gothic', 'mincho', 'rounded', 'mono'] as const;
export type FontChoice = (typeof fontChoices)[number];

/** The CSS font stacks; Japanese faces first, with the generic family as the fallback. */
export const fontStacks: Record<Exclude<FontChoice, 'default'>, string> = {
  gothic:
    '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "MS PMincho", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Noto Sans Mono", monospace',
  rounded: '"Hiragino Maru Gothic ProN", "M PLUS Rounded 1c", "Kosugi Maru", sans-serif'
};

type Config = Record<string, unknown>;

const parse = (config: string): Config | undefined => {
  try {
    const value: unknown = JSON.parse(config);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Config)
      : undefined;
  } catch {
    return undefined;
  }
};

const variablesOf = (config: Config): Config =>
  config.themeVariables && typeof config.themeVariables === 'object'
    ? (config.themeVariables as Config)
    : {};

/** The font the config's preset brings with it, if any. */
const presetFont = (config: Config): string | undefined => {
  const font = getThemePreset(presetOf(config)).themeVariables?.fontFamily;
  return typeof font === 'string' ? font : undefined;
};

/**
 * The font the config sets: one of the choices, `default` when it sets none (or only
 * its preset's own), or `custom` for one written by hand.
 */
export const getDiagramFont = (config: string): FontChoice | 'custom' => {
  const parsed = parse(config);
  if (!parsed) return 'default';
  const top = typeof parsed.fontFamily === 'string' ? parsed.fontFamily : undefined;
  const variable = variablesOf(parsed).fontFamily;
  const own =
    top ?? (typeof variable === 'string' && variable !== presetFont(parsed) ? variable : undefined);
  if (!own?.trim()) return 'default';
  const found = (Object.keys(fontStacks) as Exclude<FontChoice, 'default'>[]).find(
    (choice) => fontStacks[choice] === own
  );
  return found ?? 'custom';
};

/** The config with the font set; `default` removes it (giving a preset its own font back). */
export const setDiagramFont = (config: string, choice: FontChoice): string => {
  const parsed = parse(config);
  if (!parsed) return config;
  const rest: Config = { ...parsed };
  delete rest.fontFamily;
  delete rest.themeVariables;
  const variables: Config = { ...variablesOf(parsed) };
  delete variables.fontFamily;
  if (choice === 'default') {
    const font = presetFont(parsed);
    if (font) variables.fontFamily = font;
  } else {
    rest.fontFamily = fontStacks[choice];
    variables.fontFamily = fontStacks[choice];
  }
  const next = Object.keys(variables).length > 0 ? { ...rest, themeVariables: variables } : rest;
  return JSON.stringify(next, undefined, 2);
};
