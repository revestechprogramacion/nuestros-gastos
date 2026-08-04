import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface AvisoBreve {
  texto: string
  /** Si viene, sale un botón para echar atrás lo que se acaba de hacer. */
  deshacer?: () => void | Promise<void>
}

interface Props {
  aviso: AvisoBreve | null
  onCerrar: () => void
  /** Cuánto se queda en pantalla. Con deshacer conviene dar margen. */
  segundos?: number
}

/**
 * Confirmación breve al pie de la pantalla.
 *
 * Guardar algo y que la pantalla se cierre sin más deja la duda de si se ha
 * guardado. Y equivocarse al apuntar es lo más normal del mundo: pedir que
 * busques el gasto en la lista, lo abras y lo borres para arreglar un error
 * de hace dos segundos es demasiado camino.
 */
export function Aviso({ aviso, onCerrar, segundos = 6 }: Props) {
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!aviso) return
    setOcupado(false)
    const t = setTimeout(onCerrar, segundos * 1000)
    return () => clearTimeout(t)
  }, [aviso, onCerrar, segundos])

  if (!aviso) return null

  async function alDeshacer() {
    if (!aviso?.deshacer || ocupado) return
    setOcupado(true)
    try {
      await aviso.deshacer()
    } finally {
      onCerrar()
    }
  }

  return (
    <div className="aviso-breve" role="status" aria-live="polite">
      <span className="crecer">{aviso.texto}</span>
      {aviso.deshacer && (
        <button className="aviso-breve__accion" onClick={alDeshacer} disabled={ocupado}>
          {ocupado ? 'Deshaciendo…' : 'Deshacer'}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

const Contexto = createContext<(aviso: AvisoBreve) => void>(() => {})

/** Cualquier pantalla puede confirmar algo al pie sin pasarlo de mano en mano. */
export const useAvisar = () => useContext(Contexto)

/** Pone el aviso al pie y da a las pantallas la forma de invocarlo. */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<AvisoBreve | null>(null)
  const mostrar = useCallback((a: AvisoBreve) => setAviso(a), [])
  const valor = useMemo(() => mostrar, [mostrar])

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Aviso aviso={aviso} onCerrar={() => setAviso(null)} />
    </Contexto.Provider>
  )
}
