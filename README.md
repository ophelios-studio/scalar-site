# Scalar

The presentation site for Scalar: blockchain infrastructure for AI agents.

| Path | Page | Ground |
|---|---|---|
| `/` | Scalar: the lines, the crossing, the two products and the page's own record | Ink, released to paper on scroll |
| `/range/` | Range Chain: testing agents before release, in a sealed lab | Ink |
| `/live/` | Live Assurance Chain: agents at work after release, on an organization's own chain | Paper |
| `/404.html` | A block that is not in the record | Ink |

The site is static. It is built with [Zephyrus Leaf](https://leaf.ophelios.com) (binary tier) from Latte templates, one hand-written stylesheet and a set of small JavaScript modules. There is no bundler, no framework, no tracking, no cookies and no third-party request.

It is published at https://ophelios-studio.github.io/scalar-site/.

## Run it

Install the Leaf binary once:

```sh
curl -fsSL https://leaf.ophelios.com/install.sh | sh
```

The binary renders through the system PHP, so building also needs PHP 8.4 or later with the `intl`, `mbstring`, `sodium` and `pdo` extensions.

```sh
leaf dev --addr :8097   # serve with live reload at http://localhost:8097
leaf build              # write the static site to dist/
```

`dist/` is the whole deliverable: upload it to any static host. `404.html` sits at its root for hosts that serve a custom not-found page.

## Deploy

Where the site is served is read from two environment variables at build time. Both are empty by default, so `leaf dev` and a plain `leaf build` serve from the root.

| Variable | Meaning | Example |
|---|---|---|
| `LEAF_BASE_URL` | The path the site is served under, no trailing slash | `/scalar-site` |
| `LEAF_PRODUCTION_URL` | The public address of the site root, base path included | `https://ophelios-studio.github.io/scalar-site` |

Every link, asset and module path in the templates starts from the base path. With a production URL, the build also adds canonical URLs, absolute Open Graph image URLs, `sitemap.xml` and `robots.txt`.

```sh
LEAF_BASE_URL=/scalar-site LEAF_PRODUCTION_URL=https://ophelios-studio.github.io/scalar-site leaf build
```

`.github/workflows/pages.yml` does this on every push to `main` and publishes `dist/` to GitHub Pages: it installs a pinned Leaf release, checks its SHA-256, builds, checks that every page, the sitemap and the Open Graph images exist, and deploys. To serve the site somewhere else, such as a custom domain at its root, change the two variables in the workflow (an empty base path for a root).

## Structure

```
config.yml                 Leaf settings (name, description, base path and production URL, post-build cleanup)
.github/workflows/
  pages.yml                the GitHub Pages build and deploy
templates/
  layouts/site.latte       the document: head, header, rail, footer, the one script tag
  partials/                meta, header, rail, footer, the mark
  landing.latte            /
  pages/range.latte        /range/
  pages/live.latte         /live/
  404.latte                the not-found page
public/
  assets/css/site.css      every style, on custom properties; ink and paper are two token sets
  assets/js/               ES modules, loaded per block (see below)
  assets/fonts/            self-hosted WOFF2 subsets and their license
  assets/film/             the Range teaser and its poster
  assets/og/               Open Graph images, one per page
  assets/icons/            SVG and PNG icons; favicon.ico and site.webmanifest sit at the root
```

`site.js` is the only script the page loads. It seals the page's record, then imports a module for each block that declares one with `data-module`, and draws each static figure that declares `data-fig`. A page only downloads the code its blocks use.

| Module | Draws |
|---|---|
| `trace.js` | The shared drawing language: seeded random numbers, step paths, lines, crossings, bands, pointers |
| `figures.js` | Every static figure, each drawn once from its own seed at the element's width |
| `record.js` | The page's hash chain |
| `field.js` | The home hero: the line the visitor draws and the agents that cross it |
| `pace.js`, `hinge.js`, `ledger.js`, `mark.js` | Home: machine speed, the release to paper, the editable record, the closing mark |
| `zones.js`, `clock.js`, `canaries.js`, `film.js` | Range: the four zones, block height, the fifteen canary lines, the teaser |
| `band.js` | Live: the baseline band the reader sets, its alerts and the transaction each one points to |
| `chrome.js` | The header and the record rail, which change ground with the page beneath them |

Every figure is illustrative and says so on the page. The traces come from a seeded generator, so a figure is identical on every load and at every visit; nothing on the site is chain data.

## The record

Each page is a small hash chain, computed in the browser when the page loads. Every section marked `data-block` is a block:

```
hash = SHA-256( parent_hash + "\n" + normalized_text )
```

The first block's parent is 64 zeros. `normalized_text` is the section's readable text with its chrome removed (`.block-meta`, anything `aria-hidden="true"` or `data-volatile`, scripts, styles, canvases), text nodes joined by one space, Unicode NFC, whitespace collapsed and trimmed. Volatile text, such as a live counter or a status line, carries `data-volatile` so that the record covers what a page says rather than what it is doing.

Each block shows the first six hex digits of its hash and its parent's; the rail at the bottom shows the head. On the home page, the record block lets a reader edit any headline: the page recomputes the chain, the edited block and every block after it change, and a restore button puts the original text back.

SHA-256 comes from Web Crypto. Outside a secure context (a `file://` preview or a plain-http address other than localhost) Web Crypto is unavailable, and a small synchronous implementation in `record.js` stands in. The record block on the home page names the engine it used.

To check a hash yourself, open the browser console on any page:

```js
const { chain } = await import(new URL('record.js', document.querySelector('script[src$="/site.js"]').src).href);
const links = await chain([...document.querySelectorAll('[data-block]')]);
copy(links[0].text);   // the first block's normalized text, now on the clipboard
links[0].hash;
```

Then, in a terminal, with the copied text pasted between the quotes:

```sh
printf '%s\n%s' "0000000000000000000000000000000000000000000000000000000000000000" '<paste>' | shasum -a 256
```

Editing any copy in a template changes that block's hash and every hash after it on the next load. Nothing needs updating by hand.

## Motion and access

- Every interaction works by keyboard, mouse and touch: the hero line (arrow keys, then Enter), the canary list, the band threshold (a range input), the alerts (buttons) and the editable record.
- With `prefers-reduced-motion: reduce`, every animation is replaced by a composed still. Animations also pause when they leave the screen or the tab is hidden.
- Canvases and figures are hidden from assistive technology and carry a text equivalent beside them.
- The Range teaser never plays by itself and never starts with sound.
- Signal vermilion appears only on a crossing. It is `#c4340e` on paper and `#ff5a2e` on ink, both above 4.5:1 for text.

## Fonts

The three families are self-hosted as Latin subsets in `public/assets/fonts/`, with metric-matched fallbacks declared in `site.css` so that text does not shift when they load.

- Source Serif 4, by Adobe
- Inter, by The Inter Project Authors
- JetBrains Mono, by The JetBrains Mono Project Authors

All three are licensed under the SIL Open Font License 1.1. The license text and copyright notices are in `public/assets/fonts/OFL.txt`.

## Open Graph images

The images in `public/assets/og/` are screenshots of each page's own hero at 1200 × 630, taken in headless Chrome with reduced motion. If a hero changes, take them again the same way; they are not generated by the build.
