/**
 * UI message catalogue.
 *
 * Deliberately a plain object rather than an i18n framework. Paraglide and the
 * like want a build plugin and, in their SvelteKit form, ownership of locale
 * routing — machinery this fork has no use for: it ships two locales, switched
 * per browser by a toggle (see ./index.ts), and builds a static site served from
 * a fixed subpath. What the framework would buy
 * us is that UI strings live in one place, and that is what this file is.
 *
 * The strings themselves live in ./ja.ts (Japanese, the one file the maintainer
 * edits) and ./en.ts (upstream's original wording, so nothing is lost and the
 * editor can be built in English by setting MERMAID_LOCALE=en). This file only
 * combines them.
 */

import { en } from './en';
import { ja } from './ja';

export const messages = { en, ja } as const;

export type Locale = keyof typeof messages;
export type MessageKey = keyof (typeof messages)['en'];
