import type { Budget, Category, Expense } from '../data/types'
import { diasDelMes, diasTranscurridos, mesActual, mesDe } from '../lib/fechas'

export interface ResumenCategoria {
  categoria: Category | null
  total: number
  numGastos: number
  presupuesto: number
  fraccion: number // parte del gasto total del mes
}

export interface ResumenMes {
  mes: string
  total: number
  numGastos: number
  porCategoria: ResumenCategoria[]
  /** Estimación de cómo acabará el mes al ritmo actual. Solo tiene sentido en el mes en curso. */
  proyeccion: number
  esMesEnCurso: boolean
}

export function gastosDelMes(gastos: Expense[], mes: string): Expense[] {
  return gastos.filter((g) => mesDe(g.fecha) === mes)
}

/**
 * Quita el dinero que no se gasta, solo cambia de sitio (traspasos entre
 * vuestras cuentas). Todo lo que salga en el resumen del mes debe pasar por
 * aquí; si no, el titular dice que gastáis más de lo que gastáis.
 */
export function gastosQueCuentan(gastos: Expense[], categorias: Category[]): Expense[] {
  const fuera = new Set(categorias.filter((c) => c.excluidaDeTotales).map((c) => c.id))
  if (fuera.size === 0) return gastos
  return gastos.filter((g) => !g.categoriaId || !fuera.has(g.categoriaId))
}

export function resumirMes(
  gastos: Expense[],
  categorias: Category[],
  presupuestos: Budget[],
  mes: string,
): ResumenMes {
  const delMes = gastosDelMes(gastos, mes)
  const total = delMes.reduce((s, g) => s + g.importe, 0)

  const porId = new Map<string | null, { total: number; num: number }>()
  for (const g of delMes) {
    const actual = porId.get(g.categoriaId) ?? { total: 0, num: 0 }
    actual.total += g.importe
    actual.num += 1
    porId.set(g.categoriaId, actual)
  }

  const porCategoria: ResumenCategoria[] = [...porId.entries()]
    .map(([id, v]) => ({
      categoria: categorias.find((c) => c.id === id) ?? null,
      total: v.total,
      numGastos: v.num,
      presupuesto: presupuestos.find((p) => p.categoriaId === id)?.importe ?? 0,
      fraccion: total > 0 ? v.total / total : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const esMesEnCurso = mes === mesActual()
  const transcurridos = diasTranscurridos(mes)
  const proyeccion = esMesEnCurso && transcurridos > 0
    ? Math.round((total / transcurridos) * diasDelMes(mes))
    : total

  return { mes, total, numGastos: delMes.length, porCategoria, proyeccion, esMesEnCurso }
}

/** Categorías con presupuesto, ordenadas por lo cerca que están de pasarse. */
export function estadoPresupuestos(
  gastos: Expense[],
  categorias: Category[],
  presupuestos: Budget[],
  mes: string,
) {
  const delMes = gastosDelMes(gastos, mes)
  return presupuestos
    .filter((p) => p.importe > 0)
    .map((p) => {
      const categoria = categorias.find((c) => c.id === p.categoriaId) ?? null
      const gastado = delMes
        .filter((g) => g.categoriaId === p.categoriaId)
        .reduce((s, g) => s + g.importe, 0)
      return {
        categoria,
        presupuesto: p.importe,
        gastado,
        restante: p.importe - gastado,
        fraccion: gastado / p.importe,
      }
    })
    .filter((b) => b.categoria !== null)
    .sort((a, b) => b.fraccion - a.fraccion)
}

/** Serie de totales por mes, del más antiguo al más reciente. */
export function totalesPorMes(gastos: Expense[], meses: string[]): { mes: string; total: number }[] {
  return meses.map((mes) => ({
    mes,
    total: gastosDelMes(gastos, mes).reduce((s, g) => s + g.importe, 0),
  }))
}

/**
 * Categorías ordenadas por las que más usáis últimamente. Con veinte
 * categorías, tener delante las cuatro de siempre es la diferencia entre
 * apuntar un gasto en cinco segundos o en veinte.
 */
export function categoriasPorUso(
  categorias: Category[],
  gastos: Expense[],
  desdeFecha: string,
): Category[] {
  const usos = new Map<string, number>()
  for (const g of gastos) {
    if (!g.categoriaId || g.fecha < desdeFecha) continue
    // Los generados automáticamente no dicen nada de lo que tecleáis vosotros.
    if (g.origen === 'fijo') continue
    usos.set(g.categoriaId, (usos.get(g.categoriaId) ?? 0) + 1)
  }
  return [...categorias].sort((a, b) => {
    const diferencia = (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0)
    return diferencia !== 0 ? diferencia : a.orden - b.orden
  })
}

/** Meses con datos, del más reciente al más antiguo. Siempre incluye el mes actual. */
export function mesesConDatos(gastos: Expense[]): string[] {
  const set = new Set(gastos.map((g) => mesDe(g.fecha)))
  set.add(mesActual())
  return [...set].sort().reverse()
}

/** Las categorías que más suben respecto al mes anterior. */
export function variacionesFrente(
  gastos: Expense[],
  categorias: Category[],
  mes: string,
  mesPrevio: string,
) {
  const sumaPor = (m: string) => {
    const mapa = new Map<string | null, number>()
    for (const g of gastosDelMes(gastos, m)) {
      mapa.set(g.categoriaId, (mapa.get(g.categoriaId) ?? 0) + g.importe)
    }
    return mapa
  }
  const ahora = sumaPor(mes)
  const antes = sumaPor(mesPrevio)
  const ids = new Set([...ahora.keys(), ...antes.keys()])

  return [...ids]
    .map((id) => ({
      categoria: categorias.find((c) => c.id === id) ?? null,
      ahora: ahora.get(id) ?? 0,
      antes: antes.get(id) ?? 0,
      delta: (ahora.get(id) ?? 0) - (antes.get(id) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}
