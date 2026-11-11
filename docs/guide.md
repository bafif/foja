# Foja user guide

*English · [Español](guide.es.md)*

Foja is a CV editor built on [Typst](https://typst.app). You fill in forms; the preview next to
them is the real Typst output, updated as you type. Everything runs in your browser: your data
stays on your device. It is at <https://bafif.github.io/foja/>.

## Getting started

Open the editor and pick one of:

- **Start with the example**: my own CV, with three profiles (programmer, mathematics, physics and electronics teacher,
  and electronics technician) built from the same data, to see how a real one is put together. Switch between them with
  **Profile**, at the top.
- **More examples, with made-up people**: for those with little experience. Camila, a student looking for her first
  internship (Portada and Claustro); Julieta, a newly qualified cosmetologist (Arco and Recto); and Tomás, who finished
  secondary school and is looking for a job in shops (Rótulo and Llano). Each has two profiles: an eye-catching one
  first and one that job portals read well. They are also in the **Project** menu.
- **Empty project**: a blank CV.
- **Import JSON**: a `.foja.json` file exported from Foja (yours, or a template someone shared), or a CV in [JSON
  Resume](https://jsonresume.org), the open format other tools use: its jobs, studies, projects, awards, certificates
  and publications go to the bank of entries, with a profile that has a section for each; its skills and languages
  become skill groups. A photo on the web is not downloaded (Foja connects to nothing): add it by hand.

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

**Style and layout** shows the nine Foja styles, each with a thumbnail of your CV in it:

- **Legajo** (default): serif, the name in small caps over a rule, a sidebar card, the dates in a
  column of their own.
- **Banda**: a band of colour with the name and the photo; one column, sans-serif.
- **Minimal**: black on white with plenty of air; the colour only on the name.

Three more are made for applicant tracking systems (ATS) and the search tools that read CVs for
recruiters:

- **Claustro**: the classic. Serif, the name centred with the contacts on one line below it,
  section titles in capitals over a rule, the institution above the position and the dates.
- **Recto**: modern and plain, sans-serif and flush left; titles in capitals of the accent colour
  over a hairline, the position and the dates on one line, the institution below.
- **Llano**: the plainest and the most compact; bold titles in the accent colour, each entry on one
  line with the position and the institution.

All three are one column of plain text, with no icons and no text in pictures, the contacts in
the body (never in a Word header or footer), standard titles (the summary under "Profile", the
skills under "Skills") and the text in the PDF in the order it is seen, which a test checks. Picking
one of them sets the profile to one column, no photo and the Short length (see below), unless
Short would leave the profile without entries; all of it is written into the profile, so it shows
and can be changed like any other option.

The last three are for a short CV, a first job or an internship: they spread a little over the
page so that it looks full and catches the eye. Where the photo goes, they show the initials when
there is no photo.

- **Arco**: a tinted panel down the left with the photo in an arch, the name large in a bold serif,
  the subtitle and the summary on a soft card, titles over a fine line.
- **Rótulo**: the photo in a circle with a ring of colour, the name large and light on two lines,
  every title on a label of colour, a fine rule between the two columns.
- **Portada**: editorial, as in a magazine: the contacts across the top, the name very large in
  capitals beside the photo, each part on a row with its title on the left, the skills in columns
  at the foot.

Below the styles, the options the chosen style honours: one or two columns, sidebar side and
width, photo shape, typeface, size, colour, margins, spacing, paper, date format and the language
of fixed labels (Spanish, English, Portuguese).

**Edit in Typst** copies the profile's style into a style of your own and opens its code; **New
style from scratch** starts from a small skeleton. Errors show above the preview, which keeps the
last good version. How to write a style: [`templates.md`](templates.md).

## Importing a Typst or LaTeX template

**Style and layout → Import a Typst or LaTeX template** takes a CV template written in Typst or LaTeX: a `.typ` or a
`.tex`, or a `.zip` or `.tar.gz` with its files. Foja reads it with fixed rules, no AI: the functions it defines, the
ones its sample content calls again and again (each call is an entry), its headings (the sections), the bullets under
each call (the items) and its `#show: x.with(...)` (the header). It then proposes which argument of each macro is the
position, the place, the dates, a note or the items, from the argument's name (`title`, `company`, `dates`,
`institución`…) and from what its value looks like (a date, an e-mail, a URL).

The form shows each argument with its sample value and the field it goes to, which you can
change; below, what will come in. The same correspondence is used twice:

- **the data**: the sample content becomes entries of the bank and a new profile, in the open
  project or in a new one;
- **the look**: a style of your own that keeps the template's files and calls its macros with the
  CV's data; the new profile uses it.

`@preview` packages are not downloaded: if the template uses one, upload a `.zip` that brings its
folder (with its `typst.toml`), or import only the data. The template's licence stays with the
style. The command line does the same with `foja import`.

A LaTeX template is read the same way: the macros it defines (`\newcommand`, `\def`), the ones
its sample content calls again and again, its `\section`s, the `\item`s under each call and the
call before the first section (the header). Its look is the template itself: Foja writes its
`.tex` with the CV in place of the sample content, through the template's own macros, and
compiles it with LaTeX in the browser: pdfLaTeX, or XeLaTeX for a template that picks its fonts
by name (`fontspec`, `polyglossia`, or `% !TEX program = xelatex`). The first time, that downloads
about 9 MB (6 MB for XeLaTeX) and takes a few seconds; after that a change shows in a second or
two, still slower than with Typst. There is a set of common packages (FontAwesome 5's icons among
them); LuaLaTeX is not there, so some templates import their data but not their look. For XeLaTeX,
Foja brings Latin Modern: a font the template asks for by name and Foja lacks is named in **Style
and layout → The template's fonts**, where you upload its `.otf` or `.ttf` files (downloaded from
where the font is published); they are kept with the style. Fonts that come in the template's
`.zip` are used as they are. The preview shows LaTeX's pages without
click-to-edit or the red marks of what spills over; the PDF export is LaTeX's own PDF, and the
LaTeX export is the template's `.tex`, filled, with its files. The command line has no LaTeX: it
writes that `.tex` (`--format tex`) and no PDF.

## What goes in each profile

Every entry, item and skill of the bank has a priority, marked once where it is written:
**Essential**, **Normal** (the default) or **Extra**. Each profile then has a **length**, in
**What goes in this profile**, below the profile text:

- **Short** shows only the essential;
- **Normal** shows the essential and the normal;
- **Full** shows everything.

Below the length, the **checkboxes** list the profile's entries with their items, and its skills:
ticked, what goes in. What the length says has no mark; a box you change is an exception of this
profile, marked as such, and clicking it back returns it to the rule. The profile can also have a
**short summary**, used with the Short length (or always, or never, as **Summary used** says).

Each profile keeps its own length, exceptions and short summary, and **Duplicate** copies them.
LaTeX, Word, Markdown, JSON and JSON Resume pick exactly what the PDF shows. The example comes with three
profiles, each with its own style and length: programmer (Legajo, Normal), mathematics, physics
and electronics teacher (Claustro, Short) and electronics technician (Banda, Full).

**Fit to one page** compiles the profile and, while it takes more than one page, makes it shorter
one step at a time, in a fixed order: the length one step down, then the short summary, then the
extra things the exceptions still show, the last first. It never goes down to Short when that
would leave the profile without entries (mark what is essential in the bank first). The result
is written into the profile, and **Undo the fit** (or Ctrl+Z) takes it back in one go.

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
| Word (`.docx`) | In the look of the profile's built-in style, redone in Word, which cannot run Typst. A style of your own comes out as Legajo; Arco and Rótulo, in the layout of Legajo, and Portada, in that of Minimal, each with its colour. Claustro, Recto and Llano are paragraphs only, without tables, the dates on a tab stop at the right margin. Word has no XCharter and uses Georgia, which is wider: a CV that just fits in the PDF can run onto a second page. |
| Typst (`.zip`) | The style, the project and the fonts: compiles with `typst compile` and opens in typst.app. The only export that keeps a style of your own as it is. |
| LaTeX (`.zip`) | In the look of the profile's built-in style; a style of your own comes out as Legajo, and Arco, Rótulo and Portada as in Word. LaTeX breaks lines a little differently, so a CV that just fits in the PDF can run a few lines over. |
| Markdown | A plain CV for a README or a form that takes text. |
| JSON | The project file, to import it again or move it to another device. |
| JSON Resume | The profile in [JSON Resume](https://jsonresume.org), for other tools and their themes. Its sections are fixed: each section of the profile goes to the one its name says (experience, education, projects, awards, languages…), and a section of entries that matches none goes to work. What has no place there, like a section of strengths, Foja names when exporting; it stays in the project's JSON. |
| All formats | Every one of them in a `.zip`. |

Names in non-Latin scripts: the bundled fonts cover Latin alphabets only, so other scripts show
as missing glyphs for now.

## On a phone or a tablet

Foja works in the phone's browser too, one pane at a time: **Sections**, **Edit** and **Preview**,
switched from the bar at the bottom, which also has **Export**, in reach of the thumb. When the CV runs past
one page, **Preview** shows a dot. The top keeps only the profile, undo, redo and **⋯**, which brings up the
rest from the bottom: creating, duplicating or deleting a profile, the project, the language, the appearance
and the command palette.

- **Install it as an app.** On Android, in Chrome: **⋯ → Install as an app** in Foja's menu (or Chrome's own menu → *Add
  to Home screen*). On iPhone and iPad, in Safari or Chrome: **Share → Add to Home Screen** (Chrome has Share in the
  address bar). It opens full screen, without the browser's bars, and works offline.
- **On an iPhone, install it if your CV lives there.** iOS deletes what a site saved when the
  site goes a week without being opened, unless it is on the Home Screen. The app on the Home
  Screen keeps its own storage, apart from the browser's: to take a project you started in the
  browser, export it as JSON and import it in the app. Exporting the JSON now and then keeps a
  copy either way.
- **Exports go to the share sheet:** **Export → Prepare the file → Share or save…** offers Save to
  Files, mail and messaging apps. What the system cannot share (on Android, Word files and
  `.zip`s) downloads as usual.

## The desktop app

Foja also comes as an app for Linux, Windows and macOS. Its installers go on the
[releases page](https://github.com/bafif/foja/releases) with each version; the first one has not been published
yet. It is the same editor in a window of its own: it works
offline from the start, exports open the system's **Save as** dialog, and links open in your browser.

- **Linux:** the `.deb` for Debian, Ubuntu and their derivatives (`sudo apt install ./Foja_*.deb`), the `.rpm` for
  Fedora and openSUSE (`sudo dnf install ./Foja-*.rpm`), or the AppImage, which runs without installing: make it
  executable (`chmod +x Foja_*.AppImage`) and open it.
- **Windows:** `Foja_…_x64-setup.exe` installs it for your user, without asking for an administrator. The installer
  is not signed, so Windows says it does not know it: **More info → Run anyway**.
- **macOS:** open the `.dmg` and drag Foja to Applications; it runs on Apple silicon and Intel Macs with macOS 11 or
  later. Apple has not notarised it (that costs money), so the first time macOS will not open it: go to **System
  Settings → Privacy & Security** and click **Open Anyway** next to the message about Foja.

The app keeps its projects apart from the browser's: to take a project from one to the other, export it as JSON and
import it. It does not update itself yet: install the new version over the old one, and your projects stay.

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

`foja build my.foja.json` builds every profile as PDF; `--format` adds svg, typ, tex, md, json, jsonresume, docx or
all, and `foja import` brings in a template or a JSON Resume file. It is not on npm yet: see its
[README](../packages/cli/README.md).
