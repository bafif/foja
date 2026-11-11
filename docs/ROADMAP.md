# Foja roadmap

*English · [Español](ROADMAP.es.md)*

Foja is a no-code CV editor built on [Typst](https://typst.app). You fill in forms instead of
writing code, the preview next to them is the real Typst output, and the CV exports to PDF, JPG,
Word, Typst, LaTeX, Markdown, JSON and JSON Resume. Everything runs in the browser: there are no accounts and
no server, and the CV never leaves your machine.

This document is where I keep what Foja is meant to be, what is already built, what comes next
and the reasons behind the main decisions. How to use the editor is in the
[user guide](guide.md).

## Why I am building it

My own CV was a set of JSON files turned into a PDF by a Python generator through LaTeX (it still
lives in [`cvgen/`](../cvgen/README.md), next to a second generator in C). It worked, but every change meant editing files by hand and waiting
for a LaTeX compile, and nobody else could use it. I wanted the same idea, one bank of entries
and one CV per kind of job, with a real interface on top and Typst underneath.

Typst already has an official online editor (typst.app), but there you write code. The closest
products are RenderCV (YAML to Typst, as a CLI and a web app) and the CV templates on Typst
Universe, which are also edited as code. I did not find a form-based CV builder on Typst, so
that is the gap Foja aims at: forms, a live preview and many exports, not another code editor.

One product, three ways to run it, all from the same release:

1. **A web app** that anyone can open and install, and that keeps growing over time.
2. **A desktop app** installed like any other app on Linux, macOS and Windows.
3. **A command line** (`foja`), which replaces the old generator of my CV.

## Design principles

- **The Typst template is the generator.** The styles read the project JSON and lay out the CV
  themselves, so the browser, the desktop app and the CLI run exactly the same `.typ` files.
  Nothing generates Typst source on the side. The one exception is an imported LaTeX template,
  whose look comes from LaTeX, which also runs in the browser.
- **Local first, no server.** The web build is the product: Typst compiles to WebAssembly in a
  worker, projects live in IndexedDB, and the desktop app wraps the same build. A static site
  has no server to pay for and nothing to attack, and the CV data stays with its owner.
- **Zero cost, always.** The project never pays for anything: no code-signing certificates, no
  Apple developer account, no paid hosting, no paid domain. Every choice is the best free one.
- **One self-contained project document.** A single JSON file (format `foja/3`; older ones are migrated on loading) holds the
  person, contacts, skill groups, the shared bank of entries, the profiles, custom styles and the
  photo. A JSON Schema is the contract for the template, the exporters, the editor and the CLI.
- **Two levels, kept explicit.** The bank holds every entry once; a profile chooses which entries
  go where. Editing an entry warns where else it is used, and removing it from a profile never
  deletes it. The priority of each entry, item and skill is marked once in the bank, and each
  profile's length decides what goes in, with exceptions of its own.
- **Layout is data.** Columns, sidebar side and width, photo shape, font, size, accent colour,
  margins, density, page size, date format and label language are options per profile, read by
  the Typst styles and by the Word exporter alike.
- **Typed blocks.** Sections hold blocks (an entry from the bank, an item, a paragraph) and the
  styles render them by type, which leaves room for new kinds of blocks later.
- **One-page discipline.** The preview always says whether the CV fits on one page and, if not,
  which parts spill over, and "Fit to one page" trims it one step at a time, in a fixed order,
  until it fits.
- **Untrusted input is expected.** A project or a style may come from someone else, so the
  preview strips scripts, embedded HTML and links from the SVG, the CLI compiles in an empty
  temporary root, and every exporter escapes what it writes. Details in the
  [security model](security.md).
- **No access to version control.** Neither the app nor its exports touch anyone's repositories.

## Decisions

### How it is delivered

I compared three options: a local web app in a container, a native Tauri app with a Python sidecar,
and a web core that does all the rendering in the browser, wrapped by Tauri for the desktop.

The third one won on every count that mattered. A container runtime is a poor install for people
who are not developers, especially on macOS and Windows. A frozen Python sidecar makes the installers large
and signing painful (the sidecar has to be signed on its own, and the macOS hardened runtime
breaks PyInstaller without extra work). The in-browser core gives a public web app with static
hosting and no server, small installers that use the system webview, and a preview with no
network round trip. LaTeX is exported as source, since a full TeX distribution in WebAssembly
downloads about 120 MB; only an imported LaTeX template is compiled in the app, by pdfTeX or XeTeX
with a small set of common packages (about 9 or 6 MB, downloaded the first time one is used; the
fonts a XeLaTeX template names, the user uploads).

Containers (rootless Podman) stay for development only, with hot reload behind nginx.

### Free distribution channels

- **Web**: a static site on GitHub Pages, installable as a PWA from Chrome, Edge or Safari. It
  shows up in the system's app menu, works offline, updates itself and needs no signing.
- **Windows**: the Microsoft Store. Individual registration is free and the Store signs MSIX
  packages, so the PWA packaged with PWABuilder avoids SmartScreen warnings at no cost.
- **Linux**: Flathub. It does not accept thin web wrappers, so the Linux app is a Tauri shell
  with real desktop integration: projects opened and saved through the file-chooser portal, its
  own file type, bundled assets and a build from source. Also AUR and plain packages on GitHub
  Releases.
- **macOS**: there is no free notarisation, and Homebrew's main cask repository now refuses apps
  that fail Gatekeeper, so the PWA is the main way there. An ad-hoc-signed build can still be
  offered on GitHub Releases with instructions.
- **Signed Windows installers outside the Store**: SignPath Foundation signs open-source
  projects for free once they have some reputation.
- **Android**: the PWA installs from Chrome as a real app (Chrome packages it as a WebAPK), with
  its icon in the app drawer. A native package can come later from the same Tauri 2 shell as the
  desktop app, which also builds for Android, on GitHub Releases and on F-Droid if it meets their
  build rules. Google Play charges a registration fee, so it stays out.
- **iPhone and iPad**: the App Store needs the paid Apple Developer Program, so the PWA added to
  the Home Screen from Safari is the iOS app. Installing a build with a free Apple ID expires
  after seven days, which is no way to ship it to anyone.
- **CLI**: npm.

### Exporters in TypeScript

I first considered keeping the Python exporters and running them in the browser through Pyodide.
TypeScript was better on quality and on speed: the `docx` library has native support for table
shading, merged cells, section columns and floating images (with `python-docx` those need raw
OOXML), and there is a single schema and a single set of types shared by the forms, the
validation, the exporters and the CLI. Pyodide would also have added seconds of start-up on the
first export and a bridge between two runtimes.

### Astro instead of Next.js

The editor is entirely client-side, and the public pages should load fast. Next.js's strengths
(server rendering, server actions, image optimisation) are unusable in a static export, and its
WebAssembly-in-workers setup needs bundler configuration. Astro outputs static pages by default,
is built on Vite (which handles WebAssembly and module workers natively), ships no JavaScript on
the landing page, and has an official GitHub Pages action. The editor is a React island inside
it, with Tailwind, Zustand (plus `zundo` for undo) and dnd-kit.

### A look of its own

The first template reproduced the look of my LaTeX CV, which is based on the Wenneker template
(CC BY-NC-SA). Before publishing I replaced it, and the LaTeX and Word exports with it, with
three styles of Foja's own: **Legajo** (the default: XCharter, small caps, a tinted sidebar,
dates in a column of their own), **Banda** (a band of colour across the top, Noto Sans) and
**Minimal** (black on white, hierarchy from size and weight only). The interface got the same
treatment: three themes, Papel y tinta, Neutro and Vivo, each light and dark.

Later I added three styles for applicant tracking systems (ATS), which read a CV before a person
does: **Claustro** (the classic: serif, the name centred), **Recto** (sans-serif, left-aligned)
and **Llano** (the plainest and most compact). They are one column of text, with no icons,
standard headings and the contact details in the body, and a test checks that the PDF carries the
text in the order it is seen.

## What is built

The work so far, in the order it happened:

- **A spike** (October 30, 2026) to check that live preview without a server is viable: a Typst
  template reading the CV as JSON, compiled by typst.ts in a Web Worker on a bare Astro page. On
  a modest four-core CPU a one-character change takes about 50 ms of Typst and 4 ms of SVG
  rendering, so the preview can follow every keystroke. The compiler is 28 MB of WebAssembly (7
  MB with brotli), which means the first visit needs a loading state and the service worker has
  to precache it.
- **The project format and the CLI.** The `foja/2` format with its JSON Schema and a small
  validator (no extra dependency) that also checks references the schema cannot express;
  layout options; a converter from the old multi-file layout of my CV; and the `foja` command,
  which builds PDF, SVG and a Typst bundle that compiles on its own with plain `typst compile`.
- **The exporters.** All of them start from one resolved profile (entries looked up, dates
  formatted, labels applied): LaTeX as a self-contained `cv.tex` written for Foja, Markdown,
  JSON (the project file and the resolved profile), Word with one or two columns, JPG from the
  browser, and a `.zip` with everything.
- **The editor.** Panels for the personal data, contacts, skill groups and the bank of entries;
  profiles with their sections and layout; inline validation tied to each field; autosave to
  IndexedDB; undo and redo; the live preview with the page-fit badge; and the export dialog.
- **Polish.** Click on the preview to edit what is under the pointer, the selection outlined on
  the preview, the parts that overflow page one tinted, drag-and-drop for sections and blocks
  (with a keyboard alternative), a command palette, and photo cropping.
- **Offline and installable.** A service worker written without a framework (the PWA plugin did
  not support the Astro version), a manifest, the landing page, builds under the `/foja/` base
  path, and the GitHub workflows (tests and build on every push; the Pages deployment runs only
  by hand until I publish).
- **Styles and themes of its own.** The three styles above, a shared Typst library for writing
  more, "Edit in Typst" to copy any style into one of your own, a style editor with errors shown
  above the preview, and interface themes that can be extended with a small, validated theme
  file or from a script.
- **Interface details.** Every text/background pair meets WCAG AA contrast in all themes, style
  cards show the current profile in each style, a phone layout with one pane at a time, and the
  interface in Spanish and English.
- **A review before release.** I had the whole code base reviewed from scratch and fixed what
  came up: a style could read local files through the CLI and could put `javascript:` links in
  the preview; LaTeX could be injected through contact URLs; starting a new project replaced the
  previous one for good, and two tabs overwrote each other's autosave; a slow style could freeze
  the preview; the service worker could break open tabs on update; and several accessibility
  gaps. My three real profiles now fit on one page in Legajo, and the preview replaces only the
  pages that changed, so long CVs no longer block typing.
- **Online** (November 7, 2026). The site is on GitHub Pages at
  [`bafif.github.io/foja/`](https://bafif.github.io/foja/). The deployment still runs by hand
  (Actions → Deploy to GitHub Pages), so a push to `main` does not publish by itself.
- **Phones.** The phone layout was already there; the rest of the work was what a phone does
  differently. Exports go to the system's share sheet (Save to Files, mail, messaging apps),
  because a download from a web app installed on an iPhone often does nothing. Fields use 16 px
  text on touch screens so Safari does not zoom in on them. On phones and in the installed app,
  Foja asks the browser to keep the project when space runs low. The menu has an Install button
  where Chrome offers one, and on an iPhone it shows the steps instead, as does the welcome
  screen, since a site left in a Safari tab loses its data after a week without use. iOS also
  got its own Home Screen icon.
- **Two languages** (November 10, 2026). Besides the editor, the landing page, the command line
  and all the documentation are in Spanish and English: each picks from the browser's or the
  system's languages, and the tests fail when a text or a document lacks its other language. A
  link to Foja shared on X, WhatsApp or other apps shows a preview of its own.
- **Exports in the style's look.** LaTeX and Word always came out as Legajo; now they reproduce
  the profile's built-in style. A style of one's own is Typst code, so for it they still come out
  as Legajo, and the Typst export is the one that keeps it.
- **Three styles for applicant tracking systems**: Claustro, Recto and Llano (see *A look of its
  own*). Picking one leaves the profile with one column, no photo and the short length.
- **What goes in each profile** (format `foja/3`). A priority per entry, item and skill
  (essential, normal or extra), a length per profile (short, normal or full), per-profile
  exceptions, a short summary and "Fit to one page". LaTeX, Word, Markdown and JSON pick exactly
  what the PDF shows. The editor's example became my CV with three profiles, each with its own
  style and length.
- **Imported templates** (November 11, 2026). A CV template written in Typst or LaTeX is read
  with fixed rules, no AI: its sample content becomes bank entries and a profile, and its look a
  style of one's own, after a form where you check which argument of each macro is which field. A
  LaTeX template is compiled in the browser with pdfTeX or XeTeX: the deployment builds the engine
  and the TeX Live files, they download the first time one is used, and the user uploads the
  fonts a XeLaTeX template names. The command line gains `foja import`.
- **An interface for phones** (November 11, 2026). The first try on a real phone showed that the phone
  layout worked but was uncomfortable: on an iPhone SE the top bar did not fit and dragged the page sideways.
  Now the top keeps only the profile, undo, redo and a menu; the bar at the bottom, in reach of the thumb,
  switches panes and exports, and puts a dot on the preview when the CV runs past one page; the menu is a sheet
  that comes up from the bottom, with buttons the size of a finger; styles are picked two to a row. A test goes
  through every pane on a 320 px screen and fails if anything sticks out.
- **JSON Resume** (November 11, 2026), the open résumé format other tools use. A JSON Resume file comes in
  through the same button as a project, and on the command line with `foja import`: its entries go to the bank,
  with a profile that has its sections. A profile exports to JSON Resume as its PDF shows it; since the format's
  sections are fixed, what has no place there is named instead of lost without a word.

## What comes next

In this order:

1. **The full test on real phones**, with the new interface: on an Android with Chrome and an iPhone with
   Safari, install it, edit, export through the share sheet, and use it offline. The automated tests emulate a
   phone in Chromium, which has neither Safari's quirks nor a real share sheet.
2. **Publish the CLI on npm** as `foja` (the name was still free at the end of October 2026). The
   package already bundles itself on `npm pack`; it needs an npm account and
   `npm publish -w packages/cli`.
3. **Microsoft Store**: open a free individual Partner Center account, then package the
   published PWA as MSIX with PWABuilder.
4. **Desktop app and Flathub**: the Tauri 2 shell with native file access, a Flatpak built from
   source, and the Flathub submission. Also AUR and unsigned builds for macOS and Windows on
   GitHub Releases, and SignPath Foundation for Windows once the project qualifies.
5. **Android package**: the same Tauri 2 shell built for Android, as an APK on GitHub Releases
   and, if it qualifies, on F-Droid. On iPhone the PWA remains the app (see the distribution
   channels above).

Smaller things that can go in at any point:

- Open the Word export in Word and LibreOffice. So far the files are only checked as valid
  packages, because neither program is installed on my machine.
- An "Open in Overleaf" button. Overleaf takes the files in a POST to `overleaf.com/docs`, which
  sends the CV to a third party, so it has to be an explicit action and tested against the live
  service.
- **Versions**, off by default: snapshots on save and named versions ("sent to Acme") with a
  preview, a diff of fields and restore, stored with the project. A history inside the app, not
  a link to any version control system.

Known limitations: the LaTeX export breaks lines a little differently from Typst and can run a
few lines past one page where the PDF fits (the user guide says so). An imported LaTeX template
shows in the preview without click-to-edit or the marks of what spills over; only the data of
templates that need LuaLaTeX is imported, and the command line does not compile LaTeX: it writes
the filled `.tex`.

### Long term

A general, graphical, live Typst editor built around freedom: you collect blocks (text, lists,
entries, images, shapes), arrange them on the page, and the template turns them into Typst. The
CV is the first product on top of that idea. The typed blocks of the data model keep the door
open without building it now; until then everything stays focused on CVs.

## Name and addresses

The name comes from *foja de servicios*, the record of someone's career. The code lives under my
own GitHub account.

- Code: [`bafif/foja`](https://github.com/bafif/foja), public, GPL-3.0 (an OSI licence, as
  SignPath requires). My own CV data and the first generators live in `cvgen/`.
- Web: `bafif.github.io/foja/`. A custom domain can later serve the same site at its root with
  no other change.
- npm: `foja`. Flathub app ID: `io.github.bafif.Foja`.

## Dependencies

All free and open source, and all Node packages installed only inside the development container:
Astro, React, Tailwind, Zustand and `zundo`, dnd-kit, typst.ts (web compiler, renderer and the
Node compiler for the CLI), `docx`, and Vitest and Playwright for the tests. There is no ZIP or
JSON Schema library: both are small enough to keep in `packages/core`. The bundled fonts are
XCharter, Latin Modern Mono and Noto Sans, each with its licence next to it. Imported LaTeX
templates use SwiftLaTeX's pdfTeX and XeTeX engines and TeX Live 2022 files, which the deployment
builds and the repository does not hold ([details and licences](../apps/web/public/latex/README.md)).
The desktop app will
add the Rust toolchain, Tauri 2 and `flatpak-builder`.

## Sources

- typst.ts releases: <https://github.com/Myriad-Dreamin/typst.ts/releases>
- Typst releases: <https://github.com/typst/typst/releases>
- Typst CV templates and RenderCV: <https://typst.app/universe/package/rendercv/>,
  <https://typst.app/universe/package/brilliant-cv/>
- Tauri with a PyInstaller sidecar, signing issues:
  <https://github.com/phoson-lat/Phoson-Desktop/pull/11>,
  <https://github.com/ActivityWatch/activitywatch/issues/1249>
- LaTeX in the browser: <https://github.com/TeXlyre/texlyre-busytex>,
  <https://github.com/SwiftLaTeX/SwiftLaTeX>
- Free distribution: Microsoft Store registration and signing
  <https://blogs.windows.com/windowsdeveloper/2025/05/19/microsoft-store-expands-opportunities-for-windows-app-developers/>,
  <https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options>;
  SignPath Foundation <https://github.com/SignPath/github-actions-demo>;
  Homebrew and Gatekeeper <https://brew.sh/2025/11/12/homebrew-5.0.0/>,
  <https://github.com/Homebrew/brew/issues/20755>
- docx (npm): <https://github.com/dolanmiu/docx/blob/master/docs/usage/tables.md>
- typst.ts Node compiler: <https://www.npmjs.com/package/@myriaddreamin/typst-ts-node-compiler>
- Flathub requirements: <https://docs.flathub.org/docs/for-app-authors/requirements>;
  Tauri on Flathub: <https://v2.tauri.app/distribute/flatpak/>
- Reactive Resume: <https://github.com/amruthpillai/reactive-resume>
