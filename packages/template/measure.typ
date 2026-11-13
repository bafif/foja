// Where Typst puts each word of a profile, for the LaTeX and Word exports to break their lines where it does
// (packages/core/src/lines.ts). It lays out the style at `sys.inputs.style` as it is, every word followed by an
// invisible marker with where the word ends on the page, its width, its size and how wide a space is there. The
// marker after the last word of a paragraph goes to the paragraph's bottom left corner instead; lines.ts knows. A
// word whose start marker is on another line than its end may start a line, end a paragraph or be cut in two at the
// end of a line: it also tells where it starts, how far apart two lines are, how wide a hyphen is and how wide each
// of its endings is, for the exports to find where Typst put the hyphen.

// Text that starts with a word joiner (zero width, no glyph) is one of those endings, being measured.
#let measuring = "\u{2060}"

#show regex("\S+"): it => {
  if it.text.starts-with(measuring) { return it }
  [#metadata(none)<foja-word-start>]
  it
  context {
    let end = here().position()
    let start = query(selector(<foja-word-start>).before(here())).last().location().position()
    let width(s) = measure(measuring + s).width.pt()
    let word = (
      text: it.text,
      end: (end.page, end.x.pt(), end.y.pt()),
      width: width(it.text),
      size: text.size.pt(),
      space: width("a a") - width("aa"),
    )
    if start.page != end.page or start.y != end.y {
      // Where it starts when that is on its line, how far apart two lines are, and how wide a hyphen is.
      let clusters = it.text.clusters()
      word.start = start.x.pt()
      word.endings = range(1, clusters.len()).map(k => width(clusters.slice(k).join()))
      word.pitch = (measure([#measuring X \ X]).height - measure([#measuring X]).height).pt()
      word.hyphen = width("-")
    }
    [#metadata(word)<foja-word>]
  }
}

#include sys.inputs.style
