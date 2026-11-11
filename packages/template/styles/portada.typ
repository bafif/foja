// Portada: an editorial page, as in a magazine. The contacts in spaced capitals across the top,
// the photo beside the name set very large in capitals, the subtitle in italics; then every part
// on a row of its own, its title on the left in a serif and the content on the right, with a rule
// between rows. The skills close the page in columns. It looks as good with little as with a lot.

#import "/lib.typ": *

#let ink = rgb("#1b1b1b")
#let muted = ink.lighten(40%)
#let accent-color = accent(rgb("#1b1b1b"))
#let m = margins((top: 12, bottom: 14, left: 17, right: 17))
#let text-width = paper.width - m.left - m.right
#let label-width = text-width * 0.22
#let gutter = 7mm
#let small = base-size * 0.9
#let serif = "XCharter"
#let shows-picture = opt("photo", "square") != "none"

#set document(..document-info)
#set page(width: paper.width, height: paper.height, margin: m)
#set text(font: opt("font", "Noto Sans"), size: base-size, fill: ink, lang: lang)
#set par(leading: 0.62em, spacing: 0.62em * density, justify: false)
#set list(marker: text(fill: accent-color, sym.bullet), indent: 0pt, body-indent: 0.5em, spacing: 0.42em * density)
#show link: set text(hyphenate: false)

// Every part spans the page: its title on the left belongs to it as much as its content.
#geometry(main: (x: m.left, width: text-width))

// ---------------------------------------------------------------- pieces

#let row-title(title) = par(leading: 0.3em, text(font: serif, size: base-size * 1.3, fill: ink, title))
#let rule = block(above: 1.1em * density, below: 1.1em * density, sticky: true, line(length: 100%, stroke: 0.6pt + accent-color))
#let row(title, body) = grid(columns: (label-width, 1fr), column-gutter: gutter, row-title(title), body)

#let entry(b, compact) = anchored(b.path, block(above: 1em * density, below: 0pt, {
  text(font: serif, size: base-size * 1.2, b.title)
  if b.place != "" { linebreak() + text(size: small, weight: "bold", b.place) }
  if b.period != "" { linebreak() + text(size: small, fill: muted, b.period) }
  if b.note != none { par(text(size: small, fill: muted, b.note)) }
  if not compact and b.items.len() > 0 { block(above: 0.5em * density, list(..b.items.map(item-body))) }
}))

#let section(s) = anchored(s.path, row(s.title, for b in s.blocks {
  if b.type == "entry" { entry(b, s.compact) } else if b.type == "item" {
    anchored(b.path, block(above: 0.5em * density, below: 0pt, list(item-body(b))))
  } else { anchored(b.path, block(above: 0.5em * density, below: 0pt, par(inline(b.text)))) }
}))

#let first-letter(s) = if s.len() > 0 { upper(s.clusters().first()) } else { "" }
#let pic-height = label-width * 1.25
#let picture = if not shows-picture { none } else if cv.photo != none {
  if cv.photo-shape == "circle" {
    box(clip: true, radius: 50%, width: label-width, height: label-width, image(cv.photo, width: label-width, height: label-width, fit: "cover"))
  } else {
    let r = if cv.photo-shape == "rounded" { 4pt } else { 0pt }
    box(clip: true, radius: r, width: label-width, height: pic-height, image(cv.photo, width: label-width, height: pic-height, fit: "cover"))
  }
} else {
  box(width: label-width, height: pic-height, fill: accent-color.lighten(90%), align(center + horizon, text(
    font: serif,
    size: label-width * 0.36,
    fill: accent-color,
    first-letter(cv.given) + first-letter(cv.family),
  )))
}

// ---------------------------------------------------------------- page

// The place goes in the heading, the rest across the top, spread out.
#let place-contact = cv.contacts.find(c => c.kind == "location")
#let top-contacts = cv.contacts.filter(c => c.kind != "location")
#if top-contacts.len() > 0 {
  anchored("contacts", block(below: 1.3em * density, par(justify: false, text(size: small * 0.88, tracking: 0.07em, top-contacts
    .map(c => box(upper(contact-text(c))))
    .join(h(1.5em) + h(1fr))))))
}

#let head = {
  anchored("name", par(leading: 0.3em, text(font: serif, size: base-size * 3.4, tracking: -0.01em, upper({
    cv.given
    linebreak()
    cv.family
  }))))
  v(1em * density)
  grid(
    columns: (1fr, 1fr),
    column-gutter: 1.5em,
    align: bottom,
    anchored("subtitle", text(font: serif, size: base-size * 1.3, style: "italic", cv.subtitle)),
    {
      if place-contact != none {
        text(size: small, weight: "bold", place-contact.value)
        if cv.highlight != none { v(0.5em) }
      }
      if cv.highlight != none {
        anchored("highlight", {
          text(size: small * 0.9, weight: "bold", tracking: 0.1em, upper(cv.highlight.title))
          linebreak()
          text(font: serif, size: base-size * 1.3, cv.highlight.text)
        })
      }
    },
  )
}
#if picture == none { head } else {
  grid(columns: (label-width, 1fr), column-gutter: gutter, align: (top, bottom), anchored("photo", picture), head)
}

#let first = true
#if cv.summary != "" {
  v(1.6em * density)
  anchored("summary", row(labels.profile, par(inline(cv.summary))))
  first = false
}
#for s in cv.sections {
  if first { v(1.6em * density) } else { rule }
  section(s)
  first = false
}
#for (i, groups) in cv.skills.enumerate() {
  if first { v(1.6em * density) } else { rule }
  first = false
  anchored("skills." + str(i), if groups.len() == 1 {
    row(groups.first().title, par(groups.first().items.join(h(0.4em) + text(fill: muted, sym.dot.c) + h(0.4em))))
  } else {
    grid(columns: (label-width, ..((1fr,) * (groups.len() - 1))), column-gutter: gutter, ..groups.map(g => {
      row-title(g.title)
      v(0.35em)
      if g.items.len() > 0 { text(size: small, g.items.map(x => "· " + x).join(linebreak())) }
    }))
  })
}
