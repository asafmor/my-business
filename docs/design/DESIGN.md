# Design system

The visual language for My Business. Dense and precise on desktop; rebuilt around
touch and task completion on mobile.

The canvas is the picture, this file is the words, `src/app/globals.css` is the
truth. Where they disagree, the CSS wins and this file is out of date.

- **Canvas** — https://claude.ai/artifact/1zPinHjZbFhDo8YhxFeT1N
- **Artboard sources** — `docs/design/canvas/*.dc.html` (open any one in a browser)
- **Tokens** — `src/app/globals.css`, the `:root` block

## The one idea

Nothing is separated by a hard border; everything is separated by light. A tonal
step, a 7%-ink inset hairline, or a shadow. **A `1px solid` line is a bug.**

This is what makes the UI feel tactile at high density. Borders at this row height
turn a table into a spreadsheet grid; shadows and tone keep it readable.

## Colour

Mostly white, calm black and grey. Purple carries interaction, navy carries
information, cream flags human attention. All three are rare.

| Token             | Value                | Use                                                |
| ----------------- | -------------------- | -------------------------------------------------- |
| `--canvas`        | `#f0f0f3`            | the page behind everything                         |
| `--surface`       | `#ffffff`            | any raised card or row                             |
| `--surface-muted` | `#f6f6f8`            | recessed wells, table headers                      |
| `--surface-sunk`  | `#eaeaee`            | segmented-control tracks, progress rails           |
| `--ink`           | `#15151c`            | primary text                                       |
| `--ink-muted`     | `#55555f`            | secondary text, dates                              |
| `--ink-faint`     | `#8b8b95`            | labels, placeholders, em dashes                    |
| `--line`          | `rgb(21 21 28 / 7%)` | hairlines — **only** as an inset box-shadow        |
| `--accent`        | `#4a3a80`            | selection, focus, primary action, all charts       |
| `--accent-strong` | `#3b2e68`            | pressed primary                                    |
| `--accent-soft`   | `#edeaf7`            | active filter chips, selected wash                 |
| `--info`          | `#2c4177`            | links, processing state — **never a chart series** |
| `--warning`       | `#77622f`            | on cream; "a human must look at this"              |
| `--warning-soft`  | `#faf3e2`            | the cream wash itself                              |
| `--success`       | `#2f6b51`            | ready, money in                                    |
| `--danger`        | `#9d4436`            | failed, money out, destructive                     |

**Cream does exactly one job:** something needs a person's judgment. If cream
appears anywhere that isn't a review prompt, it's a bug.

### Charts are single-hue, always

`--accent` and `--info` are 1.7 ΔE apart for a deuteranope — indistinguishable.
They may never be two series in one plot. Every chart in this system is one hue,
and polarity is carried by **position around a zero line**, not by colour.

A second series means: small multiples, a table view, or a different chart.

## Type

Archivo for text, IBM Plex Mono for numbers, wired up in `layout.tsx` via
`next/font` as `--font-sans` and `--font-mono`.

| Role             | Spec                                            |
| ---------------- | ----------------------------------------------- |
| Page title       | 23px / 700 / -0.025em                           |
| Section heading  | 14px / 700 / -0.01em                            |
| Body, table cell | 13px / 400–600                                  |
| Secondary        | 11.5px / `--ink-muted`                          |
| Label            | 10px / 600 / 0.07em / uppercase / `--ink-faint` |
| Metric           | 23–33px / 600 / mono / -0.02em                  |

**Money is monospaced.** Always `.num` (or `[data-numeric]`), always tabular,
always right-aligned, decimals one step lighter than the integer part. A column
of totals must scan as a column.

## Elevation means something

Five steps, each with a job. Don't pick one because it looks nice.

| Token            | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| `--well`         | recessed — inputs, tracks, the page's own wells                |
| `--e1` + `--lip` | a resting card or row                                          |
| `--e2`           | under the cursor — hover, or a card that is itself interactive |
| `--e3`           | floating above the page — menus, popovers, the selection bar   |
| `--e4`           | a dialog, over a dimmed page                                   |

`--lip` (a 1px inner white top highlight) goes on every raised surface. It is what
reads as "dimensional" rather than "drop-shadowed".

## Geometry and density

Radii 5 / 8 / 12 / 14px (`--radius-xs`, `--radius-sm`, `--radius`, and 14px for
section cards). Spacing steps 2 · 4 · 8 · 12 · 16.

| Fixed size                    | Value        |
| ----------------------------- | ------------ |
| Table row                     | 38px         |
| Control (button, input, chip) | 28–30px      |
| Desktop sidebar               | 212px        |
| Mobile list row               | 72px         |
| Mobile tap target             | 44px minimum |

Density is the feature. A 38px row that stays readable beats a 56px row that looks
calm in a screenshot and exhausts you by noon.

## Controls

Quiet until touched. Flat at rest, lift on hover, sink when pressed.

| State    | Treatment                                                                   |
| -------- | --------------------------------------------------------------------------- |
| Rest     | `--e1` + `--lip` (secondary); gradient + coloured shadow (primary)          |
| Hover    | step up one elevation                                                       |
| Pressed  | `--well`, `translateY(1px)`                                                 |
| Focus    | `0 0 0 2px #fff, 0 0 0 4.5px rgb(74 58 128 / 50%)` — a ring, not an outline |
| Disabled | flat `--surface-muted`, no shadow, `--ink-faint`                            |
| Selected | `--accent-soft` wash + 1px accent ring                                      |
| Loading  | spinner replaces the leading icon; label changes to the verb in progress    |

Inputs are **wells**, not boxes. Validation speaks in a sentence under the field —
a red ring alone is not a message.

Buttons and form controls get the ring. Everything else keeps the global
`:focus-visible` outline in `--accent` as the accessibility catch-all — a ring
can be clipped by an ancestor's `overflow: hidden`, an outline can't, so the
fallback stays.

**One primary action per view.**

## Table rows

The grid has no lines. Rows separate with `box-shadow: inset 0 -1px 0 var(--line)`.

| Row state    | Treatment                                                       |
| ------------ | --------------------------------------------------------------- |
| Hover        | `border-radius: 9px; box-shadow: var(--e2)` — the row lifts out |
| Selected     | `inset 2px 0 0 var(--accent)` + 5.5% accent wash                |
| Needs review | cream gradient + `inset 2px 0 0` cream                          |
| Processing   | inline navy progress bar in place of the value                  |
| Failed       | danger wash + `inset 2px 0 0 var(--danger)`                     |
| Loading      | skeleton pills at the real column widths                        |

## Status

A status is **a colour, a word, and a shape** — so it survives greyscale,
colour blindness, and a squint across the room. Ready and Archived get a dot;
Needs review gets an `!` glyph; Failed gets an `×`. Never colour alone.

Empty is an em dash (`—`) in `--ink-faint`, never `0` and never blank.

## Mobile is not a narrow desktop

Same tokens, different product. The mobile screens are a rethink, not a
breakpoint:

- **Home** — one hero metric, then a task inbox ("6 documents to review · about 3
  minutes of work"), then recent activity. A bottom tab bar with a raised capture
  FAB in the centre.
- **Documents** — 72px cards, not table rows. Total right-aligned over a status
  dot and word. Actions inline on the card that needs them ("Review now",
  "Retry"), never behind a menu.
- **Review** — a full task flow. Document preview, extracted fields, one field
  flagged for confirmation, sticky "Confirm & next" at the bottom. Built to finish
  work at a bus stop.

Never paint fake status bars or phone chrome. Reserve the space, leave it empty.

## House rules

1. No hard borders. A `1px solid` line is a bug.
2. Money is monospaced, tabular, right-aligned.
3. Quiet until touched — controls earn depth on interaction.
4. One primary action per view.
5. Status is a word, not just a colour.
6. Empty is an em dash.
7. Mobile is not a narrow desktop.
8. Icons are drawn (inline stroke SVG), not typed (no emoji, no icon fonts).
9. Density is the feature.

## Migration status

- [x] Tokens in `globals.css`
- [x] Archivo + IBM Plex Mono via `next/font`
- [x] Every solid border replaced by elevation, tone, or an inset hairline —
      `grep "border: 1px solid" src/app/globals.css` returns nothing, and should
      keep returning nothing
- [x] Button and input state coverage (hover, pressed, focus ring, disabled,
      invalid)
- [x] Money monospaced in the documents table (`.is-numeric`, `.num`)
- [x] Row states beyond hover — needs-review, processing, failed. Selected is
      deliberately absent: nothing in the app acts on a multi-row selection yet
- [x] 38px row density
- [x] Sidebar redesign — 212px, grouped nav sections, account card
- [x] Dashboard — KPI tiles, section cards, single-hue category bars
- [x] Mobile — bottom tab bar with capture FAB, 72px document cards, filters
      folded behind a disclosure
- [ ] Mobile review flow — the full "finish it at a bus stop" task screen
- [ ] Reports and document detail

The one deliberate exception to rule 1: `.upload-dropzone` keeps a **dashed**
border. Dashes read as "drop something here" — an affordance, not a separator.
