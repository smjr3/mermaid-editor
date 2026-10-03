// Types for scripts/svg-to-iconify.js, which src/lib/util/svgToIconify.test.ts imports.
export declare const convertSvgDirectory: (
  dir: string,
  prefix: string
) => {
  prefix: string;
  icons: Record<string, { body: string; width: number; height: number }>;
};
