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
            print("\n"*2)
            print("experiencias", experiencia.values())
            print("\n"*2)
            for w in experiencia.values():
                if type(w) is str and w in tareas_dirs.keys():
                    dict_: dict= markdown2dict(tareas_dirs[w])
                    print("dict_:\n", dict_)
                    print("\n"*2)
                    print(dict_.values())
                    for i in dict_.values():
                        experiencia["Tareas"].append(i)

    return data


def main():
    
    data: dict= load_data()
    print("\n"*3)
    print(data)
    
    # print(markdown2dict(fortalezas_dir))

if __name__ == "__main__":
    main()