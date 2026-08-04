// Modelo de datos de Nuestros Gastos.
// Nota: todos los importes se guardan en CÉNTIMOS (enteros) para evitar
// los errores de redondeo de los decimales en JavaScript.

export type ID = string

export interface Member {
  id: ID
  nombre: string
  email: string | null
}

export interface Category {
  id: ID
  nombre: string
  icono: string
  color: string
  orden: number
  archivada: boolean
  /**
   * Los movimientos de esta categoría no suman en los totales del mes.
   * Para el dinero que no se gasta, solo cambia de sitio: traspasos entre
   * vuestras propias cuentas, o dinero que os devuelven.
   */
  excluidaDeTotales: boolean
}

export type ExpenseSource = 'manual' | 'csv' | 'fijo'

/**
 * Los gastos apuntados sin cobertura llevan un identificador provisional
 * hasta que suben. Editarlos o borrarlos no tendría a quién dirigirse.
 */
export const esPendienteDeSubir = (id: string) => id.startsWith('pendiente-')

export interface Expense {
  /** Provisional mientras el gasto está en la cola: ver `esPendienteDeSubir`. */
  id: ID
  importe: number // céntimos, siempre positivo
  categoriaId: ID | null
  fecha: string // 'YYYY-MM-DD'
  nota: string | null
  ticketPath: string | null
  origen: ExpenseSource
  creadoPor: ID | null
  creadoEn: string // ISO
}

export interface Budget {
  categoriaId: ID
  importe: number // céntimos al mes, 0 = sin presupuesto
}

export interface Recurring {
  id: ID
  nombre: string
  importe: number // céntimos
  categoriaId: ID | null
  /**
   * 1-31. Si el mes es más corto (un recibo del 31 en febrero) se cobra el
   * último día: no se salta el mes.
   */
  diaDelMes: number
  activo: boolean
  ultimoMesGenerado: string | null // 'YYYY-MM'
}

/** Regla aprendida del importador de CSV: si el concepto contiene X → categoría Y. */
export interface ImportRule {
  id: ID
  patron: string // en minúsculas, sin acentos
  categoriaId: ID
  aciertos: number
}

export interface Snapshot {
  miembros: Member[]
  categorias: Category[]
  gastos: Expense[]
  presupuestos: Budget[]
  fijos: Recurring[]
  reglas: ImportRule[]
}

export interface SessionUser {
  id: ID
  email: string | null
  nombre: string
}

export const SNAPSHOT_VACIO: Snapshot = {
  miembros: [],
  categorias: [],
  gastos: [],
  presupuestos: [],
  fijos: [],
  reglas: [],
}
