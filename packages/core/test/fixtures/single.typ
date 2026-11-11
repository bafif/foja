// A one-file CV template written for Foja's tests, in the shape of the common ones: the
// definitions first, then a header through `#show: resume.with(...)` and the sample content.
#let accent = rgb("#26428b")

#let resume(author: "", email: "", phone: "", linkedin: "", accent-color: accent, body) = {
  set document(author: author, title: author)
  set page(margin: 1.5cm)
  set text(font: "Noto Sans", size: 10pt)
  show heading: it => block(above: 1em, below: 0.5em, text(fill: accent-color, weight: "bold", upper(it.body)))
  align(center, text(size: 20pt, weight: "bold", author))
  align(center, [#email | #phone | #linkedin])
  body
}

#let work(title: "", company: "", location: "", dates: "") = {
  grid(columns: (1fr, auto), strong(company), location, emph(title), dates)
}

#let edu(institution: "", degree: "", dates: "") = {
  grid(columns: (1fr, auto), strong(institution), dates)
  emph(degree)
}

#show: resume.with(
  author: "Jane Doe",
  email: "jane@example.com",
  phone: "+1 555 010 0000",
  linkedin: "linkedin.com/in/janedoe",
  accent-color: rgb("#26428b"),
)

== Summary
Engineer who likes tidy systems.

== Experience
#work(title: "Software Engineer", company: "Acme", location: "Springfield", dates: "Aug 2021 – Present")
- Built the billing service.
- Cut response times in half.

#work(title: "Intern", company: "Globex", location: "Shelbyville", dates: "Jun 2020 - Aug 2020")
- Wrote tests.

== Education
#edu(institution: "State University", degree: "B.Sc. Computer Science", dates: "2016 – 2020")

== Skills
- *Languages:* Python, TypeScript
