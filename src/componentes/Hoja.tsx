import { useEffect, type ReactNode } from 'react'

interface Props {
  abierta: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
  accion?: ReactNode
}

/** Panel que sube desde abajo, como las hojas nativas de iOS. */
export function Hoja({ abierta, titulo, onCerrar, children, accion }: Props) {
  // Bloquea el scroll del fondo mientras la hoja está abierta.
  useEffect(() => {
    if (!abierta) return
    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const alPulsarEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alPulsarEsc)
    return () => {
      document.body.style.overflow = previo
      window.removeEventListener('keydown', alPulsarEsc)
    }
  }, [abierta, onCerrar])

  if (!abierta) return null

  return (
    <>
      <div className="velo" onClick={onCerrar} />
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja__cabecera">
          <button className="boton--texto" onClick={onCerrar}>Cancelar</button>
          <h3>{titulo}</h3>
          <div style={{ minWidth: 70, textAlign: 'right' }}>{accion}</div>
        </div>
        <div className="hoja__cuerpo">{children}</div>
      </div>
    </>
  )
}
