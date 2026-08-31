# Theme and palette

Two changes to upstream's appearance: the accent colour, and which mode a first
visit gets.

## Accent colour

Upstream uses `hsl(340 100% 44%)` — a vivid pink — as `--accent` in **both**
modes. This fork uses a teal-blue instead, chosen by measuring contrast rather
than by eye, and split per mode.

| Token                 | Light                          | Dark                           |
| --------------------- | ------------------------------ | ------------------------------ |
| `--accent`            | `hsl(198 88% 30%)` · `#096790` | `hsl(187 75% 52%)` · `#29cbe0` |
| `--accent-foreground` | `hsl(210 40% 98%)` (unchanged) | `hsl(222 84% 8%)`              |

The accent is used two ways in this app — as text (`text-accent`, several
components) and as a button surface (`variant="accent"`, `bg-accent`) — so both
have to pass WCAG AA (4.5:1).

| Combination                                      | Upstream pink         | This fork   |
| ------------------------------------------------ | --------------------- | ----------- |
| Accent as text on the light background           | 4.90:1                | **6.23:1**  |
| `--accent-foreground` on an accent button, light | 4.68:1                | **5.95:1**  |
| Accent as text on the dark background            | **4.08:1 — fails AA** | **10.20:1** |
| `--accent-foreground` on an accent button, dark  | 4.68:1                | **9.81:1**  |

Upstream's dark accent genuinely fails AA as text, which is why this is not a
pure preference change. Fixing it forces the foreground flip: a bright accent
that reads well on a dark background gives only 1.9:1 against a near-white
label, so `--accent-foreground` becomes near-black in dark mode.

`<meta name="theme-color">` in `src/app.html` carried the same pink and now
matches the dark accent.

Shadcn uses `--accent` for three things in `src/lib/components/ui/`: the switch's
checked background, the outline button's hover surface, and the accent button.
All three keep their structural role; only the hue changes.

### Still pink: the logo

`static/icons/mermaid.svg` hardcodes `#ff3670` for the logo's rounded square. It
is deliberately untouched — it is upstream's brand mark, and MIT covers the code
rather than the trademark, so recolouring it is a branding decision rather than a
styling one. Replacing it with an own mark, or dropping it, are the other
options.

## Default mode

A first visit gets **dark**; anyone who switches to light keeps light, on every
later visit.

`<ModeWatcher defaultMode="dark" />` alone does **not** achieve this, and the
reason is worth recording. mode-watcher's `UserPrefersMode` is a module-level
singleton constructed at import time with its own hardcoded `"system"` default,
and its `PersistedState` writes that to `localStorage` immediately. By the time
the component's `onMount` runs

```js
const localStorageMode = localStorage.getItem(modeStorageKey.current);
setMode(isValidMode(localStorageMode) ? localStorageMode : defaultMode);
```

the key already holds `"system"`, which is valid, so `defaultMode` is never
reached. Verified empirically: with only the prop set, a fresh browser context
rendered light with `localStorage["mode-watcher-mode"] === "system"`.

So `src/app.html` seeds the key **above SvelteKit's head placeholder**, before any
module loads:

```js
if (!localStorage.getItem('mode-watcher-mode')) {
  localStorage.setItem('mode-watcher-mode', 'dark');
}
```

An explicit choice is already stored, so the seed leaves it alone. The
`defaultMode` prop is kept as the fallback for when storage is unavailable
(private browsing, blocked cookies), where the seed's `try/catch` swallows the
write.

**Do not put the literal head-placeholder token in that comment.** An earlier
draft did, SvelteKit substituted the wrong occurrence, and the real placeholder
rendered as visible text at the top of every page.

## Verified

Four fresh browser contexts against a production build:

| Case        | OS preference | Stored  | Result                                          |
| ----------- | ------------- | ------- | ----------------------------------------------- |
| First visit | light         | —       | **dark** (`class="dark"`, bg `rgb(2, 8, 23)`)   |
| First visit | dark          | —       | dark                                            |
| Chose light | dark          | `light` | **light** (`class=""`, bg `rgb(255, 255, 255)`) |
| Chose dark  | light         | `dark`  | dark                                            |

48 diagram SVG elements rendered in every case. `tests/themes.spec.ts` covers the
same four cases plus toggle persistence; upstream's three tests asserted the
OS-following behaviour this replaces, so they were rewritten rather than skipped.
