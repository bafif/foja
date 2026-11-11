# Runs in a Debian bookworm container (scripts/latex-assets.sh): installs TeX Live 2022, free fonts
# and FontAwesome 5 (from TeX Live 2022's final archive, checked against a fixed SHA-256, instead of
# the 500 MB texlive-fonts-extra), then packs two sets of files, each by its bare name:
#  - /out/texlive.tar.gz for pdfLaTeX: what common.tex, the test templates for pdfLaTeX and the
#    making of LaTeX's format read (found with -recorder), plus every file of FontAwesome 5;
#  - /out/xetex.tar.gz for XeLaTeX: the same for common-xetex.tex and the XeLaTeX test templates,
#    Latin Modern (fontspec's default) and FontAwesome 5 in OpenType, the TECkit mapping fontspec
#    uses, and xetexfontlist.txt, the list of those fonts that SwiftLaTeX's XeTeX reads instead of
#    fontconfig (fontlist.py). Other fonts a template names, the editor asks the user to upload.
#    The test templates use Foja's own fonts (packages/template/fonts), installed here only to
#    compile them, not packed.
# Their lists go to /out/files.txt and /out/xetex-files.txt.
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-pictures texlive-lang-spanish texlive-lang-english texlive-xetex lmodern \
    fonts-lmodern fontconfig python3-fonttools \
    curl ca-certificates xz-utils >/dev/null 2>&1

fa=https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2022/tlnet-final/archive/fontawesome5.tar.xz
curl -fsSL "$fa" -o /tmp/fa5.tar.xz
echo "4d85aab86f679d360e7c7c812a055d9c03dd658e31bccfca4a97604497b0cc1c  /tmp/fa5.tar.xz" | sha256sum -c --quiet -
mkdir -p /usr/local/share/texmf
tar -xJf /tmp/fa5.tar.xz -C /usr/local/share/texmf --exclude=tlpkg
mktexlsr >/dev/null 2>&1
updmap-sys --enable Map=fontawesome5.map >/dev/null 2>&1

mkdir -p /usr/local/share/fonts/foja /w/pdftex /w/xetex
cp /repo-fonts/*.ttf /repo-fonts/*.otf /usr/local/share/fonts/foja/
fc-cache -f >/dev/null
cp /in/common.tex /w/pdftex/
cp /in/common-xetex.tex /w/xetex/
for doc in /fx/*.tex; do
    if grep -q '{fontspec}' "$doc"; then cp "$doc" /w/xetex/; else cp "$doc" /w/pdftex/; fi
done

recorded() { cat *.fls | sed -n 's/^INPUT //p' | grep -v '^/w/\|^[^/]' | grep -v '\.fmt$\|texmf\.cnf$'; }
pack() { # pack <name> < paths
    rm -rf /pack && mkdir /pack
    while read -r path; do
        name=$(basename "$path")
        [ -e "/pack/$name" ] || cp -L "$path" "/pack/$name"
    done
    [ "$1" = xetex ] && python3 /in/fontlist.py /pack /tex/
    ls /pack | sort > "/out/$1-files.txt"
    (cd /pack && tar --owner=0 --group=0 --mtime=2023-01-01 --sort=name -cf - * | gzip -9n > "/out/$1.tar.gz")
    echo "$1: $(ls /pack | wc -l) files, $(du -sb /pack | cut -f1) bytes, $(stat -c %s "/out/$1.tar.gz") compressed"
}
fa5() { find /usr/local/share/texmf -type f ! -name 'ls-R' "$@"; }

cd /w/pdftex
for doc in *.tex; do
    pdflatex -interaction=nonstopmode -halt-on-error -recorder "$doc" >/dev/null || { tail -20 "${doc%.tex}.log"; exit 1; }
done
pdftex -ini -etex -recorder -jobname=format '*pdflatex.ini' >/dev/null 2>&1 || true
{ recorded; fa5 ! -name '*.otf'; } | sort -u | pack texlive
mv /out/texlive-files.txt /out/files.txt

cd /w/xetex
for doc in *.tex; do
    xelatex -interaction=nonstopmode -halt-on-error -recorder "$doc" >/dev/null || { tail -20 "${doc%.tex}.log"; exit 1; }
done
xetex -ini -etex -recorder -jobname=format '*xelatex.ini' >/dev/null 2>&1 || true
{
    recorded
    fa5 -name '*.otf'
    find /usr/share/texlive/texmf-dist/fonts/misc/xetex/fontmapping/base -name 'tex-text.tec'
    # Latin Modern Roman, Sans and Mono at their 10 pt design size, fontspec's default.
    find /usr/share/texmf/fonts/opentype/public/lm -regex '.*/lm\(roman\|sans\|mono\)10-\(regular\|bold\|italic\|bolditalic\|oblique\|boldoblique\)\.otf'
    find /usr/share/texmf/fonts/opentype/public/lm -name 'lmromancaps10-regular.otf'
} | sort -u | pack xetex
