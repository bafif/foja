// The package the fixture imports, as it would come in the upload next to main.typ.
#let cv-header(name: "", email: "", site: "") = {
  align(center, text(size: 18pt, weight: "bold", name))
  align(center, [#email · #site])
}

#let cv-entry(title, place, period, body) = block(above: 0.8em, {
  strong(title)
  h(1fr)
  period
  linebreak()
  emph(place)
  body
})
