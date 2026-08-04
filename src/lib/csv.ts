import { aCentimos, normalizar } from './format'
import { parsearFechaBanco } from './fechas'

export interface MovimientoBanco {
  fecha: string // 'YYYY-MM-DD'
  concepto: string
  importe: number // céntimos, positivo = gasto
}

export interface ResultadoLectura {
  movimientos: MovimientoBanco[]
  ingresosIgnorados: number
  filasIlegibles: number
  columnas: { fecha: string; concepto: string; importe: string }
}

/** Divide una línea de CSV respetando las comillas dobles. */
function partirLinea(linea: string, sep: string): string[] {
  const campos: string[] = []
  let actual = ''
  let entreComillas = false

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') { actual += '"'; i++ }
      else entreComillas = !entreComillas
    } else if (c === sep && !entreComillas) {
      campos.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  campos.push(actual)
  // Sin quitar comillas aquí: el bucle de arriba ya las ha interpretado, y
  // volver a recortarlas se comería las que forman parte del texto.
  return campos.map((c) => c.trim())
}

/** Los bancos españoles usan ';' casi siempre, pero no todos. */
function detectarSeparador(lineas: string[]): string {
  const candidatos = [';', ',', '\t', '|']
  let mejor = ';'
  let mejorPuntuacion = -1

  for (const sep of candidatos) {
    const cuentas = lineas.slice(0, 30).map((l) => partirLinea(l, sep).length)
    const maxCols = Math.max(...cuentas)
    if (maxCols < 2) continue
    // Premiamos que muchas filas tengan el MISMO número de columnas.
    const consistentes = cuentas.filter((c) => c === maxCols).length
    const puntuacion = consistentes * 10 + maxCols
    if (puntuacion > mejorPuntuacion) { mejorPuntuacion = puntuacion; mejor = sep }
  }
  return mejor
}

const ALIAS_FECHA = ['fecha', 'f. operacion', 'fecha operacion', 'fecha de operacion', 'fecha valor', 'date', 'f. valor', 'dia']
const ALIAS_CONCEPTO = ['concepto', 'descripcion', 'detalle', 'movimiento', 'referencia', 'observaciones', 'description', 'beneficiario', 'comercio']
const ALIAS_IMPORTE = ['importe', 'cantidad', 'euros', 'importe eur', 'importe (eur)', 'amount', 'importe operacion', 'debe/haber']
const ALIAS_CARGO = ['debe', 'cargo', 'gasto', 'salida', 'pago']

function encontrarColumna(cabecera: string[], alias: string[]): number {
  const norm = cabecera.map(normalizar)
  // Coincidencia exacta primero, luego "empieza por".
  for (const a of alias) {
    const i = norm.indexOf(a)
    if (i >= 0) return i
  }
  for (const a of alias) {
    const i = norm.findIndex((c) => c.startsWith(a) || c.includes(a))
    if (i >= 0) return i
  }
  return -1
}

/**
 * Lee el CSV que exporta el banco: detecta el separador, parte las líneas y
 * deja el resto del trabajo a `leerFilas`.
 */
export function leerCsvBanco(texto: string): ResultadoLectura {
  const lineas = texto
    .replace(/^﻿/, '') // marca BOM que mete Excel
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')

  if (lineas.length === 0) throw new Error('El archivo está vacío.')

  const sep = detectarSeparador(lineas)
  return leerFilas(lineas.map((l) => partirLinea(l, sep)))
}

/**
 * El cerebro del importador, común a CSV y a Excel: salta las filas
 * decorativas que meten muchos bancos antes de la tabla real, localiza las
 * columnas de fecha, concepto e importe, y descarta los ingresos (aquí solo
 * registramos gastos).
 *
 * @param filas tabla ya partida en celdas, tal cual viene del archivo
 */
export function leerFilas(filas: string[][]): ResultadoLectura {
  const lineas = filas.filter((f) => f.some((c) => c.trim() !== ''))
  if (lineas.length === 0) throw new Error('El archivo está vacío.')

  // Buscamos la fila de cabecera: la primera que tenga fecha + importe.
  let filaCabecera = -1
  let cabecera: string[] = []
  for (let i = 0; i < Math.min(lineas.length, 25); i++) {
    const campos = lineas[i]
    if (campos.length < 2) continue
    const tieneFecha = encontrarColumna(campos, ALIAS_FECHA) >= 0
    const tieneImporte = encontrarColumna(campos, ALIAS_IMPORTE) >= 0
      || encontrarColumna(campos, ALIAS_CARGO) >= 0
    if (tieneFecha && tieneImporte) { filaCabecera = i; cabecera = campos; break }
  }

  if (filaCabecera === -1) {
    throw new Error(
      'No encuentro las columnas de fecha e importe. Comprueba que el archivo es el export de movimientos del banco.',
    )
  }

  const iFecha = encontrarColumna(cabecera, ALIAS_FECHA)
  const iConcepto = encontrarColumna(cabecera, ALIAS_CONCEPTO)
  let iImporte = encontrarColumna(cabecera, ALIAS_IMPORTE)
  const iCargo = encontrarColumna(cabecera, ALIAS_CARGO)
  // Algunos bancos separan "Debe" y "Haber": nos quedamos con la de cargos.
  if (iImporte === -1) iImporte = iCargo

  const movimientos: MovimientoBanco[] = []
  let ingresosIgnorados = 0
  let filasIlegibles = 0

  for (let i = filaCabecera + 1; i < lineas.length; i++) {
    const campos = lineas[i]
    if (campos.length <= Math.max(iFecha, iImporte)) { filasIlegibles++; continue }

    const fecha = parsearFechaBanco(campos[iFecha] ?? '')
    const bruto = campos[iImporte] ?? ''
    const centimos = aCentimos(bruto)

    if (!fecha || centimos === null || centimos === 0) { filasIlegibles++; continue }

    const esNegativo = /^\s*-/.test(bruto.trim()) || /\(.*\)/.test(bruto)
    const esColumnaDeCargos = iImporte === iCargo && iCargo !== -1
    if (!esNegativo && !esColumnaDeCargos) { ingresosIgnorados++; continue }

    movimientos.push({
      fecha,
      concepto: (iConcepto >= 0 ? campos[iConcepto] : '') || 'Movimiento del banco',
      importe: Math.abs(centimos),
    })
  }

  return {
    movimientos,
    ingresosIgnorados,
    filasIlegibles,
    columnas: {
      fecha: cabecera[iFecha] ?? '?',
      concepto: iConcepto >= 0 ? cabecera[iConcepto] : '(sin columna de concepto)',
      importe: cabecera[iImporte] ?? '?',
    },
  }
}
