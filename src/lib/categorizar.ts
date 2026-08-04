import { normalizar } from './format'
import type { Category, ImportRule } from '../data/types'

/**
 * Diccionario de arranque: comercios y conceptos habituales en España,
 * asociados al NOMBRE de la categoría por defecto. Solo se usa mientras la app
 * no ha aprendido tus propias reglas; en cuanto corriges una categoría al
 * importar, tu regla manda sobre esto.
 */
const PISTAS: Record<string, string[]> = {
  'Súper': [
    // Ojo con el súper DIA: la pista NO puede ser "dia" a secas, porque el
    // banco escribe "EL DIA 05-05-2026" en medio de conceptos que no tienen
    // nada que ver. Mejor no adivinar que adivinar mal.
    'supermercados dia', 'la plaza de dia', 'maxi dia',
    'mercadona', 'carrefour', 'lidl', 'aldi', 'alcampo', 'eroski', 'consum',
    'ahorramas', 'hipercor', 'supercor', 'supermercado', 'super ', 'froiz', 'gadis',
    'bonarea', 'condis', 'caprabo', 'fruteria', 'carniceria', 'panaderia', 'pescaderia',
  ],
  'Casa': [
    'ikea', 'leroy merlin', 'bricomart', 'bricodepot', 'alcampo hogar', 'maisons',
    'zara home', 'ferreteria', 'comunidad', 'alquiler', 'hipoteca', 'prestamo hipotecario',
  ],
  'Luz, agua, gas': [
    'iberdrola', 'endesa', 'naturgy', 'repsol luz', 'totalenergies', 'holaluz', 'lucera',
    'canal isabel', 'aguas de', 'aguas alicante', 'agua agua', 'emasa', 'emivasa', 'aqualia',
    'hidrogea', 'facsa', 'hidraulica', 'gas natural', 'octopus energy', 'electricidad',
  ],
  'Coche': [
    'repsol', 'cepsa', 'galp', 'shell', 'bp ', 'ballenoil', 'petroprix', 'gasolinera',
    'itv', 'taller', 'neumatic', 'norauto', 'aurgi', 'midas', 'parking', 'aparcamiento',
    'autopista', 'peaje', 'ap-', 'dgt', 'multa', 'grua',
  ],
  'Comer fuera': [
    'restaurante', 'bar ', 'cafeteria', 'cafe ', 'mcdonald', 'burger king', 'telepizza',
    'domino', 'kfc', 'goiko', 'vips', 'starbucks', 'glovo', 'just eat', 'uber eats',
    'deliveroo', 'taberna', 'asador', 'cerveceria', 'pizzeria', 'sushi', 'kebab',
  ],
  'Ocio': [
    'cine', 'yelmo', 'cinesa', 'kinepolis', 'teatro', 'entradas', 'ticketmaster', 'fnac',
    'game ', 'steam', 'playstation', 'nintendo', 'xbox', 'bolera', 'museo', 'discoteca',
  ],
  'Salud': [
    'farmacia', 'clinica', 'dentista', 'optica', 'sanitas', 'adeslas', 'dkv', 'asisa',
    'hospital', 'fisioterapia', 'psicolog', 'analisis', 'podolog',
    'grandvision', 'general optica', 'multiopticas', 'grupo optico',
  ],
  'Ropa': [
    'zara', 'mango', 'h&m', 'hym', 'primark', 'bershka', 'stradivarius', 'pull&bear',
    'massimo dutti', 'decathlon', 'nike', 'adidas', 'springfield', 'cortefiel', 'kiabi',
    'el corte ingles moda', 'zapateria', 'calzedonia', 'oysho',
  ],
  'Suscripciones': [
    'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'max.com', 'apple.com/bill', 'icloud',
    'google storage', 'dropbox', 'youtube premium', 'dazn', 'filmin', 'audible', 'chatgpt', 'openai',
  ],
  'Viajes': [
    'renfe', 'iberia', 'vueling', 'ryanair', 'easyjet', 'booking', 'airbnb', 'hotel',
    'hostal', 'alsa', 'avanza', 'blablacar', 'aena', 'edreams', 'kiwi.com', 'trainline',
  ],
  'Regalos': ['floristeria', 'flores', 'joyeria', 'juguetes', 'toys r us', 'imaginarium'],
  'Préstamos': [
    'prestamos adeudo', 'prestamo', 'adeudo cuota', 'cuota n.', 'financiacion',
    'leasing', 'renting', 'cofidis', 'cetelem',
  ],
  'Seguros': [
    'seguros ', 'seguro ', 'bansabadell vida', 'bssg', 'securitas direct', 'prosegur',
    'mapfre', 'axa ', 'allianz', 'linea directa', 'mutua', 'zurich', 'generali',
    'reale seguros', 'pelayo', 'catalana occidente', 'ocaso', 'santalucia', 'verti',
  ],
  'Educación': [
    'educacion', 'colegio', 'guarderia', 'escuela infantil', 'academia', 'universidad',
    'matricula', 'ampa', 'ceip', 'instituto',
  ],
  'Teléfono e internet': [
    'telefonos telefonica', 'telefonica de espana', 'movistar', 'vodafone', 'orange',
    'yoigo', 'jazztel', 'pepephone', 'masmovil', 'lowi', 'finetwork', 'avatel', 'digi spain',
  ],
  'Impuestos y comisiones': [
    'impuestos', 'irpf', 'aeat', 'agencia tributaria', 'hacienda', 'suma gestion',
    'intereses y/o comisiones', 'comision', 'mantenimiento cuenta', 'ibi ', 'tasa ',
    'embargo', 'seguridad social', 'tgss',
  ],
  'Efectivo': [
    'reintegro', 'disposicion cajero', 'cajero automatico', 'retirada efectivo',
  ],
}

/**
 * Categorías a las que apunta el diccionario. Si se renombra una categoría y
 * no se toca `PISTAS`, la pista dejaría de aplicarse en silencio; hay una
 * prueba que compara esta lista con las categorías por defecto.
 */
export const CATEGORIAS_CON_PISTAS = Object.keys(PISTAS)

export interface Sugerencia {
  categoriaId: string | null
  /** 'regla' = la aprendió de ti; 'diccionario' = pista general; null = no sabe. */
  fuente: 'regla' | 'diccionario' | null
}

/**
 * Sugiere categoría para un concepto del banco.
 * Prioridad: tus reglas aprendidas > diccionario general.
 */
export function sugerirCategoria(
  concepto: string,
  categorias: Category[],
  reglas: ImportRule[],
): Sugerencia {
  const texto = normalizar(concepto)
  if (!texto) return { categoriaId: null, fuente: null }

  // 1. Tus reglas. La más larga gana (es la más específica).
  const coincidencias = reglas
    .filter((r) => texto.includes(r.patron))
    .sort((a, b) => b.patron.length - a.patron.length || b.aciertos - a.aciertos)
  if (coincidencias.length > 0) {
    return { categoriaId: coincidencias[0].categoriaId, fuente: 'regla' }
  }

  // 2. Diccionario general.
  let mejorPista = ''
  let mejorNombre = ''
  for (const [nombreCat, pistas] of Object.entries(PISTAS)) {
    for (const pista of pistas) {
      if (texto.includes(pista) && pista.length > mejorPista.length) {
        mejorPista = pista
        mejorNombre = nombreCat
      }
    }
  }
  if (mejorNombre) {
    const cat = categorias.find((c) => normalizar(c.nombre) === normalizar(mejorNombre))
    if (cat) return { categoriaId: cat.id, fuente: 'diccionario' }
  }

  return { categoriaId: null, fuente: null }
}

/**
 * Extrae el "trozo reconocible" de un concepto del banco para guardarlo como
 * regla. Los bancos añaden ruido (fechas, referencias, "COMPRA EN", números);
 * nos quedamos con las primeras palabras con significado.
 */
export function patronDesdeConcepto(concepto: string): string {
  const RUIDO = new Set([
    'compra', 'en', 'pago', 'tarjeta', 'recibo', 'de', 'del', 'la', 'el', 'con',
    'transferencia', 'adeudo', 'domiciliacion', 'movimiento', 'operacion', 'targeta',
  ])
  const palabras = normalizar(concepto)
    .replace(/[^a-z0-9ñ\s.&-]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2 && !RUIDO.has(p) && !/^\d+$/.test(p))

  return palabras.slice(0, 2).join(' ') || normalizar(concepto).slice(0, 20)
}
