import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTienda } from '../estado/Tienda'
import { euros } from '../lib/format'
import { IconoChevron } from '../componentes/Iconos'

export function Ajustes() {
  const t = useTienda()
  const totalHistorico = t.datos.gastos.reduce((s, g) => s + g.importe, 0)
  const sinCategoria = t.datos.gastos.filter((g) => g.categoriaId === null)
  const [repasando, setRepasando] = useState(false)
  const [resultadoRepaso, setResultadoRepaso] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const dePrueba = t.modo === 'nube' ? t.gastosDePrueba() : 0

  async function subirPrueba() {
    if (!confirm(
      `Se subirán a la nube los ${dePrueba} gastos que hiciste en la versión de prueba `
      + 'de este navegador.\n\nLos que ya estén subidos no se duplican. ¿Seguimos?',
    )) return

    setSubiendo(true)
    setResultadoRepaso(null)
    try {
      const r = await t.subirDatosDePrueba()
      const partes = [
        `${r.gastos} gastos subidos`,
        r.categorias > 0 && `${r.categorias} categorías`,
        r.fijos > 0 && `${r.fijos} gastos fijos`,
        r.reglas > 0 && `${r.reglas} reglas`,
        r.omitidos > 0 && `${r.omitidos} ya estaban`,
      ].filter(Boolean)
      setResultadoRepaso(partes.join(' · '))
    } catch (e) {
      setResultadoRepaso(e instanceof Error ? e.message : 'No he podido subirlos')
    } finally {
      setSubiendo(false)
    }
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
        {dePrueba > 0 && (
          <button className="fila" onClick={subirPrueba} disabled={subiendo}>
            <span className="icono" style={{ background: 'var(--tarjeta-alt)' }} aria-hidden>☁️</span>
            <span className="fila__principal">
              <span className="fila__titulo">
                {subiendo ? 'Subiendo…' : 'Subir los datos de la prueba'}
              </span>
              <span className="fila__sub">
                {dePrueba} gastos guardados en este navegador, aún sin subir
              </span>
            </span>
            <IconoChevron />
          </button>
        )}
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
      </div>

      {resultadoRepaso && <div className="nota-info" style={{ marginTop: 12 }}>{resultadoRepaso}</div>}

      {t.modo === 'local' && (
        <div className="nota-info" style={{ marginTop: 12 }}>
          <strong>Modo de prueba.</strong> Ahora mismo los datos solo viven en este
          navegador y no se comparten. Cuando conectemos Supabase, la app pasará sola
          a modo compartido entre los dos móviles.
        </div>
      )}

      <button className="boton boton--peligro" style={{ marginTop: 20 }}
        onClick={() => { void t.salir() }}>
        Cerrar sesión
      </button>

      <p className="peque tenue centrado" style={{ marginTop: 24 }}>
        Nuestros Gastos · {t.modo === 'nube' ? 'sincronizado' : 'modo local'}
      </p>
    </>
  )
}
