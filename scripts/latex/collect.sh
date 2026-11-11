# Runs in a Debian bookworm container (scripts/latex-assets.sh): installs TeX Live 2022, compiles
# common.tex and the test templates with -recorder, makes LaTeX's format the same way, and packs
# every file they read, by its bare name, into /out/texlive.tar.gz (with its list in /out/files.txt).
set -eu
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends texlive-latex-base texlive-latex-recommended texlive-latex-extra \
    texlive-fonts-recommended texlive-pictures texlive-lang-spanish texlive-lang-english lmodern >/dev/null 2>&1
mkdir -p /w /pack && cd /w
cp /in/common.tex /fx/*.tex .
for doc in *.tex; do
    pdflatex -interaction=nonstopmode -halt-on-error -recorder "$doc" >/dev/null || { tail -20 "${doc%.tex}.log"; exit 1; }
done
pdftex -ini -etex -recorder -jobname=format '*pdflatex.ini' >/dev/null 2>&1 || true
cat *.fls | sed -n 's/^INPUT //p' | grep -v '^/w/\|^[^/]' | grep -v '\.fmt$\|texmf\.cnf$' | sort -u > inputs.txt
while read -r path; do
    name=$(basename "$path")
    [ -e "/pack/$name" ] || cp -L "$path" "/pack/$name"
done < inputs.txt
cd /pack
ls | sort > /out/files.txt
tar --owner=0 --group=0 --mtime=2023-01-01 --sort=name -cf - * | gzip -9n > /out/texlive.tar.gz
echo "$(wc -l < /out/files.txt) files, $(du -sb /pack | cut -f1) bytes, $(stat -c %s /out/texlive.tar.gz) compressed"
