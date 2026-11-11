// Rótulo: light and airy, for a short CV. The photo in a circle with a ring of the accent colour
// (the initials, when there is no photo), the name large and light on two lines, the subtitle in
// spaced capitals, and every title on a label of the accent colour, softened. A fine rule
// separates the two columns: the contacts, the skills and the side sections go on the left.

#import "/lib.typ": *

#let ink = rgb("#25272a")
#let muted = ink.lighten(40%)
#let accent-color = accent(rgb("#a35a83"))
#let deep = accent-color.darken(32%)
#let label-fill = accent-color.lighten(84%)
#let m = margins((top: 16, bottom: 14, left: 15, right: 15))
#let text-width = paper.width - m.left - m.right
#let side-width = text-width * 0.34
#let gutter = 11mm
#let main-width = text-width - side-width - gutter
#let main-x = m.left + side-width + gutter
#let small = base-size * 0.9
#let shows-picture = opt("photo", "square") != "none"
#let pic = side-width * 0.72

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "Noto Sans"), size: base-size, fill: ink, lang: lang)
#set par(leading: 0.7em, spacing: 0.7em * density, justify: false)
#set list(marker: text(fill: accent-color, sym.bullet), indent: 0pt, body-indent: 0.5em, spacing: 0.5em * density)
#show link: set text(hyphenate: false)

#geometry(main: (x: main-x, width: main-width), side: (x: m.left, width: side-width))

/// A title on its label.
#let tag(title) = block(above: 1.6em * density, below: 0.8em * density, sticky: true, box(
  fill: label-fill,
  inset: (x: 6pt, y: 4pt),
  radius: 1.5pt,
  text(size: small * 0.95, weight: "bold", tracking: 0.14em, fill: deep, upper(title)),
))

// ---------------------------------------------------------------- the left column

#let first-letter(s) = if s.len() > 0 { upper(s.clusters().first()) } else { "" }
#let picture = if not shows-picture { none } else {
  let inner = if cv.photo != none {
    box(clip: true, radius: 50%, width: pic, height: pic, image(cv.photo, width: pic, height: pic, fit: "cover"))
  } else {
    circle(radius: pic / 2, fill: label-fill, align(center + horizon, text(
      size: pic * 0.3,
      tracking: 0.04em,
      fill: deep,
      first-letter(cv.given) + first-letter(cv.family),
    )))
  }
  box(width: pic + 14pt, height: pic + 14pt, {
    place(center + horizon, circle(radius: pic / 2 + 5.5pt, stroke: 2.4pt + accent-color))
    place(center + horizon, inner)
  })
}

#let line-block(body) = block(above: 0.55em * density, below: 0pt, body)

#let sidebar = {
  set text(size: small)
  if picture != none {
    anchored("photo", column: "side", align(center, picture))
    v(0.4em)
  }
  if cv.contacts.len() > 0 {
    anchored("contacts", column: "side", {
      tag(labels.contact)
      for c in cv.contacts { line-block(contact-text(c)) }
    })
  }
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), column: "side", for g in row {
      tag(g.title)
      for it in g.items { line-block(it) }
    })
  }
  for s in cv.sections.filter(s => s.side) {
    anchored(s.path, column: "side", {
      tag(s.title)
      for b in s.blocks {
        anchored(b.path, column: "side", block(above: 0.75em * density, below: 0pt, if b.type == "entry" {
          text(weight: "bold", b.title)
          if b.place != "" { linebreak() + b.place }
          if b.period != "" { linebreak() + text(fill: muted, b.period) }
        } else { item-body(b) }))
      }
    })
  }
}

// ---------------------------------------------------------------- the right column

#let entry(b, compact) = anchored(b.path, block(above: 1.05em * density, below: 0pt, {
  grid(columns: (auto, 1fr), column-gutter: 0.5em, text(fill: accent-color, sym.bullet), {
    text(weight: "bold", b.title)
    let meta = (b.place, b.period).filter(x => x != "")
    if meta.len() > 0 {
      linebreak()
      text(size: small, fill: muted, meta.join(", "))
    }
    if b.note != none { par(text(size: small, fill: muted, b.note)) }
  })
  if not compact and b.items.len() > 0 {
    block(above: 0.6em, below: 0.6em, line(length: 100%, stroke: 0.5pt + ink.lighten(80%)))
    list(..b.items.map(item-body))
  }
}))

#let main-section(s) = anchored(s.path, {
  tag(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.55em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, block(above: 0.55em * density, below: 0pt, par(inline(b.text)))) }
  }
})

#let main = {
  v(0.6em)
  anchored("name", par(leading: 0.34em, text(size: base-size * 3.2, tracking: 0.01em, {
    cv.given
    linebreak()
    cv.family
  })))
  v(0.9em)
  anchored("subtitle", text(weight: "medium", tracking: 0.24em, upper(cv.subtitle)))
  if cv.highlight != none {
    v(0.35em)
    anchored("highlight", text(size: small)[#text(weight: "bold", fill: deep, cv.highlight.title) #h(0.4em) #cv.highlight.text])
  }
  if cv.summary != "" {
    v(0.9em)
    anchored("summary", par(inline(cv.summary)))
  }
  for s in cv.sections.filter(s => not s.side) { main-section(s) }
}

#grid(
  columns: (side-width + gutter / 2, main-width + gutter / 2),
  stroke: (x, y) => if x == 0 { (right: 0.6pt + ink.lighten(78%)) },
  inset: (x, y) => if x == 0 { (right: gutter / 2) } else { (left: gutter / 2) },
  sidebar, main,
)
