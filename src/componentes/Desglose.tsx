import { euros, porcentaje } from '../lib/format'
import type { ResumenCategoria } from '../estado/calculos'

interface Props {
  filas: ResumenCategoria[]
  onPulsar?: (categoriaId: string | null) => void
}

/**
 * Reparto del gasto por categoría: barras horizontales ordenadas de mayor a
 * menor.
 *
 * Todas las barras van del mismo rojo a propósito. Aquí lo que se mide es
 * cuánto, y eso ya lo dice el largo de la barra; quién es cada una lo dicen su
 * emoji y su nombre, escritos al lado. Pintar cada categoría de un color
 * distinto solo añadiría ruido.
 */
export function Desglose({ filas, onPulsar }: Props) {
  if (filas.length === 0) return null
  const maximo = filas[0].total || 1

  return (
    <div className="tarjeta">
      {filas.map((f, i) => {
        const nombre = f.categoria?.nombre ?? 'Sin categoría'
        // Sin onPulsar la fila es solo lectura: un <div>, no un botón apagado.
        const Elemento = onPulsar ? 'button' : 'div'
        return (
          <Elemento
            key={f.categoria?.id ?? 'sin'}
            className="desglose__fila"
            {...(onPulsar && {
              onClick: () => onPulsar(f.categoria?.id ?? null),
              'aria-label': `${nombre}: ${euros(f.total)}`,
            })}
            style={{ marginTop: i === 0 ? 0 : 14 }}
          >
            <div className="entre" style={{ marginBottom: 6 }}>
              <span className="fila-flex" style={{ gap: 8, minWidth: 0 }}>
                <span aria-hidden>{f.categoria?.icono ?? '·'}</span>
                <span className="fila__titulo">{nombre}</span>
              </span>
              <span className="fila-flex" style={{ gap: 8 }}>
                <span className="cifra" style={{ fontWeight: 600 }}>{euros(f.total)}</span>
                <span className="peque tenue cifra" style={{ minWidth: 34, textAlign: 'right' }}>
                  {porcentaje(f.fraccion)}
                </span>
              </span>
            </div>
            <div className="progreso">
              <div
                className="progreso__relleno"
                style={{
                  width: `${Math.max((f.total / maximo) * 100, 2)}%`,
                  background: 'linear-gradient(90deg, var(--rojo-claro), var(--rojo))',
                }}
              />
            </div>
          </Elemento>
        )
      })}
    </div>
  )
}
