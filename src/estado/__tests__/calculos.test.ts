import { describe, expect, it } from 'vitest'
import { estadoPresupuestos, gastosQueCuentan, resumirMes, variacionesFrente } from '../calculos'
import { sugerirCategoria, patronDesdeConcepto } from '../../lib/categorizar'
import type { Category, Expense } from '../../data/types'

const CATS: Category[] = [
  { id: 'c1', nombre: 'Súper', icono: '🛒', color: '#16a34a', orden: 1, archivada: false, excluidaDeTotales: false },
  { id: 'c2', nombre: 'Coche', icono: '🚗', color: '#dc2626', orden: 2, archivada: false, excluidaDeTotales: false },
  { id: 'c3', nombre: 'Suscripciones', icono: '📺', color: '#0284c7', orden: 3, archivada: false, excluidaDeTotales: false },
]

function gasto(id: string, importe: number, fecha: string, categoriaId: string | null): Expense {
  return {
    id, importe, fecha, categoriaId,
    nota: null, ticketPath: null, origen: 'manual',
    creadoPor: 'u1', creadoEn: `${fecha}T10:00:00.000Z`,
  }
}

const GASTOS: Expense[] = [
  gasto('1', 5000, '2026-07-03', 'c1'),
  gasto('2', 3000, '2026-07-20', 'c1'),
  gasto('3', 8000, '2026-07-15', 'c2'),
  gasto('4', 1399, '2026-07-05', null),   // sin categoría
  gasto('5', 2000, '2026-06-10', 'c1'),   // otro mes
]

describe('resumirMes', () => {
  const r = resumirMes(GASTOS, CATS, [], '2026-07')

  it('suma solo los gastos del mes pedido', () => {
    expect(r.total).toBe(5000 + 3000 + 8000 + 1399)
    expect(r.numGastos).toBe(4)
  })

  it('agrupa por categoría y ordena de mayor a menor', () => {
    expect(r.porCategoria.map((c) => c.categoria?.nombre ?? 'Sin categoría'))
      .toEqual(['Súper', 'Coche', 'Sin categoría'])
    expect(r.porCategoria[0].total).toBe(8000)
  })

  it('reparte los porcentajes de forma que sumen 1', () => {
    const suma = r.porCategoria.reduce((s, c) => s + c.fraccion, 0)
    expect(suma).toBeCloseTo(1, 10)
  })

  it('no proyecta nada en un mes ya cerrado', () => {
    expect(r.esMesEnCurso).toBe(false)
    expect(r.proyeccion).toBe(r.total)
  })

  it('devuelve ceros en un mes sin gastos', () => {
    const vacio = resumirMes(GASTOS, CATS, [], '2020-01')
    expect(vacio.total).toBe(0)
    expect(vacio.porCategoria).toEqual([])
  })
})

describe('gastosQueCuentan', () => {
  const conTraspasos: Category[] = [
    ...CATS,
    { id: 'c4', nombre: 'Traspasos', icono: '🔄', color: '#059669', orden: 4, archivada: false, excluidaDeTotales: true },
  ]
  const gastos = [...GASTOS, gasto('6', 100000, '2026-07-10', 'c4')]

  it('deja fuera el dinero que solo cambia de sitio', () => {
    const cuentan = gastosQueCuentan(gastos, conTraspasos)
    expect(cuentan).toHaveLength(GASTOS.length)
    expect(cuentan.some((g) => g.categoriaId === 'c4')).toBe(false)
  })

  it('un traspaso de 1.000 € no infla el total del mes', () => {
    const sinFiltrar = resumirMes(gastos, conTraspasos, [], '2026-07')
    const filtrado = resumirMes(gastosQueCuentan(gastos, conTraspasos), conTraspasos, [], '2026-07')
    expect(sinFiltrar.total - filtrado.total).toBe(100000)
  })

  it('sin categorías excluidas devuelve la lista tal cual', () => {
    expect(gastosQueCuentan(GASTOS, CATS)).toBe(GASTOS)
  })
})

describe('estadoPresupuestos', () => {
  it('calcula lo gastado, lo que queda y si se han pasado', () => {
    const r = estadoPresupuestos(GASTOS, CATS, [
      { categoriaId: 'c1', importe: 10000 },
      { categoriaId: 'c2', importe: 5000 },
    ], '2026-07')

    const superr = r.find((b) => b.categoria!.id === 'c1')!
    expect(superr.gastado).toBe(8000)
    expect(superr.restante).toBe(2000)
    expect(superr.fraccion).toBeCloseTo(0.8)

    const coche = r.find((b) => b.categoria!.id === 'c2')!
    expect(coche.restante).toBe(-3000)  // se han pasado
  })

  it('ignora las categorías con tope a cero', () => {
    const r = estadoPresupuestos(GASTOS, CATS, [{ categoriaId: 'c1', importe: 0 }], '2026-07')
    expect(r).toEqual([])
  })
})

describe('variacionesFrente', () => {
  it('ordena por el cambio más grande en valor absoluto', () => {
    const r = variacionesFrente(GASTOS, CATS, '2026-07', '2026-06')
    expect(r[0].categoria?.nombre).toBe('Coche')  // 0 -> 80 €
    expect(r[0].delta).toBe(8000)

    const superr = r.find((v) => v.categoria?.id === 'c1')!
    expect(superr.antes).toBe(2000)
    expect(superr.ahora).toBe(8000)
    expect(superr.delta).toBe(6000)
  })
})

describe('sugerirCategoria', () => {
  it('reconoce comercios españoles habituales', () => {
    expect(sugerirCategoria('COMPRA TARJETA MERCADONA MADRID', CATS, []))
      .toEqual({ categoriaId: 'c1', fuente: 'diccionario' })
    expect(sugerirCategoria('PAGO REPSOL E.S. 4021', CATS, []).categoriaId).toBe('c2')
    expect(sugerirCategoria('NETFLIX.COM AMSTERDAM', CATS, []).categoriaId).toBe('c3')
  })

  it('tus reglas mandan sobre el diccionario', () => {
    const reglas = [{ id: 'r1', patron: 'mercadona', categoriaId: 'c2', aciertos: 3 }]
    expect(sugerirCategoria('COMPRA MERCADONA', CATS, reglas))
      .toEqual({ categoriaId: 'c2', fuente: 'regla' })
  })

  it('entre varias reglas gana la más específica', () => {
    const reglas = [
      { id: 'r1', patron: 'repsol', categoriaId: 'c2', aciertos: 1 },
      { id: 'r2', patron: 'repsol luz', categoriaId: 'c3', aciertos: 1 },
    ]
    expect(sugerirCategoria('RECIBO REPSOL LUZ Y GAS', CATS, reglas).categoriaId).toBe('c3')
  })

  it('no inventa categoría cuando no reconoce nada', () => {
    expect(sugerirCategoria('TRASPASO 0912838', CATS, []))
      .toEqual({ categoriaId: null, fuente: null })
  })
})

describe('patronDesdeConcepto', () => {
  it('se queda con el nombre del comercio y tira el ruido del banco', () => {
    expect(patronDesdeConcepto('COMPRA TARJETA EN MERCADONA MADRID 4021'))
      .toBe('mercadona madrid')
    expect(patronDesdeConcepto('RECIBO DE IBERDROLA CLIENTES SAU'))
      .toBe('iberdrola clientes')
  })
})

describe('gastos pendientes de subir', () => {
  it('se reconocen por su identificador provisional', async () => {
    const { esPendienteDeSubir } = await import('../../data/types')
    expect(esPendienteDeSubir('pendiente-0')).toBe(true)
    expect(esPendienteDeSubir('a35ac5f4-fb95-42b3-bd5f-71c742880f96')).toBe(false)
  })
})
