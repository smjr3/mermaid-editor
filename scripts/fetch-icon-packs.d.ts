// Types for scripts/fetch-icon-packs.js, which src/lib/util/fetchIconPacks.test.ts imports.
export declare const outputDir: string;
export declare const manifestName: string;
export declare const inlineStyles: (text: string) => string;
export declare const readZip: (buffer: Buffer) => { name: string; data: Buffer }[];
export declare const toVendorIconName: (path: string) => string;
export declare const fetchIconPacks: (
  value: string | undefined,
  out?: string
) => Promise<{ count: number; prefix: string }[]>;
