import { eurosRedondos } from '../lib/format'
import { nombreMes } from '../lib/fechas'

interface Props {
  serie: { mes: string; total: number }[]
  mesSeleccionado: string
  onSeleccionar: (mes: string) => void
}

/**
 * Total gastado en los últimos meses. Una sola serie, así que no lleva leyenda:
 * el título de la tarjeta ya dice qué se está midiendo. Se toca una barra para
 * cambiar el mes que estás mirando.
 */
export function BarrasMeses({ serie, mesSeleccionado, onSeleccionar }: Props) {
  const maximo = Math.max(...serie.map((s) => s.total), 1)

  return (
    <div className="barras" role="group" aria-label="Gasto por mes">
      {serie.map((s) => {
        const activo = s.mes === mesSeleccionado
        const alto = Math.max((s.total / maximo) * 100, s.total > 0 ? 4 : 1.5)
        return (
          <button
            key={s.mes}
            className="barras__col"
            data-activo={activo}
            onClick={() => onSeleccionar(s.mes)}
            aria-label={`${nombreMes(s.mes)}: ${eurosRedondos(s.total)}`}
            aria-pressed={activo}
          >
            <span className="barras__valor cifra">{s.total > 0 ? eurosRedondos(s.total) : '—'}</span>
            <span className="barras__pista">
              <span className="barras__barra" style={{ height: `${alto}%` }} />
            </span>
            <span className="barras__etiqueta">{nombreMes(s.mes, false).slice(0, 3)}</span>
          </button>
        )
      })}
    </div>
  )
}
