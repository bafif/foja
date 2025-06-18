import json

json_dir = "data/cv_data.json"
perfil_dir = "data/perfil.md"
fortalezas_dir = "data/fortalezas.md"
tareas_dirs = {
    "tecso": "data/tecso_tareas.md",
    "Reparación de equipos informáticos": "data/reparacion_tareas.md",
    "Docencia particular": "data/particular_tareas.md",
}


def markdown2dict(file: str) -> dict:
    """Función para transformar los archivos de Markdown
    en una jerarquía de títulos, subtítulos y descripciones

    Args:
        file (str): archivo Markdown para convertir

    Returns:
        dict: diccionario con una descripción asociada a cada
        título, será una lista si corresponden más de un subtítulo
        a cada título o más de un párrafo a cada subtítulo.
    """
    with open(file, "r", encoding= "utf-8", newline="\n") as md:
        md_txt = md.read()
    lines = md_txt.splitlines()
    headers = [header.replace("# ", "") for header in lines if "#" in header]
    descs = [desc for desc in lines if "#" not in desc]
    dict = {header: desc for header, desc in zip(headers, descs)}
    return dict


def load_data() -> dict:
    """Es la función que se encarga de abrir todos los
    archivos donde va a estar la información modificable
    (el diccionario, las)

    Returns:
        dict: pares entre un tipo de dato y el texto
        o valor que lo acompaña.
    """

    data: dict= {}
    
    with open(json_dir, "r") as data_json:
        reader = data_json.read()
        data = json.loads(reader)

    with open(perfil_dir,"r",encoding="utf-8",newline="\n") as perfil:
        data["Perfil"] = perfil.read()

    fortalezas = markdown2dict(fortalezas_dir)
    data["Fortalezas"] = fortalezas

    for experiencias in data["Experiencia"].values():
        for experiencia in experiencias:
            for w in experiencia.values():
                if type(w) is str and w in tareas_dirs.keys():
                    dict_: dict= markdown2dict(tareas_dirs[w])
                    for i in dict_.values():
                        experiencia["Tareas"].append(i)
    return data

def make_latex(data: dict, *args):
    out = ""
    start = []
    for file in args:
        with open(file, "r") as input:
            text = input.read()
            start.append(text)
    out = "\n".join(start)
    
    document = []
    document.append("\\begin{document}")
    document.append("\\title{Currículum}")
    document.append(f"\\author{{{" ".join(data["Apellidos"])}, {" ".join(data["Nombres"])}}}")
    document.append("\\maketitle")
    
    document.append("\\section{Habilidades}")
    for categoria, lista in data["Habilidades"].items():
        if categoria != "Idiomas":
            document.append(f"\\subsection{{{categoria}}}")
            document.append(", ".join(lista))
        else:
            document.append("\\subsection{Idiomas}")
            idiomas = []
            for k, w in lista.items():
                idiomas.append(f"\\textbf{{{k}}}: {w}")
            document.append(". ".join(idiomas))

    document.append("\\end{document}")
    out = out + "\n" + "\n".join(document)

    return out
    
def main():
    print(make_latex(load_data(), "python/st.sty"))

if __name__ == "__main__":
    main()