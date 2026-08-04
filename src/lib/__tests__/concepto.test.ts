import { describe, expect, it } from 'vitest'
import { conceptoLegible, tituloDelGasto } from '../concepto'

describe('conceptoLegible', () => {
  /** Conceptos tal cual salen del extracto real. */
  const casos: [string, string][] = [
    ['PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26', 'Prestamos Cuota'],
    ['ADEUDO RECIBO GrandVision Spain Grupo Optico S.A.U.', 'Grandvision Spain Grupo'],
    ['ADEUDO RECIBO SANITAS S A DE SEGUROS', 'Sanitas'],
    ['SEGUROS SECURITAS DIRECT ESPANA S.A.U.', 'Seguros Securitas Direct'],
    ['ELECTRICIDAD IBERDROLA CLIENTES,SA IBERDROLA ELECTRI', 'Electricidad Iberdrola'],
    ['TELEFONOS TELEFONICA DE ESPANA SAU FIJOxxxxxx855.jul', 'Telefonos Telefonica'],
    ['TRANSFERENCIA A Gloria Nataly Santos Vasquez', 'Gloria Nataly Santos'],
    ['COMPRA TARJETA MERCADONA MADRID', 'Mercadona Madrid'],
    ['INTERESES Y/O COMISIONES CUENTA', 'Intereses Y/O Comisiones'],
    ['REINTEGRO', 'Reintegro'],
    ['EMBARGO COMUNICADO EL DIA 05-05-2026', 'Embargo Comunicado Dia'],
  ]

  for (const [crudo, esperado] of casos) {
    it(`"${crudo.slice(0, 40)}" → ${esperado}`, () => {
      expect(conceptoLegible(crudo)).toBe(esperado)
    })
  }

  it('devuelve null cuando no queda nada aprovechable', () => {
    expect(conceptoLegible('')).toBeNull()
    expect(conceptoLegible('123456789')).toBeNull()
    expect(conceptoLegible('31/07/26')).toBeNull()
  })
})

describe('tituloDelGasto', () => {
  it('respeta lo que has escrito tú', () => {
    expect(tituloDelGasto('Cena con amigos', 'manual', 'Comer fuera')).toBe('Cena con amigos')
    expect(tituloDelGasto('Sanitas', 'fijo', 'Salud')).toBe('Sanitas')
  })

  it('limpia solo lo que viene del banco', () => {
    expect(tituloDelGasto('ADEUDO RECIBO SANITAS S A DE SEGUROS', 'csv', 'Salud')).toBe('Sanitas')
  })

  it('sin nota, se queda con el nombre de la categoría', () => {
    expect(tituloDelGasto(null, 'manual', 'Súper')).toBe('Súper')
    expect(tituloDelGasto(null, 'manual', null)).toBe('Gasto')
  })

  it('si al limpiar no queda nada, no deja al gasto sin nombre', () => {
    expect(tituloDelGasto('987654321', 'csv', 'Otros')).toBe('Otros')
  })
})
