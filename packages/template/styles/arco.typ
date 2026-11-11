// Arco: made for a CV with little in it, so that it looks full and kind. A tinted panel down the
// left with the photo in an arch at its top (the initials, when there is no photo), the name large
// in a bold serif, the subtitle and the summary on a soft card, and titles over a fine line that
// ends in a diamond. Two columns: the panel holds the contacts, the skills and the side sections.

#import "/lib.typ": *

#let ink = rgb("#2b2427")
#let muted = ink.lighten(38%)
#let accent-color = accent(rgb("#b06a5b"))
#let deep = accent-color.darken(30%)
#let tint = accent-color.lighten(88%)
#let soft = accent-color.lighten(76%)
#let m = margins((top: 14, bottom: 12, left: 13, right: 14))
#let text-width = paper.width - m.left - m.right
#let side-width = text-width * 0.33
#let gutter = 10mm
#let main-width = text-width - side-width - gutter
#let main-x = m.left + side-width + gutter
#let pad = 5mm
#let small = base-size * 0.9
#let serif = "XCharter"
#let shows-picture = opt("photo", "square") != "none"
#let pic-width = side-width * 0.8
#let pic-height = pic-width * 1.2
// On the first page the panel starts halfway down the photo, which stands out of it.
#let panel-top = if shows-picture { m.top + pic-height * 0.55 } else { m.top - pad }

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m, background: context {
  let first = counter(page).get().first() == 1
  let y0 = if first { panel-top } else { 0pt }
  place(top + left, dx: m.left - pad, dy: y0, rect(
    width: side-width + 2 * pad,
    height: paper.height - y0,
    fill: tint,
    radius: if first { (top-left: 6mm, top-right: 6mm) } else { 0pt },
  ))
})
#set text(font: opt("font", "Noto Sans"), size: base-size, fill: ink, lang: lang)
#set par(leading: 0.62em, spacing: 0.62em * density, justify: false)
#set list(marker: text(fill: accent-color, sym.bullet), indent: 0.1em, body-indent: 0.5em, spacing: 0.45em * density)
#show link: set text(hyphenate: false)

#geometry(main: (x: main-x, width: main-width), side: (x: m.left, width: side-width))

// ---------------------------------------------------------------- ornaments

#let diamond(size: 4.4pt) = box(width: size, height: size, align(center + horizon, rotate(45deg, square(size: size * 0.68, fill: accent-color))))

/// A four-pointed star of radius `r`.
#let star(r) = {
  let w = r * 0.28
  polygon(fill: accent-color.lighten(25%), (r, 0pt), (r + w, r - w), (2 * r, r), (r + w, r + w), (r, 2 * r), (r - w, r + w), (0pt, r), (r - w, r - w))
}

#let title-line(title, size: base-size * 1.2) = block(above: 1.35em * density, below: 0.7em * density, sticky: true, {
  text(font: serif, size: size, weight: "bold", fill: ink, title)
  h(0.5em)
  box(width: 1fr, baseline: -0.3em, line(length: 100%, stroke: 0.6pt + accent-color.lighten(30%)))
  box(baseline: -(0.3em - 2.2pt), diamond())
})

// ---------------------------------------------------------------- the panel

#let first-letter(s) = if s.len() > 0 { upper(s.clusters().first()) } else { "" }
#let arch(w) = (top-left: w / 2, top-right: w / 2)
#let picture = if not shows-picture { none } else {
  let inner = if cv.photo != none {
    box(clip: true, radius: arch(pic-width), width: pic-width, height: pic-height, image(cv.photo, width: pic-width, height: pic-height, fit: "cover"))
  } else {
    box(radius: arch(pic-width), width: pic-width, height: pic-height, fill: soft, align(center + horizon, text(
      font: serif,
      size: pic-width * 0.3,
      weight: "bold",
      fill: white,
      first-letter(cv.given) + first-letter(cv.family),
    )))
  }
  box(stroke: 0.8pt + accent-color, radius: arch(pic-width + 9pt), inset: 4.5pt, inner)
}

#let dots(items) = block(above: 0.2em, stroke: (left: 0.7pt + accent-color.lighten(35%)), inset: (left: 10pt, y: 1pt), for (i, it) in items.enumerate() {
  block(above: if i == 0 { 0pt } else { 0.62em * density }, below: 0pt, {
    place(left, dx: -10pt - 2.6pt, dy: 0.12em, circle(radius: 2.3pt, fill: tint, stroke: 0.8pt + accent-color))
    it
  })
})

#let contact-line(c) = block(above: 0.6em * density, below: 0pt, grid(
  columns: (auto, 1fr),
  column-gutter: 0.55em,
  move(dy: 0.12em, circle(radius: 2.6pt, stroke: 0.9pt + accent-color)),
  contact-text(c),
))

#let side-section(s) = {
  title-line(s.title, size: base-size * 1.1)
  for b in s.blocks {
    anchored(b.path, column: "side", block(above: 0.65em * density, below: 0pt, if b.type == "entry" {
      text(weight: "bold", b.title)
      if b.place != "" { linebreak() + text(fill: deep, b.place) }
      if b.period != "" { linebreak() + text(fill: muted, b.period) }
    } else { item-body(b) }))
  }
}

#let sidebar = {
  set text(size: small)
  if picture != none {
    place(top + left, dx: -1mm, dy: 5mm, star(3.2pt))
    place(top + left, dx: 2.6mm, dy: 11mm, star(1.9pt))
    place(top + left, dx: -0.4mm, dy: 15.5mm, star(1.4pt))
    anchored("photo", column: "side", align(center, picture))
    v(3mm)
  }
  if cv.contacts.len() > 0 {
    anchored("contacts", column: "side", {
      title-line(labels.contact, size: base-size * 1.1)
      for c in cv.contacts { contact-line(c) }
    })
  }
  for (i, row) in cv.skills.enumerate() {
    anchored("skills." + str(i), column: "side", for g in row {
      title-line(g.title, size: base-size * 1.1)
      dots(g.items)
    })
  }
  for s in cv.sections.filter(s => s.side) { anchored(s.path, column: "side", side-section(s)) }
}

// ---------------------------------------------------------------- the main column

#let entry(b, compact) = anchored(b.path, block(above: 1em * density, below: 0pt, {
  text(weight: "bold", b.title)
  if b.place != "" or b.period != "" {
    linebreak()
    text(size: small, {
      if b.place != "" { text(fill: deep, weight: "medium", b.place) }
      if b.place != "" and b.period != "" { h(0.45em) + text(fill: accent-color, "|") + h(0.45em) }
      text(fill: muted, b.period)
    })
  }
  if b.note != none { par(text(size: small, fill: muted, b.note)) }
  if not compact and b.items.len() > 0 { block(above: 0.5em * density, list(..b.items.map(item-body))) }
}))

#let main-section(s) = anchored(s.path, {
  title-line(s.title)
  for b in s.blocks {
    if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
      anchored(b.path, block(above: 0.5em * density, below: 0pt, list(item-body(b))))
    } else { anchored(b.path, block(above: 0.5em * density, below: 0pt, par(justify: true, inline(b.text)))) }
  }
})

#let main = {
  anchored("name", par(leading: 0.32em, text(font: serif, size: base-size * 3.1, weight: "bold", fill: ink, {
    cv.given
    linebreak()
    cv.family
  })))
  block(above: 1em, fill: soft.lighten(30%), radius: 5pt, inset: (x: 11pt, y: 10pt), width: 100%, {
    anchored("subtitle", text(size: base-size * 1.12, weight: "bold", fill: deep, cv.subtitle))
    if cv.highlight != none {
      v(0.3em)
      anchored("highlight", text(size: small)[#text(weight: "bold", fill: deep, cv.highlight.title): #cv.highlight.text])
    }
    if cv.summary != "" {
      v(0.45em)
      anchored("summary", par(justify: true, inline(cv.summary)))
    }
  })
  for s in cv.sections.filter(s => not s.side) { main-section(s) }
}

#grid(columns: (side-width, main-width), column-gutter: gutter, sidebar, main)
