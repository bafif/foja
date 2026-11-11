# Foja roadmap

*English · [Español](ROADMAP.es.md)*

What Foja is meant to be, the principles and decisions behind it and their reasons, what is built and what comes
next. How to use the editor is in the [user guide](guide.md).

## What it is for

Typst has an official online editor (typst.app), but there you write code. The closest products are RenderCV (YAML to
Typst, as a CLI and a web app) and the CV templates on Typst Universe, which are also edited as code. There was no
form-based CV builder on Typst: that is the gap Foja aims at, with forms, a live preview and many exports, not another
code editor.

Foja grew out of [cvgen](../cvgen/README.md), a generator that turns a set of JSON files into a PDF through LaTeX. It
keeps cvgen's idea, one bank of entries and one CV per kind of job, with a real interface on top and Typst underneath.

One product, three ways to run it, all from the same release:

1. **A web app** that anyone can open and install.
2. **A desktop app** installed like any other app on Linux, macOS and Windows.
3. **A command line** (`foja`), meant to replace cvgen.

## Design principles

- **The Typst template is the generator.** The styles read the project JSON and lay out the CV themselves, so the
  browser, the desktop app and the CLI run exactly the same `.typ` files. Nothing generates Typst source on the side.
  The one exception is an imported LaTeX template, whose look comes from LaTeX, which also runs in the browser.
- **Local first, no server.** The web build is the product: Typst compiles to WebAssembly in a worker, projects live
  in IndexedDB, and the desktop app wraps the same build. A static site has no server to pay for and nothing to
  attack, and the CV data stays with its owner.
- **Zero cost, always.** The project never pays for anything: no code-signing certificates, no Apple developer
  account, no paid hosting, no paid domain. Every choice is the best free one.
- **One self-contained project document.** A single JSON file (format `foja/3`; older ones are migrated on loading)
  holds the person, contacts, skill groups, the shared bank of entries, the profiles, custom styles and the photo. A
  JSON Schema is the contract for the template, the exporters, the editor and the CLI.
- **Two levels, kept explicit.** The bank holds every entry once; a profile chooses which entries go where. Editing
  an entry warns where else it is used, and removing it from a profile never deletes it. The priority of each entry,
  item and skill is marked once in the bank, and each profile's length decides what goes in, with exceptions of its
  own.
- **Layout is data.** Columns, sidebar side and width, photo shape, font, size, accent colour, margins, density, page
  size, date format and label language are options per profile, read by the Typst styles and by the Word exporter
  alike.
- **Typed blocks.** Sections hold blocks (an entry from the bank, an item, a paragraph) and the styles render them by
  type, which leaves room for new kinds of blocks later.
- **One-page discipline.** The preview always says whether the CV fits on one page and, if not, which parts spill
  over, and “Fit to one page” trims it one step at a time, in a fixed order, until it fits.
- **Untrusted input is expected.** A project, a style or a template may come from someone else, so the preview strips
  scripts, embedded HTML and links from the SVG, the CLI compiles in an empty temporary root, and every exporter
  escapes what it writes. Details in the [security model](security.md).
- **No access to version control.** Neither the app nor its exports touch anyone's repositories.

## Decisions

### How it is delivered

Three options were compared: a local web app in a container, a native Tauri app with a Python sidecar, and a web core
that does all the rendering in the browser, wrapped by Tauri for the desktop.

The third one won on every count that mattered. A container runtime is a poor install for people who are not
developers, especially on macOS and Windows. A frozen Python sidecar makes the installers large and signing painful
(the sidecar has to be signed on its own, and the macOS hardened runtime breaks PyInstaller without extra work). The
in-browser core gives a public web app with static hosting and no server, small installers that use the system
webview, and a preview with no network round trip.

Containers (rootless Podman) stay for development only.

### Live preview in the browser

typst.ts compiles in a Web Worker. On a modest four-core CPU a one-character change takes about 50 ms of Typst and
4 ms of SVG rendering, so the preview follows every keystroke; and since it replaces only the pages that changed, a
long CV does not slow typing down. The compiler is 28 MB of WebAssembly (7 MB with brotli): the first visit shows a
loading state and the service worker precaches it.

### LaTeX: exported as source, compiled only for imported templates

A full TeX distribution in WebAssembly downloads about 120 MB, so the LaTeX export is source (a self-contained
`cv.tex`), not a PDF. Only an imported LaTeX template is compiled in the browser, by SwiftLaTeX's pdfTeX or XeTeX with a
small set of common packages: about 9 MB (6 MB for XeTeX), built at each deploy and downloaded the first time one is
used. The fonts a XeLaTeX template names besides Latin Modern, the user uploads.

### Free distribution channels

- **Web**: a static site on GitHub Pages, installable as a PWA from Chrome, Edge or Safari. It shows up in the
  system's app menu, works offline, updates itself and needs no signing.
- **Windows**: the Microsoft Store. Individual registration is free and the Store signs MSIX packages, so the PWA
  packaged with PWABuilder avoids SmartScreen warnings at no cost.
- **Linux**: Flathub. It does not accept thin web wrappers, so the Linux app is a Tauri shell with real desktop
  integration: projects opened and saved through the file-chooser portal, its own file type, bundled assets and a
  build from source. Also AUR and plain packages on GitHub Releases.
- **macOS**: there is no free notarisation, and Homebrew's main cask repository refuses apps that fail Gatekeeper, so
  the PWA is the main way there. The desktop `.dmg` goes on GitHub Releases unsigned, with instructions to open it.
- **Signed Windows installers outside the Store**: SignPath Foundation signs open-source projects for free once they
  have some reputation.
- **Android**: the PWA installs from Chrome as a real app (Chrome packages it as a WebAPK), with its icon in the app
  drawer. A native package can come from the same Tauri 2 shell as the desktop app, which also builds for Android, on
  GitHub Releases and on F-Droid if it meets their build rules. Google Play charges a registration fee, so it stays
  out.
- **iPhone and iPad**: the App Store needs the paid Apple Developer Program, so the PWA added to the Home Screen from
  Safari is the iOS app. A build installed with a free Apple ID expires after seven days, which is no way to ship it to
  anyone.
- **CLI**: npm.

### Exporters in TypeScript

Keeping cvgen's Python exporters and running them in the browser through Pyodide was the other option. TypeScript was
better on quality and on speed: the `docx` library has native support for table shading, merged cells, section
columns and floating images (with `python-docx` those need raw OOXML), and there is a single schema and a single set
of types shared by the forms, the validation, the exporters and the CLI. Pyodide would also have added seconds of
start-up on the first export and a bridge between two runtimes.

Every exporter starts from one resolved profile (entries looked up, dates formatted, labels applied), so each format
shows exactly what the PDF shows. LaTeX and Word reproduce the profile's built-in style; a style of one's own is Typst
code, so they give it as Legajo, and the Typst export is the one that keeps it. Word is checked by opening the files
in LibreOffice, in a container, with Gelasio, which has Georgia's metrics: valid packages are not enough, and the
tests hold the layout to Typst's.

### Astro instead of Next.js

The editor is entirely client-side, and the public pages should load fast. Next.js's strengths (server rendering,
server actions, image optimisation) are unusable in a static export, and its WebAssembly-in-workers setup needs
bundler configuration. Astro outputs static pages by default, is built on Vite (which handles WebAssembly and module
workers natively), ships no JavaScript on the landing page, and has an official GitHub Pages action. The editor is a
React island inside it, with Tailwind, Zustand (plus `zundo` for undo) and dnd-kit. The service worker is written
without a framework, because the PWA plugin did not support the Astro version.

### Styles of its own

Every built-in style is Foja's own, so all of them are under Foja's licence: cvgen's look comes from the Wenneker
template, which is under CC BY-NC-SA.

- **Legajo**, **Banda** and **Minimal** are the general ones.
- **Claustro**, **Recto** and **Llano** are for applicant tracking systems, which read a CV before a person does. They
  are one column of text, with no icons, standard headings and the contact details in the body, and a test checks
  that the PDF carries the text in the order it is seen. Picking one leaves the profile with one column, no photo and
  the short length.
- **Arco**, **Rótulo** and **Portada** are for a short CV, a first job or an internship: they spread a little over the
  page so that it looks full, with the initials where the photo goes when there is none.

### Imported templates, with fixed rules

A CV template written in Typst or LaTeX is read with fixed rules, no AI, and nothing is sent anywhere: its sample
content becomes bank entries and a profile, and its look a style of one's own, after a form where the user checks
which argument of each macro is which field. The command line does the same
with `foja import`, taking the rules' proposal as it is.

### JSON Resume

JSON Resume is the open résumé format other tools use, so Foja imports it and exports each profile to it. Its sections
are fixed: what has no place there is named when exporting instead of lost without a word.

### Phones

On a phone the editor shows one pane at a time, with a bar at the bottom, in reach of the thumb, to switch panes and
export, and a menu that comes up from the bottom. Exports go to the system's share sheet, because a download from a
web app installed on an iPhone often does nothing. Fields use 16 px text on touch screens so Safari does not zoom in.
Foja asks the browser to keep the project when space runs low, and on an iPhone it shows how to install it, since
Safari deletes a site's data after a week without use. A test goes through every pane on a 320 px screen and fails if
anything sticks out.

### Two languages

The editor, the landing page, the command line and the documentation are in Spanish and English, and each picks from
the browser's or the system's languages. The tests fail when a text or a document lacks its other language, so
neither falls behind.

### The desktop app

A Tauri 2 window around the same site, built without the service worker and with the LaTeX files inside, so it works
offline from the start. A webview has no downloads and no tabs, so exports go through the system's save dialog and
links open in the browser; everything else is the web editor as it is. A workflow run by hand builds a `.deb`, an
`.rpm` and an AppImage for Linux, a setup `.exe` for Windows and a `.dmg` for both kinds of Mac on GitHub's runners.
None is signed, to keep the project at zero cost; the release notes and the user guide say how to open them.

## What is built

- **The editor**: the bank of entries and the profiles, live preview with click-to-edit and the page-fit badge,
  inline validation, autosave to IndexedDB that keeps the previous project when it is replaced and edits in one tab
  at a time, undo and redo, drag and drop with a keyboard alternative, a command palette and photo cropping.
- **What goes in each profile**: priorities, lengths, exceptions, a short summary and “Fit to one page”.
- **Nine styles**, a shared Typst library, “Edit in Typst” and a style editor; interface themes, extendable with a
  small, validated JSON file or from a script. Every text and background pair meets WCAG AA contrast in every theme.
- **Exports** to PDF, JPG, Word, Typst, LaTeX, Markdown, JSON, JSON Resume and a `.zip` with all of them.
- **Imported templates**, Typst and LaTeX, and JSON Resume files.
- **The web app** online at [`bafif.github.io/foja/`](https://bafif.github.io/foja/), offline and installable, with
  its phone interface. The deploy runs by hand.
- **The command line**, with `build`, `validate` and `import`, and a converter from cvgen's data.
- **The desktop installers**. The Linux packages are tried; the Windows and macOS installers have not been tried yet,
  and no version has been published.
- **Spanish and English** everywhere.

## What comes next

In this order:

1. **The full test on real phones**: on an Android with Chrome and an iPhone with Safari, install it, edit, export
   through the share sheet, and use it offline. The automated tests emulate a phone in Chromium, which has neither
   Safari's quirks nor a real share sheet.
2. **Publish the CLI on npm** as `foja`, so that `npx foja` works without the repository. The package already bundles
   itself on `npm pack`.
3. **Microsoft Store**: package the published PWA as MSIX with PWABuilder, from a free individual Partner Center
   account.
4. **Desktop app and Flathub**: try the Windows and macOS installers and publish the first version; then native file
   access (projects opened and saved as files, with a file type of their own), updating itself, a Flatpak built from
   source, and the Flathub submission. Also AUR, and SignPath Foundation for Windows once the project qualifies.
5. **Android package**: the same Tauri 2 shell built for Android, as an APK on GitHub Releases and, if it qualifies,
   on F-Droid. On iPhone the PWA remains the app (see the distribution channels above).

Smaller things that can go in at any point:

- Check the Word export in Microsoft Word: so far it has been checked only in LibreOffice.
- An “Open in Overleaf” button. Overleaf takes the files in a POST to `overleaf.com/docs`, which sends the CV to a
  third party, so it has to be an explicit action and tested against the live service.
- **Versions**, off by default: snapshots on save and named versions (“sent to Acme”) with a preview, a diff of fields
  and restore, stored with the project. A history inside the app, not a link to any version control system.

Known limitations: the LaTeX export breaks lines a little differently from Typst and can run a few lines past one page
where the PDF fits; so can the Word export, by more, since Georgia is wider than XCharter (the example's programmer
profile runs about twenty lines over in LibreOffice). An imported LaTeX template shows in the preview without
click-to-edit or the marks of what spills over; only the data of templates that need LuaLaTeX is imported, and the
command line does not compile LaTeX: it writes the filled `.tex`.

### Long term

A general, graphical, live Typst editor built around freedom: you collect blocks (text, lists, entries, images,
shapes), arrange them on the page, and the template turns them into Typst. The CV is the first product on top of that
idea. The typed blocks of the data model keep the door open without building it now; until then everything stays
focused on CVs.

## Name and addresses

The name comes from *foja de servicios*, the record of someone's career.

- Code: [`bafif/foja`](https://github.com/bafif/foja), public, GPL-3.0 (an OSI licence, as SignPath requires). cvgen
  and its data live in `cvgen/`.
- Web: `bafif.github.io/foja/`. A custom domain can later serve the same site at its root with no other change.
- npm: `foja`. Flathub app ID: `io.github.bafif.Foja`.

## Dependencies

All free and open source, and all Node packages installed only inside the development container: Astro, React,
Tailwind, Zustand and `zundo`, dnd-kit, typst.ts (web compiler, renderer and the Node compiler for the CLI), `docx`,
and Vitest and Playwright for the tests. There is no ZIP or JSON Schema library: both are small enough to keep in
`packages/core`. The bundled fonts are XCharter, Latin Modern Mono and Noto Sans, each with its licence next to it.
Imported LaTeX templates use SwiftLaTeX's pdfTeX and XeTeX engines and TeX Live 2022 files, which the deployment
builds and the repository does not hold ([details and licences](../apps/web/public/latex/README.md)). The desktop app
adds Rust, Tauri 2 and its dialog and opener plugins, built only in its container and on the release runners; the
Flatpak will add `flatpak-builder`.

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
