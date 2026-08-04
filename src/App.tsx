import { useEffect, useState, type ComponentType } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ProveedorTienda, useTienda } from './estado/Tienda'
import { Entrar } from './pantallas/Entrar'
import { Inicio } from './pantallas/Inicio'
import { Gastos } from './pantallas/Gastos'
import { Planes } from './pantallas/Planes'
import { Ajustes } from './pantallas/Ajustes'
import { Categorias } from './pantallas/Categorias'
import { Importar } from './pantallas/Importar'
import { AltaGasto } from './componentes/AltaGasto'
import { IconoAjustes, IconoInicio, IconoLista, IconoPlan } from './componentes/Iconos'

export default function App() {
  return (
    <ProveedorTienda>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Marco />
      </BrowserRouter>
    </ProveedorTienda>
  )
}

/** Avisa cuando el móvil se queda sin señal. */
function useSinConexion(): boolean {
  const [sinConexion, setSinConexion] = useState(
    typeof navigator !== 'undefined' && !navigator.onLine,
  )
  useEffect(() => {
    const actualizar = () => setSinConexion(!navigator.onLine)
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])
  return sinConexion
}

function Marco() {
  const t = useTienda()
  const [anadiendo, setAnadiendo] = useState(false)
  const sinConexion = useSinConexion()

  if (t.cargando) {
    return (
      <div className="entrar">
        <div className="entrar__marca">
          <span className="entrar__logo" aria-hidden />
          <p className="suave">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!t.usuario) return <Entrar />

  return (
    <div className="app">
      {sinConexion && (
        <div className="sin-conexion">
          Sin conexión · lo que apuntes se guardará y se subirá solo
        </div>
      )}

      <main className="contenido">
        {t.error && <div className="aviso" style={{ marginTop: 12 }}>{t.error}</div>}
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/plan" element={<Planes />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/importar" element={<Importar />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Barra onAnadir={() => setAnadiendo(true)} />
      <AltaGasto abierta={anadiendo} onCerrar={() => setAnadiendo(false)} />
    </div>
  )
}

function Barra({ onAnadir }: { onAnadir: () => void }) {
  const { pathname } = useLocation()

  const item = (
    ruta: string,
    etiqueta: string,
    Icono: ComponentType,
    rutasHijas: string[] = [],
  ) => (
    <Link
      to={ruta}
      className="barra__item"
      data-activo={pathname === ruta || rutasHijas.includes(pathname)}
    >
      <Icono />
      <span>{etiqueta}</span>
    </Link>
  )

  return (
    <nav className="barra" aria-label="Navegación principal">
      {item('/', 'Resumen', IconoInicio)}
      {item('/gastos', 'Gastos', IconoLista)}
      <button className="barra__mas" onClick={onAnadir} aria-label="Añadir gasto">
        <span aria-hidden>+</span>
      </button>
      {item('/plan', 'Plan', IconoPlan)}
      {item('/ajustes', 'Ajustes', IconoAjustes, ['/categorias', '/importar'])}
    </nav>
  )
}
