# @oppulence/themes

Brand theme CSS for Oppulence apps. Each file is a full Tailwind v4 theme: design tokens (`@theme`), light and dark variables (`:root` / `.dark`), base styles, and component skins.

| File             | Brand      | Source of truth                                                                |
| ---------------- | ---------- | ------------------------------------------------------------------------------ |
| `eigenn.css`     | Eigenn     | `oppulence-canvas/apps/web/src/app/globals.css`                                |
| `conduitt.css`   | Conduitt   | `oppulence-canvas/corinthian/corinthian-web/src/app/globals.css` + `fonts.css` |
| `cossistant.css` | Cossistant | `cossistant/apps/web/src/app/globals.css`                                      |

## Use

Install the package. Then import one theme after Tailwind in your app entry CSS:

```css
@import "tailwindcss";
@import "@oppulence/themes/eigenn.css";
```

Requires Tailwind CSS v4 (peer dependency). Each theme defines the `dark` custom variant (`.dark` class on an ancestor). Do not define `@custom-variant dark` again in the app.

## What the themes do not ship

The source apps own these. Provide them in the app when you need them:

1. **`@source` scanning.** The app's own Tailwind import scans the app's files.
2. **Fonts.** Define the font variables the theme reads, or accept the fallbacks:
   - Conduitt: `--font-inter`, `--font-geist-sans`, `--font-geist-mono`, `--font-jetbrains-mono`, `--font-landing-serif` (use `next/font`).
   - Cossistant: serve Geist, Geist Mono, and F37Stout.
   - Eigenn: uses the SF Pro system stack; no font files needed.
3. **Fumadocs CSS.** The `.docs-shell` rules only apply if the app imports `fumadocs-ui` CSS itself.
4. **Cossistant support widget CSS** (`@cossistant/next/support.css`).
5. **Tailwind plugins.** `tailwind-scrollbar-hide` (Eigenn) and `tailwind-scrollbar` (Cossistant) are not shipped; each theme already defines a `.no-scrollbar` utility.

## Update flow

These files are extracted copies, not the live source. When a source app changes its globals, re-extract: copy the file and strip `@import "tailwindcss"`, `@source`, `@config`, fumadocs imports, and app-served `@font-face` blocks.
