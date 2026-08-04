import { euros } from '../lib/format'
import { etiquetaFecha } from '../lib/fechas'
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

  // Sin nota, el título ya es el nombre de la categoría: no lo repetimos debajo.
  const titulo = gasto.nota || cat?.nombre || 'Gasto'
  const detalles = [
    mostrarFecha ? etiquetaFecha(gasto.fecha) : null,
    gasto.nota ? (cat?.nombre ?? 'Sin categoría') : (cat ? null : 'Sin categoría'),
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
        style={{ background: `color-mix(in srgb, ${cat?.color ?? '#888'} 22%, var(--tarjeta))` }}
        aria-hidden
      >
        {cat?.icono ?? '❓'}
      </span>
      <span className="fila__principal">
        <span className="fila__titulo" style={{ display: 'block' }}>{titulo}</span>
        <span className="fila__sub">
          {detalles.join(' · ')}
          {gasto.ticketPath ? `${detalles.length ? ' · ' : ''}📎` : ''}
        </span>
      </span>
      <span className="fila__importe cifra">{euros(gasto.importe)}</span>
    </button>
  )
}
