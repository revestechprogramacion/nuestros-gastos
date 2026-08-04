import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTienda } from '../estado/Tienda'
import {
  estadoPresupuestos, gastosDelMes, gastosQueCuentan, resumirMes, totalesPorMes,
  variacionesFrente,
} from '../estado/calculos'
import { euros, eurosRedondos } from '../lib/format'
import { desplazarMes, hoyISO, mesActual, nombreMesCapital } from '../lib/fechas'
import { BarrasMeses } from '../componentes/BarrasMeses'
import { Desglose } from '../componentes/Desglose'
import { FilaGasto } from '../componentes/FilaGasto'
import { AltaGasto } from '../componentes/AltaGasto'
import type { Expense } from '../data/types'

export function Inicio() {
  const t = useTienda()
  const [mes, setMes] = useState(mesActual())
  const [editando, setEditando] = useState<Expense | null>(null)

  const { categorias, presupuestos } = t.datos
  const mesPrevio = desplazarMes(mes, -1)

  // Todo el resumen se calcula sobre el gasto de verdad: los traspasos entre
  // vuestras propias cuentas se quedan fuera.
  const gastos = useMemo(
    () => gastosQueCuentan(t.datos.gastos, categorias),
    [t.datos.gastos, categorias],
  )
  // Lo que se ha dejado fuera este mes, para decirlo en vez de esconderlo.
  const fueraDelTotal = useMemo(() => {
    const cuentan = new Set(gastos.map((g) => g.id))
    return gastosDelMes(t.datos.gastos, mes)
      .filter((g) => !cuentan.has(g.id))
      .reduce((s, g) => s + g.importe, 0)
  }, [t.datos.gastos, gastos, mes])

  const resumen = useMemo(
    () => resumirMes(gastos, categorias, presupuestos, mes),
    [gastos, categorias, presupuestos, mes],
  )
  const totalPrevio = useMemo(
    () => gastosDelMes(gastos, mesPrevio).reduce((s, g) => s + g.importe, 0),
    [gastos, mesPrevio],
  )
  const serie = useMemo(() => {
    const meses: string[] = []
    for (let i = 5; i >= 0; i--) meses.push(desplazarMes(mesActual(), -i))
    return totalesPorMes(gastos, meses)
  }, [gastos])

  const alertas = useMemo(
    () => estadoPresupuestos(gastos, categorias, presupuestos, mes).filter((b) => b.fraccion >= 0.8),
    [gastos, categorias, presupuestos, mes],
  )
  const subidas = useMemo(
    () => variacionesFrente(gastos, categorias, mes, mesPrevio).filter((v) => v.delta > 0).slice(0, 3),
    [gastos, categorias, mes, mesPrevio],
  )
  const ultimos = useMemo(
    () => [...gastosDelMes(gastos, mes)]
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.creadoEn.localeCompare(a.creadoEn)))
      .slice(0, 5),
    [gastos, mes],
  )

  const diferencia = resumen.total - totalPrevio
  const hayPrevio = totalPrevio > 0

  // Lo de hoy, que es lo que de verdad se mira al abrir la app.
  const hoy = hoyISO()
  const deHoy = useMemo(
    () => gastos.filter((g) => g.fecha === hoy).reduce((s, g) => s + g.importe, 0),
    [gastos, hoy],
  )
  const gastosDeHoy = useMemo(
    () => gastos.filter((g) => g.fecha === hoy).length,
    [gastos, hoy],
  )

  return (
    <>
      <div className="cabecera">
        <h1>{nombreMesCapital(mes, mes.slice(0, 4) !== String(new Date().getFullYear()))}</h1>
        {mes !== mesActual() && (
          <button className="boton--texto" onClick={() => setMes(mesActual())}>Ir a hoy</button>
        )}
      </div>

      <div className="tarjeta tarjeta--hero">
        <p className="peque suave">Gastado este mes</p>
        <p className="titular">{euros(resumen.total)}</p>

        {hayPrevio && (
          <p className="peque suave" style={{ marginTop: 6 }}>
            {diferencia === 0 ? 'Igual que ' : (
              <>
                <strong className={diferencia > 0 ? 'negativo' : 'positivo'}>
                  {euros(Math.abs(diferencia))}
                </strong>{' '}
                {diferencia > 0 ? 'más que ' : 'menos que '}
              </>
            )}
            en {nombreMesCapital(mesPrevio, false).toLowerCase()}
          </p>
        )}

        {/* En los primeros días del mes la proyección es ruido: cuatro compras
            seguidas disparan la estimación. La enseñamos a partir de la semana. */}
        {resumen.esMesEnCurso && resumen.total > 0 && new Date().getDate() >= 8 && (
          <p className="peque tenue" style={{ marginTop: 4 }}>
            A este ritmo el mes acabará en ~{eurosRedondos(resumen.proyeccion)}
          </p>
        )}

        {fueraDelTotal > 0 && (
          <p className="peque tenue" style={{ marginTop: 4 }}>
            Aparte, {euros(fueraDelTotal)} en traspasos que no cuentan como gasto
          </p>
        )}

        <div style={{ marginTop: 20 }}>
          <BarrasMeses serie={serie} mesSeleccionado={mes} onSeleccionar={setMes} />
        </div>
      </div>

      {/* Lo de hoy, en grande y aparte: es lo que se mira de un vistazo. */}
      {resumen.esMesEnCurso && (
        <div className="hoy">
          <span className="hoy__etiqueta">Hoy</span>
          <span className="hoy__cifra cifra">{euros(deHoy)}</span>
          <span className="hoy__nota">
            {gastosDeHoy === 0
              ? 'Todavía no habéis gastado nada'
              : `${gastosDeHoy} ${gastosDeHoy === 1 ? 'gasto' : 'gastos'} apuntados`}
          </span>
        </div>
      )}

      {alertas.length > 0 && (
        <>
          <p className="epigrafe">Ojo con el presupuesto</p>
          <div className="tarjeta">
            {alertas.map((b, i) => {
              const pasado = b.restante < 0
              return (
                <div key={b.categoria!.id} style={{ marginTop: i === 0 ? 0 : 14 }}>
                  <div className="entre" style={{ marginBottom: 6 }}>
                    <span className="fila-flex" style={{ gap: 8 }}>
                      <span aria-hidden>{b.categoria!.icono}</span>
                      <span style={{ fontWeight: 500 }}>{b.categoria!.nombre}</span>
                    </span>
                    <span className={`peque cifra ${pasado ? 'negativo' : 'suave'}`}>
                      {pasado
                        ? `${euros(-b.restante)} de más`
                        : `quedan ${euros(b.restante)}`}
                    </span>
                  </div>
                  <div className="progreso">
                    <div className="progreso__relleno" style={{
                      width: `${Math.min(b.fraccion * 100, 100)}%`,
                      background: pasado ? 'var(--rojo-vivo)' : 'var(--aviso)',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {resumen.porCategoria.length > 0 && (
        <>
          <p className="epigrafe">En qué se ha ido</p>
          <Desglose filas={resumen.porCategoria} />
        </>
      )}

      {subidas.length > 0 && hayPrevio && (
        <>
          <p className="epigrafe">Lo que más ha subido</p>
          <div className="lista">
            {subidas.map((v) => (
              <div key={v.categoria?.id ?? 'sin'} className="fila">
                <span className="icono icono--s" style={{
                  background: v.categoria
                    ? `color-mix(in srgb, ${v.categoria.color} 22%, var(--tarjeta))`
                    : 'var(--tarjeta-alt)',
                }} aria-hidden>{v.categoria?.icono ?? '·'}</span>
                <span className="fila__principal">
                  <span className="fila__titulo">{v.categoria?.nombre ?? 'Sin categoría'}</span>
                  <span className="fila__sub cifra">
                    {euros(v.antes)} → {euros(v.ahora)}
                  </span>
                </span>
                <span className="fila__importe cifra negativo">+{euros(v.delta)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {ultimos.length > 0 ? (
        <>
          <div className="entre" style={{ margin: '22px 4px 8px' }}>
            <span className="epigrafe" style={{ margin: 0 }}>Últimos gastos</span>
            <Link to="/gastos" className="boton--texto peque">Ver todos</Link>
          </div>
          <div className="lista">
            {ultimos.map((g) => (
              <FilaGasto key={g.id} gasto={g} onPulsar={setEditando} />
            ))}
          </div>
        </>
      ) : (
        <div className="vacio">
          <span className="vacio__emoji">🧾</span>
          <p><strong>Aún no hay gastos en {nombreMesCapital(mes, false).toLowerCase()}</strong></p>
          <p className="peque" style={{ marginTop: 6 }}>
            Toca el botón <strong>+</strong> de abajo para apuntar el primero.
          </p>
        </div>
      )}

      <AltaGasto abierta={editando !== null} gasto={editando} onCerrar={() => setEditando(null)} />
    </>
  )
}
