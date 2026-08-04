/**
 * Los bancos escriben el concepto para sus máquinas, no para ti:
 *
 *   "PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26"
 *   "ADEUDO RECIBO GrandVision Spain Grupo Optico S.A.U."
 *   "COMPRA TARJETA 5402XXXXXX1234 MERCADONA ALICANTE"
 *
 * En una lista eso es ilegible. Aquí se queda lo que de verdad identifica el
 * gasto —el comercio— y se tira el resto: la coletilla del banco, la fecha,
 * la referencia y los restos de la forma jurídica.
 *
 * El texto original NO se pierde: sigue guardado y se ve al abrir el gasto.
 */

const MESES_CORTOS = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic'

/** Muletillas con las que el banco encabeza medio extracto. */
const PRESCINDIBLES = new Set([
  'adeudo', 'recibo', 'compra', 'pago', 'tarjeta', 'transferencia', 'traspaso',
  'domiciliacion', 'domiciliado', 'movimiento', 'operacion', 'cargo', 'abono',
  'de', 'del', 'la', 'el', 'los', 'las', 'a', 'al', 'en', 'por', 'con', 'y',
])

/** Restos de la forma jurídica que no aportan nada al final del nombre. */
const SOCIEDADES = new Set([
  's', 'a', 'sa', 'sl', 'sau', 'slu', 'sad', 'sac', 'scp', 'sc', 'au', 'u',
  'espana', 'iberia', 'clientes', 'seguros', 'servicio', 'sociedad',
])

/**
 * Palabra a palabra, con la primera letra en mayúscula. Lo que lleva algún
 * signo dentro ("Y/O", "E.S.") se deja tal cual: suelen ser siglas.
 */
function capitalizar(palabras: string[]): string {
  return palabras
    .map((p) => (/[^a-záéíóúñü]/i.test(p)
      ? p
      : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(' ')
}

/**
 * Convierte el concepto del banco en algo que se lee de un vistazo.
 * Devuelve null si no queda nada aprovechable, para que quien llame decida
 * qué poner en su lugar.
 */
export function conceptoLegible(nota: string): string | null {
  if (!nota) return null

  let texto = nota
    // Fechas: 31/07/26, 31-07-2026, 05.05.2026
    .replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/g, ' ')
    // Mes abreviado pegado con punto: ".feb", ".jul"
    .replace(new RegExp(`\\.(${MESES_CORTOS})\\b`, 'gi'), ' ')
    // Referencias del banco: "N.8077561060", "Nº 12345"
    .replace(/n[.ºo]?\s*\d{4,}/gi, ' ')
    // Tarjetas enmascaradas: "5402XXXXXX1234", "FIJOxxxxxx855"
    .replace(/[a-z0-9]*x{3,}[a-z0-9]*/gi, ' ')
    // Números largos sueltos (referencias, contratos)
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  let palabras = texto.split(' ').filter(Boolean)

  // Fuera las muletillas de cabecera, pero sin quedarnos sin nada.
  while (palabras.length > 1 && PRESCINDIBLES.has(palabras[0].toLowerCase())) {
    palabras.shift()
  }
  // Y las que quedan sueltas por el medio.
  palabras = palabras.filter((p) => !PRESCINDIBLES.has(p.toLowerCase()))

  // Tres palabras bastan para reconocer un comercio. Se recorta ANTES de
  // limpiar el final, porque si no la coletilla se cuela dentro del corte.
  palabras = palabras.slice(0, 3)

  // Fuera los restos de la forma jurídica del final.
  while (palabras.length > 1 && SOCIEDADES.has(palabras[palabras.length - 1].toLowerCase())) {
    palabras.pop()
  }
  if (palabras.length === 0) return null

  const limpio = capitalizar(palabras)
  return limpio.length > 1 ? limpio : null
}

/**
 * Lo que se enseña en la lista. Las notas que has escrito tú se respetan tal
 * cual: solo se limpia lo que ha venido del banco.
 */
export function tituloDelGasto(
  nota: string | null,
  origen: 'manual' | 'csv' | 'fijo',
  nombreCategoria: string | null,
): string {
  if (!nota) return nombreCategoria ?? 'Gasto'
  if (origen !== 'csv') return nota
  return conceptoLegible(nota) ?? nombreCategoria ?? nota
}
