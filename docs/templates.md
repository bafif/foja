# Writing a CV style

*English · [Español](templates.es.md)*

A Foja style is one Typst file. It imports Foja's library and lays out `cv`, the profile being
built, already resolved:

```typst
#import "/lib.typ": *

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: margins((top: 18, bottom: 18, left: 18, right: 18)))
#set text(font: opt("font", "Noto Sans"), size: base-size, lang: lang)

#text(size: 2em, weight: "bold", fill: accent(rgb("#1f5f5b")), cv.name)
#cv.subtitle
```

In the editor: **Style and layout → Edit in Typst** copies the profile's style into one of your
own and opens its code; **New style from scratch** starts from a small skeleton. Your styles
live in the project file (`templates`), so they travel with it and with the Typst export.

## What `cv` holds

| Field | |
| :--- | :--- |
| `cv.name`, `cv.given`, `cv.family` | the whole name, given names, family names |
| `cv.subtitle`, `cv.summary` | strings (`summary` may be `""`) |
| `cv.highlight` | `(title: …, text: …)` or `none` (e.g. the course applied for) |
| `cv.photo`, `cv.photo-shape` | a path for `image()` or `none`; `"square"`, `"rounded"` or `"circle"` |
| `cv.contacts` | array of `(kind, label, value, link)`; `link` is `none` for the phone and the location |
| `cv.skills` | rows of groups `(title, items)`; a row with several groups is meant to go side by side |
| `cv.sections` | array of `(index, path, id, title, side, compact, blocks)` |

Every block of a section is either an entry,
`(type: "entry", path, id, title, place, period, note, items)`, or
`(type: "item" | "paragraph", path, heading, text)`. `period` is already formatted
(`05/2026 – actualidad`); `items` are `(heading, text)` pairs. `side` is true for sections the
user put in the sidebar; a one-column style can ignore it.

`cv` holds only what the profile lets in: the entries, items and skills its length takes by their
priority, with its overrides, and the short summary when it uses it. A section or a skill group
left empty by that is not in `cv`; `index` and `path` still give each part's place in the profile.

## Helpers

| | |
| :--- | :--- |
| `inline(text)` | a string with `**bold**` spans made strong |
| `item-body(item)` | an item with its heading in bold |
| `photo(width, shape: …)` | the photo clipped to its shape, or `none` |
| `contact-text(contact)` | the value, linked when it has a link |
| `labels` | fixed words in the CV's language: `labels.profile`, `labels.contact`, `labels.skills`, `labels.present`, `labels.contacts.phone`, … |
| `month(value)`, `period(entry)` | dates in the profile's format (already applied in `cv`) |
| `document-info` | `(title, author)` for `#set document(..document-info)` |

## Layout options

The profile's options (the **Options** panel) reach the style through `opt(key, default)` and a
few ready-made values: `accent(default-colour)`, `base-size`, `density` (0.7, 1 or 1.3),
`paper` (`(width, height)`), `margins(defaults-in-mm)`, `lang`. A style reads the options it
wants and ignores the rest; `opt("columns", 2)`, `opt("sidebar", "left")`,
`opt("sidebarWidth", 30)`, `opt("photo", "square")`, `opt("font", …)` and
`opt("dateFormat", …)` are there too.

Fonts available: **XCharter** (serif), **Noto Sans** (sans) and **Latin Modern Mono 9**.

## Click-to-edit and the page-fit badge

Two optional calls make the editor understand the page:

- `anchored(path, body, column: "main")` marks `body` as the part at `path`, so a click on it
  in the preview opens that part and the selection is outlined on it. Use the paths `cv` gives
  (`s.path`, `b.path`) and these: `"name"`, `"subtitle"`, `"summary"`, `"photo"`,
  `"highlight"`, `"contacts"`, `"skills.0"` (a row). The page-fit badge counts lines from the
  marks too.
- `geometry(main: (x: …, width: …), side: (x: …, width: …))` tells the editor where the columns
  are (from the left edge of the page), so the outlines have the right width. Without it they
  run from the mark to the right margin.

A style without either still compiles and previews; only those two features are missing.

## The built-in styles

`packages/template/styles/legajo.typ`, `banda.typ` and `minimal.typ` are complete examples, and
`packages/template/lib.typ` is the library itself. `claustro.typ`, `recto.typ` and `llano.typ`, the
styles made for applicant tracking systems, show what keeps a CV readable by a parser: one column,
nothing but text, the contacts in the body, a title over every part (`labels.profile` over the
summary, `labels.skills` over the skills), no hyphenation, and the dates on their entry's line with
`h(1fr)` rather than in a grid cell beside a block of several lines, so that the PDF carries the
text in the order it is seen. `packages/cli/test/ats.test.ts` checks that order in the PDF.
`arco.typ`, `rotulo.typ` and `portada.typ` draw with Typst's own shapes: a panel in the page's
`background`, the photo clipped by a `box` with rounded corners, `polygon` and `circle` as
ornaments, and the initials in the photo's place when there is none (`opt("photo", …)` says
whether the profile wants one).

A built-in style can bring a `preset` in `packages/template/styles.json`: options written into the
profile when the style is picked (the three above set one column, no photo and the short length;
`pickStyle` leaves the short length out when it would leave the profile without entries).

## Imported templates

A style made by **Import a Typst or LaTeX template** from a Typst template keeps the template's files in the project
(`templates.<id>.files`, pictures in `binaries`, the licence's path in `license`); the compiler
sees them under `/custom/<id>/`. Its source, `/custom/<id>.typ`, imports them (the main file's
own definitions go to `foja-defs.typ`, without the sample content), copies the main file's `#set`
and `#show` rules, opens with the template's header filled with `cv.name`, `cv.subtitle` and the
contacts, and lays out each section calling, for each entry, the macro its section used in the
template (`foja-section-macro`) through `foja-entry`, with the arguments the review form mapped:
`b.title`, `b.place`, `b.period`, `foja-start(b)`, `foja-end(b)`, the note, and the items as a
list. It is an ordinary style of your own after that: edit it in **Edit in Typst** like any other.

A LaTeX template keeps its files the same way, plus `templates.<id>.latex`, which says how to fill
its macros with the CV: the main `.tex` file (`main`), the engine (`engine: "xetex"` for XeLaTeX;
pdfLaTeX when absent), the header macro and what goes in each argument (`header`), the arguments
of each entry macro (`entries`), the macro of each section (`sections`, and `entry` for the rest)
and the section command (`section`). With that Foja writes the filled `.tex` and LaTeX compiles it
in the browser. That style's Typst source only shows the pages of the PDF LaTeX made: the look
comes from the template's files. The fonts uploaded in **The template's fonts** go in `binaries`, under
`fonts/`.
