# Foja user guide

*English · [Español](guide.es.md)*

Foja is a CV editor built on [Typst](https://typst.app). You fill in forms; the preview next to
them is the real Typst output, updated as you type. Everything runs in your browser: your data
stays on your device. It is at <https://bafif.github.io/foja/>.

## Getting started

Open the editor and pick one of:

- **Start with the example**: my own CV as a programmer, to see how a real one is put together.
- **Empty project**: a blank CV.
- **Import JSON**: a `.foja.json` file exported from Foja (yours, or a template someone shared).

Your work is saved in the browser as you go ("Saved" in the header). **Ctrl+S** saves at once.
Replacing the project (new, example, import) keeps the previous one: **Project ▾ → Restore the
previous project** brings it back. Export the project as JSON now and then to keep a copy outside
the browser.

## Profiles and the entry bank

A project holds **one bank of entries** (jobs, degrees, projects) and **several profiles** that
pick from it: a CV for a programming job and one for a teaching post can share the same
entries, each with its own subtitle, summary, sections and layout. Editing an entry changes it in
every profile that uses it; the entry form says which ones do.

- **Profile ▾** in the header switches profiles; **+ New profile** and **Duplicate** make more.
- **Data**: personal data and photo, contacts, skill groups, and the entry bank.
- **Profile**: the profile's text (subtitle, summary, which contacts and skills it shows) and its
  **style and layout**.
- **Sections**: each section holds blocks: an entry from the bank, an item (a bullet with an
  optional heading) or a paragraph. Drag sections and blocks to reorder them (or use the handle
  with the keyboard: Space, arrows, Space). A section can go in the sidebar, and can be
  *compact* (entries without their items, in small type).

Dates use month pickers; an entry can be *ongoing* or have a *single date*. Text can carry
`**bold**`.

## Styles

**Style and layout** shows the three Foja styles, each with a thumbnail of your CV in it:

- **Legajo** (default): serif, the name in small caps over a rule, a sidebar card, the dates in a
  column of their own.
- **Banda**: a band of colour with the name and the photo; one column, sans-serif.
- **Minimal**: black on white with plenty of air; the colour only on the name.

Below them, the options the chosen style honours: one or two columns, sidebar side and width,
photo shape, typeface, size, colour, margins, spacing, paper, date format and the language of
fixed labels (Spanish, English, Portuguese).

**Edit in Typst** copies the profile's style into a style of your own and opens its code; **New
style from scratch** starts from a small skeleton. Errors show above the preview, which keeps the
last good version. How to write a style: [`templates.md`](templates.md).

## One page

The badge above the preview says whether the CV fits on one page and, if not, by how many lines;
the parts that spill over are tinted red, and the sections they belong to get a ⚠ in the
navigation. Click any part of the preview to edit it.

## Exporting

**Export** (Ctrl+E) offers:

| Format | Notes |
| :--- | :--- |
| PDF | The CV as you see it. |
| JPG | One image per page, at 72, 150 or 300 dpi. |
| Word (`.docx`) | In the look of the profile's style (Legajo, Banda or Minimal), redone in Word, which cannot run Typst. A style of your own comes out as Legajo. |
| Typst (`.zip`) | The style, the project and the fonts: compiles with `typst compile` and opens in typst.app. The only export that keeps a style of your own as it is. |
| LaTeX (`.zip`) | In the look of the profile's style (Legajo, Banda or Minimal); a style of your own comes out as Legajo. LaTeX breaks lines a little differently, so a CV that just fits in the PDF can run a few lines over. |
| Markdown | A plain CV for a README or a form that takes text. |
| JSON | The project file, to import it again or move it to another device. |
| All formats | Every one of them in a `.zip`. |

Names in non-Latin scripts: the bundled fonts cover Latin alphabets only, so other scripts show
as missing glyphs for now.

## On a phone or a tablet

Foja works in the phone's browser too, one pane at a time: **Sections**, **Edit** and **Preview**,
switched from the bar at the bottom.

- **Install it as an app.** On Android, in Chrome: **⋯ → Install as an app** in Foja's menu (or
  Chrome's own menu → *Add to Home screen*). On iPhone and iPad, in Safari or Chrome: **Share → Add to
  Home Screen** (Chrome has Share in the address bar). It opens full screen, without the browser's bars, and works offline.
- **On an iPhone, install it if your CV lives there.** iOS deletes what a site saved when the
  site goes a week without being opened, unless it is on the Home Screen. The app on the Home
  Screen keeps its own storage, apart from the browser's: to take a project you started in the
  browser, export it as JSON and import it in the app. Exporting the JSON now and then keeps a
  copy either way.
- **Exports go to the share sheet:** **Export → Prepare the file → Share or save…** offers Save to
  Files, mail and messaging apps. What the system cannot share (on Android, Word files and
  `.zip`s) downloads as usual.

## Privacy and storage

- Nothing is sent anywhere: the project lives in this browser (IndexedDB) and in the files you
  export. There are no accounts.
- The editor works offline once it has been opened.
- Foja edits in one tab at a time, so two tabs never overwrite each other; a second tab offers to
  take over.

## Keyboard

| Keys | |
| :--- | :--- |
| Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y | undo, redo |
| Ctrl+S | save now |
| Ctrl+E | export |
| Ctrl+K | command palette: go to any panel, section, entry or profile, or run an action |
| Escape | closes menus and dialogs |

In the style code editor, Tab indents; Escape then Tab leaves it.

## Appearance and language

**Appearance ▾** switches the interface theme (Papel y tinta, Neutro, Vivo, or one you import)
and light or dark mode. Making a theme: [`themes.md`](themes.md).

The interface is in Spanish and English. It starts in Spanish when your browser lists Spanish among
its languages, and in English otherwise; the language selector in the header (and on the welcome
screen; on a phone, under **⋯**) changes it, and Foja remembers what you pick.

## Command line

`npx foja build my.foja.json` builds every profile as PDF; `--format` adds svg, typ, tex, md,
json, docx or all. See [`packages/cli/README.md`](../packages/cli/README.md).
