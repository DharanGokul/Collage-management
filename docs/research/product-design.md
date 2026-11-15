# Product design audit: colour, contrast and visual consistency

Date: 2026-11-15. Scope: the React front end (Caesar tokens, Noir dark and Day light themes), all five role views (admin, staff, HOD, student, accountant). The platform super admin console was not scanned.

## 1. Summary

- A programmatic audit of real computed colours found **54 text-contrast failures on the default Burgundy brand** (11 distinct element types) and **401 failures across 16 brand colours** (10 presets plus 6 extremes), in both themes. Token-level checks found 24 more failures across the palette matrix (1 on the default brand).
- After the fixes, text failures are **0 on the default brand and 0 across all 16 primary colours** in both themes (about 4,200 and 10,300 text samples respectively). Token checks: 0 failures.
- The main structural causes were: (a) `color: var(--surface)` used as text on status fills, but `--surface` is a 60% translucent colour in Day mode; (b) white text on gradient panels (event cards, "Up next") whose base colour was the raw brand colour, so pale brands (yellow, white, mint) failed badly; (c) the accent used as a *shape* colour (chart bars, nav indicator, progress) against the Noir page, where Burgundy is only 1.67:1; (d) input and secondary-button borders below 3:1.
- The colour picker now shows measured contrast live and suggests a nearest mid-tone for near-black and very pale choices.
- Visual review found one layout bug that breaks figures (currency numbers wrapping inside the KPI strip), a clipped "WORKSHOP" label, and translucent sticky table columns on mobile. All three fixed.

## 2. Method

Scripts live in the session scratchpad `design/` folder (`lib.cjs`, `scan.cjs`, `probes.cjs`, `run.cjs`, `sum.cjs`, `palsum.cjs`, `shots.cjs`, `presets.cjs`).

- Playwright (Chromium) against a local Vite dev server, signed in as each role with the demo password. Theme set through `data-theme` on `<html>`.
- **Text contrast (WCAG 1.4.3).** Every visible text node and every input placeholder is collected with its computed colour, opacity (multiplied up the ancestor chain), font size and weight. The page is then screenshotted with all text made transparent, and the background under each text box is sampled on a grid of pixels. The worst pixel decides. This handles gradients, translucent "glass" cards and overlays, which a naive ancestor walk cannot. Large text (24px, or 18.66px bold) needs 3:1, everything else 4.5:1. Disabled controls are skipped.
- **Component probes.** A synthetic panel is injected so every variant is measured on every run: five button variants, six badge tones, five `tone-*` text classes, four alerts, inputs, select, textarea, a link, muted text, nav and count badges, and an event card.
- **Non-text contrast (1.4.11).** Input border, secondary and danger button borders, focus outline, progress bars (every tone), chart bars, donut stroke, kind dots, nav indicators, each against a sampled adjacent pixel. Threshold 3:1. Filled primary buttons are reported separately, since their label identifies them.
- **Token checks.** For each palette: on-accent vs accent (4.5), accent-text and secondary-text vs the worst page tone in each theme (4.5), on-secondary vs secondary, focus ring (3), accent and secondary used as UI colours (3), ink and muted ink on the Day tints.
- **Palettes.** Set by calling the app's own `applyPalette` and `resolveSecondary` (imported from `/src/lib/*.ts` in the dev server), so the audit exercises the real derivation. Palettes: the ten `PRESET_COLORS` plus #facc15, #ffffff, #111111, #a7f3d0, #6b7280, #e11d28 (#1d4ed8 is already a preset). The requested #6d001a and #1d4ed8 are presets; #e11d28 stands in for the requested bright red.
- Screens: 5 roles, 3 to 8 routes each at 1440px for the default brand; the role home page, plus events for student and staff, for every other palette.
- **Visual review.** Screenshots at 1440 and 375 for every role in both themes, plus DOM metrics (horizontal overflow, distinct font sizes, tap-target size).

Limits of this audit. It samples what is rendered on the seeded demo data, not every state (modals, error and empty states were reviewed from code and screenshots only, not programmatically scanned). The Day-theme page background is a gradient; the token checks use #e6e9e7 as a representative worst tone, and the pixel scan is the authority. Pre-fix non-text numbers had a sampling artefact (the focus ring of the first input was captured as "background"), so the non-text before-numbers below are given analytically or as approximate. The Marble/Day palette in section 4 uses luminance maths I computed; it was not user-tested.

## 3. Colour audit results

### 3.1 Before and after counts

| Check | Before | After |
|---|---|---|
| Text failures, default Burgundy, all roles and routes, both themes | 54 (11 distinct) | 0 |
| Text failures, 16 primary colours, both themes | 401 | 0 |
| Token failures, 16 primary colours | 24 | 0 |
| Token failures, default | 1 (accent as shape on Noir, 1.67:1) | 0 |
| Non-text failures that are real (not sampling noise), default brand | input border, secondary-button border, chart bars, donut, nav indicators, progress | see 3.4 |

### 3.2 Failing pairs before the fixes (default Burgundy, both themes)

| Element (selector) | Where | Measured | Needed |
|---|---|---|---|
| `.mini-day.out` "26" | calendar mini month, other-month days (opacity 0.6) | 2.49 Day, 3.50 Night | 4.5 |
| `.mark-P.on` "P" | staff attendance, present toggle, Day mode | 3.37 | 4.5 |
| `.ev` text on status fill | calendar events, Day mode | 4.06 | 4.5 |
| `::placeholder` in `.input` | search and note fields, Night | 4.03 | 4.5 |
| `::placeholder` in `.input` | search and note fields, Day | 4.42 to 4.49 | 4.5 |

Cause of rows 2 and 3: `color: var(--surface)`. In Day mode `--surface` is `rgb(252 252 250 / 0.6)`, so the text was 60% opaque. Placeholder colour was the browser default.

### 3.3 Failing pairs before the fixes (other brands; worst ratios)

| Brand | Text fails Night / Day | Worst measured | Element |
|---|---|---|---|
| #6d001a, #000000, #1f3a5f, #0b5d4b, #4b1d6b, #8c1c13, #2f4f4f, #5a3e2b, #1d4ed8, #6b7280 | 1 to 2 each (placeholder, avatar, badge-primary, tabs) | 4.03 | placeholder; avatar 4.12; badge-primary 4.25 |
| #7a4b00 | 9 / 1 | 4.03 | secondary-text on secondary-soft |
| #e11d28 | 9 / 21 | 3.93 | "Resolve" button label, others |
| #111111 | 1 / 8 | 4.03 | avatar, tab text |
| #facc15 | 42 / 42 | 1.53 to 2.26 | `.spec`, `.pill`, `.upnext-*`, `.ev-*` on gradient |
| #a7f3d0 | 55 / 55 | 1.28 to 2.03 | same |
| #ffffff | 62 / 70 | 1.00 to 1.74 | same (white on a white panel) |

Event cards and the "Up next" panel are the main failure surface: white text sat on a gradient built from the raw brand colour (`--accent-pressed` is only 32% darker, still pale for yellow).

Token failures before (palette matrix, 24): the accent or secondary used as a shape colour on the Noir page (burgundy 1.67, navy 1.83, purple 1.69, #111111 1.11, #000000 1.00 and others), on the Day page for pale brands (#facc15 1.49, #ffffff 1.03, #a7f3d0 1.25), and muted ink on a Day tint (4.33 to 4.41 for #1f3a5f, #4b1d6b, #1d4ed8). Note these were measured against `--surface` (black in Night), the after-run uses #131313 and #e6e9e7, slightly different references.

### 3.4 Non-text contrast

Analytic numbers for the border tokens (exact):

| Token | Before | After |
|---|---|---|
| Night `--control-border` on #131313 | #6b6b6b, 3.49:1 | #8a8a8a, 5.38:1 |
| Day `--control-border` on white | #8d9693, 3.04:1 | #6f7875, 4.55:1 |
| Day `--control-border` on page tone #ecefed | 2.62:1 | 3.93:1 |

Accent as a shape on Noir (default brand): 1.67:1 before. Chart bars, donut stroke, tab underline, and the nav indicator now use `--accent-ui` (lightened to at least 3.2:1 against #131313 on Night, darkened to 3.2:1 against #e6e9e7 on Day). The nav "blob" keeps its fill (so the icon colour still works) and gets a 1.5px `--accent-ui` inset ring.

Remaining after the last full run (`after-pal2.json`): 3 measured failures, all the *hover* border of `.btn-secondary` on pale brands in Day mode (#facc15 1.39, #ffffff 1.11, #a7f3d0 1.16): the hover rule used the raw accent as the border colour. Fixed afterwards by using `--accent-ui` (see 3.5 for the confirming run).

Kind dots inside event panels and badges measure 1.3 to 1.6 but are always paired with the kind's text label, so they are redundant under 1.4.1 and not counted.

### 3.5 Final confirmation run

See the section "Final run" appended at the end of this file (filled from `final-pal.json`).

### 3.6 Preset palette measurements

Luminance L, contrast with white text, with black text, and the colour as a shape on the Day page (#e6e9e7) and the Night page (#131313):

| Preset | L | White text | Black text | On Day | On Night |
|---|---|---|---|---|---|
| #6d001a (default) | 0.033 | 12.61 | 1.67 | 10.31 | 1.47 |
| #000000 | 0.000 | 21.00 | 1.00 | 17.17 | 1.13 |
| #1f3a5f | 0.041 | 11.48 | 1.83 | 9.39 | 1.62 |
| #0b5d4b | 0.084 | 7.83 | 2.68 | 6.40 | 2.37 |
| #7a4b00 | 0.092 | 7.41 | 2.83 | 6.06 | 2.51 |
| #4b1d6b | 0.034 | 12.45 | 1.69 | 10.18 | 1.49 |
| #8c1c13 | 0.065 | 9.17 | 2.29 | 7.50 | 2.03 |
| #2f4f4f | 0.068 | 8.93 | 2.35 | 7.30 | 2.08 |
| #5a3e2b | 0.058 | 9.73 | 2.16 | 7.96 | 1.91 |
| #1d4ed8 | 0.107 | 6.70 | 3.13 | 5.48 | 2.77 |
| #facc15 | 0.636 | 1.53 | 13.71 | 1.25 | 12.13 |
| #ffffff | 1.000 | 1.00 | 21.00 | 1.22 | 18.58 |
| #111111 | 0.006 | 18.88 | 1.11 | 15.44 | 1.02 |
| #a7f3d0 | 0.769 | 1.28 | 16.37 | 1.05 | 14.49 |
| #6b7280 | 0.167 | 4.83 | 4.34 | 3.95 | 3.84 |
| #e11d28 | 0.170 | 4.76 | 4.41 | 3.90 | 3.90 |

The existing `contrastText` rule (white if at least 4.5:1, else black) always lands at 4.58:1 or better for any colour, because the white and black ratios cross near 4.58. So the on-accent button label can never fail; the failures were everywhere else.

## 4. Colour research

Network access worked for WebSearch. WebFetch to w3.org failed (host not allowed in this session), so I could not read primary pages in full; claims below rest on search-result summaries and are labelled. Anything beyond that is marked "from memory, unverified".

### Standards

- **WCAG 1.4.3 Contrast (Minimum).** 4.5:1 for normal text; 3:1 for large text, defined as 18pt, or 14pt bold (about 24px and 18.66px). Logotypes are exempt. Source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (via search summary; page not opened).
- **WCAG 1.4.11 Non-text Contrast.** 3:1 for UI components (such as form field borders) and meaningful graphics against adjacent colours; states such as focus and selected too. W3C's example is a #787878 border on white at about 3:1. Source: https://w3c.github.io/wcag21/understanding/non-text-contrast (WCAG 2.1 page; I did not find a 2.2-specific page confirming the wording is unchanged, so "unchanged in 2.2" is from memory, unverified).
- **WCAG 1.4.1 Use of Color (Level A).** Colour must not be the only means of conveying information; colour coding is fine if redundant. Lightness differences count as a distinction only if contrast requirements are met. Source: https://w3.org/WAI/WCAG22/Understanding/use-of-color.html and MDN https://developer.mozilla.org/docs/Web/Accessibility/Understanding_WCAG/Perceivable/Use_of_color (search summaries).

### Colour-blind safe palettes

- Okabe-Ito eight-colour palette (orange #E69F00, sky blue #56B4E9, bluish green #009E73, yellow #F0E442, blue #0072B2, vermillion #D55E00, reddish purple #CC79A7, black) is widely recommended for categorical data. Source: https://cran.r-project.org/web/packages/ggokabeito/readme/README.html. Secondary sources only; I did not read the original paper.
- Datawrapper: palette choice is not enough; use labels, symbols and patterns, and avoid pairing green with pink or red with green. https://www.datawrapper.de/blog/colorblindness-part2
- Prevalence about 8% of men and 0.5% of women (red-green CVD) appears across blogs; one attributes it to a 2012 meta-analysis (Birch, JOSA A), which I could not verify. https://www.insightsoftware.com/blog/visualizing-for-the-color-blind/ . Other sources quote 4 to 8% for men, so treat the exact figure as approximate.

### Dark mode

- Material's dark theme guidance recommends a dark grey surface (#121212) rather than pure black, and desaturated accents because saturated colours fail 4.5:1 against dark surfaces. https://m2.material.io/design/color/dark-theme (search summary). Caveat: one blog attributes a "15.8:1" figure to Material; I found no Material page saying so, so ignore it.
- This app's Noir uses pure black (#000) for the page and #131313 for cards. That is a deliberate Caesar choice (and the theme-color meta); the audit shows it passes, so I left it. The Material guidance is a trade-off against OLED benefits and halation, not a WCAG requirement (from memory, unverified).

### White-label brand colour

- Radix Colors scales are built so white text works on step 9 and are not meant to be customised; custom brands should be added as separate scales. https://www.radix-ui.com/docs/colors/palette-composition/composing-a-palette
- Common approach: take one brand hex, generate the rest, choose on-colour text by luminance (or CSS `contrast-color()`), verify the pair against WCAG, inject as CSS variables. https://colorfyi.com/blog/react-dynamic-theming and https://smashingmagazine.com/2026/05/building-self-correcting-color-systems-contrast-color (summaries only). Blog-level evidence, not a standard.
- This product already does the right thing structurally (derive on-accent by luminance); the gap was that every other derived role assumed the brand was a deep colour.

### Colour psychology (be sceptical)

- Not supported: the claim that red impairs exam or test performance. A 2020 meta-analysis of 67 effect sizes found no evidential value after correcting for publication bias; replications failed. https://link.springer.com/article/10.3758/s13423-020-01772-1 (summary). Colour-in-context theory (Elliot and Maier) says effects depend on context, and is less directly tested.
- Not found: any good evidence that a particular brand hue improves learning, trust in a finance product or ERP adoption. I found none and make no such claim. Dashboard guidance from vendors (insightsoftware and others) is practitioner advice, not evidence: use brand colour as an accent, keep a small palette, reserve red and green for meaning, pair colour with labels or icons. https://www.insightsoftware.com/blog/5-design-tips-to-enhance-your-dashboard-colors/ . I did not find the NN/g dashboard colour article's text.
- Practical stance: choose for legibility, hierarchy and the college's own identity, not for psychological effects.

### India caveat

Blog-level sources agree that saffron, white, green and red carry strong religious, national and festive associations, with regional variation (white as purity and as mourning; red as auspicious in some regions). One source notes saffron has political weight today. https://www.gktoday.in/colour-symbolism-in-indian-culture-festivals-and-national-identity/ and https://blog.logrocket.com/ux-design/color-culture-how-color-language-changes-background . Weak sources. Implication: do not hardwire meaning to a hue; the college picks its colour, so status meaning must come from icon and text, not colour (already the rule below).

## 5. Recommendations

### 5.1 Preset palette

Presets as shipped are all deep colours and all work (white text 6.7 to 21:1) now that the app derives lighter variants for Night. Suggestions:

1. Drop **#000000** (and treat #111111 the same): it has no hue identity and is 1.1:1 against the Noir page. It is also what `SuperAdmin.tsx` uses as the default for new tenants (`PRESET_COLORS[1]`); change that index when presets change. Not changed here.
2. Add a "same in both themes" row so a college can choose a look that does not shift. Computed luminance-banded mid-tones (white text 5.2 to 5.3:1, 3.5:1 on Night, 4.3:1 on Day): Crimson #cf2541, Terracotta #b04f2c, Amber-brown #9a5f11, Olive #5f7422, Forest #1a7b4b, Teal #157875, Ocean #1773a1, Cobalt #2c66da, Indigo #5e5ed0, Violet #8a4fc4, Plum #b03ba6, Slate #5a6d87. These are computed by script, not designer-reviewed or colour-blind simulated.
3. Keep the default Burgundy; it is the strongest identity colour and the tests pass.

### 5.2 Picker rules (implemented as a readout; nothing blocks)

- Always show: button text colour and ratio (needs 4.5:1), colour on the Day page and Night page (shapes need 3:1).
- Warn (not block) when luminance is under 0.015 or over 0.5, and offer the nearest mid-tone (same hue and saturation, lightness shifted). Blocking would remove a college's right to use its own logo colour; the app can adapt instead.
- Note "adjusted automatically" for everything else outside the 0.12 to 0.183 luminance band, with no nudge, since that band excludes every deep preset including the default.
- Future: a one-click "Use suggested" is there for the extremes only; consider also warning when primary and custom secondary are closer than about 1.5:1 to each other.

### 5.3 Secondary colour derivation

Current: analogous hue shift (+32 degrees) with saturation floor 0.35 and lightness clamped 0.30 to 0.45. For the default it yields #aa3c0e, a vivid orange beside burgundy; in screenshots the "Up next" art block is noticeably louder than the brand. Recommendations: cap secondary chroma at about 70% of the primary's; derive `--secondary-text` and `--secondary-ui` the same way as the accent (done in this change); consider defaulting to the *mono* harmony for colleges that have not chosen, which is calmer. Unmeasured: no user test of preference.

### 5.4 Semantic colour rules

- Never colour alone: every status uses a word or glyph with the colour (badges, "P/L/A" letters, kind codes, stepper states). Keep it, and add an icon to success and error alerts and to alert-style badges where they only have a tint.
- Reserve red, amber, green and blue for meaning; the brand colour must never be used for a status, and status colours are not derived from the brand.
- Charts: do not rely on hue difference between the accent and secondary bars; add labels (already on top of bars) and, for multi-series charts, direct labels or patterns.
- Text on a status fill uses `--on-ink` (black in Night, white in Day), never `--surface`.
- Never use opacity to de-emphasise text; use weight or the muted ink token (fixed on `.mini-day.out`).

## 6. Visual consistency findings

Severity: High (breaks content), Medium (noticeable), Low (polish).

| # | Sev | Where | Finding | Fix | Status |
|---|---|---|---|---|---|
| 1 | High | `.kpi-value` (`index.css`), dashboard KPI strip, accountant home | `overflow-wrap: anywhere` split figures mid-number ("₹18,20,0 / 00") | `white-space: nowrap`, wider min column (200px) | Fixed |
| 2 | High | `.table th.right:last-child` etc., mobile tables (admin students) | Sticky action column used translucent Day-mode `--surface-raised`; scrolled cells showed through and headers overlapped | Opaque `--surface-solid`, also on hover | Fixed |
| 3 | Medium | `.upnext-art .slab-word` | 60px vertical word "WORKSHOP" clipped in the 250px art block at 1440 | 42px | Fixed |
| 4 | Medium | `.upnext`, `.ev-panel` | White text on raw brand gradient failed for pale brands | `--accent-deep`, `--secondary-deep` (8:1 vs white) | Fixed |
| 5 | Medium | `prefers-reduced-motion` block | Only shortened durations; infinite spinners would strobe at 0.01ms | Iteration count 1; spinners slowed to 2s instead of frozen | Fixed |
| 6 | Medium | Type scale | 18 distinct font sizes on one page including fractional 12.5, 13.68, 14.4, 15.96, 16.2 (from `clamp` and em); no scale tokens | Define 6 to 8 type tokens and use them. Not done | Open |
| 7 | Medium | Radii | Card radius 22px Night vs 28px Day, buttons 12px, pills 999px; 3 radii per theme is fine, but Day vs Night differ by design | Document as intentional; consider one `--radius-card` | Open |
| 8 | Medium | Secondary colour | Orange derived from burgundy is louder than the brand on the "Up next" art | See 5.3 | Open |
| 9 | Low | Tap targets | 8 interactive elements under 32px on admin home (5 on mobile); student 1, accountant 2 | Raise icon buttons to 44px hit area | Open |
| 10 | Low | Hero title | Night is uppercase 900 weight at 52px, Day sentence case 600; a good theme personality, but number-heavy headings differ | Keep; note for brand guide | Info |
| 11 | Low | Mobile tables | Wide tables scroll horizontally inside a `.table-wrap` (students 502px in 375px); no scroll affordance beyond the sticky column shadow | Card layout for rows below 600px, or a fade edge | Open |
| 12 | Low | Empty and error states | Reviewed in code only (`Empty` component, `.alert`); consistent icon, title and text. Not screenshotted for every route | Spot-check | Open |
| 13 | Low | Motion | GSAP entrance, blob and counter animations all check `prefersReducedMotion()`; hover "wave" on buttons is hidden in reduced motion. Entrance stagger on every page is mildly busy on dense tables | Disable stagger on table pages | Info |

Page-level overflow: none. No horizontal page scroll at 375 or 1440 on any role.

## 7. Code changes made

- `src/lib/theme.ts`: `applyPalette` now also sets `--accent-ui-dark/light`, `--secondary-ui-dark/light` (3.2:1 shape colours per theme) and `--accent-deep`, `--secondary-deep` (8:1 vs white); text-colour targets raised (light 4.5 to 6, dark 7 to 8) because accent text also sits on tinted badges.
- `src/lib/color.ts`: added `relLuminance`, `contrastOf`, `brandReport` (button text ratio, ratios on each page, extreme flag, nearest mid-tone suggestion).
- `src/components/ColorPicker.tsx`: live `ContrastNote` with measured ratios and a "use suggested" button for near-black and very pale colours.
- `src/index.css`:
  - Tokens: `--accent-ui`, `--secondary-ui`, `--on-ink`, `--placeholder`, defaults for the new vars; stronger `--control-border` in both themes; darker Day `--ink-muted` (#59625f to #4f5855).
  - `color: var(--surface)` replaced by `--on-ink` on `.mark-*.on`, `.ev`, `.span-bar`, `.now-tag`, `.toast`, `.rail-tip`.
  - Placeholder styling; `.mini-day.out` no longer uses opacity.
  - Charts, donut, tab underline, `tone-bg-ink` use the UI colours; nav blobs and primary buttons get an inset UI-colour ring; secondary-button hover border uses `--accent-ui`.
  - `.upnext` and `.ev-panel` gradients built from `--accent-deep`; small text on them raised to 0.82 to 0.88 alpha.
  - KPI nowrap, wider KPI columns, smaller up-next art word, opaque sticky table column, reduced-motion spinner handling, `.cpick-check` styles.

## 8. Open items

- Presets: drop black, add the mid-tone row, update `SuperAdmin.tsx` default index (section 5.1).
- Type-scale and radius tokens (findings 6 and 7); tap target sizes (9); mobile table cards (11).
- Secondary derivation rework (5.3) and a designer review of the mid-tone presets plus a colour-vision-deficiency simulation of the status colours and charts (not done).
- The audit samples seeded demo data; modals, toasts in transit, and the super admin console were not scanned.
- Primary sources (w3.org) could not be fetched; re-check the WCAG wording at the pages cited.
- `npx tsc -b`, `npx oxlint` (zero warnings) and `npm test` (35 tests) pass at the time of writing.

## Final run

Last full run, 16 brand colours x both themes, after all fixes including the secondary-button hover border (about 10,300 text samples): **0 text failures, 0 token failures, 0 measurable non-text failures**. The script's raw non-text count of 82 contains only unmeasurable samples (ratio about 1.0, where the sampled point falls on the same fill, for example a full-width bar) and the filled primary button, which is excluded because its label identifies it. Unlike the earlier runs, the non-text sampling here was corrected (card-edge background, ring sampled above the input).
