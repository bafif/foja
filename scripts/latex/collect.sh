# Runs in a Debian bookworm container (scripts/latex-assets.sh): installs TeX Live 2022 and
# FontAwesome 5 (from TeX Live 2022's final archive, checked against a fixed SHA-256, instead of the
# 500 MB texlive-fonts-extra), compiles common.tex and the test templates with -recorder, makes
# LaTeX's format the same way, and packs every file they read, by its bare name, plus every file of
# FontAwesome 5, into /out/texlive.tar.gz (with its list in /out/files.txt).
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-pictures texlive-lang-spanish texlive-lang-english lmodern \
    curl ca-certificates xz-utils >/dev/null 2>&1

fa=https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2022/tlnet-final/archive/fontawesome5.tar.xz
curl -fsSL "$fa" -o /tmp/fa5.tar.xz
echo "4d85aab86f679d360e7c7c812a055d9c03dd658e31bccfca4a97604497b0cc1c  /tmp/fa5.tar.xz" | sha256sum -c --quiet -
mkdir -p /usr/local/share/texmf
tar -xJf /tmp/fa5.tar.xz -C /usr/local/share/texmf --exclude=tlpkg
mktexlsr >/dev/null 2>&1
updmap-sys --enable Map=fontawesome5.map >/dev/null 2>&1

mkdir -p /w /pack && cd /w
cp /in/common.tex /fx/*.tex .
for doc in *.tex; do
    pdflatex -interaction=nonstopmode -halt-on-error -recorder "$doc" >/dev/null || { tail -20 "${doc%.tex}.log"; exit 1; }
done
pdftex -ini -etex -recorder -jobname=format '*pdflatex.ini' >/dev/null 2>&1 || true
{
    cat *.fls | sed -n 's/^INPUT //p' | grep -v '^/w/\|^[^/]' | grep -v '\.fmt$\|texmf\.cnf$'
    # Every icon, not only those the documents above use.
    find /usr/local/share/texmf -type f ! -name '*.otf' ! -name 'ls-R'
} | sort -u > inputs.txt
while read -r path; do
    name=$(basename "$path")
    [ -e "/pack/$name" ] || cp -L "$path" "/pack/$name"
done < inputs.txt
cd /pack
ls | sort > /out/files.txt
tar --owner=0 --group=0 --mtime=2023-01-01 --sort=name -cf - * | gzip -9n > /out/texlive.tar.gz
echo "$(wc -l < /out/files.txt) files, $(du -sb /pack | cut -f1) bytes, $(stat -c %s /out/texlive.tar.gz) compressed"
