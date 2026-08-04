import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clavePeriodica, detectarFijos, diaEfectivo } from '../periodicos'
import type { Expense } from '../../data/types'

/** Congelamos "hoy" al 4 de agosto de 2026: la ventana será feb–jul. */
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 4))
})
afterEach(() => vi.useRealTimers())

function gasto(fecha: string, importe: number, nota: string, categoriaId: string | null = 'c1'): Expense {
  return {
    id: `${fecha}-${importe}-${nota}`, importe, fecha, categoriaId, nota,
    ticketPath: null, origen: 'csv', creadoPor: 'u1', creadoEn: `${fecha}T10:00:00Z`,
  }
}

/** Un movimiento en cada uno de los meses feb–jul. */
function cadaMes(dia: number, importe: number, nota: (mes: string) => string): Expense[] {
  return ['02', '03', '04', '05', '06', '07'].map((m) =>
    gasto(`2026-${m}-${String(dia).padStart(2, '0')}`, importe, nota(m)))
}

describe('clavePeriodica', () => {
  it('quita lo que cambia cada mes: fechas, referencias y el mes abreviado', () => {
    expect(clavePeriodica('PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26'))
      .toBe('prestamos adeudo cuota')
    expect(clavePeriodica('TELEFONOS TELEFONICA DE ESPANA SAU FIJOxxxxxx855.feb'))
      .toBe('telefonos telefonica de espana')
    expect(clavePeriodica('TELEFONOS TELEFONICA DE ESPANA SAU FIJOxxxxxx855.jul'))
      .toBe('telefonos telefonica de espana')
  })

  it('dos meses del mismo recibo dan la misma clave', () => {
    expect(clavePeriodica('PRESTAMOS ADEUDO CUOTA N.8077561060 30/06/26'))
      .toBe(clavePeriodica('PRESTAMOS ADEUDO CUOTA N.8077561060 31/07/26'))
  })
})

describe('detectarFijos', () => {
  it('detecta un recibo mensual y propone importe y día', () => {
    const gastos = cadaMes(6, 3961, () => 'SEGUROS SECURITAS DIRECT ESPANA S.A.U.')
    const [f] = detectarFijos(gastos).fijos

    expect(f.importe).toBe(3961)
    expect(f.diaDelMes).toBe(6)
    expect(f.meses).toBe(6)
    expect(f.ultimoMes).toBe('2026-07')
  })

  it('separa dos préstamos que comparten concepto pero no importe', () => {
    const gastos = [
      ...cadaMes(28, 180581, (m) => `PRESTAMOS ADEUDO CUOTA N.8077561060 28/${m}/26`),
      ...cadaMes(28, 76791, (m) => `PRESTAMOS ADEUDO CUOTA N.8078406209 28/${m}/26`),
    ]
    const { fijos } = detectarFijos(gastos)

    expect(fijos).toHaveLength(2)
    expect(fijos.map((f) => f.importe)).toEqual([180581, 76791])
    // Mismo concepto: el nombre se distingue con la referencia del banco.
    expect(fijos.map((f) => f.nombre)).toEqual([
      'Prestamos 1060',
      'Prestamos 6209',
    ])
  })

  it('la luz se detecta, pero NO se propone: cambia cada mes', () => {
    const importes = [23676, 28731, 44029, 26000, 27000, 25000]
    const gastos = ['02', '03', '04', '05', '06', '07'].map((m, i) =>
      gasto(`2026-${m}-17`, importes[i], 'ELECTRICIDAD IBERDROLA CLIENTES,SA'))

    const { fijos, variables } = detectarFijos(gastos)

    // Apuntarla por adelantado con un importe inventado descuadraría el mes.
    expect(fijos).toEqual([])
    expect(variables).toHaveLength(1)
    expect(variables[0].importeMin).toBe(23676)
    expect(variables[0].importeMax).toBe(44029)
  })

  it('una cuota que siempre vale lo mismo sí se propone', () => {
    // Un par de céntimos de diferencia siguen siendo "el mismo recibo".
    const importes = [3961, 3961, 3962, 3961, 3962, 3961]
    const gastos = ['02', '03', '04', '05', '06', '07'].map((m, i) =>
      gasto(`2026-${m}-06`, importes[i], 'SEGUROS SECURITAS DIRECT ESPANA S.A.U.'))

    const { fijos, variables } = detectarFijos(gastos)
    expect(fijos).toHaveLength(1)
    expect(variables).toEqual([])
  })

  it('NO propone transferencias sueltas aunque haya muchas', () => {
    // Como en el extracto real: varias al mes, importes dispares y en
    // cualquier día. Eso es dinero que mandas a mano, no un recibo.
    const dias = [[3, 9, 18, 27], [1, 14, 22, 28], [6, 11, 19, 25],
      [2, 8, 21, 29], [5, 16, 23, 30], [4, 13, 17, 26]]
    const importes = [[20000, 2000, 100000, 5000], [15000, 170000, 3000, 8000],
      [50000, 12000, 2500, 90000], [30000, 6000, 110000, 4000],
      [25000, 140000, 7000, 9000], [45000, 11000, 2000, 80000]]

    const gastos = ['02', '03', '04', '05', '06', '07'].flatMap((m, i) =>
      dias[i].map((d, j) =>
        gasto(`2026-${m}-${String(d).padStart(2, '0')}`, importes[i][j],
          'TRANSFERENCIA A Miguel Martinez Gil')))

    expect(detectarFijos(gastos).fijos).toEqual([])
  })

  it('NO propone un pago mensual que cae cualquier día del mes', () => {
    const dias = [2, 11, 19, 27, 6, 23]
    const gastos = ['02', '03', '04', '05', '06', '07'].map((m, i) =>
      gasto(`2026-${m}-${String(dias[i]).padStart(2, '0')}`, 50000, 'TRANSFERENCIA A Un Amigo'))

    expect(detectarFijos(gastos).fijos).toEqual([])
  })

  it('ignora lo que solo pasó un par de veces', () => {
    const gastos = [
      gasto('2026-06-29', 120000, 'REINTEGRO'),
      gasto('2026-07-29', 100000, 'REINTEGRO'),
    ]
    expect(detectarFijos(gastos).fijos).toEqual([])
  })

  it('no se cuenta a sí mismo: los gastos ya generados quedan fuera', () => {
    const generados = cadaMes(6, 3961, () => 'Alarma').map((g) => ({ ...g, origen: 'fijo' as const }))
    expect(detectarFijos(generados).fijos).toEqual([])
  })

  it('deja fuera el mes en curso, que está a medias', () => {
    // Agosto (mes actual) no cuenta; con feb–jul completos hay de sobra.
    const gastos = [...cadaMes(2, 20819, () => 'ADEUDO RECIBO SANITAS'),
      gasto('2026-08-02', 20819, 'ADEUDO RECIBO SANITAS')]
    const [f] = detectarFijos(gastos).fijos
    expect(f.mesesAnalizados).toBe(6)
    expect(f.ultimoMes).toBe('2026-07')
  })
})

describe('diaEfectivo', () => {
  it('un recibo del 31 cae el último día en los meses cortos', () => {
    expect(diaEfectivo(31, '2026-02')).toBe(28)
    expect(diaEfectivo(31, '2024-02')).toBe(29) // bisiesto
    expect(diaEfectivo(31, '2026-04')).toBe(30)
    expect(diaEfectivo(31, '2026-07')).toBe(31)
    expect(diaEfectivo(5, '2026-02')).toBe(5)
  })
})

describe('nombres propuestos', () => {
  /** El banco encabeza medio extracto con muletillas; el nombre debe ser útil. */
  const nombreDe = (concepto: string) =>
    detectarFijos(cadaMes(6, 5000, () => concepto)).fijos[0]?.nombre

  it('se queda con lo que identifica al recibo', () => {
    expect(nombreDe('ADEUDO RECIBO SANITAS S A DE SEGUROS')).toBe('Sanitas')
    expect(nombreDe('SEGUROS SECURITAS DIRECT ESPANA S.A.U.')).toBe('Securitas direct espana')
    expect(nombreDe('ELECTRICIDAD IBERDROLA CLIENTES,SA')).toBe('Iberdrola clientes')
    expect(nombreDe('SEGUROS BANSABADELL VIDA,S.A.')).toBe('Bansabadell vida')
  })

  it('nunca se queda sin nombre, aunque todo sean muletillas', () => {
    expect(nombreDe('ADEUDO RECIBO')).toBe('Adeudo')
  })
})
