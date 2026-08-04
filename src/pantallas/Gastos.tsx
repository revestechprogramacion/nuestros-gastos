import { useMemo, useState } from 'react'
import { useTienda } from '../estado/Tienda'
import { mesesConDatos } from '../estado/calculos'
import { euros } from '../lib/format'
import { etiquetaFecha, nombreMesCapital } from '../lib/fechas'
import { tituloDelGasto } from '../lib/concepto'
import { prepararTexto, puntuar } from '../lib/buscar'
import { FilaGasto } from '../componentes/FilaGasto'
import { AltaGasto } from '../componentes/AltaGasto'
import type { Expense } from '../data/types'

const TODOS = '__todos__'

export function Gastos() {
  const t = useTienda()
  const [busqueda, setBusqueda] = useState('')
  const [mes, setMes] = useState(TODOS)
  const [categoriaId, setCategoriaId] = useState(TODOS)
  const [editando, setEditando] = useState<Expense | null>(null)

  const meses = useMemo(() => mesesConDatos(t.datos.gastos), [t.datos.gastos])

  /*
    Índice de búsqueda. Se calcula una sola vez por gasto —no en cada tecla—
    y reúne todo por lo que tiene sentido buscar: el concepto original del
    banco, el nombre limpio que se ve en pantalla, la categoría, el importe
    y la fecha escrita en palabras.
  */
  const indice = useMemo(() => {
    const porCategoria = new Map(t.datos.categorias.map((c) => [c.id, c.nombre]))
    return new Map(t.datos.gastos.map((g) => {
      const categoria = g.categoriaId ? porCategoria.get(g.categoriaId) ?? null : null
      return [g.id, prepararTexto([
        g.nota,
        tituloDelGasto(g.nota, g.origen, categoria),
        categoria,
        (g.importe / 100).toFixed(2),
        etiquetaFecha(g.fecha),
        g.origen === 'fijo' ? 'fijo recurrente' : null,
      ])]
    }))
  }, [t.datos.gastos, t.datos.categorias])

  const filtrados = useMemo(() => {
    const conNota = t.datos.gastos
      .filter((g) => {
        if (mes !== TODOS && !g.fecha.startsWith(mes)) return false
        if (categoriaId !== TODOS && g.categoriaId !== categoriaId) return false
        return true
      })
      .map((g) => ({ g, nota: busqueda.trim() ? puntuar(busqueda, indice.get(g.id) ?? '') : 1 }))
      .filter((x) => x.nota > 0)

    // Buscando, mandan los que mejor encajan; sin buscar, manda la fecha.
    conNota.sort((a, b) => (b.nota - a.nota)
      || (a.g.fecha < b.g.fecha ? 1 : a.g.fecha > b.g.fecha ? -1 : 0)
      || b.g.creadoEn.localeCompare(a.g.creadoEn))

    return conNota.map((x) => x.g)
  }, [t.datos.gastos, busqueda, mes, categoriaId, indice])

  const total = filtrados.reduce((s, g) => s + g.importe, 0)

  // Agrupamos por día para que la lista se lea como un extracto.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Expense[]>()
    for (const g of filtrados) {
      const lista = mapa.get(g.fecha) ?? []
      lista.push(g)
      mapa.set(g.fecha, lista)
    }
    return [...mapa.entries()]
  }, [filtrados])

  const hayFiltro = busqueda !== '' || mes !== TODOS || categoriaId !== TODOS

  return (
    <>
      <div className="cabecera"><h1>Gastos</h1></div>

      <div className="campo">
        <input
          type="search"
          placeholder="Buscar: mercadona, luz, 34,90…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar gastos"
        />
      </div>

      <div className="carrusel">
        <button className="pastilla" data-activa={mes === TODOS} onClick={() => setMes(TODOS)}>
          Todo
        </button>
        {meses.slice(0, 14).map((m) => (
          <button key={m} className="pastilla" data-activa={mes === m} onClick={() => setMes(m)}>
            {nombreMesCapital(m, false)}
          </button>
        ))}
      </div>

      <div className="carrusel">
        <button className="pastilla" data-activa={categoriaId === TODOS}
          onClick={() => setCategoriaId(TODOS)}>
          Todas
        </button>
        {t.datos.categorias.filter((c) => !c.archivada).map((c) => (
          <button key={c.id} className="pastilla" data-activa={categoriaId === c.id}
            onClick={() => setCategoriaId(c.id)}>
            <span aria-hidden>{c.icono}</span> {c.nombre}
          </button>
        ))}
      </div>

      <div className="entre" style={{ padding: '4px 4px 8px' }}>
        <span className="peque suave">
          {filtrados.length} {filtrados.length === 1 ? 'gasto' : 'gastos'}
        </span>
        <span className="cifra" style={{ fontWeight: 700 }}>{euros(total)}</span>
      </div>

      {porDia.length === 0 ? (
        <div className="vacio">
          <span className="vacio__emoji">{hayFiltro ? '🔍' : '🧾'}</span>
          <p><strong>{hayFiltro ? 'Nada por aquí' : 'Todavía no hay gastos'}</strong></p>
          {hayFiltro && (
            <button className="boton--texto" style={{ marginTop: 10 }}
              onClick={() => { setBusqueda(''); setMes(TODOS); setCategoriaId(TODOS) }}>
              Quitar los filtros
            </button>
          )}
        </div>
      ) : (
        porDia.map(([fecha, gastos]) => (
          <div key={fecha}>
            <div className="entre separador-fecha">
              <span>{etiquetaFecha(fecha)}</span>
              <span className="cifra">{euros(gastos.reduce((s, g) => s + g.importe, 0))}</span>
            </div>
            <div className="lista">
              {gastos.map((g) => (
                <FilaGasto key={g.id} gasto={g} onPulsar={setEditando} mostrarFecha={false}
                  onBorrar={(x) => { t.borrarGasto(x.id).catch(() => { /* el mensaje ya sale arriba */ }) }} />
              ))}
            </div>
          </div>
        ))
      )}

      <AltaGasto abierta={editando !== null} gasto={editando} onCerrar={() => setEditando(null)} />
    </>
  )
}
