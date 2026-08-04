import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTienda } from '../estado/Tienda'
import { euros } from '../lib/format'
import { IconoChevron } from '../componentes/Iconos'
import {
  desactivarAvisos, estadoAvisos, estaInstalada, pedirPermiso, type EstadoAvisos,
} from '../lib/avisos'

export function Ajustes() {
  const t = useTienda()
  const totalHistorico = t.datos.gastos.reduce((s, g) => s + g.importe, 0)
  const sinCategoria = t.datos.gastos.filter((g) => g.categoriaId === null)
  const [repasando, setRepasando] = useState(false)
  const [resultadoRepaso, setResultadoRepaso] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<EstadoAvisos>(() => estadoAvisos())

  async function alternarAvisos() {
    if (avisos === 'activados') {
      desactivarAvisos()
      setAvisos('desactivados')
      return
    }
    setAvisos(await pedirPermiso())
  }

  const textoAvisos: Record<EstadoAvisos, string> = {
    'activados': 'Te avisamos cuando el otro apunte un gasto',
    'desactivados': estaInstalada()
      ? 'Apagados. Tócalo para que te avise cuando el otro apunte algo'
      : 'Para que funcionen en el iPhone, añade antes la app a la pantalla de inicio',
    'bloqueados': 'Los bloqueaste. Se reactivan en Ajustes del iPhone → Nuestros Gastos',
    'no-soportado': 'Este navegador no admite avisos',
  }

  async function repasar() {
    setRepasando(true)
    setResultadoRepaso(null)
    try {
      const { categoriasNuevas, recategorizados } = await t.repasarSinCategoria()
      setResultadoRepaso(
        recategorizados === 0
          ? 'No he sabido colocar ninguno más. Los que quedan hay que asignarlos a mano.'
          : `${recategorizados} gastos colocados` +
            (categoriasNuevas > 0 ? ` · ${categoriasNuevas} categorías nuevas` : ''),
      )
    } catch (e) {
      setResultadoRepaso(e instanceof Error ? e.message : 'No he podido repasarlos')
    } finally {
      setRepasando(false)
    }
  }

  /** Descarga todo, tal cual, para poder volver atrás si algo saliera mal. */
  function copiaDeSeguridad() {
    const copia = {
      version: 1,
      generada: new Date().toISOString(),
      casa: t.datos.miembros,
      categorias: t.datos.categorias,
      gastos: t.datos.gastos,
      presupuestos: t.datos.presupuestos,
      fijos: t.datos.fijos,
      reglas: t.datos.reglas,
    }
    descargar(
      new Blob([JSON.stringify(copia, null, 1)], { type: 'application/json' }),
      `copia-nuestros-gastos-${new Date().toISOString().slice(0, 10)}.json`,
    )
  }

  function descargar(blob: Blob, nombre: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportar() {
    const cabecera = 'Fecha;Categoria;Nota;Importe;Quien;Origen\n'
    const filas = [...t.datos.gastos]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((g) => [
        g.fecha,
        t.categoriaPorId(g.categoriaId)?.nombre ?? '',
        (g.nota ?? '').replace(/[;\n\r]/g, ' '),
        (g.importe / 100).toFixed(2).replace('.', ','),
        t.nombreMiembro(g.creadoPor),
        g.origen,
      ].join(';'))
      .join('\n')

    const blob = new Blob(['﻿' + cabecera + filas], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nuestros-gastos-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="cabecera"><h1>Ajustes</h1></div>

      <div className="tarjeta">
        <p className="peque suave">Total registrado</p>
        <p className="cifra" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em' }}>
          {euros(totalHistorico)}
        </p>
        <p className="peque tenue" style={{ marginTop: 4 }}>
          {t.datos.gastos.length} gastos · {t.datos.categorias.length} categorías
        </p>
      </div>

      <p className="epigrafe">La casa</p>
      <div className="lista">
        {t.datos.miembros.map((m) => (
          <div key={m.id} className="fila">
            <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>
              {m.nombre.charAt(0).toUpperCase()}
            </span>
            <span className="fila__principal">
              <span className="fila__titulo">
                {m.nombre}{m.id === t.usuario?.id && ' (tú)'}
              </span>
              <span className="fila__sub">{m.email ?? 'Sin email'}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="epigrafe">Gestión</p>
      <div className="lista">
        <Link to="/categorias" className="fila">
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>🏷️</span>
          <span className="fila__principal">
            <span className="fila__titulo">Categorías</span>
            <span className="fila__sub">Crear, renombrar y cambiar iconos</span>
          </span>
          <IconoChevron />
        </Link>
        <Link to="/importar" className="fila">
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>🏦</span>
          <span className="fila__principal">
            <span className="fila__titulo">Importar del banco</span>
            <span className="fila__sub">Subir el Excel o el CSV de movimientos</span>
          </span>
          <IconoChevron />
        </Link>
        <button className="fila" onClick={repasar} disabled={repasando}>
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>🪄</span>
          <span className="fila__principal">
            <span className="fila__titulo">
              {repasando ? 'Repasando…' : 'Repasar los sin categoría'}
            </span>
            <span className="fila__sub">
              {sinCategoria.length > 0
                ? `${sinCategoria.length} gastos sin colocar · ${euros(sinCategoria.reduce((s, g) => s + g.importe, 0))}`
                : 'Todos los gastos tienen categoría'}
            </span>
          </span>
          <IconoChevron />
        </button>
        <button className="fila" onClick={exportar}>
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>📤</span>
          <span className="fila__principal">
            <span className="fila__titulo">Exportar todo a CSV</span>
            <span className="fila__sub">Para abrirlo en Excel o Numbers</span>
          </span>
          <IconoChevron />
        </button>
        <button className="fila" onClick={copiaDeSeguridad}>
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>🗄️</span>
          <span className="fila__principal">
            <span className="fila__titulo">Copia de seguridad</span>
            <span className="fila__sub">Un archivo con absolutamente todo, por si acaso</span>
          </span>
          <IconoChevron />
        </button>
      </div>

      {resultadoRepaso && <div className="nota-info" style={{ marginTop: 12 }}>{resultadoRepaso}</div>}

      <p className="epigrafe">Avisos</p>
      <div className="lista">
        <button className="fila" onClick={alternarAvisos}
          disabled={avisos === 'no-soportado' || avisos === 'bloqueados'}
          aria-pressed={avisos === 'activados'}>
          <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>🔔</span>
          <span className="fila__principal">
            <span className="fila__titulo">Avisarme de los gastos del otro</span>
            <span className="fila__sub">{textoAvisos[avisos]}</span>
          </span>
          <span style={{ fontSize: 22 }} aria-hidden>{avisos === 'activados' ? '✅' : '⬜️'}</span>
        </button>
      </div>
      <p className="peque tenue" style={{ margin: '8px 4px 0' }}>
        Llegan con la app abierta o recién usada. Con el móvil guardado y la app
        cerrada del todo aún no: eso necesita un servidor de notificaciones,
        que se puede añadir cuando quieras.
      </p>

      {t.modo === 'local' && (
        <div className="nota-info" style={{ marginTop: 12 }}>
          <strong>Modo de prueba.</strong> Ahora mismo los datos solo viven en este
          navegador y no se comparten. Cuando conectemos Supabase, la app pasará sola
          a modo compartido entre los dos móviles.
        </div>
      )}

      <button className="boton boton--peligro" style={{ marginTop: 20 }}
        onClick={() => { t.salir().catch(() => { /* cerrar sesión no puede fallar hacia el usuario */ }) }}>
        Cerrar sesión
      </button>

      <p className="peque tenue centrado" style={{ marginTop: 24 }}>
        Nuestros Gastos · {t.modo === 'nube' ? 'sincronizado' : 'modo local'}
      </p>
    </>
  )
}
