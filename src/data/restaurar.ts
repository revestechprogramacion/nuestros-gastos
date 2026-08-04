import type { Category, Expense, ImportRule, Recurring } from './types'

/**
 * Restauración del histórico.
 *
 * Los movimientos que Miguel importó del banco se quedaron guardados en el
 * navegador donde hizo la prueba, y llevarlos a la nube a mano exigía volver a
 * entrar allí. Más simple: viajan con la app, en `restaurar.txt`, y la propia
 * app los sube la primera vez que encuentra la casa vacía.
 *
 * El archivo está fuera de git —son datos personales— y con `import.meta.glob`
 * su ausencia no rompe nada: si no está, aquí no hay nada que restaurar.
 */

const archivos = import.meta.glob('./restaurar.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const CRUDO = (Object.values(archivos)[0] as string | undefined) ?? ''

type GastoNuevo = Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>

export interface Historico {
  /** Gastos con la categoría por NOMBRE, que es lo único estable entre bases. */
  gastos: (Omit<GastoNuevo, 'categoriaId'> & { categoria: string })[]
  fijos: (Omit<Recurring, 'id' | 'categoriaId' | 'activo'> & { categoria: string })[]
  reglas: { patron: string; categoria: string }[]
}

function parsear(texto: string): Historico {
  const vacio: Historico = { gastos: [], fijos: [], reglas: [] }
  if (!texto.trim()) return vacio

  let seccion = ''
  for (const linea of texto.split('\n')) {
    const l = linea.trim()
    if (!l) continue
    if (l === 'GASTOS' || l === 'FIJOS' || l === 'REGLAS') { seccion = l; continue }

    const campos = l.split('|')
    if (seccion === 'GASTOS' && campos.length >= 5) {
      const [fecha, importe, origen, categoria, ...resto] = campos
      vacio.gastos.push({
        fecha,
        importe: Number(importe),
        origen: origen as Expense['origen'],
        categoria,
        nota: resto.join('|') || null,
        ticketPath: null,
      })
    } else if (seccion === 'FIJOS' && campos.length >= 5) {
      const [nombre, importe, dia, ultimoMes, categoria] = campos
      vacio.fijos.push({
        nombre,
        importe: Number(importe),
        diaDelMes: Number(dia),
        ultimoMesGenerado: ultimoMes || null,
        categoria,
      })
    } else if (seccion === 'REGLAS' && campos.length >= 2) {
      vacio.reglas.push({ patron: campos[0], categoria: campos[1] })
    }
  }
  return vacio
}

export const HISTORICO = parsear(CRUDO)

export function hayHistoricoQueRestaurar(): boolean {
  return HISTORICO.gastos.length > 0
}

/** Traduce nombres de categoría a los identificadores de esta base de datos. */
export function mapaDeCategorias(categorias: Category[]): Map<string, string> {
  return new Map(categorias.map((c) => [c.nombre, c.id]))
}

export type ReglaNueva = Omit<ImportRule, 'id'>
