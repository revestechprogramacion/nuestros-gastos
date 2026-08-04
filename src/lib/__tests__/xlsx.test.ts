// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { leerXlsx } from '../xlsx'
import { leerFilas } from '../csv'
import { crearXlsx } from './ayuda-xlsx'

/**
 * Muchos bancos españoles ofrecen "Exportar a Excel" y no dan CSV, así que
 * este camino tiene que funcionar tan bien como el otro.
 *
 * Números de serie de Excel usados abajo (base 30/12/1899):
 *   46236 = 02/08/2026 · 46237 = 03/08/2026 · 46238 = 04/08/2026
 */

const TEXTOS = [
  'Listado de movimientos',            // 0
  'Fecha',                             // 1
  'Concepto',                          // 2
  'Importe',                           // 3
  'COMPRA TARJETA MERCADONA MADRID',   // 4
  'NOMINA REVESTECH SL',               // 5
  'RECIBO IBERDROLA CLIENTES SAU',     // 6
]

const FILAS = [
  // Fila decorativa, como la que mete el banco antes de la tabla.
  '<row r="1"><c r="A1" t="s"><v>0</v></c></row>',
  // Cabecera de verdad.
  '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c></row>',
  // Gasto (fecha con formato de fecha, importe negativo).
  '<row r="3"><c r="A3" s="1"><v>46238</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>-62.45</v></c></row>',
  // Ingreso: debe ignorarse.
  '<row r="4"><c r="A4" s="1"><v>46237</v></c><c r="B4" t="s"><v>5</v></c><c r="C4"><v>2100</v></c></row>',
  // Otro gasto.
  '<row r="5"><c r="A5" s="1"><v>46236</v></c><c r="B5" t="s"><v>6</v></c><c r="C5"><v>-89.4</v></c></row>',
].join('')

describe('leerXlsx', () => {
  it('lee la hoja y convierte los números de serie en fechas', async () => {
    const filas = await leerXlsx(crearXlsx({ textos: TEXTOS, filasXml: FILAS }))

    expect(filas[1]).toEqual(['Fecha', 'Concepto', 'Importe'])
    expect(filas[2]).toEqual(['2026-08-04', 'COMPRA TARJETA MERCADONA MADRID', '-62.45'])
  })

  it('sigue el índice del libro para dar con la hoja, aunque no se llame sheet1', async () => {
    const filas = await leerXlsx(crearXlsx({
      textos: TEXTOS, filasXml: FILAS, rutaHoja: 'worksheets/otra-hoja.xml',
    }))
    expect(filas[2][1]).toBe('COMPRA TARJETA MERCADONA MADRID')
  })

  it('encaja con el importador: saca los gastos e ignora la nómina', async () => {
    const r = leerFilas(await leerXlsx(crearXlsx({ textos: TEXTOS, filasXml: FILAS })))

    expect(r.movimientos).toHaveLength(2)
    expect(r.ingresosIgnorados).toBe(1)
    expect(r.movimientos[0]).toEqual({
      fecha: '2026-08-04',
      concepto: 'COMPRA TARJETA MERCADONA MADRID',
      importe: 6245,
    })
    expect(r.movimientos[1].importe).toBe(8940)
  })

  it('avisa con un Excel antiguo (.xls) en vez de fallar de mala manera', async () => {
    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    await expect(leerXlsx(new File([ole2], 'viejo.xls')))
      .rejects.toThrow(/Excel antiguo/)
  })

  it('avisa si el archivo no es ni CSV ni Excel', async () => {
    await expect(leerXlsx(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'foto.png')))
      .rejects.toThrow(/No reconozco/)
  })
})
