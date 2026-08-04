import type { SessionUser, Snapshot } from './types'

/**
 * Lo que la app se guarda en el móvil para poder abrir al instante.
 *
 * El problema que resuelve: al abrir había que esperar a que se descargara el
 * cliente de Supabase, se renovara el token, se comprobara el hogar y se
 * pidieran seis tablas. Seis etapas encadenadas y la pantalla en blanco
 * mientras tanto.
 *
 * Ahora lo último que se vio se guarda aquí. Al abrir se pinta eso —lectura
 * de disco, instantánea— y la red se consulta por detrás. Si algo cambió,
 * se actualiza sin que se note; si no hay cobertura, sigues viendo tus datos.
 */

const CLAVES = {
  snapshot: 'nuestros-gastos:copia',
  sesion: 'nuestros-gastos:sesion',
  miembro: 'nuestros-gastos:miembro-de',
  fijos: 'nuestros-gastos:fijos-revisados',
} as const

function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : null
  } catch {
    // Datos corruptos (se llenó el disco a medias, otra versión...): se
    // ignoran y se vuelve a pedir a la red. Nunca deben tumbar el arranque.
    return null
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Sin sitio o en modo privado: la app funciona igual, solo más lenta.
  }
}

/* ------------------------------ Sesión ------------------------------ */

export const sesionGuardada = () => leer<SessionUser>(CLAVES.sesion)
export const guardarSesion = (u: SessionUser | null) =>
  u ? escribir(CLAVES.sesion, u) : localStorage.removeItem(CLAVES.sesion)

/* ------------------------------ Datos ------------------------------- */

export const snapshotGuardado = () => leer<Snapshot>(CLAVES.snapshot)
export const guardarSnapshot = (s: Snapshot) => escribir(CLAVES.snapshot, s)

/* --------------------- Comprobaciones de una vez -------------------- */

/**
 * Entrar en el hogar solo hace falta la primera vez. Repetir la llamada en
 * cada arranque es un viaje a la red para oír "ya estabas".
 */
export const yaEsMiembro = (idUsuario: string) => leer<string>(CLAVES.miembro) === idUsuario
export const marcarMiembro = (idUsuario: string) => escribir(CLAVES.miembro, idUsuario)

/**
 * Los gastos fijos se revisan una vez al día. Hacerlo en cada apertura
 * significaba recorrerlos y escribir en la base de datos sin necesidad.
 */
export function tocaRevisarFijos(hoy: string): boolean {
  return leer<string>(CLAVES.fijos) !== hoy
}
export const marcarFijosRevisados = (hoy: string) => escribir(CLAVES.fijos, hoy)

/** Al cerrar sesión se borra todo lo que identifica a la persona. */
export function olvidarTodo(): void {
  for (const c of Object.values(CLAVES)) {
    try { localStorage.removeItem(c) } catch { /* nada que hacer */ }
  }
}
