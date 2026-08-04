import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  abierta: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  accion?: ReactNode
}

/** A partir de aquí se entiende que has querido cerrar, no rozar. */
const UMBRAL_CERRAR = 110

/**
 * Panel que sube desde abajo, como las hojas nativas de iOS.
 *
 * Salir de aquí tiene que ser tan fácil como entrar. Hay tres formas, y
 * las tres funcionan:
 *
 *   · El gesto de volver atrás. Al abrirse, la hoja deja una marca en el
 *     historial; el botón de atrás de Android y el deslizar desde el borde
 *     en iPhone la cierran en lugar de sacarte de la aplicación.
 *   · Arrastrarla hacia abajo, con el tirador de arriba.
 *   · El botón «Cancelar».
 *
 * Sin lo del historial, en una app instalada no hay botón de atrás y te
 * quedas encerrado en el formulario.
 */
export function Hoja({ abierta, titulo, onCerrar, children, accion }: Props) {
  // La función de cerrar cambia en cada render; guardarla en una caja evita
  // que el efecto se rearme y llene el historial de marcas.
  const cerrar = useRef(onCerrar)
  cerrar.current = onCerrar

  const [arrastre, setArrastre] = useState(0)
  const inicioY = useRef<number | null>(null)

  // Bloquea el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    if (!abierta) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alPulsarEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current() }
    window.addEventListener('keydown', alPulsarEsc)
    return () => {
      document.body.style.overflow = previo
      window.removeEventListener('keydown', alPulsarEsc)
    }
  }, [abierta])

  // Engancha la hoja al historial: "atrás" la cierra.
  useEffect(() => {
    if (!abierta) return
    setArrastre(0)

    let cerradaConAtras = false
    history.pushState({ hoja: true }, '')

    const alVolver = () => {
      cerradaConAtras = true
      cerrar.current()
    }
    window.addEventListener('popstate', alVolver)

    return () => {
      window.removeEventListener('popstate', alVolver)
      // Si se cerró con el botón o el gesto, hay que retirar la marca que
      // dejamos; si se cerró con "atrás", el navegador ya la ha quitado.
      if (!cerradaConAtras && history.state?.hoja) history.back()
    }
  }, [abierta])

  if (!abierta) return null

  const alEmpezar = (e: React.TouchEvent) => { inicioY.current = e.touches[0].clientY }

  const alMover = (e: React.TouchEvent) => {
    if (inicioY.current === null) return
    setArrastre(Math.max(0, e.touches[0].clientY - inicioY.current))
  }

  const alSoltar = () => {
    inicioY.current = null
    if (arrastre > UMBRAL_CERRAR) cerrar.current()
    else setArrastre(0)
  }

  return (
    <>
      <div
        className="velo"
        onClick={() => cerrar.current()}
        style={{ opacity: Math.max(0, 1 - arrastre / 320) }}
      />
      <div
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{
          transform: `translateY(${arrastre}px)`,
          transition: arrastre === 0 ? 'transform .25s cubic-bezier(.32,.72,0,1)' : 'none',
        }}
      >
        {/* Zona de arrastre: el tirador dice sin palabras que se puede bajar. */}
        <div onTouchStart={alEmpezar} onTouchMove={alMover} onTouchEnd={alSoltar}
          onTouchCancel={alSoltar}>
          <div className="hoja__tirador" aria-hidden />
          <div className="hoja__cabecera">
            <button className="boton--texto" onClick={() => cerrar.current()}>Cancelar</button>
            <h3>{titulo}</h3>
            <div style={{ minWidth: 70, textAlign: 'right' }}>{accion}</div>
          </div>
        </div>
        <div className="hoja__cuerpo">{children}</div>
      </div>
    </>
  )
}
