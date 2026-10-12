# 亲称 · 家庭相簿

**Live album:** https://zandaniji.github.io/family-album-site/

A standalone, bilingual family album for exploring Chinese kinship terms one relationship at a time. No app framework, build step or database is required. Chinese is the primary language, with English directly beneath every label, control, result and explanation.

The portraits are AI-generated illustrations of roles. They do not depict real people or represent a stored family tree. Third-party code is credited in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Entry point |
| `album-interactive.js` | Album behaviour: choices, route, result spread, notes and questions |
| `relationship-view.js` | Fitted, zoomable diagrams for the route and the result tree |
| `paper-turn.js` | Paper geometry, fold shadows and pointer mapping for page turns |
| `styles.css` | Layout, paper treatment and typography |
| `vendor/kinship.js` | Locally maintained kinship engine (see below) |
| `vendor/page-flip.browser.js` | Patched St.PageFlip (corner lift, eased turns, warm fold shadows) |
| `album/` | Open-album photograph, portrait frame and paper grain |
| `avatars/` | Ten illustrative role portraits |

Chinese text is set in 京華老宋体 (KingHwa OldSong), and the spoken notes in 霞鹜文楷 (LXGW WenKai, OFL). Both load from jsDelivr as complete, range-split web fonts (the open-source 中文网字计划 packages), so every character has a glyph. Offline, whole words fall back to one system serif instead of mixing typefaces. English and pinyin use Libre Baskerville from Google Fonts, or Georgia offline.

The album scales with the window up to 1,760 px wide (just above the 1,672 px album photograph), then stays centred, so the turning pages always register with the photo. On desktop the book keeps a margin of room around it (2.5% of the window width on each side, 8–40 px). Text inside the album is sized in container units relative to the album, so type keeps its proportion to the pages on any screen size or browser zoom. Each size reads as its pixel size when the album is 1,368 px wide, as at a 1440×900 window, with an 11 px floor. The original `album.js` prototype, unused portraits and frames, generated `qa-*.png` screenshots and delivery archives are kept locally and excluded from Git.

## Design tokens

New text and colour should use the tokens at the top of `styles.css`, not raw values.

- **Type:** seven steps, given at a 1440 px window (album 1,368 px wide), scaling with the album and never below 11 px. `--type-caption` 11 (English captions), `--type-label` 13, `--type-body` 15, `--type-title` 18, `--type-heading` 24, `--type-display-sm` 32, `--type-display` 44.
- **Ink on paper:** `--ink` for main text (7.2:1 on the paper), `--ink-soft` for secondary text such as English, pinyin and labels (5.3:1), `--ink-faint` for disabled and decorative marks only, `--ink-strong` for hover. `--color-spoken` is the blue-black of the spoken notes, and `--pencil` (5.3:1) the graphite of pencilled hints.
- **Latin in Chinese copy:** Latin letters inside Chinese text, such as “TA”, are set in Libre Baskerville like the English lines.
- **Tracking:** `--track-latin` 0.02em, `--track-cjk` 0.06em, `--track-loose` 0.08em, `--track-label` 0.14em.
- **Controls:** every album button carries the `ink-control` class: an ink label with a hand-drawn stroke under the Chinese text. The stroke previews lightly on hover and stays in full ink when selected (`aria-pressed="true"`). Focus is a dashed outline, and disabled controls use `--ink-faint`. New controls should use this class rather than their own hover, selected or disabled styles.
- **Spacing:** `--space-1` to `--space-7` (4, 8, 12, 16, 24, 32, 48 px at the reference album width), scaling with the album like the type.
- **Page grid:** the "Page grid" block at the end of `styles.css` is the one place that positions page content.
  - **Margins:** `--page-top` and `--page-bottom` are 7%, `--page-outer` is 6% and `--page-inner` (the spine side) is 5%.
  - **Lines:** the spread shares one top line (identity choice, page headings, zoom controls) and one bottom line (footer actions and the page-turn tabs).
  - **Page-turn tabs:** **揭晓称呼** sits on the bottom line at the right page's outer corner, and **返回选人** mirrors it at the left page's corner, first in the footer, on the result spread. Both are set at `--type-title`, with an inked dog-ear in the outer margin so the label aligns with the grid.
  - **Photo edges:** text aligned with the choice photos uses `--photo-inset`.
  - **Selected person:** marked by the shared ink stroke under the photo's caption. The name readout is announced to screen readers only.
  - **Photo size:** a short route's portraits on the left page are drawn at the same size as the choice photos on the right. If the left page is short of height, the choices shrink to match.
  - **Choices:** photos tilt but their captions stay level, and they fill the grid in reading order, so a hidden spouse leaves no gap.
  - **Connectors:** ink lines run from edge to edge, below a caption, so they never cross a photo or a name. In the result tree, siblings and spouses are labelled (手足 / Siblings, 夫妻 / Spouses) at the size of the names.

## Using the album

**Exploring.** Choose or drag a relationship photo from the right page to the left. A copy joins the route on the left page; the original stays on the right, and the heading says whose relative you are choosing next, for example “爸爸的……”.
- Click an earlier photo to continue from that person.
- Drag a copied photo back to the right page to remove that step and everything after it.
- **撤销 / Undo** restores the previous edit. **重新开始 / Start over** clears the route, answers and history.
- A pencilled hint beside “我” explains the first step until a photo is placed.
- When a long route or tree has to shrink to fit, − / + zoom appears: drag empty diagram space to pan, and use **全览 / View all** to refit. While everything is drawn at full size, zoom is not offered.
- **我是 / I am…** (unspecified, male or female) sits above “我”. It filters spouse choices and settles some results.

**Revealing.** **揭晓称呼 / Reveal term**, the tab at the bottom-right page corner, turns to the result spread. The first time, the term inks into the paper once the page has turned (not with reduced motion).
- The left page shows a generation tree: elders above, siblings and spouses side by side. Ambiguous roles are not merged into one person.
- The right page shows:
  - **书面称谓 / On paper:** the written term, in the album's ink, with upright pinyin tight under the characters and an italic English gloss set apart below. The row label lines up with the term itself. Phrase-like alternatives, such as 继母的父亲, follow on an “或 · or” line.
  - **口语常称 / Spoken:** what people usually say, as a handwritten blue-black note in 「」 with its own pinyin. For example: 公公 → 「爸爸」, 外祖父 → 「外公」「姥爷」, 堂兄 → 「堂哥」.
- When the answer depends on a fact, the page asks or says so:
  - **TA 比我 / Relative to me** appears when the person's age compared with you decides the term.
  - **我是 / I am…** appears on the result page when your own gender decides it. It stays visible once answered.
  - Notes name any other missing fact, such as “她是否是你的母亲” or “TA 与你父亲的长幼”.
- **Relatives with no dedicated term** are described through the relative who connects you, for example 嫂子的哥哥. The spoken suggestion follows a rule of thumb: call them what the connecting relative does, then adjust for generation and age.
  - Same generation: 「哥」「大哥」 / 「姐」「大姐」 if older, by name if younger.
  - Younger generation: by name.
  - Older generation: 「伯伯」「叔叔」 / 「阿姨」.
  - A spouse's relatives (妻子的伯父) take the term your spouse uses.
- **返回选人 / Back to choices**, the keyboard arrows and dragging the paper all move between the spreads. Changing the route removes the stale result.

## Kinship engine

`vendor/kinship.js` resolves a route with explicit simplifying assumptions: siblings share parents, and marriage is monogamous. It keeps ambiguity visible rather than guessing, and returns `exact`, `ambiguous` or `descriptive` results.
- **Endpoint age:** the age answer applies only to the final person compared with “我”, never to someone in the middle of the route.
- **Terms shown:** the album asks for written (reference) terms. Each rule's reference and address lists supply the written and spoken rows.
- **Limits:** work is bounded at 64 steps and 1,024 rewrite states. Beyond that the album shows a recoverable “暂无法确定” and asks you to shorten the route.
- **Ancestors:** 外曾祖父 (mother's paternal grandfather) is distinguished from 曾外祖父 (father's maternal grandfather) and 外曾外祖父.
- **Grandparents' spouses:** 祖父的妻子 → 祖母 / 继祖母.
- **A parent's spouse further along the route:** the stepparent ambiguity carries forward, so 父亲的妻子的父亲 → 外祖父 / 继母的父亲.
- **Siblings' and nieces'/nephews' in-laws:** 亲家公 / 亲家母 for a sibling's parents-in-law; 侄孙, 侄外孙, 外甥孙, 外甥外孙; 侄媳, 侄女婿, 外甥媳妇, 外甥女婿; 内侄 / 内侄女.
- **A parent's cousins:** 堂伯 / 堂叔, 堂姑, 堂舅, 堂姨 on the all-male line through the father's father; 表伯 / 表叔, 表姑, 表舅, 表姨 through any woman; and their spouses (堂舅母, 表姑父 …). A father's male cousin is 伯 or 叔 by age against the father, so both are shown with that fact named. Spoken forms put the everyday word first: 堂舅 → 「舅舅」「堂舅」.
- **Second cousins** (a parent's cousin's child): 从堂兄 / 从堂姐 … on the all-male line, said aloud as 「堂哥」「堂姐」; 堂姑表, 堂舅表 and 堂姨表 for the children of 堂姑, 堂舅 and 堂姨; and 远房表 for every other line through a woman, said aloud as 「表哥」「表姐」. Age against you picks 哥/弟 or 姐/妹, so the album asks TA 比我.
- **No dedicated term:** the connecting-relative fallback described above.

The engine was originally copied from a separate kinship prototype, kept outside this repository, and has since diverged. Do not swap that copy in; merge rule changes deliberately and run both test suites. The approach to normalising routes was checked against [mumuy/relationship](https://github.com/mumuy/relationship) and its [algorithm notes](https://github.com/mumuy/relationship/wiki/算法实现); no third-party source is vendored.

## Preview

From this folder:

```powershell
py -m http.server 8080
```

Then open http://127.0.0.1:8080/. For a quick look, `index.html` also opens directly in Chrome; use the HTTP preview for browser QA.

## Tests

**Engine.**

```powershell
node --test kinship-review.test.cjs kinship-findings.test.cjs
```

- `kinship-review.test.cjs` guards endpoint age, intermediate identity ambiguity, spouse-side seniority, reverse terms and duplicate rewrite states.
- `kinship-findings.test.cjs` guards the corrected and added terms, the spoken forms and the connecting-relative fallback.
- The prototype's 127-case suite should also pass against this copy. Copy `vendor/kinship.js` next to that folder's `tests.js` and `run-tests.js` in a scratch directory, then run `node run-tests.js`.

**Browser.** These need Chrome at its default Windows location.

```powershell
node qa-browser.mjs --desktop-only
```

- The run checks 1440×900 and 1024×768: photo transfer, headings, branch edits, Undo, zoom and pan, fitted 12- and 20-person routes, generation trees, resizing, keyboard navigation, paper turns and reduced motion.
- It also checks the written and spoken terms, the identity and age questions on the result page, specific notes, the connecting-relative advice, and that each result fits its page.
- A timer-throttled check makes sure a photo click straight after panning is never swallowed.
- Add `--screenshot-desktop` to save `qa-*.png` captures.
- Without `--desktop-only`, the run adds a 390×844 phone check. Its touch-drag release has a known timeout, so the full suite is not expected to pass until mobile work resumes; `--mobile-only` keeps the reproduction.

## Known limitations and next steps

- **Mobile:** deferred. The result page overflows at phone width, and touch-drag release times out.
- **Offline type:** the album fonts need an internet connection. Self-hosting a 京華老宋体 subset built from every string the album can show would make it work fully offline.
- **Contrast:** the small English captions still need a contrast pass.
- **Unanswerable facts:** some missing facts are explained but not yet answerable on the page, for example whether 爷爷的儿子 is 爸爸.
- **Spoken data:** spoken forms come from the engine's address lists, so some terms have none, for example 大舅子.
- **No saving or sharing:** the route lives in memory only. Reloading starts over, and there is no shareable link.
- **Portraits:** the portrait PNGs are large and worth optimising, keeping their sepia look.
