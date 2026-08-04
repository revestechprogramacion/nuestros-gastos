import { normalizar } from './format'

/**
 * Búsqueda que perdona.
 *
 * El objetivo es que nunca pienses «sé que lo apunté y no me sale». Para eso
 * hay que aguantar cómo escribe la gente de verdad: sin tildes, con faltas,
 * en plural, abreviando, o recordando otra palabra distinta de la que pone.
 *
 * Se busca en TODO lo que el gasto tiene: el concepto original del banco, el
 * nombre limpio que se ve en pantalla, la categoría, el importe y la fecha.
 *
 * Reglas, en orden de preferencia:
 *   1. Coincidencia literal      "merca"      → MERCADONA
 *   2. Sin tildes ni mayúsculas  "telefonica" → Telefónica
 *   3. Singular/plural           "seguros"    → Seguro
 *   4. Sinónimos y abreviaturas  "luz"        → ELECTRICIDAD IBERDROLA
 *   5. Parecido (erratas)        "mercadonna" → MERCADONA
 *
 * Todas las palabras que escribas tienen que encontrarse (búsqueda "Y"), pero
 * cada una puede hacerlo por cualquiera de las cinco vías.
 */

/** Familias de palabras que la gente usa para lo mismo. */
const SINONIMOS: string[][] = [
  ['super', 'supermercado', 'compra', 'mercadona', 'lidl', 'carrefour', 'aldi', 'alcampo', 'consum'],
  ['luz', 'electricidad', 'iberdrola', 'endesa', 'naturgy', 'corriente'],
  ['agua', 'aguas', 'canal', 'aqualia'],
  ['gas', 'butano', 'calefaccion'],
  ['telefono', 'movil', 'telefonica', 'movistar', 'vodafone', 'orange', 'fibra', 'internet'],
  ['gasolina', 'gasoil', 'diesel', 'combustible', 'gasolinera', 'repsol', 'cepsa', 'carburante'],
  ['coche', 'auto', 'automovil', 'vehiculo', 'taller', 'itv'],
  ['comida', 'restaurante', 'comer', 'cena', 'almuerzo', 'menu', 'bar'],
  ['medico', 'salud', 'farmacia', 'clinica', 'dentista', 'sanitas', 'adeslas', 'seguro medico'],
  ['seguro', 'seguros', 'poliza', 'mapfre', 'axa', 'allianz', 'securitas', 'alarma'],
  ['prestamo', 'credito', 'hipoteca', 'cuota', 'banco', 'financiacion'],
  ['colegio', 'cole', 'escuela', 'educacion', 'academia', 'guarderia', 'matricula'],
  ['ropa', 'zara', 'primark', 'zapatos', 'calzado', 'moda'],
  ['ocio', 'cine', 'teatro', 'concierto', 'entradas'],
  ['viaje', 'hotel', 'vuelo', 'avion', 'tren', 'renfe', 'booking'],
  ['efectivo', 'cajero', 'reintegro', 'metalico'],
  ['impuestos', 'hacienda', 'irpf', 'iva', 'multa', 'tasa', 'embargo'],
  ['traspaso', 'transferencia', 'traspasos', 'envio'],
  ['suscripcion', 'netflix', 'spotify', 'disney', 'hbo', 'amazon'],
  ['regalo', 'cumple', 'cumpleanos', 'navidad'],
]

/** palabra → todas las de su familia (incluida ella misma). */
const FAMILIA = new Map<string, string[]>()
for (const grupo of SINONIMOS) {
  for (const palabra of grupo) {
    FAMILIA.set(palabra, [...new Set([...(FAMILIA.get(palabra) ?? []), ...grupo])])
  }
}

/**
 * "seguros" → "seguro", "coches" → "coche", "luces" → "luz".
 *
 * En castellano el plural añade -s tras vocal y -es tras consonante, así que
 * mirar la letra anterior acierta en la gran mayoría. No es un diccionario:
 * para buscar no hace falta, basta con acercarse.
 */
export function singular(palabra: string): string {
  if (palabra.length <= 3 || !palabra.endsWith('s')) return palabra
  if (palabra.endsWith('ces')) return `${palabra.slice(0, -3)}z`
  const anterior = palabra[palabra.length - 2]
  if ('aeiou'.includes(anterior)) return palabra.slice(0, -1)
  return palabra.endsWith('es') ? palabra.slice(0, -2) : palabra.slice(0, -1)
}

/**
 * Distancia de edición con tope: cuántos cambios hacen falta para pasar de una
 * palabra a otra. Se corta en cuanto se pasa del máximo, que es lo que la hace
 * barata cuando hay cientos de gastos.
 */
export function distancia(a: string, b: string, maximo: number): number {
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1
  if (a === b) return 0

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    let mejorFila = i
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(actual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + coste)
      actual.push(v)
      if (v < mejorFila) mejorFila = v
    }
    if (mejorFila > maximo) return maximo + 1
    anterior = actual
  }
  return anterior[b.length]
}

/** Cuántas erratas se perdonan según lo larga que sea la palabra. */
function tolerancia(palabra: string): number {
  if (palabra.length <= 3) return 0
  if (palabra.length <= 5) return 1
  return 2
}

/** Prepara el texto de un gasto para buscar en él. Hazlo una sola vez. */
export function prepararTexto(partes: (string | null | undefined)[]): string {
  return normalizar(partes.filter(Boolean).join(' '))
}

/**
 * Puntúa cómo de bien encaja la consulta con el texto.
 * 0 = no encaja. Cuanto más alto, mejor coincidencia.
 */
export function puntuar(consulta: string, texto: string): number {
  const q = normalizar(consulta).trim()
  if (!q) return 1
  if (!texto) return 0

  const palabrasTexto = texto.split(/\s+/).filter(Boolean)
  let total = 0

  for (const termino of q.split(/\s+/).filter(Boolean)) {
    const punto = puntuarTermino(termino, texto, palabrasTexto)
    if (punto === 0) return 0 // todas las palabras tienen que aparecer
    total += punto
  }
  return total
}

function puntuarTermino(termino: string, texto: string, palabras: string[]): number {
  // 1. Tal cual, en cualquier parte.
  if (texto.includes(termino)) {
    return palabras.some((p) => p === termino) ? 10
      : palabras.some((p) => p.startsWith(termino)) ? 8
      : 6
  }

  // 2. Los números se comparan como números: "34,90", "34.90" y "3490" son lo mismo.
  const comoNumero = termino.replace(/[.,]/g, '')
  if (/^\d+$/.test(comoNumero) && texto.replace(/[.,]/g, '').includes(comoNumero)) return 7

  // 3. Singular y plural, en los dos sentidos.
  const raiz = singular(termino)
  if (raiz !== termino && texto.includes(raiz)) return 5
  if (palabras.some((p) => singular(p) === raiz)) return 5

  // 4. Sinónimos y abreviaturas.
  for (const hermana of FAMILIA.get(raiz) ?? FAMILIA.get(termino) ?? []) {
    if (texto.includes(hermana)) return 4
  }

  // 5. Erratas: parecido a alguna palabra del texto.
  const margen = tolerancia(termino)
  if (margen > 0) {
    for (const p of palabras) {
      if (distancia(termino, p, margen) <= margen) return 3
      // También contra el principio de palabras largas: "mercadon" ~ "mercadona".
      if (p.length > termino.length && distancia(termino, p.slice(0, termino.length), margen) <= margen) {
        return 2
      }
    }
  }

  return 0
}

/** ¿Encaja, sí o no? */
export function coincide(consulta: string, texto: string): boolean {
  return puntuar(consulta, texto) > 0
}
