import type { Category } from '../data/types'

interface Props {
  categorias: Category[]
  seleccionada: string | null
  onSeleccionar: (id: string) => void
}

/** Rejilla de categorías: se elige de un solo toque, sin desplegables. */
export function SelectorCategoria({ categorias, seleccionada, onSeleccionar }: Props) {
  return (
    <div className="rejilla-cat">
      {categorias.filter((c) => !c.archivada).map((c) => {
        const activa = c.id === seleccionada
        return (
          <button
            key={c.id}
            className="cat"
            data-activa={activa}
            onClick={() => onSeleccionar(c.id)}
            aria-pressed={activa}
            aria-label={c.nombre}
          >
            <span
              aria-hidden
              className="icono"
              style={{
                background: activa ? c.color : `color-mix(in srgb, ${c.color} 22%, var(--tarjeta))`,
              }}
            >
              {c.icono}
            </span>
            <span className="cat__nombre">{c.nombre}</span>
          </button>
        )
      })}
    </div>
  )
}
