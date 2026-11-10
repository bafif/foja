// Llano: the plainest and the densest, flush left in a sans-serif. The name in the accent colour,
// the subtitle and the contacts below it; section titles in bold, in the accent colour, with no
// rule; each entry on one line, the position and the institution with the dates on the right. One
// column of plain text, no icons or pictures of text, laid out in the order it is read, so that
// applicant tracking systems read it as people do.

#import "/lib.typ": *

#let ink = rgb("#202020")
#let muted = ink.lighten(42%)
#let accent-color = accent(rgb("#1f5f5b"))
#let m = margins((top: 13, bottom: 13, left: 15, right: 15))
#let text-width = paper.width - m.left - m.right
#let small = base-size * 0.9

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "Noto Sans"), size: base-size * 0.95, fill: ink, lang: lang, hyphenate: false)
#set par(leading: 0.55em, spacing: 0.55em * density, justify: false)
#set list(marker: text(fill: muted, [–]), indent: 0pt, body-indent: 0.55em, spacing: 0.35em * density)

#geometry(main: (x: m.left, width: text-width))

#let section-title(title) = block(
  above: 1.2em * density,
  below: 0.45em * density,
  sticky: true,
  text(size: base-size * 1.1, weight: "bold", fill: accent-color, title),
)

#let entry(b, compact) = anchored(b.path, block(above: 0.7em * density, below: 0pt, {
  text(weight: "bold", b.title)
  if b.place != "" { [, #b.place] }
  if b.period != "" {
    h(1fr)
    text(size: small, fill: muted, b.period)
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
      anchored(b.path, block(above: 0.4em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, par(inline(b.text))) }
  }
})

// ---------------------------------------------------------------- header

#let head = {
  anchored("name", par(text(size: base-size * 2, weight: "medium", fill: accent-color, cv.name)))
  if cv.subtitle != "" { anchored("subtitle", par(text(size: base-size * 1.1, cv.subtitle))) }
  if cv.contacts.len() > 0 { anchored("contacts", par(text(size: small, fill: muted, cv.contacts.map(contact-text).join(" · ")))) }
}
#let picture = photo(base-size * 6.5)
#if picture == none { head } else { grid(columns: (1fr, auto), column-gutter: 1.2em, align: (horizon, top), head, anchored("photo", picture)) }

// ---------------------------------------------------------------- body

#if cv.highlight != none {
  v(0.5em * density)
  anchored("highlight", par[#text(weight: "bold", cv.highlight.title): #cv.highlight.text])
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
