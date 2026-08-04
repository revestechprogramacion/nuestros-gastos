import { useMemo, useState } from 'react'
import { useTienda } from '../estado/Tienda'
import { mesesConDatos } from '../estado/calculos'
import { euros } from '../lib/format'
import { etiquetaFecha, mesActual, nombreMesCapital } from '../lib/fechas'
import { tituloDelGasto } from '../lib/concepto'
import { prepararTexto, puntuar } from '../lib/buscar'
import { FilaGasto } from '../componentes/FilaGasto'
import { useAvisar } from '../componentes/Aviso'
import { AltaGasto } from '../componentes/AltaGasto'
import { Hoja } from '../componentes/Hoja'
import { SelectorCategoria } from '../componentes/SelectorCategoria'
import type { Expense } from '../data/types'

const TODOS = '__todos__'

export function Gastos() {
  const t = useTienda()
  const avisar = useAvisar()

  const [busqueda, setBusqueda] = useState('')
  // Se abre en el mes en curso, no en "todo": el total de varios años como
  // cifra grande no dice nada y obliga a filtrar antes de poder mirar.
  const [mes, setMes] = useState<string>(mesActual())
  const [categoriaId, setCategoriaId] = useState(TODOS)
  const [editando, setEditando] = useState<Expense | null>(null)
  const [eligiendoCategoria, setEligiendoCategoria] = useState(false)

  const meses = useMemo(() => mesesConDatos(t.datos.gastos), [t.datos.gastos])
  const categoria = categoriaId === TODOS ? null : t.categoriaPorId(categoriaId)

  /*
    Índice de búsqueda: se calcula una vez por gasto, no en cada tecla. Reúne
    todo por lo que tiene sentido buscar —concepto del banco, nombre limpio,
    categoría, importe y fecha en palabras—.
  */
  const indice = useMemo(() => {
    const porCategoria = new Map(t.datos.categorias.map((c) => [c.id, c.nombre]))
    return new Map(t.datos.gastos.map((g) => {
      const nombre = g.categoriaId ? porCategoria.get(g.categoriaId) ?? null : null
      return [g.id, prepararTexto([
        g.nota,
        tituloDelGasto(g.nota, g.origen, nombre),
        nombre,
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
    for (const g of filtrados) mapa.set(g.fecha, [...(mapa.get(g.fecha) ?? []), g])
    return [...mapa.entries()]
  }, [filtrados])

  /** Borrar nunca debe ser un callejón sin salida: siempre con vuelta atrás. */
  function borrarConDeshacer(g: Expense) {
    t.borrarGasto(g.id)
      .then(() => avisar({
        texto: `Borrado ${euros(g.importe)}`,
        deshacer: () => t.crearGasto({
          importe: g.importe,
          categoriaId: g.categoriaId,
          fecha: g.fecha,
          nota: g.nota,
          ticketPath: g.ticketPath,
          origen: g.origen,
        }),
      }))
      .catch(() => { /* el mensaje de error ya sale arriba */ })
  }

  const hayFiltro = busqueda !== '' || mes !== mesActual() || categoriaId !== TODOS
  const queEstasViendo = [
    busqueda.trim() ? `«${busqueda.trim()}»` : null,
    mes === TODOS ? 'todos los meses' : nombreMesCapital(mes, false).toLowerCase(),
    categoria ? categoria.nombre.toLowerCase() : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <div className="cabecera"><h1>Gastos</h1></div>

      {/* El titular dice lo que estás viendo AHORA, con los filtros puestos.
          Una cifra grande que no significa nada es peor que no ponerla. */}
      <div className="resumen-filtro">
        <span className="resumen-filtro__cifra cifra">{euros(total)}</span>
        <span className="resumen-filtro__pie">
          {filtrados.length} {filtrados.length === 1 ? 'gasto' : 'gastos'} · {queEstasViendo}
        </span>
      </div>

      <div className="buscador">
        <span className="buscador__lupa" aria-hidden>⌕</span>
        <input
          type="search"
          placeholder="Buscar mercadona, luz, 34,90…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar gastos"
        />
        {busqueda && (
          <button className="buscador__limpiar" onClick={() => setBusqueda('')}
            aria-label="Limpiar la búsqueda">✕</button>
        )}
      </div>

      {/* Una sola fila de filtros: los meses en línea y las categorías detrás
          de un botón. Antes eran dos filas que se comían media pantalla
          antes de enseñar un solo gasto. */}
      <div className="carrusel">
        <button className="pastilla" data-activa={categoriaId !== TODOS}
          onClick={() => setEligiendoCategoria(true)}>
          {categoria ? `${categoria.icono} ${categoria.nombre}` : 'Categoría'} ▾
        </button>
        <span className="carrusel__separador" aria-hidden />
        <button className="pastilla" data-activa={mes === TODOS} onClick={() => setMes(TODOS)}>
          Todo
        </button>
        {meses.slice(0, 14).map((m) => (
          <button key={m} className="pastilla" data-activa={mes === m} onClick={() => setMes(m)}>
            {nombreMesCapital(m, false)}
          </button>
        ))}
      </div>

      {porDia.length === 0 ? (
        <div className="vacio">
          <span className="vacio__emoji">{hayFiltro ? '🔍' : '🧾'}</span>
          <p><strong>{hayFiltro ? 'Nada con estos filtros' : 'Aún no hay gastos este mes'}</strong></p>
          <p className="peque" style={{ marginTop: 6 }}>
            {hayFiltro
              ? 'Prueba con otro mes o quita los filtros.'
              : 'Toca el botón + de abajo para apuntar el primero.'}
          </p>
          {hayFiltro && (
            <button className="boton--texto" style={{ marginTop: 12 }}
              onClick={() => { setBusqueda(''); setMes(mesActual()); setCategoriaId(TODOS) }}>
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
                  onBorrar={borrarConDeshacer} />
              ))}
            </div>
          </div>
        ))
      )}

      <Hoja abierta={eligiendoCategoria} titulo="Filtrar por categoría"
        onCerrar={() => setEligiendoCategoria(false)}>
        <button className="boton boton--secundario" style={{ marginBottom: 16 }}
          onClick={() => { setCategoriaId(TODOS); setEligiendoCategoria(false) }}>
          Ver todas las categorías
        </button>
        <SelectorCategoria
          categorias={t.datos.categorias}
          seleccionada={categoriaId === TODOS ? null : categoriaId}
          onSeleccionar={(id) => { setCategoriaId(id); setEligiendoCategoria(false) }}
        />
      </Hoja>

      <AltaGasto abierta={editando !== null} gasto={editando} onCerrar={() => setEditando(null)} />
    </>
  )
}
