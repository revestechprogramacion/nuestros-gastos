const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** 'YYYY-MM-DD' de hoy, en hora local (no UTC: evita el clásico fallo de un día). */
export function hoyISO(): string {
  return aISO(new Date())
}

export function aISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** '2026-08-04' → '2026-08' */
export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7)
}

export function mesActual(): string {
  return mesDe(hoyISO())
}

/** Suma (o resta) meses a una clave 'YYYY-MM'. */
export function desplazarMes(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** '2026-08' → 'agosto 2026' */
export function nombreMes(mes: string, conAno = true): string {
  const [y, m] = mes.split('-').map(Number)
  const nombre = MESES[m - 1] ?? ''
  return conAno ? `${nombre} ${y}` : nombre
}

/** '2026-08' → 'Agosto 2026' */
export function nombreMesCapital(mes: string, conAno = true): string {
  const s = nombreMes(mes, conAno)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** 'Hoy', 'Ayer' o 'lun, 4 ago' */
export function etiquetaFecha(fechaISO: string): string {
  const hoy = hoyISO()
  if (fechaISO === hoy) return 'Hoy'
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  if (fechaISO === aISO(ayer)) return 'Ayer'

  const [y, m, d] = fechaISO.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  const texto = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(y !== new Date().getFullYear() && { year: 'numeric' }),
  }).format(fecha)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Días transcurridos del mes indicado (para proyectar el gasto del mes en curso). */
export function diasTranscurridos(mes: string): number {
  if (mes !== mesActual()) return diasDelMes(mes)
  return new Date().getDate()
}

export function diasDelMes(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Días de diferencia entre dos fechas 'YYYY-MM-DD' (siempre positivo). */
export function diasEntre(a: string, b: string): number {
  const aDate = new Date(`${a}T00:00:00`)
  const bDate = new Date(`${b}T00:00:00`)
  return Math.abs(Math.round((aDate.getTime() - bDate.getTime()) / 86_400_000))
}

/**
 * Interpreta las fechas que sueltan los bancos españoles:
 * '04/08/2026', '04-08-26', '2026-08-04', '4 ago 2026'.
 * Devuelve 'YYYY-MM-DD' o null.
 */
export function parsearFechaBanco(bruto: string): string | null {
  const t = bruto.trim()
  if (!t) return null

  // Ya viene en ISO
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`

  // dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy
  const dmy = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (dmy) {
    const dia = dmy[1].padStart(2, '0')
    const mes = dmy[2].padStart(2, '0')
    let ano = dmy[3]
    if (ano.length === 2) ano = `20${ano}`
    if (Number(mes) >= 1 && Number(mes) <= 12 && Number(dia) >= 1 && Number(dia) <= 31) {
      return `${ano}-${mes}-${dia}`
    }
  }

  // '4 ago 2026' / '4 de agosto de 2026'
  const textual = t.toLowerCase().match(/^(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,})\s*(?:de\s+)?(\d{4})/)
  if (textual) {
    const i = MESES.findIndex((m) => m.startsWith(textual[2].slice(0, 3)))
    if (i >= 0) {
      return `${textual[3]}-${String(i + 1).padStart(2, '0')}-${textual[1].padStart(2, '0')}`
    }
  }

  return null
}
