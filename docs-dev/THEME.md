# Theme and palette

One change to upstream's appearance: the accent colour. The light/dark mechanism
itself is untouched — the editor follows the operating system's colour scheme and
remembers a choice made through the toggle, exactly as upstream does.

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

Upstream's dark accent genuinely fails AA as text, so this is not a pure
preference change. Fixing it forces the foreground flip: a bright accent that
reads well on a dark background gives only 1.9:1 against a near-white label, so
`--accent-foreground` becomes near-black in dark mode. Restoring upstream's
near-white value there would drop accent-button labels to that 1.9:1.

Shadcn uses `--accent` for three things in `src/lib/components/ui/`: the switch's
checked background, the outline button's hover surface, and the accent button.
All three keep their structural role; only the hue changes.

`<meta name="theme-color">` in `src/app.html` carried the same pink. Because the
app follows the OS scheme, it is now a `prefers-color-scheme` pair rather than
one fixed value, so the mobile browser chrome matches whichever mode is showing.

## Still pink: the logo

`static/icons/mermaid.svg` hardcodes `#ff3670` for the logo's rounded square. It
is deliberately untouched — it is upstream's brand mark, and MIT covers the code
rather than the trademark, so recolouring it is a branding decision rather than a
styling one. Replacing it with an own mark, or dropping it, are the other
options.

## Default mode: deliberately left to the OS

An earlier revision defaulted the editor to dark. That was reverted in favour of
upstream's behaviour, and the finding behind it is worth keeping, because it
applies to **any** attempt to change the default:

`<ModeWatcher defaultMode="…" />` does not work. mode-watcher's
`UserPrefersMode` is a module-level singleton constructed at import time with its
own hardcoded `"system"` default, and its `PersistedState` writes that to
`localStorage` immediately. By the time the component's `onMount` runs

```js
const localStorageMode = localStorage.getItem(modeStorageKey.current);
setMode(isValidMode(localStorageMode) ? localStorageMode : defaultMode);
```

the key already holds `"system"`, which is valid, so `defaultMode` is never
reached — whatever value it holds. Verified empirically: with the prop set to
`"dark"`, a fresh browser context rendered light with
`localStorage["mode-watcher-mode"] === "system"`.

Forcing a default therefore means seeding that storage key from an inline script
in `src/app.html`, above SvelteKit's head placeholder so it runs before any
module loads. That works — it was implemented and verified across four browser
contexts — but it costs an inline script in an upstream file for either choice,
light or dark. Following the OS costs nothing and is what upstream does, so that
is what this fork ships.

If a fixed default is ever wanted, seed the key; do not reach for `defaultMode`
and assume it took effect. And **do not put the literal head-placeholder token in
that script's comment**: an earlier draft did, SvelteKit substituted the wrong
occurrence, and the real placeholder rendered as visible text at the top of every
page.
