import { useRef, useState } from 'react'
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
  /** Si se pasa, la fila se puede deslizar a la izquierda para borrar. */
  onBorrar?: (g: Expense) => void
}

/** A partir de aquí se considera que has querido deslizar, no rozar. */
const UMBRAL_BORRAR = 72

export function FilaGasto({ gasto, onPulsar, mostrarFecha = true, onBorrar }: Props) {
  const t = useTienda()
  const cat = t.categoriaPorId(gasto.categoriaId)

  /*
    Deslizar a la izquierda para borrar.

    Solo se sigue el dedo cuando el movimiento es claramente horizontal: si
    no, deslizar la lista hacia abajo borraría gastos sin querer. Y al
    soltar se pregunta siempre, que borrar es lo único que no tiene vuelta.
  */
  const [desplazado, setDesplazado] = useState(0)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const horizontal = useRef(false)

  const alEmpezar = (e: React.TouchEvent) => {
    if (!onBorrar) return
    inicio.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    horizontal.current = false
  }

  const alMover = (e: React.TouchEvent) => {
    if (!onBorrar || !inicio.current) return
    const dx = e.touches[0].clientX - inicio.current.x
    const dy = e.touches[0].clientY - inicio.current.y
    if (!horizontal.current) {
      if (Math.abs(dy) > Math.abs(dx)) { inicio.current = null; return }
      if (Math.abs(dx) < 10) return
      horizontal.current = true
    }
    setDesplazado(Math.max(Math.min(dx, 0), -110))
  }

  const alSoltar = () => {
    if (!onBorrar) return
    const pasado = desplazado <= -UMBRAL_BORRAR
    setDesplazado(0)
    inicio.current = null
    if (!pasado) return
    if (confirm(`¿Borrar «${titulo}» de ${euros(gasto.importe)}?`)) onBorrar(gasto)
  }

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

  const fila = (
    <button
      className="fila"
      onClick={() => onPulsar(gasto)}
      onTouchStart={alEmpezar}
      onTouchMove={alMover}
      onTouchEnd={alSoltar}
      onTouchCancel={alSoltar}
      style={onBorrar ? {
        transform: `translateX(${desplazado}px)`,
        transition: desplazado === 0 ? 'transform .2s' : 'none',
      } : undefined}
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

  if (!onBorrar) return fila

  return (
    <div className="fila-deslizable">
      <span className="fila-deslizable__fondo" aria-hidden>Borrar</span>
      {fila}
    </div>
  )
}
