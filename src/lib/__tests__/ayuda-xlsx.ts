import { crc32, deflateRawSync } from 'node:zlib'

/**
 * Fabrica un .xlsx de verdad (ZIP con deflate) para las pruebas, sin depender
 * de tener un extracto real a mano. Si el lector puede con esto, puede con el
 * archivo del banco.
 */

interface Fichero { nombre: string; contenido: string }

function escribirZip(ficheros: Fichero[]): Uint8Array<ArrayBuffer> {
  const locales: Buffer[] = []
  const centrales: Buffer[] = []
  let offset = 0

  for (const f of ficheros) {
    const crudo = Buffer.from(f.contenido, 'utf-8')
    const comprimido = deflateRawSync(crudo)
    const nombre = Buffer.from(f.nombre, 'utf-8')
    const suma = crc32(crudo)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)      // versión necesaria
    local.writeUInt16LE(8, 8)       // método: deflate
    local.writeUInt32LE(suma, 14)
    local.writeUInt32LE(comprimido.length, 18)
    local.writeUInt32LE(crudo.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    locales.push(local, nombre, comprimido)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(suma, 16)
    central.writeUInt32LE(comprimido.length, 20)
    central.writeUInt32LE(crudo.length, 24)
    central.writeUInt16LE(nombre.length, 28)
    central.writeUInt32LE(offset, 42)
    centrales.push(central, nombre)

    offset += local.length + nombre.length + comprimido.length
  }

  const zonaLocal = Buffer.concat(locales)
  const zonaCentral = Buffer.concat(centrales)

  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(ficheros.length, 8)
  fin.writeUInt16LE(ficheros.length, 10)
  fin.writeUInt32LE(zonaCentral.length, 12)
  fin.writeUInt32LE(zonaLocal.length, 16)

  const completo = Buffer.concat([zonaLocal, zonaCentral, fin])
  // Copia a un ArrayBuffer propio: los Buffer de Node comparten un pool y no
  // sirven directamente donde se espera un ArrayBuffer exacto.
  const salida = new Uint8Array(new ArrayBuffer(completo.length))
  salida.set(completo)
  return salida
}

const CABECERA_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

export interface OpcionesLibro {
  /** Textos de la tabla de cadenas compartidas. */
  textos: string[]
  /** Filas de <row> ya montadas. */
  filasXml: string
  /** Nombre de la hoja dentro del ZIP. */
  rutaHoja?: string
}

export function crearXlsx({ textos, filasXml, rutaHoja = 'worksheets/hoja-banco.xml' }: OpcionesLibro): File {
  const zip = escribirZip([
    {
      nombre: '[Content_Types].xml',
      contenido: `${CABECERA_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`,
    },
    {
      nombre: 'xl/workbook.xml',
      contenido: `${CABECERA_XML}<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimientos" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido: `${CABECERA_XML}<Relationships><Relationship Id="rId1" Target="${rutaHoja}"/></Relationships>`,
    },
    {
      nombre: 'xl/sharedStrings.xml',
      contenido: `${CABECERA_XML}<sst count="${textos.length}">${
        textos.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`,
    },
    {
      // El estilo 0 es normal; el estilo 1 lleva formato de fecha (numFmtId 14).
      nombre: 'xl/styles.xml',
      contenido: `${CABECERA_XML}<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
    },
    {
      nombre: `xl/${rutaHoja}`,
      contenido: `${CABECERA_XML}<worksheet><sheetData>${filasXml}</sheetData></worksheet>`,
    },
  ])

  return new File([zip], 'movimientos.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
