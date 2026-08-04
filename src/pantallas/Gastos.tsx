import { useMemo, useState } from 'react'
import { useTienda } from '../estado/Tienda'
import { mesesConDatos } from '../estado/calculos'
import { euros, normalizar } from '../lib/format'
import { etiquetaFecha, nombreMesCapital } from '../lib/fechas'
import { tituloDelGasto } from '../lib/concepto'
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

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return t.datos.gastos
      .filter((g) => {
        if (mes !== TODOS && !g.fecha.startsWith(mes)) return false
        if (categoriaId !== TODOS && g.categoriaId !== categoriaId) return false
        if (!q) return true
        const cat = t.datos.categorias.find((c) => c.id === g.categoriaId)
        // Se busca tanto por el texto del banco como por el nombre limpio que
        // se ve en la lista: si en pantalla pone "Sanitas", buscar "sanitas"
        // tiene que encontrarlo.
        const titulo = tituloDelGasto(g.nota, g.origen, cat?.nombre ?? null)
        const heno = normalizar(
          `${g.nota ?? ''} ${titulo} ${cat?.nombre ?? ''} ${(g.importe / 100).toFixed(2)}`,
        )
        return heno.includes(q)
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.creadoEn.localeCompare(a.creadoEn)))
  }, [t.datos.gastos, t.datos.categorias, busqueda, mes, categoriaId])

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
          placeholder="Buscar por nota, categoría o importe"
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
                <FilaGasto key={g.id} gasto={g} onPulsar={setEditando} mostrarFecha={false} />
              ))}
            </div>
          </div>
        ))
      )}

      <AltaGasto abierta={editando !== null} gasto={editando} onCerrar={() => setEditando(null)} />
    </>
  )
}
