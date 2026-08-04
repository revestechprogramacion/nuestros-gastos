import type {
  Budget, Category, Expense, ImportRule, Recurring, SessionUser, Snapshot,
} from './types'

/**
 * Capa de datos. La app nunca habla con Supabase directamente: habla con esta
 * interfaz. Así podemos usar el modo local (sin cuentas, para probar en el Mac)
 * y el modo nube exactamente con el mismo código de pantallas.
 */
export interface Repo {
  readonly modo: 'local' | 'nube'

  // --- Sesión ---
  sesionActual(): Promise<SessionUser | null>
  entrar(email: string, password: string): Promise<void>
  /** Crea la cuenta. Devuelve false si hay que confirmar el email antes de entrar. */
  registrarse(email: string, password: string): Promise<boolean>
  salir(): Promise<void>

  // --- Carga ---
  cargarTodo(): Promise<Snapshot>
  /** Avisa cuando el otro miembro de la casa cambia algo. Devuelve la función para dejar de escuchar. */
  escucharCambios(cb: () => void): () => void

  // --- Gastos ---
  crearGasto(g: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>): Promise<Expense>
  crearGastos(gs: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>[]): Promise<Expense[]>
  actualizarGasto(g: Expense): Promise<Expense>
  /** Actualiza muchos de golpe (repaso de categorías, importaciones). */
  actualizarGastos(gs: Expense[]): Promise<void>
  borrarGasto(id: string): Promise<void>

  // --- Categorías ---
  guardarCategoria(c: Omit<Category, 'id'> & { id?: string }): Promise<Category>
  borrarCategoria(id: string): Promise<void>

  // --- Presupuestos ---
  guardarPresupuesto(b: Budget): Promise<void>

  // --- Gastos fijos ---
  guardarFijo(r: Omit<Recurring, 'id'> & { id?: string }): Promise<Recurring>
  borrarFijo(id: string): Promise<void>

  // --- Reglas del importador ---
  guardarRegla(r: Omit<ImportRule, 'id'> & { id?: string }): Promise<void>

  // --- Tickets ---
  subirTicket(file: File): Promise<string>
  urlTicket(path: string): Promise<string | null>
  borrarTicket(path: string): Promise<void>
}

export const HAY_NUBE = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

let instancia: Repo | null = null

/** Devuelve el repositorio activo: nube si hay credenciales, local si no. */
export async function getRepo(): Promise<Repo> {
  if (instancia) return instancia
  if (HAY_NUBE) {
    const { SupabaseRepo } = await import('./supabaseRepo')
    instancia = new SupabaseRepo()
  } else {
    const { LocalRepo } = await import('./localRepo')
    instancia = new LocalRepo()
  }
  return instancia
}

export function nuevoId(): string {
  return crypto.randomUUID()
}
