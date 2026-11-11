# Runs in an Alpine container (scripts/latex-assets.sh): installs TeX Live 2026 (the release BusyTeX's engines are
# built from), free fonts and FontAwesome 5 (from TeX Live 2022's final archive, checked against a fixed SHA-256,
# instead of the 2 GB of texmf-dist-fontsextra; it has not changed since), then makes one set of files per engine:
#  - pdftex: what common.tex and the test templates for pdfLaTeX read (found with -recorder), plus every file of
#    FontAwesome 5;
#  - xetex: the same for common-xetex.tex and the XeLaTeX test templates, plus what xdvipdfmx reads to turn their
#    .xdv into a PDF, Latin Modern (fontspec's default) and FontAwesome 5 in OpenType, fonts.conf, which tells
#    fontconfig to look for fonts there and among the template's files, and ICU's data (78, the version BusyTeX's
#    engines are built with, checked against a fixed SHA-256) cut down to what XeTeX reads font names with. Other
#    fonts a template names, the editor asks the user to upload. The test templates use Foja's own fonts
#    (packages/template/fonts), installed here only to compile them, not packed.
# Each set keeps TeX Live's layout under texmf-dist/, with its ls-R and texmf.cnf, as the engine looks for it. Then
# formats.mjs makes LaTeX's format with BusyTeX's own engine (/engine), adds it to the set, and compiles every document
# again with nothing but the set: a file it lacks fails here, not in the browser. Out: /out/<engine>.tar.gz and
# /out/<engine>-files.txt.
set -eu
apk add --no-cache texlive texlive-xetex texmf-dist-latexrecommended texmf-dist-latexextra \
    texmf-dist-fontsrecommended texmf-dist-pictures texmf-dist-langspanish texmf-dist-langenglish \
    fontconfig nodejs curl xz tar icu >/dev/null

dist=$(kpsewhich -var-value TEXMFDIST)
local=$(kpsewhich -var-value TEXMFLOCAL)
sysvar=$(kpsewhich -var-value TEXMFSYSVAR)
sysconfig=$(kpsewhich -var-value TEXMFSYSCONFIG)

fa=https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2022/tlnet-final/archive/fontawesome5.tar.xz
curl -fsSL "$fa" -o /tmp/fa5.tar.xz
echo "4d85aab86f679d360e7c7c812a055d9c03dd658e31bccfca4a97604497b0cc1c  /tmp/fa5.tar.xz" | sha256sum -c -s -
mkdir -p "$local"
tar -xJf /tmp/fa5.tar.xz -C "$local" --exclude=tlpkg
mktexlsr >/dev/null 2>&1
updmap-sys --enable Map=fontawesome5.map >/dev/null 2>&1

mkdir -p /usr/share/fonts/foja /w/pdftex /w/xetex
cp /repo-fonts/*.ttf /repo-fonts/*.otf /usr/share/fonts/foja/
# Here XeLaTeX finds fonts by name through the system's fontconfig: TeX Live's OpenType fonts join it.
ln -s "$dist/fonts/opentype" /usr/share/fonts/texlive
ln -s "$local/fonts/opentype" /usr/share/fonts/texlive-local
fc-cache -f >/dev/null
cp /in/common.tex /w/pdftex/
cp /in/common-xetex.tex /w/xetex/
for doc in /fx/*.tex; do
    if grep -q '{fontspec}' "$doc"; then cp "$doc" /w/xetex/; else cp "$doc" /w/pdftex/; fi
done

# The files a run read, from its .fls, without the document's own, the format and texmf.cnf (packed apart).
recorded() { cat ./*.fls | sed -n 's/^INPUT //p' | grep '^/' | grep -v '^/w/' | grep -v '\.fmt$\|/texmf\.cnf$\|/ls-R$'; }
fa5() { find "$local" -type f ! -name ls-R "$@"; }
# Copies each path into $2/texmf-dist at its place in its tree (the TEXMF trees become one), and adds texmf.cnf and
# the tree's ls-R, without which kpathsea finds nothing there.
stage() { # stage <list> <dir>
    rm -rf "$2" && mkdir -p "$2/texmf-dist/web2c"
    sort -u "$1" | while read -r file; do
        rel=
        for tree in "$dist" "$local" "$sysvar" "$sysconfig"; do
            case "$file" in "$tree"/*) rel=${file#"$tree"/}; break ;; esac
        done
        [ -n "$rel" ] || continue
        mkdir -p "$2/texmf-dist/$(dirname "$rel")"
        cp -L "$file" "$2/texmf-dist/$rel"
    done
    cp "$dist/web2c/texmf.cnf" "$2/texmf-dist/web2c/texmf.cnf"
    mktexlsr "$2/texmf-dist" >/dev/null 2>&1
}
pack() { # pack <engine> <dir>
    (cd "$2" && find . -type f | sed 's|^\./||' | sort) > "/out/$1-files.txt"
    (cd "$2" && tar --owner=0 --group=0 --mtime=2026-01-01 --sort=name -cf - ./*) | gzip -9n > "/out/$1.tar.gz"
    echo "$1: $(wc -l < "/out/$1-files.txt") files, $(du -sb "$2" | cut -f1) bytes, $(stat -c %s "/out/$1.tar.gz") compressed"
}

cd /w/pdftex
for doc in *.tex; do
    pdflatex -interaction=nonstopmode -halt-on-error -recorder "$doc" >/dev/null || { tail -20 "${doc%.tex}.log"; exit 1; }
done
{ recorded; fa5 ! -name '*.otf'; } > /tmp/pdftex-run.txt
rm -f ./*.fls
pdftex -ini -recorder -jobname=pdflatex -translate-file=cp227.tcx '*pdflatex.ini' >/dev/null 2>&1 || true
{ cat /tmp/pdftex-run.txt; recorded; } > /tmp/pdftex-ini.txt
stage /tmp/pdftex-ini.txt /stage/pdftex
stage /tmp/pdftex-run.txt /pack/pdftex
node /in/formats.mjs /engine pdftex /stage/pdftex /pack/pdftex /w/pdftex
pack pdftex /pack/pdftex

# The fonts XeTeX opens by file name and everything xdvipdfmx opens are not recorded: they come from kpathsea's report
# of each search.
found() { sed -n 's/^kdebug:returning from .*search(.*) =>[[:space:]]*//p' | tr ' ' '\n' | grep '^/' | grep -v '/ls-R$' || true; }
cd /w/xetex
for doc in *.tex; do
    xelatex -interaction=nonstopmode -halt-on-error -recorder -no-pdf -kpathsea-debug=32 "$doc" >/dev/null 2>/tmp/kdebug.txt \
        || { tail -20 "${doc%.tex}.log"; exit 1; }
    found < /tmp/kdebug.txt >> /tmp/xetex-found.txt
    xdvipdfmx --kpathsea-debug=32 -o /dev/null "${doc%.tex}.xdv" 2>&1 | found >> /tmp/xetex-found.txt
done
{
    recorded
    cat /tmp/xetex-found.txt
    fa5 -name '*.otf'
    find "$dist/fonts/misc/xetex/fontmapping/base" -name 'tex-text.tec'
    # Latin Modern Roman, Sans and Mono at their 10 pt design size, fontspec's default.
    find "$dist/fonts/opentype/public/lm" -regex '.*/lm\(roman\|sans\|mono\)10-\(regular\|bold\|italic\|bolditalic\|oblique\|boldoblique\)\.otf'
    find "$dist/fonts/opentype/public/lm" -name 'lmromancaps10-regular.otf'
} | grep -v '^/usr/share/fonts/' > /tmp/xetex-run.txt
rm -f ./*.fls
xetex -ini -etex -recorder -jobname=xelatex xelatex.ini >/dev/null 2>&1 || true
{ cat /tmp/xetex-run.txt; recorded; } > /tmp/xetex-ini.txt
stage /tmp/xetex-ini.txt /stage/xetex
stage /tmp/xetex-run.txt /pack/xetex
icu=https://github.com/unicode-org/icu/releases/download/release-78.3/icu4c-78.3-data-bin-l.zip
curl -fsSL "$icu" -o /tmp/icu.zip
echo "982619632b78887f1895b063e96e8c3cc7f99283337c8abbd05aa71635de613c  /tmp/icu.zip" | sha256sum -c -s -
unzip -o -q /tmp/icu.zip icudt78l.dat -d /tmp/icu
# The Mac Roman converter ("macintosh") and the table of converters' names: without them XeTeX cannot read a font's
# names and stops.
icupkg --list /tmp/icu/icudt78l.dat | grep -vx 'cnvalias.icu' | grep -vx 'macos-0_2-10.2.cnv' > /tmp/icu/remove.txt
icupkg -r /tmp/icu/remove.txt /tmp/icu/icudt78l.dat /pack/xetex/icudt78l.dat
for dir in /stage/xetex /pack/xetex; do cp /in/fonts.conf "$dir/fonts.conf"; done
cp /pack/xetex/icudt78l.dat /stage/xetex/
node /in/formats.mjs /engine xetex /stage/xetex /pack/xetex /w/xetex /repo-fonts
pack xetex /pack/xetex
