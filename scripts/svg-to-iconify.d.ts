// Types for scripts/svg-to-iconify.js, which src/lib/util/svgToIconify.test.ts imports.
export declare const convertSvgDirectory: (
  dir: string,
  prefix: string
) => {
  prefix: string;
  icons: Record<string, { body: string; width: number; height: number }>;
};
export declare const inlineStyles: (text: string) => string;
export declare const parseSvg: (
  text: string
) => { body: string; width: number; height: number } | undefined;
