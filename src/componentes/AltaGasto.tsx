import { useEffect, useMemo, useRef, useState } from 'react'
import { Hoja } from './Hoja'
import { SelectorCategoria } from './SelectorCategoria'
import { useTienda } from '../estado/Tienda'
import { categoriasPorUso } from '../estado/calculos'
import { aCentimos, euros } from '../lib/format'
import { aISO, hoyISO } from '../lib/fechas'
import { esPendienteDeSubir, type Expense } from '../data/types'
import { useAvisar } from './Aviso'

interface Props {
  abierta: boolean
  onCerrar: () => void
  /** Si viene un gasto, editamos; si no, creamos uno nuevo. */
  gasto?: Expense | null
}

function ayerISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return aISO(d)
}

export function AltaGasto({ abierta, onCerrar, gasto }: Props) {
  const t = useTienda()
  const avisar = useAvisar()
  const editando = Boolean(gasto)

  const [importe, setImporte] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState('')
  const [ticketPath, setTicketPath] = useState<string | null>(null)
  const [ticketUrl, setTicketUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputImporte = useRef<HTMLInputElement>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  // Al abrir: cargamos el gasto que se edita, o dejamos todo en blanco.
  useEffect(() => {
    if (!abierta) return
    setError(null)
    if (gasto) {
      setImporte((gasto.importe / 100).toFixed(2).replace('.', ','))
      setCategoriaId(gasto.categoriaId)
      setFecha(gasto.fecha)
      setNota(gasto.nota ?? '')
      setTicketPath(gasto.ticketPath)
    } else {
      setImporte('')
      setCategoriaId(null)
      setFecha(hoyISO())
      setNota('')
      setTicketPath(null)
      setTicketUrl(null)
      // Un pelín de retraso para que iOS abra el teclado de forma fiable.
      setTimeout(() => inputImporte.current?.focus(), 120)
    }
  }, [abierta, gasto])

  useEffect(() => {
    if (!ticketPath) { setTicketUrl(null); return }
    let vivo = true
    void t.urlTicket(ticketPath).then((u) => { if (vivo) setTicketUrl(u) })
    return () => { vivo = false }
  }, [ticketPath, t])

  const centimos = aCentimos(importe)
  // Un gasto que aún no ha subido no se puede modificar: en el servidor
  // todavía no existe, así que no habría a quién enviarle el cambio.
  const enCola = gasto !== null && gasto !== undefined && esPendienteDeSubir(gasto.id)
  const puedeGuardar = centimos !== null && centimos > 0 && !guardando && !subiendo && !enCola

  // Las que más usáis, primero: con veinte categorías eso ahorra un scroll.
  const categoriasOrdenadas = useMemo(() => {
    const hace90dias = new Date()
    hace90dias.setDate(hace90dias.getDate() - 90)
    return categoriasPorUso(t.datos.categorias, t.datos.gastos, aISO(hace90dias))
  }, [t.datos.categorias, t.datos.gastos])

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    setError(null)
    try {
      setTicketPath(await t.subirTicket(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido subir la foto')
    } finally {
      setSubiendo(false)
      if (inputFoto.current) inputFoto.current.value = ''
    }
  }

  async function guardar() {
    if (centimos === null || centimos <= 0) return
    setGuardando(true)
    setError(null)
    try {
      const campos = {
        importe: centimos,
        categoriaId,
        fecha,
        nota: nota.trim() || null,
        ticketPath,
        origen: gasto?.origen ?? ('manual' as const),
      }
      if (gasto) {
        const antes = gasto
        await t.actualizarGasto({ ...gasto, ...campos })
        avisar({
          texto: 'Cambios guardados',
          deshacer: () => t.actualizarGasto(antes),
        })
      } else {
        await t.crearGasto(campos)
        avisar({ texto: `Apuntado ${euros(campos.importe)}`, deshacer: deshacerUltimo })
      }
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido guardar el gasto')
    } finally {
      setGuardando(false)
    }
  }

  /** La compra del súper es la misma cada semana: un toque y ya está. */
  async function repetirHoy() {
    if (centimos === null || centimos <= 0) return
    setGuardando(true)
    setError(null)
    try {
      await t.crearGasto({
        importe: centimos,
        categoriaId,
        fecha: hoyISO(),
        nota: nota.trim() || null,
        ticketPath: null,
        origen: 'manual',
      })
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido repetirlo')
      setGuardando(false)
    }
  }

  /**
   * Borra lo último apuntado. Se busca por sus datos en lugar de guardar el
   * identificador porque, sin cobertura, el gasto todavía no tiene uno.
   */
  async function deshacerUltimo() {
    const reciente = t.datos.gastos.find(
      (g) => g.importe === centimos && g.fecha === fecha && !esPendienteDeSubir(g.id),
    )
    if (reciente) await t.borrarGasto(reciente.id)
  }

  async function borrar() {
    if (!gasto) return
    if (!confirm(`¿Borrar este gasto de ${euros(gasto.importe)}?`)) return
    setGuardando(true)
    try {
      const borrado = gasto
      await t.borrarGasto(gasto.id)
      avisar({
        texto: `Borrado ${euros(borrado.importe)}`,
        deshacer: () => t.crearGasto({
          importe: borrado.importe,
          categoriaId: borrado.categoriaId,
          fecha: borrado.fecha,
          nota: borrado.nota,
          ticketPath: borrado.ticketPath,
          origen: borrado.origen,
        }),
      })
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido borrar el gasto')
      setGuardando(false)
    }
  }

  return (
    <Hoja
      abierta={abierta}
      titulo={editando ? 'Editar gasto' : 'Nuevo gasto'}
      onCerrar={onCerrar}
      accion={
        <button className="boton--texto" onClick={guardar} disabled={!puedeGuardar}
          style={{ fontWeight: 600, opacity: puedeGuardar ? 1 : .4 }}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      }
    >
      {error && <div className="aviso">{error}</div>}

      {enCola && (
        <div className="nota-info">
          Este gasto se apuntó sin cobertura y está esperando a subir. En cuanto
          vuelva la señal podrás editarlo o borrarlo.
        </div>
      )}

      <div className="importe-grande">
        <input
          ref={inputImporte}
          inputMode="decimal"
          placeholder="0,00"
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          aria-label="Importe en euros"
        />
        <span>€</span>
      </div>

      <label className="campo__etiqueta">Categoría</label>
      <SelectorCategoria
        categorias={categoriasOrdenadas}
        seleccionada={categoriaId}
        onSeleccionar={setCategoriaId}
      />

      <label className="campo__etiqueta" style={{ marginTop: 20 }}>Cuándo</label>
      <div className="fila-flex" style={{ marginBottom: 14 }}>
        <button className="pastilla" data-activa={fecha === hoyISO()}
          onClick={() => setFecha(hoyISO())}>Hoy</button>
        <button className="pastilla" data-activa={fecha === ayerISO()}
          onClick={() => setFecha(ayerISO())}>Ayer</button>
        <input
          type="date"
          className="crecer"
          value={fecha}
          max={hoyISO()}
          onChange={(e) => setFecha(e.target.value)}
          style={{
            minHeight: 40, padding: '8px 12px', borderRadius: 99,
            border: '1px solid var(--borde)', background: 'var(--tarjeta)',
            outline: 'none', fontSize: 14,
          }}
          aria-label="Fecha del gasto"
        />
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="nota">Nota (opcional)</label>
        <input id="nota" type="text" value={nota} placeholder="Ej: compra semanal"
          onChange={(e) => setNota(e.target.value)} />
      </div>

      <div className="campo">
        <label className="campo__etiqueta">Ticket (opcional)</label>
        {ticketUrl ? (
          <div className="pila">
            <img src={ticketUrl} alt="Foto del ticket" className="ticket" />
            <button className="boton boton--secundario"
              onClick={() => { setTicketPath(null); setTicketUrl(null) }}>
              Quitar la foto
            </button>
          </div>
        ) : (
          <button className="boton boton--secundario" disabled={subiendo}
            onClick={() => inputFoto.current?.click()}>
            {subiendo ? 'Subiendo…' : '📷  Hacer foto del ticket'}
          </button>
        )}
        <input ref={inputFoto} type="file" accept="image/*" capture="environment"
          onChange={elegirFoto} style={{ display: 'none' }} />
      </div>

      {editando && !enCola && (
        <>
          <button className="boton boton--secundario" style={{ marginTop: 8 }} onClick={repetirHoy}>
            🔁  Repetir este gasto hoy
          </button>
          <button className="boton boton--peligro" style={{ marginTop: 8 }} onClick={borrar}>
            Borrar este gasto
          </button>
        </>
      )}

      {/* Pegado abajo: se llega a él sin buscarlo ni hacer scroll. */}
      <div className="hoja__pie">
        <button className="boton" onClick={guardar} disabled={!puedeGuardar}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : `Añadir ${centimos ? euros(centimos) : 'gasto'}`}
        </button>
      </div>
    </Hoja>
  )
}
