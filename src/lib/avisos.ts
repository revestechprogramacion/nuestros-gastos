/**
 * Avisos del sistema.
 *
 * QUÉ SE PUEDE Y QUÉ NO, sin engaños:
 *
 *   SÍ · Avisar cuando el otro apunta un gasto y tú tienes la app abierta
 *        o recién usada. Es lo que cubre el 90 % de los casos reales:
 *        estáis en el súper, uno paga, al otro le salta.
 *   SÍ · Avisar al pasarse de un presupuesto.
 *   SÍ · Recordar al abrir la app que lleváis días sin apuntar nada.
 *
 *   NO · Avisar con la app cerrada del todo y el móvil en el bolsillo.
 *        Eso son notificaciones "push" de verdad, y necesitan un servidor
 *        que las envíe (claves VAPID + una función desplegada). Se puede
 *        añadir, pero es un paso aparte y hay que desplegarlo.
 *
 * En iPhone, además, los avisos solo funcionan si la app está instalada en
 * la pantalla de inicio (iOS 16.4 o superior). En Safari a pelo, no.
 */

const CLAVE_PREFERENCIA = 'nuestros-gastos:avisos'

/*
  En navegación privada de Safari, escribir en el almacén del navegador
  lanza una excepción. Un ajuste de avisos no puede tumbar la app por eso.
*/
function recordar(valor: string): void {
  try { localStorage.setItem(CLAVE_PREFERENCIA, valor) } catch { /* da igual */ }
}
function recordado(): string | null {
  try { return localStorage.getItem(CLAVE_PREFERENCIA) } catch { return null }
}

export type EstadoAvisos = 'no-soportado' | 'desactivados' | 'activados' | 'bloqueados'

function haySoporte(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** ¿Está instalada en la pantalla de inicio? En iPhone hace falta para avisar. */
export function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
}

export function estadoAvisos(): EstadoAvisos {
  if (!haySoporte()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueados'
  if (Notification.permission === 'granted') {
    return recordado() === 'no' ? 'desactivados' : 'activados'
  }
  return 'desactivados'
}

/** Pide permiso al móvil. Devuelve cómo ha quedado la cosa. */
export async function pedirPermiso(): Promise<EstadoAvisos> {
  if (!haySoporte()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueados'

  if (Notification.permission !== 'granted') {
    const respuesta = await Notification.requestPermission()
    if (respuesta !== 'granted') return respuesta === 'denied' ? 'bloqueados' : 'desactivados'
  }
  recordar('si')
  return 'activados'
}

export function desactivarAvisos(): void {
  recordar('no')
}

/**
 * Enseña un aviso. Se apoya en el service worker cuando está disponible,
 * que es lo que iOS exige para las apps instaladas.
 */
export async function avisar(titulo: string, cuerpo: string, etiqueta: string): Promise<void> {
  if (estadoAvisos() !== 'activados') return

  const opciones: NotificationOptions = {
    body: cuerpo,
    icon: `${import.meta.env.BASE_URL}iconos/icono-192.png`,
    badge: `${import.meta.env.BASE_URL}iconos/icono-192.png`,
    // Con la misma etiqueta, un aviso sustituye al anterior en vez de
    // amontonarse: nadie quiere quince notificaciones del súper.
    tag: etiqueta,
    silent: false,
  }

  try {
    const registro = await navigator.serviceWorker?.getRegistration()
    if (registro) {
      await registro.showNotification(titulo, opciones)
      return
    }
  } catch {
    // Si el service worker no está listo, probamos por la vía directa.
  }

  try {
    new Notification(titulo, opciones)
  } catch {
    // Algunos navegadores solo permiten la vía del service worker. Sin drama:
    // el aviso es un extra, no puede tumbar nada.
  }
}

/** Cuántos días hace del último gasto apuntado. */
export function diasSinApuntar(fechas: string[], hoy: string): number | null {
  if (fechas.length === 0) return null
  const ultima = fechas.reduce((a, b) => (a > b ? a : b))
  const ms = new Date(`${hoy}T00:00:00`).getTime() - new Date(`${ultima}T00:00:00`).getTime()
  return Math.max(0, Math.round(ms / 86_400_000))
}
