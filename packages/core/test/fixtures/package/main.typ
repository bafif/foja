// A CV in the shape of templates published as packages: the macros come from `@preview`, take
// positional arguments and a content block, and the header is a plain call.
#import "@preview/tiny-cv:0.1.0": cv-header, cv-entry

#cv-header(name: "John Roe", email: "john@example.com", site: "https://johnroe.example")

= Experiencia
#cv-entry("Desarrollador", "Initech", "03/2019 - actualidad")[
  - Mantenimiento del sistema de facturación.
  - Migración a la nube.
]
#cv-entry("Pasante", "Hooli", "2018")[
  - Pruebas automáticas.
]
