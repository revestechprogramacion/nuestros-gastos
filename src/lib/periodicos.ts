import type { Expense } from '../data/types'
import { desplazarMes, diasDelMes, mesActual, mesDe } from './fechas'
import { euros, normalizar } from './format'

/**
 * Detección de gastos que se repiten mes a mes a partir del histórico
 * importado del banco: hipoteca, seguros, luz, teléfono…
 *
 * La gracia está en agrupar bien. El banco cambia el concepto cada mes
 * (le pega la fecha, el número de recibo, el mes abreviado), así que dos
 * cuotas del mismo préstamo llegan con textos distintos.
 */

const MESES_CORTOS = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic'

/**
 * Reduce un concepto del banco a lo que no cambia de un mes a otro.
 * "PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26" → "prestamos adeudo cuota"
 */
export function clavePeriodica(concepto: string): string {
  return normalizar(concepto)
    .replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, ' ')          // 31/07/26
    .replace(new RegExp(`\\.(${MESES_CORTOS})\\b`, 'g'), ' ')  // ".feb"
    .replace(/n\.?\s*\d+/g, ' ')                               // n.8077561060
    .replace(/x{2,}/g, ' ')                                    // xxxxxx855
    .replace(/\d{3,}/g, ' ')                                   // referencias largas
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ')
}

export interface CandidatoFijo {
  /** Nombre propuesto, ya legible. */
  nombre: string
  /** Un concepto original, para que se reconozca. */
  ejemplo: string
  categoriaId: string | null
  /** Importe propuesto: la mediana de lo pagado. */
  importe: number
  importeMin: number
  importeMax: number
  diaDelMes: number
  /** En cuántos de los meses analizados apareció. */
  meses: number
  mesesAnalizados: number
  /** Último mes en que se vio: desde ahí empezará a generarse. */
  ultimoMes: string
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * Parte una lista de importes en grupos "del mismo recibo". Dos préstamos
 * distintos comparten concepto pero no importe, y hay que separarlos.
 */
function agruparPorImporte<T extends { importe: number }>(items: T[], tolerancia = 0.18): T[][] {
  const orden = [...items].sort((a, b) => a.importe - b.importe)
  const grupos: T[][] = []
  let actual: T[] = []

  for (const it of orden) {
    if (actual.length === 0) { actual = [it]; continue }
    const refe = actual[actual.length - 1].importe
    if (Math.abs(it.importe - refe) <= refe * tolerancia) actual.push(it)
    else { grupos.push(actual); actual = [it] }
  }
  if (actual.length > 0) grupos.push(actual)
  return grupos
}

/**
 * ¿Caen todos los pagos por las mismas fechas? Un recibo domiciliado sí; las
 * transferencias que haces cuando te acuerdas, no.
 */
function diasConsistentes(dias: number[], margen = 4, minimo = 0.7): boolean {
  const centro = mediana(dias)
  const cerca = dias.filter((d) => Math.abs(d - centro) <= margen).length
  return cerca / dias.length >= minimo
}

/** La categoría que más se repite entre los gastos del grupo. */
function categoriaDominante(grupo: Expense[]): string | null {
  const cuenta = new Map<string, number>()
  for (const g of grupo) {
    if (g.categoriaId) cuenta.set(g.categoriaId, (cuenta.get(g.categoriaId) ?? 0) + 1)
  }
  let mejor: string | null = null
  let max = 0
  for (const [id, n] of cuenta) if (n > max) { mejor = id; max = n }
  return mejor
}

/** Palabrería con la que el banco encabeza medio extracto. */
const RELLENO = new Set([
  'adeudo', 'recibo', 'cuota', 'compra', 'pago', 'transferencia', 'domiciliacion',
  'electricidad', 'telefonos', 'telefono', 'seguros', 'seguro',
  'de', 'del', 'la', 'el', 'a', 'en',
])

/**
 * Deja el concepto presentable: "ADEUDO RECIBO SANITAS S A" → "Sanitas".
 * Se quitan las muletillas del banco por delante y los restos de la forma
 * jurídica por detrás ("...VIDA, S.A." → "vida s"), que no dicen nada.
 */
function bonito(clave: string): string {
  const original = clave.split(' ')
  let palabras = [...original]

  while (palabras.length > 1 && RELLENO.has(palabras[0])) palabras.shift()
  if (palabras.length === 0 || RELLENO.has(palabras[0])) palabras = [original[0]]

  palabras = palabras.filter((p) => !RELLENO.has(p)).slice(0, 3)
  while (palabras.length > 1 && palabras[palabras.length - 1].length <= 2) palabras.pop()

  const texto = (palabras.length ? palabras : [original[0]]).join(' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export interface OpcionesDeteccion {
  /** Cuántos meses cerrados mirar hacia atrás. */
  mesesAtras?: number
  /** Fracción de esos meses en los que tiene que aparecer para contar. */
  cobertura?: number
  /** Cuánto puede bailar el importe y seguir considerándose "el mismo". */
  variacionMaxima?: number
}

export interface ResultadoDeteccion {
  /** Recibos que valen siempre lo mismo: se pueden dar por hechos. */
  fijos: CandidatoFijo[]
  /** Los que se repiten pero cambian de importe (luz, agua): no se proponen. */
  variables: CandidatoFijo[]
}

/**
 * Propone gastos fijos a partir del histórico.
 *
 * Solo se queda con lo que de verdad parece un recibo mensual: aparece en la
 * mayoría de los meses y va **una vez por mes**. Las transferencias sueltas,
 * aunque sean muchas, no lo son: varían de importe y caen varias veces al mes.
 *
 * Y de los que quedan, solo se dan por hechos los que valen **siempre lo
 * mismo** (préstamos, hipoteca, seguros). La luz y el agua cambian cada mes:
 * apuntarlas por adelantado con un importe inventado sería mentir en los
 * totales, así que esas se devuelven aparte y no se proponen.
 */
export function detectarFijos(
  gastos: Expense[],
  { mesesAtras = 6, cobertura = 0.6, variacionMaxima = 0.12 }: OpcionesDeteccion = {},
): ResultadoDeteccion {
  // El mes en curso está a medias: contarlo hundiría la cobertura de todo.
  const ventana: string[] = []
  for (let i = 1; i <= mesesAtras; i++) ventana.push(desplazarMes(mesActual(), -i))
  const desde = ventana[ventana.length - 1]

  const porClave = new Map<string, Expense[]>()
  for (const g of gastos) {
    if (g.origen === 'fijo' || !g.nota) continue      // los generados no cuentan
    const mes = mesDe(g.fecha)
    if (mes < desde || !ventana.includes(mes)) continue
    const clave = clavePeriodica(g.nota)
    if (clave.length < 3) continue
    porClave.set(clave, [...(porClave.get(clave) ?? []), g])
  }

  const minMeses = Math.max(2, Math.ceil(ventana.length * cobertura))
  const candidatos: CandidatoFijo[] = []

  for (const [clave, todos] of porClave) {
    const mesesClave = new Set(todos.map((g) => mesDe(g.fecha))).size
    // Solo partimos por importe si hay más de un cobro al mes: ahí sí puede
    // haber dos recibos distintos con el mismo concepto (dos préstamos, dos
    // pólizas). Si ya va uno al mes, es UN recibo que varía —la luz de
    // invierno cuesta el doble que la de verano— y partirlo sería un error.
    const fueDividido = todos.length / mesesClave > 1.4
    const grupos = fueDividido ? agruparPorImporte(todos) : [todos]

    for (const grupo of grupos) {
      const meses = new Set(grupo.map((g) => mesDe(g.fecha)))
      if (meses.size < minMeses) continue

      // Un recibo mensual cae una vez al mes. Si caen tres, es otra cosa.
      if (grupo.length / meses.size > 1.4) continue

      const importes = grupo.map((g) => g.importe)
      const dias = grupo.map((g) => Number(g.fecha.slice(8)))

      // Un recibo domiciliado cae siempre por las mismas fechas. Si los pagos
      // se reparten por todo el mes, es dinero que mandas a mano, no un fijo.
      if (!diasConsistentes(dias)) continue

      // Si hemos tenido que partir el concepto por importe, estamos afirmando
      // que son recibos distintos y estables. Exigimos que lo sean: si dentro
      // del grupo el importe baila, lo que hay es dinero suelto, no un recibo.
      const centro = mediana(importes)
      if (fueDividido && Math.max(...importes) - Math.min(...importes) > centro * 0.25) continue

      candidatos.push({
        nombre: bonito(clave),
        ejemplo: grupo[grupo.length - 1].nota ?? clave,
        categoriaId: categoriaDominante(grupo),
        importe: mediana(importes),
        importeMin: Math.min(...importes),
        importeMax: Math.max(...importes),
        diaDelMes: mediana(dias),
        meses: meses.size,
        mesesAnalizados: ventana.length,
        ultimoMes: [...meses].sort().slice(-1)[0],
      })
    }
  }

  // Si un mismo concepto da varios recibos (dos préstamos, dos pólizas), el
  // nombre a secas no los distingue. Lo mejor para diferenciarlos es la
  // referencia que el propio banco pone en el concepto; si no hay, el importe.
  const vecesPorNombre = new Map<string, number>()
  for (const c of candidatos) {
    vecesPorNombre.set(c.nombre, (vecesPorNombre.get(c.nombre) ?? 0) + 1)
  }
  for (const c of candidatos) {
    if ((vecesPorNombre.get(c.nombre) ?? 0) <= 1) continue
    const referencia = c.ejemplo.match(/\d{6,}/)?.[0]
    c.nombre = referencia
      ? `${c.nombre} ${referencia.slice(-4)}`
      : `${c.nombre} · ${euros(c.importe)}`
  }

  candidatos.sort((a, b) => b.importe - a.importe)

  const constante = (c: CandidatoFijo) =>
    (c.importeMax - c.importeMin) / c.importe <= variacionMaxima

  return {
    fijos: candidatos.filter(constante),
    variables: candidatos.filter((c) => !constante(c)),
  }
}

/**
 * Día real en que toca un gasto fijo dentro de un mes concreto. Un recibo que
 * cae el 31 tiene que caer el 28 en febrero, no desaparecer.
 */
export function diaEfectivo(diaDelMes: number, mes: string): number {
  return Math.min(diaDelMes, diasDelMes(mes))
}
