// Recto: modern and plain, everything flush left in a sans-serif. The name in bold, the subtitle in
// the accent colour, the contacts on one line; section titles in small capitals of the accent colour
// over a hairline; each entry with the position and the dates on one line and the institution
// below. One column of plain text, no icons or pictures of text, laid out in the order it is read,
// so that applicant tracking systems read it as people do.

#import "/lib.typ": *

#let ink = rgb("#1b1f23")
#let muted = ink.lighten(40%)
#let accent-color = accent(rgb("#1f4e79"))
#let m = margins((top: 14, bottom: 14, left: 16, right: 16))
#let text-width = paper.width - m.left - m.right
#let small = base-size * 0.9

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "Noto Sans"), size: base-size * 0.95, fill: ink, lang: lang, hyphenate: false)
#set par(leading: 0.6em, spacing: 0.6em * density, justify: false)
#set list(marker: text(fill: accent-color, sym.bullet), indent: 0.2em, body-indent: 0.5em, spacing: 0.4em * density)

#geometry(main: (x: m.left, width: text-width))

#let section-title(title) = block(
  above: 1.3em * density,
  below: 0.55em * density,
  sticky: true,
  width: 100%,
  inset: (bottom: 3pt),
  stroke: (bottom: 0.5pt + ink.lighten(78%)),
  text(size: small, weight: "bold", tracking: 0.1em, fill: accent-color, upper(title)),
)

#let entry(b, compact) = anchored(b.path, block(above: 0.85em * density, below: 0pt, {
  text(weight: "bold", b.title)
  if b.period != "" {
    h(1fr)
    text(size: small, fill: muted, b.period)
  }
  if b.place != "" {
    linebreak()
    text(fill: muted, b.place)
  }
  if b.note != none {
    linebreak()
    text(size: small, fill: muted, b.note)
  }
  if not compact and b.items.len() > 0 { list(..b.items.map(item-body)) }
}))

#let section(s) = anchored(s.path, {
  section-title(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.45em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, par(inline(b.text))) }
  }
})

// ---------------------------------------------------------------- header

#let head = {
  anchored("name", par(text(size: base-size * 2.2, weight: "bold", cv.name)))
  if cv.subtitle != "" { anchored("subtitle", par(text(size: base-size * 1.15, weight: "medium", fill: accent-color, cv.subtitle))) }
  if cv.contacts.len() > 0 { anchored("contacts", par(text(size: small, fill: muted, cv.contacts.map(contact-text).join(" | ")))) }
}
#let picture = photo(base-size * 7)
#if picture == none { head } else { grid(columns: (1fr, auto), column-gutter: 1.2em, align: (horizon, top), head, anchored("photo", picture)) }

// ---------------------------------------------------------------- body

#if cv.highlight != none {
  v(0.6em * density)
  anchored("highlight", par[#text(weight: "bold", fill: accent-color, cv.highlight.title): #cv.highlight.text])
}
#if cv.summary != "" {
  section-title(labels.profile)
  anchored("summary", par(inline(cv.summary)))
}
#if cv.skills.len() > 0 {
  section-title(labels.skills)
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), { for g in row { par[#text(weight: "bold", g.title): #g.items.join(", ")] } })
  }
}
#for s in cv.sections { section(s) }
