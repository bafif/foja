import json

json_dir = "data/cv_data.json"
perfil_dir = "data/perfil.md"
fortalezas_dir = "data/fortalezas.md"
tareas_dirs = {
    "tecso": "data/tecso_tareas.md",
    "Reparación de equipos \
        informáticos": "data/reparacion_tareas.md",
    "Docencia particular": "data/particular_tareas.md",
}

def markdown2dict(file: str) -> dict:
    with open(file, "r", encoding= "utf-8", newline="\n") as md:
        md_txt = md.read()
    lines = md_txt.splitlines()
    headers = [header for header in lines if header[0] == "#"]
    descs = [desc for desc in lines if desc[0] != "#"]
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
    return data



def main():
    
    """ data: dict= load_data()
    print(data) """
    
    print(markdown2dict(fortalezas_dir))

if __name__ == "__main__":
    main()