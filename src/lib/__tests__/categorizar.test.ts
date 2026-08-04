import { describe, expect, it } from 'vitest'
import { CATEGORIAS_CON_PISTAS, sugerirCategoria } from '../categorizar'
import { CATEGORIAS_INICIALES } from '../../data/seed'
import type { Category } from '../../data/types'

const CATS: Category[] = CATEGORIAS_INICIALES.map((c, i) => ({ ...c, id: `c${i}` }))

/** Devuelve el nombre de la categoría sugerida, o null. */
function categoriaDe(concepto: string): string | null {
  const { categoriaId } = sugerirCategoria(concepto, CATS, [])
  return CATS.find((c) => c.id === categoriaId)?.nombre ?? null
}

/**
 * Conceptos tal y como los escribe el banco en el extracto real: en
 * mayúsculas, sin acentos y con la coletilla que le da la gana.
 */
describe('conceptos reales de un extracto español', () => {
  const casos: [string, string][] = [
    ['PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26', 'Préstamos'],
    ['SEGUROS BANSABADELL VIDA,S.A.', 'Seguros'],
    ['SEGUROS SECURITAS DIRECT ESPANA S.A.U.', 'Seguros'],
    ['ADEUDO RECIBO BSSG', 'Seguros'],
    ['ELECTRICIDAD IBERDROLA CLIENTES,SA', 'Luz, agua, gas'],
    ['AGUA AGUAS ALICANTE E.M. SERVICIO AGUA AGU', 'Luz, agua, gas'],
    ['TELEFONOS TELEFONICA DE ESPANA SAU FIJOxxxxxx855.feb', 'Teléfono e internet'],
    ['ADEUDO RECIBO GrandVision Spain Grupo Optico S.A.U.', 'Salud'],
    ['TRANSFERENCIA A LAMARSA EDUCACION, S.L', 'Educación'],
    ['IMPUESTOS - IRPF', 'Impuestos y comisiones'],
    ['INTERESES Y/O COMISIONES CUENTA', 'Impuestos y comisiones'],
    ['REINTEGRO', 'Efectivo'],
    ['COMPRA TARJETA MERCADONA MADRID', 'Súper'],
    ['PAGO TARJETA REPSOL E.S. 4021', 'Coche'],
    ['NETFLIX.COM AMSTERDAM', 'Suscripciones'],
  ]

  for (const [concepto, esperada] of casos) {
    it(`"${concepto.slice(0, 42)}" → ${esperada}`, () => {
      expect(categoriaDe(concepto)).toBe(esperada)
    })
  }

  it('no confunde "el DIA 05-05-2026" con el supermercado DIA', () => {
    // El banco escribe la fecha en palabras dentro del concepto; una pista
    // de tres letras se la tragaba entera.
    expect(categoriaDe('EMBARGO COMUNICADO EL DIA 05-05-2026')).toBe('Impuestos y comisiones')
    expect(categoriaDe('ADEUDO RECIBO EL DIA 12-03-2026')).toBeNull()
    expect(categoriaDe('COMPRA SUPERMERCADOS DIA ALICANTE')).toBe('Súper')
  })

  it('no adivina con una transferencia a una persona', () => {
    // Estas dependen de cada casa: solo las resuelve una regla tuya.
    expect(categoriaDe('TRANSFERENCIA A Gloria Nataly Santos Vasquez')).toBeNull()
  })

  it('una regla tuya resuelve la transferencia a tu propia cuenta', () => {
    const traspasos = CATS.find((c) => c.nombre === 'Traspasos')!
    const reglas = [{ id: 'r1', patron: 'miguel martinez gil', categoriaId: traspasos.id, aciertos: 1 }]

    expect(sugerirCategoria('TRANSFERENCIA A Miguel Martinez Gil', CATS, reglas))
      .toEqual({ categoriaId: traspasos.id, fuente: 'regla' })
  })
})

describe('categorías por defecto', () => {
  it('no repite nombres ni colores', () => {
    const nombres = CATEGORIAS_INICIALES.map((c) => c.nombre)
    const colores = CATEGORIAS_INICIALES.map((c) => c.color)
    expect(new Set(nombres).size).toBe(nombres.length)
    expect(new Set(colores).size).toBe(colores.length)
  })

  it('cada categoría del diccionario de pistas existe de verdad', () => {
    // Si se renombra una categoría y no se toca el diccionario, la pista deja
    // de aplicarse en silencio. Esta prueba lo caza.
    const nombres = CATEGORIAS_INICIALES.map((c) => c.nombre)
    for (const nombre of CATEGORIAS_CON_PISTAS) {
      expect(nombres).toContain(nombre)
    }
  })
})
