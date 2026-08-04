import { euros } from '../lib/format'
import { etiquetaFecha } from '../lib/fechas'
import { tituloDelGasto } from '../lib/concepto'
import { useTienda } from '../estado/Tienda'
import type { Expense } from '../data/types'

interface Props {
  gasto: Expense
  onPulsar: (g: Expense) => void
  /** En listas agrupadas por día la fecha ya va en el encabezado. */
  mostrarFecha?: boolean
}

export function FilaGasto({ gasto, onPulsar, mostrarFecha = true }: Props) {
  const t = useTienda()
  const cat = t.categoriaPorId(gasto.categoriaId)

  // Solo decimos quién lo apuntó cuando fue el otro: ver tu propio nombre en
  // cada línea es ruido.
  const otroMiembro = gasto.creadoPor && gasto.creadoPor !== t.usuario?.id
    ? t.nombreMiembro(gasto.creadoPor)
    : ''

  // Los conceptos del banco se enseñan limpios; el original sigue guardado y
  // se ve entero al abrir el gasto.
  const titulo = tituloDelGasto(gasto.nota, gasto.origen, cat?.nombre ?? null)

  const detalles = [
    mostrarFecha ? etiquetaFecha(gasto.fecha) : null,
    cat?.nombre ?? 'Sin categoría',
    gasto.origen === 'fijo' ? 'fijo' : null,
    otroMiembro || null,
  ].filter(Boolean)

  return (
    <button
      className="fila"
      onClick={() => onPulsar(gasto)}
      aria-label={`${titulo}, ${euros(gasto.importe)}, ${etiquetaFecha(gasto.fecha)}`}
    >
      <span
        className="icono"
        style={cat
          ? { background: `color-mix(in srgb, ${cat.color} 22%, var(--tarjeta))` }
          : { background: 'var(--tarjeta-alt)' }}
        aria-hidden
      >
        {cat?.icono ?? '·'}
      </span>
      <span className="fila__principal">
        <span className="fila__titulo">{titulo}</span>
        <span className="fila__sub">
          {detalles.join(' · ')}
          {gasto.ticketPath ? `${detalles.length ? ' · ' : ''}📎` : ''}
        </span>
      </span>
      <span className="fila__importe cifra">{euros(gasto.importe)}</span>
    </button>
  )
}
