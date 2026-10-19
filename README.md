# ObraLab

Herramientas de control de obra en **mejora continua** para ingenieros civiles y arquitectos: calculadoras, formatos de campo, métodos de gestión y herramientas digitales. Se agrega al menos una herramienta nueva cada día.

Autor: Ing. Miguel Estrada · Tijuana, B.C.

## Uso

Abre la app desde GitHub Pages: `https://ingmiguelestradaf-rgb.github.io/OBRA-LAB/`

- **Novedades**: qué se agregó cada día y cómo aplicarlo en obra.
- **Calculadoras**: los valores capturados se guardan en tu navegador.
- **Cuantificador de acero** y **Distribución de escalera** dentro de Calculadoras.
- **Checklists de calidad**: de obra negra a acabados, instalaciones y entrega.
- **Formatos**: llénalos en el celular o tablet, exporta a CSV o imprime a PDF.
- **Métodos** y **Herramientas digitales**: pasos concretos para implementarlos.

## Cómo crece la app

Todo el contenido vive en dos archivos; la app no necesita compilarse.

- `data/herramientas.json` → lista `herramientas`
- `data/actualizaciones.json` → lista `actualizaciones` (bitácora de novedades)

### Esquema de una herramienta

Campos comunes: `id` (único, kebab-case con prefijo `calc-`, `fmt-`, `met-` o `dig-`), `tipo`, `categoria`, `titulo`, `resumen`, `agregada` (AAAA-MM-DD), `como_usar` (lista de pasos), `fuentes` opcional (`[{titulo, url}]`).

| tipo | campos extra |
|---|---|
| `calculadora` | `entradas: [{id, label, unidad, valor}]`, `salidas: [{label, formula, unidad, decimales, destacar?, semaforo?: [verde_min, amarillo_min]}]`. `formula` es una expresión JavaScript que usa los `id` de las entradas y `Math`. |
| `formato` | `campos: [texto]` (datos generales), `items: [texto]` (puntos a verificar Cumple / No / N/A) |
| `calidad` | igual que `formato`; `categoria` = etapa (Obra negra, Estructura, Instalaciones, Acabados, Entrega). Aparece en la pestaña Checklists de calidad |
| `metodo` | `beneficio` |
| calculadora con `modulo` | herramienta interactiva propia en `modulos/<modulo>.js` (ej. `acero`, `escalera`); no lleva entradas ni salidas |
| `recurso` | `beneficio`, `plataforma`, `costo`, `url` (herramienta digital externa) |

### Esquema de una actualización

`{ fecha, titulo, resumen, herramientas: [ids], como_aplicarlo, fuentes: [{titulo, url}] }`

## Reglas de mejora continua

1. Nunca se borra una herramienta; se mejora (y se anota en Novedades).
2. Cada herramienta nueva debe ser aplicable en una obra en México esta semana.
3. Las herramientas digitales llevan fuente oficial y costo verificado en la fecha en que se agregan.
4. Las fórmulas se prueban con los valores de ejemplo antes de publicarse.
