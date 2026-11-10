// Claustro: the classic one-page CV of university career offices (in the manner of Harvard's).
// Serif; the name centred with the contacts on one line below it; section titles in capitals over a
// rule from margin to margin; each entry with the institution above and the position and dates
// below, then bullets. One column of plain text, no icons or pictures of text, laid out in the
// order it is read, so that applicant tracking systems read it as people do.

#import "/lib.typ": *

#let ink = rgb("#1a1a1a")
#let muted = ink.lighten(38%)
#let accent-color = accent(ink)
#let m = margins((top: 14, bottom: 14, left: 18, right: 18))
#let text-width = paper.width - m.left - m.right
#let small = base-size * 0.9

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "XCharter"), size: base-size, fill: ink, lang: lang, hyphenate: false)
#set par(leading: 0.55em, spacing: 0.55em * density, justify: false)
#set list(marker: [•], indent: 0.5em, body-indent: 0.5em, spacing: 0.35em * density)

#geometry(main: (x: m.left, width: text-width))

#let section-title(title) = block(
  above: 1.15em * density,
  below: 0.5em * density,
  sticky: true,
  width: 100%,
  inset: (bottom: 2.5pt),
  stroke: (bottom: 0.7pt + accent-color),
  text(weight: "bold", tracking: 0.05em, upper(title)),
)

// The institution in bold above; the position in italics and the dates on the right below it. An
// entry without an institution has the position in bold and the dates on its line.
#let entry(b, compact) = anchored(b.path, block(above: 0.8em * density, below: 0pt, {
  if b.place != "" {
    text(weight: "bold", b.place)
    linebreak()
    emph(b.title)
  } else { text(weight: "bold", b.title) }
  if b.period != "" {
    h(1fr)
    b.period
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

#let head = align(center, {
  anchored("name", par(text(size: base-size * 2.2, weight: "bold", cv.name)))
  if cv.subtitle != "" { anchored("subtitle", par(text(size: base-size * 1.1, style: "italic", cv.subtitle))) }
  if cv.contacts.len() > 0 { anchored("contacts", par(text(size: small, cv.contacts.map(contact-text).join(" · ")))) }
})
#let picture = photo(base-size * 7)
#if picture == none { head } else {
  // The photo on the right, an empty cell as wide on the left, so the header stays centred.
  grid(columns: (base-size * 7, 1fr, base-size * 7), column-gutter: 1em, align: (top, horizon, top), [], head, anchored("photo", picture))
}

// ---------------------------------------------------------------- body

#if cv.highlight != none {
  v(0.6em * density)
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
