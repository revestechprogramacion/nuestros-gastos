/**
 * Lector de Excel (.xlsx) sin librerías externas.
 *
 * Un .xlsx no es más que un ZIP con varios XML dentro. El navegador ya sabe
 * descomprimir (DecompressionStream) y leer XML (DOMParser), así que no hace
 * falta arrastrar una dependencia de 400 KB solo para importar el extracto.
 *
 * Devuelve la primera hoja como una tabla de textos, lista para el importador.
 */

// ---------------------------------------------------------------- ZIP

interface EntradaZip {
  nombre: string
  comprimido: boolean
  inicio: number
  largo: number
}

function leerU16(v: DataView, p: number) { return v.getUint16(p, true) }
function leerU32(v: DataView, p: number) { return v.getUint32(p, true) }

/** Localiza las entradas del ZIP leyendo su directorio central. */
function listarZip(buf: ArrayBuffer): EntradaZip[] {
  const v = new DataView(buf)
  const bytes = new Uint8Array(buf)

  // El "End Of Central Directory" está al final, detrás de un comentario de
  // longitud variable: lo buscamos hacia atrás.
  let eocd = -1
  const desde = Math.max(0, bytes.length - 66_000)
  for (let i = bytes.length - 22; i >= desde; i--) {
    if (leerU32(v, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd === -1) throw new Error('El archivo no es un Excel válido (falta el índice del ZIP).')

  const numEntradas = leerU16(v, eocd + 10)
  let p = leerU32(v, eocd + 16)
  const entradas: EntradaZip[] = []

  for (let i = 0; i < numEntradas; i++) {
    if (leerU32(v, p) !== 0x02014b50) break
    const metodo = leerU16(v, p + 10)
    const largoComprimido = leerU32(v, p + 20)
    const largoNombre = leerU16(v, p + 28)
    const largoExtra = leerU16(v, p + 30)
    const largoComentario = leerU16(v, p + 32)
    const offsetLocal = leerU32(v, p + 42)
    const nombre = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + largoNombre))

    // La cabecera local repite el nombre y los extras, con longitudes propias.
    const nombreLocal = leerU16(v, offsetLocal + 26)
    const extraLocal = leerU16(v, offsetLocal + 28)
    const inicio = offsetLocal + 30 + nombreLocal + extraLocal

    entradas.push({ nombre, comprimido: metodo === 8, inicio, largo: largoComprimido })
    p += 46 + largoNombre + largoExtra + largoComentario
  }

  return entradas
}

async function extraer(buf: ArrayBuffer, e: EntradaZip): Promise<string> {
  const trozo = new Uint8Array(buf, e.inicio, e.largo)
  if (!e.comprimido) return new TextDecoder().decode(trozo)

  // Solo DecompressionStream: nada de Blob ni Response, que no se comportan
  // igual en todos los entornos y aquí llegaron a colgarse.
  const ds = new DecompressionStream('deflate-raw')
  const escritor = ds.writable.getWriter()
  void escritor.write(trozo).then(() => escritor.close())

  const lector = ds.readable.getReader()
  const trozos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    trozos.push(value)
    total += value.length
  }

  const salida = new Uint8Array(total)
  let p = 0
  for (const t of trozos) { salida.set(t, p); p += t.length }
  return new TextDecoder().decode(salida)
}

// ---------------------------------------------------------------- XLSX

/** "C7" → 2 (la columna C es la tercera) */
function columnaDe(ref: string): number {
  const letras = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/** Número de serie de Excel → 'YYYY-MM-DD' */
function fechaDeSerie(serie: number): string {
  // Excel cuenta desde el 1900 y arrastra el famoso bug del año bisiesto:
  // la base real es el 30/12/1899.
  const ms = Math.round(serie * 86_400_000)
  const d = new Date(Date.UTC(1899, 11, 30) + ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Formatos de fecha/hora que Excel trae de fábrica. */
const FORMATOS_FECHA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

/**
 * Averigua qué estilos representan fechas. En el XML las fechas son números
 * corrientes; lo único que las distingue es el formato que tienen aplicado.
 */
function estilosDeFecha(xmlEstilos: string | null): Set<number> {
  const esFecha = new Set<number>()
  if (!xmlEstilos) return esFecha

  const doc = new DOMParser().parseFromString(xmlEstilos, 'application/xml')

  // Formatos personalizados: nos fijamos en si el patrón lleva día/mes/año.
  const personalizados = new Set<number>()
  for (const nf of doc.getElementsByTagName('numFmt')) {
    const codigo = nf.getAttribute('formatCode') ?? ''
    const id = Number(nf.getAttribute('numFmtId'))
    // Quitamos lo que va entre comillas para no confundir un texto con 'd'.
    if (/[dmyhs]/i.test(codigo.replace(/"[^"]*"/g, ''))) personalizados.add(id)
  }

  const cellXfs = doc.getElementsByTagName('cellXfs')[0]
  if (!cellXfs) return esFecha

  const xfs = cellXfs.getElementsByTagName('xf')
  for (let i = 0; i < xfs.length; i++) {
    const id = Number(xfs[i].getAttribute('numFmtId') ?? 0)
    if (FORMATOS_FECHA.has(id) || personalizados.has(id)) esFecha.add(i)
  }
  return esFecha
}

function textosCompartidos(xml: string | null): string[] {
  if (!xml) return []
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map((si) =>
    // Un texto puede venir troceado en varios <r>; se concatenan.
    Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join(''),
  )
}

/**
 * Lee la primera hoja de un .xlsx y la devuelve como tabla de textos.
 * Las fechas se devuelven ya como 'YYYY-MM-DD'.
 */
export async function leerXlsx(archivo: File): Promise<string[][]> {
  const buf = await archivo.arrayBuffer()

  // Los .xls antiguos son un formato binario completamente distinto.
  const firma = new Uint8Array(buf, 0, Math.min(8, buf.byteLength))
  if (firma[0] === 0xd0 && firma[1] === 0xcf) {
    throw new Error(
      'Este es un Excel antiguo (.xls). Ábrelo, dale a «Guardar como» y elige ' +
      '«Excel (.xlsx)» o «CSV». Luego súbelo otra vez.',
    )
  }
  if (firma[0] !== 0x50 || firma[1] !== 0x4b) {
    throw new Error('No reconozco este archivo. Debe ser un CSV o un Excel (.xlsx).')
  }

  const entradas = listarZip(buf)
  const buscar = (nombre: string) => entradas.find((e) => e.nombre === nombre)

  // ¿Cuál es la primera hoja? El libro las lista en orden y las referencia por
  // id; el archivo de relaciones traduce ese id a una ruta.
  let rutaHoja = 'xl/worksheets/sheet1.xml'
  const libro = buscar('xl/workbook.xml')
  const relaciones = buscar('xl/_rels/workbook.xml.rels')

  if (libro && relaciones) {
    const docLibro = new DOMParser()
      .parseFromString(await extraer(buf, libro), 'application/xml')
    const primera = docLibro.getElementsByTagName('sheet')[0]
    const rid = primera?.getAttribute('r:id') ?? primera?.getAttribute('id')

    if (rid) {
      const docRel = new DOMParser()
        .parseFromString(await extraer(buf, relaciones), 'application/xml')
      for (const rel of docRel.getElementsByTagName('Relationship')) {
        if (rel.getAttribute('Id') === rid) {
          const destino = rel.getAttribute('Target') ?? ''
          rutaHoja = destino.startsWith('/')
            ? destino.slice(1)
            : `xl/${destino.replace(/^\.\//, '')}`
          break
        }
      }
    }
  }

  const hoja = buscar(rutaHoja)
    ?? entradas.find((e) => /^xl\/worksheets\/.*\.xml$/.test(e.nombre))
  if (!hoja) throw new Error('El Excel no tiene ninguna hoja de cálculo dentro.')

  const compartidos = textosCompartidos(
    buscar('xl/sharedStrings.xml') ? await extraer(buf, buscar('xl/sharedStrings.xml')!) : null,
  )
  const fechas = estilosDeFecha(
    buscar('xl/styles.xml') ? await extraer(buf, buscar('xl/styles.xml')!) : null,
  )

  const doc = new DOMParser()
    .parseFromString(await extraer(buf, hoja), 'application/xml')

  const filas: string[][] = []
  for (const fila of doc.getElementsByTagName('row')) {
    const celdas: string[] = []
    for (const celda of fila.getElementsByTagName('c')) {
      const col = columnaDe(celda.getAttribute('r') ?? '')
      const tipo = celda.getAttribute('t')
      const estilo = Number(celda.getAttribute('s') ?? -1)
      let valor = ''

      if (tipo === 's') {
        const i = Number(celda.getElementsByTagName('v')[0]?.textContent ?? -1)
        valor = compartidos[i] ?? ''
      } else if (tipo === 'inlineStr') {
        valor = Array.from(celda.getElementsByTagName('t'))
          .map((t) => t.textContent ?? '').join('')
      } else {
        valor = celda.getElementsByTagName('v')[0]?.textContent ?? ''
        // Un número con formato de fecha es una fecha.
        if (valor !== '' && fechas.has(estilo) && Number.isFinite(Number(valor))) {
          valor = fechaDeSerie(Number(valor))
        }
      }

      while (celdas.length < col) celdas.push('')
      celdas[col] = valor.trim()
    }
    filas.push(celdas)
  }

  return filas
}
