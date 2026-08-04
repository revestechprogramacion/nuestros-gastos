import { describe, expect, it } from 'vitest'
import { leerCsvBanco } from '../csv'

/**
 * El importador tiene que tragar lo que exporta cada banco: separadores
 * distintos, filas decorativas antes de la tabla, comas decimales, comillas y
 * columnas Debe/Haber separadas.
 */

describe('leerCsvBanco', () => {
  it('lee un extracto con cabecera decorativa y punto y coma (estilo BBVA)', () => {
    const csv = [
      'Listado de movimientos',
      'Cuenta;ES00 0000 0000 0000 0000 0000',
      '',
      'Fecha;Fecha valor;Concepto;Importe;Divisa;Saldo',
      '04/08/2026;04/08/2026;COMPRA TARJETA MERCADONA MADRID;-62,45;EUR;1.234,00',
      '03/08/2026;03/08/2026;NOMINA REVESTECH SL;2.100,00;EUR;1.296,45',
      '02/08/2026;02/08/2026;RECIBO IBERDROLA CLIENTES SAU;-89,40;EUR;-803,55',
      '01/08/2026;01/08/2026;PAGO TARJETA REPSOL E.S. 4021;-65,00;EUR;-892,95',
    ].join('\n')

    const r = leerCsvBanco(csv)

    expect(r.movimientos).toHaveLength(3)
    expect(r.ingresosIgnorados).toBe(1)
    expect(r.movimientos[0]).toEqual({
      fecha: '2026-08-04',
      concepto: 'COMPRA TARJETA MERCADONA MADRID',
      importe: 6245,
    })
  })

  it('entiende columnas Debe y Haber separadas', () => {
    const csv = [
      'Fecha operacion,Descripcion,Debe,Haber',
      '04/08/2026,PAGO EN LIDL SUPERMERCADO,38.20,',
      '03/08/2026,TRANSFERENCIA RECIBIDA,,500.00',
      '02/08/2026,NETFLIX.COM,13.99,',
    ].join('\n')

    const r = leerCsvBanco(csv)

    expect(r.movimientos.map((m) => m.importe)).toEqual([3820, 1399])
  })

  it('respeta las comillas: separadores y comillas dobles dentro del concepto', () => {
    const csv = [
      '"Fecha";"Concepto";"Importe (EUR)"',
      '"04/08/2026";"CENA; RESTAURANTE ""EL PUERTO""";"-45,80"',
      '"03/08/2026";"FARMACIA CENTRAL";"-12,30"',
    ].join('\n')

    const r = leerCsvBanco(csv)

    expect(r.movimientos).toHaveLength(2)
    expect(r.movimientos[0].concepto).toBe('CENA; RESTAURANTE "EL PUERTO"')
    expect(r.movimientos[0].importe).toBe(4580)
  })

  it('trata los importes entre paréntesis como cargos', () => {
    const csv = [
      'Fecha,Concepto,Importe',
      '04/08/2026,COMPRA EN ZARA,(59.90)',
    ].join('\n')

    expect(leerCsvBanco(csv).movimientos[0].importe).toBe(5990)
  })

  it('avisa cuando el archivo no es un extracto', () => {
    expect(() => leerCsvBanco('esto;no;es;un;extracto\nni;de;lejos;nada;aqui'))
      .toThrow(/columnas de fecha e importe/)
  })

  it('avisa cuando el archivo está vacío', () => {
    expect(() => leerCsvBanco('   \n  \n')).toThrow(/vacío/)
  })
})
