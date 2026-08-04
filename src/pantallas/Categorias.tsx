import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTienda } from '../estado/Tienda'
import { COLORES_CATEGORIA, EMOJIS_CATEGORIA } from '../data/seed'
import { euros } from '../lib/format'
import { Hoja } from '../componentes/Hoja'
import { IconoAtras, IconoChevron } from '../componentes/Iconos'
import type { Category } from '../data/types'

export function Categorias() {
  const t = useTienda()
  const navegar = useNavigate()
  const [editando, setEditando] = useState<Category | null>(null)
  const [creando, setCreando] = useState(false)

  const usoPorCategoria = (id: string) =>
    t.datos.gastos.filter((g) => g.categoriaId === id).reduce((s, g) => s + g.importe, 0)

  return (
    <>
      <div className="cabecera">
        <button className="boton--texto fila-flex" onClick={() => navegar('/ajustes')}>
          <IconoAtras /> Ajustes
        </button>
        <h1 className="cabecera__titulo">Categorías</h1>
        <span className="cabecera__hueco" />
      </div>

      <div className="lista">
        {t.datos.categorias.map((c) => (
          <button key={c.id} className="fila" onClick={() => setEditando(c)}>
            <span className="icono"
              style={{ background: `color-mix(in srgb, ${c.color} 22%, var(--tarjeta))` }}
              aria-hidden>{c.icono}</span>
            <span className="fila__principal">
              <span className="fila__titulo">{c.nombre}</span>
              <span className="fila__sub cifra">
                {euros(usoPorCategoria(c.id))} en total
                {c.archivada && ' · archivada'}
              </span>
            </span>
            <IconoChevron />
          </button>
        ))}
      </div>

      <button className="boton" onClick={() => setCreando(true)}>Nueva categoría</button>

      <HojaCategoria
        abierta={creando || editando !== null}
        categoria={editando}
        onCerrar={() => { setCreando(false); setEditando(null) }}
      />
    </>
  )
}

function HojaCategoria({ abierta, categoria, onCerrar }: {
  abierta: boolean; categoria: Category | null; onCerrar: () => void
}) {
  const t = useTienda()
  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('📦')
  const [color, setColor] = useState(COLORES_CATEGORIA[0])
  const [archivada, setArchivada] = useState(false)
  const [excluida, setExcluida] = useState(false)
  const [clave, setClave] = useState('')

  const claveActual = `${abierta}-${categoria?.id ?? 'nueva'}`
  if (clave !== claveActual) {
    setClave(claveActual)
    setNombre(categoria?.nombre ?? '')
    setIcono(categoria?.icono ?? '📦')
    setColor(categoria?.color ?? COLORES_CATEGORIA[0])
    setArchivada(categoria?.archivada ?? false)
    setExcluida(categoria?.excluidaDeTotales ?? false)
  }

  const numGastos = categoria
    ? t.datos.gastos.filter((g) => g.categoriaId === categoria.id).length
    : 0

  async function guardar() {
    if (!nombre.trim()) return
    await t.guardarCategoria({
      ...(categoria?.id && { id: categoria.id }),
      nombre: nombre.trim(),
      icono,
      color,
      orden: categoria?.orden ?? t.datos.categorias.length + 1,
      archivada,
      excluidaDeTotales: excluida,
    })
    onCerrar()
  }

  async function borrar() {
    if (!categoria) return
    const aviso = numGastos > 0
      ? `"${categoria.nombre}" tiene ${numGastos} gastos.\n\nSe quedarán guardados pero sin categoría. ¿Seguro?`
      : `¿Borrar la categoría "${categoria.nombre}"?`
    if (!confirm(aviso)) return
    await t.borrarCategoria(categoria.id)
    onCerrar()
  }

  return (
    <Hoja abierta={abierta} titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <div className="centrado" style={{ marginBottom: 18 }}>
        <span className="icono" style={{
          width: 64, height: 64, fontSize: 32, margin: '0 auto',
          background: `color-mix(in srgb, ${color} 22%, var(--tarjeta))`,
        }}>{icono}</span>
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="cat-nombre">Nombre</label>
        <input id="cat-nombre" type="text" value={nombre} placeholder="Ej: Mascota"
          onChange={(e) => setNombre(e.target.value)} />
      </div>

      <label className="campo__etiqueta">Icono</label>
      <div className="rejilla-emoji">
        {EMOJIS_CATEGORIA.map((e) => (
          <button key={e} className="emoji" data-activo={e === icono} onClick={() => setIcono(e)}>
            {e}
          </button>
        ))}
      </div>

      <label className="campo__etiqueta" style={{ marginTop: 18 }}>Color</label>
      <div className="fila-flex" style={{ flexWrap: 'wrap', gap: 10 }}>
        {COLORES_CATEGORIA.map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`}
            style={{
              width: 34, height: 34, borderRadius: '50%', background: c,
              border: c === color ? '3px solid var(--texto)' : '3px solid transparent',
            }} />
        ))}
      </div>

      <button className="fila" style={{ borderRadius: 12, marginTop: 20 }}
        onClick={() => setExcluida(!excluida)}
        aria-pressed={excluida}>
        <span className="fila__principal">
          <span className="fila__titulo">Cuenta como gasto</span>
          <span className="fila__sub">
            {excluida
              ? 'No suma en los totales del mes'
              : 'Suma en el «gastado este mes»'}
          </span>
        </span>
        <span style={{ fontSize: 22 }} aria-hidden>{excluida ? '🚫' : '✅'}</span>
      </button>
      <p className="peque tenue" style={{ margin: '6px 4px 0' }}>
        Apágalo para el dinero que no se gasta, solo cambia de sitio: traspasos
        a vuestra otra cuenta, o dinero que os devuelven.
      </p>

      {categoria && (
        <button className="fila" style={{ borderRadius: 12, marginTop: 12, borderBottom: 'none' }}
          onClick={() => setArchivada(!archivada)}
          aria-pressed={archivada}>
          <span className="fila__principal">
            <span className="fila__titulo">Archivada</span>
            <span className="fila__sub">
              {archivada ? 'No aparece al añadir gastos' : 'Se puede elegir al añadir gastos'}
            </span>
          </span>
          <span style={{ fontSize: 22 }} aria-hidden>{archivada ? '📥' : '✅'}</span>
        </button>
      )}

      <button className="boton" style={{ marginTop: 16 }} onClick={guardar} disabled={!nombre.trim()}>
        {categoria ? 'Guardar cambios' : 'Crear categoría'}
      </button>

      {categoria && (
        <button className="boton boton--peligro" style={{ marginTop: 8 }} onClick={borrar}>
          Borrar categoría
        </button>
      )}
    </Hoja>
  )
}
