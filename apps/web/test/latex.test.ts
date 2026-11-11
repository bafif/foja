import { expect, test } from "vitest";
import { latexErrors, missingFonts } from "../src/lib/latex";

// From XeLaTeX's log for a template that names two fonts Foja lacks (fontspec 2.9).
const log = String.raw`! Package fontspec Error: 
(fontspec)                The font "Noto Sans" cannot be found; this may be
(fontspec)                but usually is not a fontspec bug. Either there is
(fontspec)                a typo in the font name/file, the font is not
(fontspec)                installed (correctly), or there is a bug in the
(fontspec)                underlying font loading engine (XeTeX/luaotfload).

For immediate help type H <return>.
 ...                                              
                                                  
l.6 \setmainfont{Noto Sans}
                           
! Package fontspec Error: 
(fontspec)                The font "XCharter" cannot be found; this may be
(fontspec)                but usually is not a fontspec bug. Either there is
(fontspec)                a typo in the font name/file, the font is not
(fontspec)                installed (correctly), or there is a bug in the
(fontspec)                underlying font loading engine (XeTeX/luaotfload).

For immediate help type H <return>.
 ...                                              
                                                  
l.7 \newfontfamily
                  \headingfont{XCharter}
`;

test("a package's error is read whole, with the source line, and the fonts it misses are named", () => {
  const errors = latexErrors(log + log);
  expect(errors).toHaveLength(2);
  expect(errors[0]).toMatch(/^Package fontspec Error: The font "Noto Sans" cannot be found; .* \(l\.6 \\setmainfont\{Noto Sans\}\)$/);
  expect(missingFonts(errors)).toEqual(["Noto Sans", "XCharter"]);
});

test("a log with no error line says how it ended", () => {
  expect(latexErrors("a\nb\nNo pages of output.")).toEqual(["a b No pages of output."]);
});
