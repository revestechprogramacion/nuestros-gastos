const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
})

const EUROS_REDONDO = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
})

/** 123456 → "1.234,56 €" */
export function euros(centimos: number): string {
  return EUROS.format(centimos / 100)
}

/** 123456 → "1.235 €" — para titulares grandes donde los céntimos estorban. */
export function eurosRedondos(centimos: number): string {
  return EUROS_REDONDO.format(Math.round(centimos / 100))
}

/**
 * Convierte lo que escribe el usuario a céntimos.
 * Acepta "12,50", "12.50", "1.234,56", "1,234.56" y "12".
 * Devuelve null si no hay un número válido.
 */
export function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/[^\d.,-]/g, '').trim()
  if (!limpio) return null

  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')
  let normalizado: string

  if (ultimaComa === -1 && ultimoPunto === -1) {
    normalizado = limpio
  } else if (ultimaComa > ultimoPunto) {
    // Formato español: el separador decimal es la coma.
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else {
    // Formato inglés: el separador decimal es el punto.
    normalizado = limpio.replace(/,/g, '')
  }

  const n = Number(normalizado)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

/**
 * Quita acentos y pasa a minúsculas, para comparar textos del banco.
 * La ñ se conserva: en español es una letra, no una vocal acentuada, y sin
 * ella "Peña" y "pena" serían la misma palabra.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/ñ/gi, (m) => (m[0] === 'N' ? 'Ñ' : 'ñ')) // recompone la ñ
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** "12,3" → "12,3 %" con un decimal como mucho. */
export function porcentaje(fraccion: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 })
    .format(fraccion)
}
