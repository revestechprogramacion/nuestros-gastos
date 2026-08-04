import { useMemo, useState } from 'react'
import { useTienda } from '../estado/Tienda'
import { estadoPresupuestos, gastosDelMes } from '../estado/calculos'
import { aCentimos, euros } from '../lib/format'
import { mesActual, nombreMesCapital } from '../lib/fechas'
import { Hoja } from '../componentes/Hoja'
import { SelectorCategoria } from '../componentes/SelectorCategoria'
import { DetectarFijos } from '../componentes/DetectarFijos'
import type { Recurring } from '../data/types'

export function Planes() {
  const [pestana, setPestana] = useState<'presupuesto' | 'fijos'>('presupuesto')

  return (
    <>
      <div className="cabecera"><h1>Plan</h1></div>

      <div className="fila-flex" style={{ marginBottom: 16 }}>
        <button className="pastilla crecer" style={{ justifyContent: 'center' }}
          data-activa={pestana === 'presupuesto'} onClick={() => setPestana('presupuesto')}>
          Presupuesto
        </button>
        <button className="pastilla crecer" style={{ justifyContent: 'center' }}
          data-activa={pestana === 'fijos'} onClick={() => setPestana('fijos')}>
          Gastos fijos
        </button>
      </div>

      {pestana === 'presupuesto' ? <Presupuesto /> : <Fijos />}
    </>
  )
}

/* ------------------------------ Presupuesto ----------------------------- */

function Presupuesto() {
  const t = useTienda()
  const mes = mesActual()
  const { gastos, presupuestos } = t.datos
  // Poner tope a los traspasos no tiene sentido: no son gasto.
  const categorias = t.datos.categorias.filter((c) => !c.excluidaDeTotales)

  const estado = useMemo(
    () => estadoPresupuestos(gastos, categorias, presupuestos, mes),
    [gastos, categorias, presupuestos, mes],
  )

  const totalPresupuestado = estado.reduce((s, b) => s + b.presupuesto, 0)
  // Solo cuenta el gasto de las categorías CON tope: comparar el gasto total
  // del mes contra un presupuesto parcial diría siempre que os habéis pasado.
  const totalGastado = estado.reduce((s, b) => s + b.gastado, 0)
  const sinPresupuesto = categorias.filter(
    (c) => !c.archivada && !estado.some((b) => b.categoria!.id === c.id),
  )

  return (
    <>
      {totalPresupuestado > 0 && (
        <div className="tarjeta">
          <div className="entre" style={{ marginBottom: 8 }}>
            <span className="peque suave">
              Categorías con tope · {nombreMesCapital(mes, false).toLowerCase()}
            </span>
            <span className="cifra peque suave">
              {euros(totalGastado)} de {euros(totalPresupuestado)}
            </span>
          </div>
          <div className="progreso" style={{ height: 10 }}>
            <div className="progreso__relleno" style={{
              width: `${Math.min((totalGastado / totalPresupuestado) * 100, 100)}%`,
              background: totalGastado > totalPresupuestado
                ? 'var(--rojo-vivo)'
                : 'linear-gradient(90deg, var(--rojo-claro), var(--rojo))',
            }} />
          </div>
          <p className="peque suave" style={{ marginTop: 8 }}>
            {totalGastado > totalPresupuestado
              ? `Vais ${euros(totalGastado - totalPresupuestado)} por encima del plan.`
              : `Os quedan ${euros(totalPresupuestado - totalGastado)} de lo presupuestado.`}
          </p>
        </div>
      )}

      {estado.length === 0 && (
        <div className="nota-info">
          Pon un tope mensual solo a las categorías que quieras vigilar. Las que dejes
          en blanco no molestan: se siguen registrando igual.
        </div>
      )}

      {estado.length > 0 && <p className="epigrafe">Con tope</p>}
      {estado.map((b) => (
        <FilaPresupuesto key={b.categoria!.id} categoriaId={b.categoria!.id}
          icono={b.categoria!.icono} color={b.categoria!.color} nombre={b.categoria!.nombre}
          presupuesto={b.presupuesto} gastado={b.gastado} />
      ))}

      {sinPresupuesto.length > 0 && <p className="epigrafe">Sin tope</p>}
      {sinPresupuesto.map((c) => {
        const gastado = gastosDelMes(gastos, mes)
          .filter((g) => g.categoriaId === c.id)
          .reduce((s, g) => s + g.importe, 0)
        return (
          <FilaPresupuesto key={c.id} categoriaId={c.id} icono={c.icono} color={c.color}
            nombre={c.nombre} presupuesto={0} gastado={gastado} />
        )
      })}
    </>
  )
}

function FilaPresupuesto(props: {
  categoriaId: string; icono: string; color: string; nombre: string
  presupuesto: number; gastado: number
}) {
  const t = useTienda()
  const [texto, setTexto] = useState(
    props.presupuesto > 0 ? String(Math.round(props.presupuesto / 100)) : '',
  )
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const centimos = texto.trim() === '' ? 0 : (aCentimos(texto) ?? 0)
    if (centimos === props.presupuesto) return
    setGuardando(true)
    try {
      await t.guardarPresupuesto({ categoriaId: props.categoriaId, importe: centimos })
    } finally {
      setGuardando(false)
    }
  }

  const fraccion = props.presupuesto > 0 ? props.gastado / props.presupuesto : 0
  const pasado = props.presupuesto > 0 && props.gastado > props.presupuesto

  return (
    <div className="tarjeta" style={{ padding: 14 }}>
      <div className="entre">
        <span className="fila-flex crecer" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span className="icono icono--s"
            style={{ background: `color-mix(in srgb, ${props.color} 22%, var(--tarjeta))` }}
            aria-hidden>{props.icono}</span>
          <span className="crecer">
            <span className="fila__titulo" style={{ display: 'block' }}>{props.nombre}</span>
            <span className="fila__sub cifra">
              {props.presupuesto > 0
                ? `${euros(props.gastado)} de ${euros(props.presupuesto)}`
                : `${euros(props.gastado)} este mes`}
            </span>
          </span>
        </span>
        <span className="fila-flex" style={{ gap: 4 }}>
          <input
            inputMode="numeric"
            value={texto}
            placeholder="—"
            onChange={(e) => setTexto(e.target.value)}
            onBlur={guardar}
            aria-label={`Presupuesto mensual de ${props.nombre} en euros`}
            style={{
              width: 74, minHeight: 40, padding: '6px 8px', textAlign: 'right',
              borderRadius: 10, border: '1px solid var(--borde)', background: 'var(--tarjeta-alt)',
              outline: 'none', fontVariantNumeric: 'tabular-nums',
              opacity: guardando ? .5 : 1,
            }}
          />
          <span className="suave">€</span>
        </span>
      </div>

      {props.presupuesto > 0 && (
        <div className="progreso" style={{ marginTop: 10 }}>
          <div className="progreso__relleno" style={{
            width: `${Math.min(fraccion * 100, 100)}%`,
            background: pasado
              ? 'var(--rojo-vivo)'
              : fraccion > 0.8
                ? 'var(--aviso)'
                : 'linear-gradient(90deg, var(--rojo-claro), var(--rojo))',
          }} />
        </div>
      )}
    </div>
  )
}

/* ------------------------------ Gastos fijos ---------------------------- */

function Fijos() {
  const t = useTienda()
  const [editando, setEditando] = useState<Recurring | null>(null)
  const [creando, setCreando] = useState(false)
  const [detectando, setDetectando] = useState(false)

  const totalMes = t.datos.fijos.filter((f) => f.activo).reduce((s, f) => s + f.importe, 0)

  return (
    <>
      <div className="nota-info">
        Se apuntan solos cada mes el día que les toca: préstamos, hipoteca,
        seguros, Netflix… Solo lo que vale <strong>siempre lo mismo</strong>.
        La luz o el agua cambian cada mes, así que esas es mejor traerlas del
        banco con su cifra real.
      </div>

      {totalMes > 0 && (
        <div className="tarjeta">
          <p className="peque suave">Fijos al mes</p>
          <p className="cifra" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-.03em' }}>
            {euros(totalMes)}
          </p>
        </div>
      )}

      {t.datos.fijos.length > 0 && (
        <div className="lista">
          {t.datos.fijos.map((f) => {
            const cat = t.categoriaPorId(f.categoriaId)
            return (
              <button key={f.id} className="fila" onClick={() => setEditando(f)}
                style={{ opacity: f.activo ? 1 : .5 }}>
                <span className="icono"
                  style={{ background: `color-mix(in srgb, ${cat?.color ?? '#888'} 22%, var(--tarjeta))` }}
                  aria-hidden>{cat?.icono ?? '🔁'}</span>
                <span className="fila__principal">
                  <span className="fila__titulo"
                    style={{ whiteSpace: 'normal', overflow: 'visible' }}>{f.nombre}</span>
                  <span className="fila__sub">
                    Cada día {f.diaDelMes} · {cat?.nombre ?? 'Sin categoría'}
                    {!f.activo && ' · en pausa'}
                  </span>
                </span>
                <span className="fila__importe cifra">{euros(f.importe)}</span>
              </button>
            )
          })}
        </div>
      )}

      {t.datos.fijos.length === 0 && (
        <div className="vacio">
          <span className="vacio__emoji">🔁</span>
          <p><strong>Aún no hay gastos fijos</strong></p>
        </div>
      )}

      <button className="boton" onClick={() => setCreando(true)}>Añadir gasto fijo</button>

      <button className="boton boton--secundario" style={{ marginTop: 8 }}
        onClick={() => setDetectando(true)}>
        🪄  Detectar los que ya se repiten
      </button>
      <p className="peque tenue centrado" style={{ marginTop: 8 }}>
        Busca en lo que importaste del banco lo que se paga todos los meses.
      </p>

      <HojaFijo abierta={creando || editando !== null} fijo={editando}
        onCerrar={() => { setCreando(false); setEditando(null) }} />
      <DetectarFijos abierta={detectando} onCerrar={() => setDetectando(false)} />
    </>
  )
}

function HojaFijo({ abierta, fijo, onCerrar }: {
  abierta: boolean; fijo: Recurring | null; onCerrar: () => void
}) {
  const t = useTienda()
  const [nombre, setNombre] = useState('')
  const [importe, setImporte] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [dia, setDia] = useState(1)
  const [activo, setActivo] = useState(true)
  const [clave, setClave] = useState('')

  // Cargamos los valores cada vez que cambia el fijo que estamos editando.
  const claveActual = `${abierta}-${fijo?.id ?? 'nuevo'}`
  if (clave !== claveActual) {
    setClave(claveActual)
    setNombre(fijo?.nombre ?? '')
    setImporte(fijo ? (fijo.importe / 100).toFixed(2).replace('.', ',') : '')
    setCategoriaId(fijo?.categoriaId ?? null)
    setDia(fijo?.diaDelMes ?? 1)
    setActivo(fijo?.activo ?? true)
  }

  const centimos = aCentimos(importe)
  const valido = nombre.trim() !== '' && centimos !== null && centimos > 0

  async function guardar() {
    if (!valido) return
    await t.guardarFijo({
      ...(fijo?.id && { id: fijo.id }),
      nombre: nombre.trim(),
      importe: centimos!,
      categoriaId,
      diaDelMes: dia,
      activo,
      // Si es nuevo, arranca sin generar: lo creará el próximo día que toque.
      ultimoMesGenerado: fijo?.ultimoMesGenerado ?? null,
    })
    onCerrar()
  }

  async function borrar() {
    if (!fijo) return
    if (!confirm(`¿Borrar el gasto fijo "${fijo.nombre}"?\n\nLos gastos que ya generó se quedan.`)) return
    await t.borrarFijo(fijo.id)
    onCerrar()
  }

  return (
    <Hoja abierta={abierta} titulo={fijo ? 'Editar gasto fijo' : 'Nuevo gasto fijo'} onCerrar={onCerrar}>
      <div className="campo">
        <label className="campo__etiqueta" htmlFor="fijo-nombre">Nombre</label>
        <input id="fijo-nombre" type="text" value={nombre} placeholder="Ej: Hipoteca"
          onChange={(e) => setNombre(e.target.value)} />
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="fijo-importe">Importe al mes (€)</label>
        <input id="fijo-importe" inputMode="decimal" value={importe} placeholder="0,00"
          onChange={(e) => setImporte(e.target.value)} />
      </div>

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="fijo-dia">Día del mes en que se paga</label>
        <select id="fijo-dia" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>Día {d}</option>
          ))}
        </select>
        <p className="peque tenue" style={{ marginTop: 6 }}>
          Si eliges un día que ese mes no existe (el 31 en febrero), se apunta
          el último día del mes.
        </p>
      </div>

      <label className="campo__etiqueta">Categoría</label>
      <SelectorCategoria categorias={t.datos.categorias} seleccionada={categoriaId}
        onSeleccionar={setCategoriaId} />

      <button className="fila" style={{ borderRadius: 12, marginTop: 20, borderBottom: 'none' }}
        onClick={() => setActivo(!activo)}>
        <span className="fila__principal">
          <span className="fila__titulo">Activo</span>
          <span className="fila__sub">
            {activo ? 'Se apuntará solo cada mes' : 'En pausa, no genera gastos'}
          </span>
        </span>
        <span style={{ fontSize: 22 }}>{activo ? '✅' : '⏸️'}</span>
      </button>

      <button className="boton" style={{ marginTop: 16 }} onClick={guardar} disabled={!valido}>
        {fijo ? 'Guardar cambios' : 'Crear gasto fijo'}
      </button>

      {fijo && (
        <button className="boton boton--peligro" style={{ marginTop: 8 }} onClick={borrar}>
          Borrar gasto fijo
        </button>
      )}
    </Hoja>
  )
}
