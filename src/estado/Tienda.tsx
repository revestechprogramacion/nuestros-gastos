import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { getRepo, type Repo } from '../data/repo'
import { CATEGORIAS_INICIALES } from '../data/seed'
import { HISTORICO, hayHistoricoQueRestaurar, mapaDeCategorias } from '../data/restaurar'
import { sugerirCategoria } from '../lib/categorizar'
import { diaEfectivo } from '../lib/periodicos'
import { SNAPSHOT_VACIO, type Budget, type Category, type Expense, type ImportRule, type Recurring, type SessionUser, type Snapshot } from '../data/types'
import { aISO, desplazarMes, hoyISO, mesActual, mesDe } from '../lib/fechas'

interface Tienda {
  cargando: boolean
  error: string | null
  usuario: SessionUser | null
  modo: 'local' | 'nube'
  datos: Snapshot

  entrar: (email: string, password: string) => Promise<void>
  /** Devuelve false si hay que confirmar el email antes de poder entrar. */
  registrarse: (email: string, password: string) => Promise<boolean>
  salir: () => Promise<void>
  recargar: () => Promise<void>

  crearGasto: (g: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>) => Promise<void>
  crearGastos: (gs: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>[]) => Promise<void>
  actualizarGasto: (g: Expense) => Promise<void>
  borrarGasto: (id: string) => Promise<void>

  /** Vuelve a intentar categorizar los gastos que quedaron sin categoría. */
  repasarSinCategoria: () => Promise<{ categoriasNuevas: number; recategorizados: number }>

  /** Cuántos gastos quedaron en la versión de prueba de este navegador. */
  gastosDePrueba: () => number
  /** Sube a la nube lo que se hizo en la versión de prueba de este navegador. */
  subirDatosDePrueba: () => Promise<ResumenMigracion>

  guardarCategoria: (c: Omit<Category, 'id'> & { id?: string }) => Promise<void>
  borrarCategoria: (id: string) => Promise<void>

  guardarPresupuesto: (b: Budget) => Promise<void>

  guardarFijo: (r: Omit<Recurring, 'id'> & { id?: string }) => Promise<void>
  borrarFijo: (id: string) => Promise<void>

  guardarRegla: (r: Omit<ImportRule, 'id'>) => Promise<void>

  subirTicket: (f: File) => Promise<string>
  urlTicket: (path: string) => Promise<string | null>

  categoriaPorId: (id: string | null) => Category | null
  nombreMiembro: (id: string | null) => string
}

export interface ResumenMigracion {
  gastos: number
  categorias: number
  fijos: number
  reglas: number
  /** Los que ya estaban subidos y no se han duplicado. */
  omitidos: number
}

/**
 * Lee lo que quedó guardado por la versión de prueba en ESTE navegador.
 * Cuando la app pasó a la nube, esos datos siguieron ahí sin tocar.
 */
function leerDatosDePrueba(): Snapshot | null {
  try {
    const crudo = localStorage.getItem('nuestros-gastos:local:v1')
    if (!crudo) return null
    const a = JSON.parse(crudo) as Snapshot
    return a.gastos?.length ? a : null
  } catch {
    return null
  }
}

const Contexto = createContext<Tienda | null>(null)

export function useTienda(): Tienda {
  const t = useContext(Contexto)
  if (!t) throw new Error('useTienda debe usarse dentro de <ProveedorTienda>')
  return t
}

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null)
  const [usuario, setUsuario] = useState<SessionUser | null>(null)
  const [datos, setDatos] = useState<Snapshot>(SNAPSHOT_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const generandoFijos = useRef(false)

  const recargarCon = useCallback(async (r: Repo) => {
    try {
      const snap = await r.cargarTodo()
      setDatos(snap)
      setError(null)
      return snap
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando los datos')
      return null
    }
  }, [])

  // Arranque: repo + sesión + primera carga.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const r = await getRepo()
      if (!vivo) return
      setRepo(r)
      const sesion = await r.sesionActual()
      if (!vivo) return
      setUsuario(sesion)
      if (sesion) {
        const snap = await recargarCon(r)
        if (snap) await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
      }
      setCargando(false)
    })()
    return () => { vivo = false }
  }, [recargarCon])

  // Sincronización: si el otro móvil cambia algo, recargamos.
  useEffect(() => {
    if (!repo || !usuario) return
    return repo.escucharCambios(() => { void recargarCon(repo) })
  }, [repo, usuario, recargarCon])

  /**
   * Envuelve una mutación: la ejecuta, recarga los datos y deja el mensaje de
   * error a la vista si algo falla. El resultado del repositorio se descarta a
   * propósito: las pantallas siempre leen del snapshot recargado.
   */
  const accion = useCallback(
    <A extends unknown[]>(fn: (r: Repo, ...args: A) => Promise<unknown>) =>
      async (...args: A): Promise<void> => {
        if (!repo) throw new Error('La app aún se está cargando')
        try {
          await fn(repo, ...args)
          await recargarCon(repo)
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Algo ha fallado'
          setError(msg)
          throw new Error(msg)
        }
      },
    [repo, recargarCon],
  )

  const valor = useMemo<Tienda>(() => ({
    cargando,
    error,
    usuario,
    modo: repo?.modo ?? 'local',
    datos,

    entrar: async (email, password) => {
      const r = repo ?? (await getRepo())
      await r.entrar(email, password)
      const sesion = await r.sesionActual()
      setUsuario(sesion)
      const snap = await recargarCon(r)
      if (snap) await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
    },
    registrarse: async (email, password) => {
      const r = repo ?? (await getRepo())
      const haySesion = await r.registrarse(email, password)
      if (!haySesion) return false
      const sesion = await r.sesionActual()
      setUsuario(sesion)
      const snap = await recargarCon(r)
      if (snap) await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
      return true
    },
    salir: async () => {
      if (repo) await repo.salir()
      setUsuario(null)
      setDatos(SNAPSHOT_VACIO)
    },
    recargar: async () => { if (repo) await recargarCon(repo) },

    repasarSinCategoria: async () => {
      const r = repo ?? (await getRepo())

      // 1. Si faltan categorías por defecto (porque la casa se creó con una
      //    versión anterior de la app), las creamos.
      const existentes = new Set(datos.categorias.map((c) => c.nombre))
      const queFaltan = CATEGORIAS_INICIALES.filter((c) => !existentes.has(c.nombre))
      for (const c of queFaltan) await r.guardarCategoria(c)

      const snap = (await recargarCon(r)) ?? datos

      // 2. Repasamos los que se quedaron huérfanos.
      const arreglados: Expense[] = []
      for (const g of snap.gastos) {
        if (g.categoriaId !== null || !g.nota) continue
        const { categoriaId } = sugerirCategoria(g.nota, snap.categorias, snap.reglas)
        if (categoriaId) arreglados.push({ ...g, categoriaId })
      }

      await r.actualizarGastos(arreglados)
      await recargarCon(r)

      return { categoriasNuevas: queFaltan.length, recategorizados: arreglados.length }
    },

    gastosDePrueba: () => leerDatosDePrueba()?.gastos.length ?? 0,

    subirDatosDePrueba: async () => {
      const r = repo ?? (await getRepo())
      const local = leerDatosDePrueba()
      const vacio: ResumenMigracion = { gastos: 0, categorias: 0, fijos: 0, reglas: 0, omitidos: 0 }
      if (!local) return vacio

      // Las categorías de allí y de aquí tienen identificadores distintos:
      // el puente entre unas y otras es el nombre.
      let snap = datos
      const porNombre = () => new Map(snap.categorias.map((c) => [c.nombre, c.id]))
      let mapa = porNombre()

      let categoriasNuevas = 0
      for (const c of local.categorias) {
        if (mapa.has(c.nombre)) continue
        const { id: _id, ...sinId } = c
        await r.guardarCategoria(sinId)
        categoriasNuevas++
      }
      if (categoriasNuevas > 0) {
        snap = (await recargarCon(r)) ?? snap
        mapa = porNombre()
      }

      const nombreLocal = new Map(local.categorias.map((c) => [c.id, c.nombre]))
      const aquiId = (idLocal: string | null) =>
        (idLocal && mapa.get(nombreLocal.get(idLocal) ?? '')) ?? null

      // No repetimos lo que ya esté subido: mismo día, mismo importe, mismo concepto.
      const huella = (g: { fecha: string; importe: number; nota: string | null }) =>
        `${g.fecha}|${g.importe}|${g.nota ?? ''}`
      const yaEstan = new Set(snap.gastos.map(huella))

      const porSubir = local.gastos.filter((g) => !yaEstan.has(huella(g)))
      const omitidos = local.gastos.length - porSubir.length

      // En tandas, que son cientos y una petición gigante se cae entera.
      for (let i = 0; i < porSubir.length; i += 100) {
        await r.crearGastos(porSubir.slice(i, i + 100).map((g) => ({
          importe: g.importe,
          categoriaId: aquiId(g.categoriaId),
          fecha: g.fecha,
          nota: g.nota,
          ticketPath: null, // las fotos de la prueba viven solo en este navegador
          origen: g.origen,
        })))
      }

      const fijosAqui = new Set(snap.fijos.map((f) => f.nombre))
      let fijos = 0
      for (const f of local.fijos) {
        if (fijosAqui.has(f.nombre)) continue
        const { id: _id, ...sinId } = f
        await r.guardarFijo({ ...sinId, categoriaId: aquiId(f.categoriaId) })
        fijos++
      }

      const reglasAqui = new Set(snap.reglas.map((x) => x.patron))
      let reglas = 0
      for (const x of local.reglas) {
        const destino = aquiId(x.categoriaId)
        if (!destino || reglasAqui.has(x.patron)) continue
        await r.guardarRegla({ patron: x.patron, categoriaId: destino, aciertos: x.aciertos })
        reglas++
      }

      for (const p of local.presupuestos) {
        const destino = aquiId(p.categoriaId)
        if (destino) await r.guardarPresupuesto({ categoriaId: destino, importe: p.importe })
      }

      await recargarCon(r)
      return { gastos: porSubir.length, categorias: categoriasNuevas, fijos, reglas, omitidos }
    },

    crearGasto: accion((r, g: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>) => r.crearGasto(g)),
    crearGastos: accion((r, gs: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>[]) => r.crearGastos(gs)),
    actualizarGasto: accion((r, g: Expense) => r.actualizarGasto(g)),
    borrarGasto: accion((r, id: string) => r.borrarGasto(id)),

    guardarCategoria: accion((r, c: Omit<Category, 'id'> & { id?: string }) => r.guardarCategoria(c)),
    borrarCategoria: accion((r, id: string) => r.borrarCategoria(id)),

    guardarPresupuesto: accion((r, b: Budget) => r.guardarPresupuesto(b)),

    guardarFijo: accion((r, x: Omit<Recurring, 'id'> & { id?: string }) => r.guardarFijo(x)),
    borrarFijo: accion((r, id: string) => r.borrarFijo(id)),

    guardarRegla: accion((r, x: Omit<ImportRule, 'id'>) => r.guardarRegla(x)),

    subirTicket: async (f: File) => {
      const r = repo ?? (await getRepo())
      return r.subirTicket(f)
    },
    urlTicket: async (path: string) => {
      const r = repo ?? (await getRepo())
      return r.urlTicket(path)
    },

    categoriaPorId: (id) => datos.categorias.find((c) => c.id === id) ?? null,
    nombreMiembro: (id) => datos.miembros.find((m) => m.id === id)?.nombre ?? '',
  }), [cargando, error, usuario, repo, datos, accion, recargarCon])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/**
 * Dos tareas de mantenimiento al entrar:
 *  1. Si la casa está recién creada, sembrar las categorías por defecto.
 *  2. Crear los gastos fijos (hipoteca, luz...) que tocaban y aún no existen.
 */
async function sembrarYGenerar(
  repo: Repo,
  snap: Snapshot,
  recargar: (r: Repo) => Promise<Snapshot | null>,
  cerrojo: { current: boolean },
) {
  if (cerrojo.current) return
  cerrojo.current = true
  try {
    let actual = snap
    if (actual.categorias.length === 0) {
      for (const c of CATEGORIAS_INICIALES) await repo.guardarCategoria(c)
      actual = (await recargar(repo)) ?? actual
    }

    // Casa recién estrenada y hay histórico esperando: lo subimos ahora, sin
    // que nadie tenga que pedirlo. Solo ocurre una vez, con la casa vacía.
    if (actual.gastos.length === 0 && hayHistoricoQueRestaurar()) {
      await restaurarHistorico(repo, actual)
      actual = (await recargar(repo)) ?? actual
    }
    const creados = await generarFijos(repo, actual)
    if (creados > 0) await recargar(repo)
  } finally {
    cerrojo.current = false
  }
}

/** Sube el histórico que viaja con la app a una casa que aún está vacía. */
async function restaurarHistorico(repo: Repo, snap: Snapshot): Promise<void> {
  const porNombre = mapaDeCategorias(snap.categorias)
  const id = (nombre: string) => porNombre.get(nombre) ?? null

  // En tandas: son cientos y una petición gigante se cae entera.
  const gastos = HISTORICO.gastos.map((g) => ({
    importe: g.importe,
    categoriaId: id(g.categoria),
    fecha: g.fecha,
    nota: g.nota,
    ticketPath: null,
    origen: g.origen,
  }))
  for (let i = 0; i < gastos.length; i += 100) {
    await repo.crearGastos(gastos.slice(i, i + 100))
  }

  for (const f of HISTORICO.fijos) {
    await repo.guardarFijo({
      nombre: f.nombre,
      importe: f.importe,
      categoriaId: id(f.categoria),
      diaDelMes: f.diaDelMes,
      activo: true,
      ultimoMesGenerado: f.ultimoMesGenerado,
    })
  }

  for (const r of HISTORICO.reglas) {
    const destino = id(r.categoria)
    if (destino) await repo.guardarRegla({ patron: r.patron, categoriaId: destino, aciertos: 1 })
  }
}

/** Crea los gastos de los fijos activos cuyo día ya ha pasado y no se generaron. */
async function generarFijos(repo: Repo, snap: Snapshot): Promise<number> {
  const hoy = hoyISO()
  const mesHoy = mesActual()
  const diaHoy = new Date().getDate()
  let creados = 0

  for (const fijo of snap.fijos) {
    if (!fijo.activo) continue

    // Ponernos al día como mucho 12 meses hacia atrás.
    const meses: string[] = []
    let m = fijo.ultimoMesGenerado ? desplazarMes(fijo.ultimoMesGenerado, 1) : mesHoy
    let guardia = 0
    while (m <= mesHoy && guardia++ < 12) {
      meses.push(m)
      m = desplazarMes(m, 1)
    }

    let ultimoGenerado = fijo.ultimoMesGenerado
    for (const mes of meses) {
      // Un recibo del 31 cae el 28 en febrero, no se salta el mes.
      const dia = diaEfectivo(fijo.diaDelMes, mes)

      // En el mes en curso solo lo creamos si ya llegó el día.
      if (mes === mesHoy && dia > diaHoy) continue

      const fecha = `${mes}-${String(dia).padStart(2, '0')}`
      const yaExiste = snap.gastos.some(
        (g) => g.origen === 'fijo' && g.nota === fijo.nombre && mesDe(g.fecha) === mes,
      )
      if (yaExiste) { ultimoGenerado = mes; continue }

      await repo.crearGasto({
        importe: fijo.importe,
        categoriaId: fijo.categoriaId,
        fecha: fecha > hoy ? aISO(new Date()) : fecha,
        nota: fijo.nombre,
        ticketPath: null,
        origen: 'fijo',
      })
      creados++
      ultimoGenerado = mes
    }

    if (ultimoGenerado !== fijo.ultimoMesGenerado) {
      await repo.guardarFijo({ ...fijo, ultimoMesGenerado: ultimoGenerado })
    }
  }
  return creados
}
