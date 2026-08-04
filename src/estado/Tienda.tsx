import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { getRepo, type Repo } from '../data/repo'
import {
  guardarSesion, guardarSnapshot, marcarFijosRevisados, olvidarTodo,
  sesionGuardada, snapshotGuardado, tocaRevisarFijos,
} from '../data/cache'
import { CATEGORIAS_INICIALES } from '../data/seed'
import { sugerirCategoria } from '../lib/categorizar'
import { diaEfectivo } from '../lib/periodicos'
import { avisar } from '../lib/avisos'
import { euros } from '../lib/format'
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



const Contexto = createContext<Tienda | null>(null)

export function useTienda(): Tienda {
  const t = useContext(Contexto)
  if (!t) throw new Error('useTienda debe usarse dentro de <ProveedorTienda>')
  return t
}

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repo | null>(null)
  // Arrancamos con lo último que se vio. Es una lectura de disco, así que
  // la primera pantalla aparece sin esperar a la red.
  const [usuario, setUsuario] = useState<SessionUser | null>(() => sesionGuardada())
  const [datos, setDatos] = useState<Snapshot>(() => snapshotGuardado() ?? SNAPSHOT_VACIO)
  const [cargando, setCargando] = useState(() => sesionGuardada() === null)
  const [error, setError] = useState<string | null>(null)
  const generandoFijos = useRef(false)

  const recargarCon = useCallback(async (r: Repo) => {
    try {
      const snap = await r.cargarTodo()
      setDatos(snap)
      guardarSnapshot(snap)
      setError(null)
      return snap
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando los datos')
      return null
    }
  }, [])

  /*
    Arranque en dos tiempos.

    Primer tiempo (ya hecho arriba, sin red): se pinta lo último que se vio.
    Segundo tiempo (aquí): se comprueba la sesión de verdad y se refrescan
    los datos. Si algo cambió, se actualiza; si no, no se nota nada.

    Las tareas de mantenimiento —sembrar categorías, generar los gastos
    fijos— se dejan para el final y no bloquean la pantalla.
  */
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const r = await getRepo()
      if (!vivo) return
      setRepo(r)

      const sesion = await r.sesionActual()
      if (!vivo) return
      setUsuario(sesion)
      guardarSesion(sesion)
      setCargando(false)
      if (!sesion) return

      const snap = await recargarCon(r)
      if (!vivo || !snap) return

      // Ahora sí sabemos cómo se llama en la casa, no solo su correo.
      const enLaCasa = snap.miembros.find((m) => m.id === sesion.id)
      if (enLaCasa && enLaCasa.nombre !== sesion.nombre) {
        const conNombre = { ...sesion, nombre: enLaCasa.nombre }
        setUsuario(conNombre)
        guardarSesion(conNombre)
      }

      await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
    })()
    return () => { vivo = false }
  }, [recargarCon])

  // Sincronización: si el otro móvil cambia algo, recargamos y avisamos.
  const vistos = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!repo || !usuario) return
    return repo.escucharCambios(async () => {
      const snap = await recargarCon(repo)
      if (!snap) return

      // La primera vuelta solo toma nota de lo que ya había: si no, al abrir
      // la app saltarían avisos de gastos de hace meses.
      if (vistos.current === null) {
        vistos.current = new Set(snap.gastos.map((g) => g.id))
        return
      }

      const nuevos = snap.gastos.filter(
        (g) => !vistos.current!.has(g.id) && g.creadoPor && g.creadoPor !== usuario.id,
      )
      snap.gastos.forEach((g) => vistos.current!.add(g.id))

      if (nuevos.length === 1) {
        const g = nuevos[0]
        const quien = snap.miembros.find((m) => m.id === g.creadoPor)?.nombre ?? 'En casa'
        void avisar(`${quien} ha apuntado un gasto`, `${euros(g.importe)} · ${g.nota ?? 'sin nota'}`, 'gasto-nuevo')
      } else if (nuevos.length > 1) {
        const total = nuevos.reduce((t, g) => t + g.importe, 0)
        void avisar('Gastos nuevos en casa', `${nuevos.length} gastos · ${euros(total)}`, 'gasto-nuevo')
      }
    })
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

  /**
   * Cambia el estado en el sitio, sin volver a pedirlo todo al servidor.
   *
   * Apuntar un gasto obligaba antes a recargar las seis tablas enteras: con
   * cientos de movimientos eso son cientos de kilobytes y un parpadeo en la
   * pantalla por cada toque. Ahora el servidor confirma la fila y se coloca
   * donde toca; la recarga completa queda para cuando de verdad hace falta.
   */
  const aplicar = useCallback((cambio: (s: Snapshot) => Snapshot) => {
    setDatos((previo) => cambio(previo))
  }, [])

  const porFecha = (a: Expense, b: Expense) =>
    (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.creadoEn.localeCompare(a.creadoEn))

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
      guardarSesion(sesion)
      const snap = await recargarCon(r)
      if (snap) await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
    },
    registrarse: async (email, password) => {
      const r = repo ?? (await getRepo())
      const haySesion = await r.registrarse(email, password)
      if (!haySesion) return false
      const sesion = await r.sesionActual()
      setUsuario(sesion)
      guardarSesion(sesion)
      const snap = await recargarCon(r)
      if (snap) await sembrarYGenerar(r, snap, recargarCon, generandoFijos)
      return true
    },
    salir: async () => {
      if (repo) await repo.salir()
      olvidarTodo()
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


    crearGasto: async (g) => {
      const r = repo ?? (await getRepo())
      try {
        const creados = await r.crearGastos([g])
        // Sin cobertura el repositorio lo encola y no devuelve nada: entonces
        // sí recargamos, porque la copia local ya incluye los pendientes.
        if (creados.length > 0) aplicar((s) => ({ ...s, gastos: [...creados, ...s.gastos].sort(porFecha) }))
        else await recargarCon(r)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No he podido guardar el gasto')
        throw e
      }
    },

    crearGastos: async (gs) => {
      const r = repo ?? (await getRepo())
      try {
        const creados = await r.crearGastos(gs)
        if (creados.length === gs.length) {
          aplicar((s) => ({ ...s, gastos: [...creados, ...s.gastos].sort(porFecha) }))
        } else {
          await recargarCon(r)
        }
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No he podido guardar los gastos')
        throw e
      }
    },

    actualizarGasto: async (g) => {
      const r = repo ?? (await getRepo())
      try {
        const nuevo = await r.actualizarGasto(g)
        aplicar((s) => ({
          ...s,
          gastos: s.gastos.map((x) => (x.id === nuevo.id ? nuevo : x)).sort(porFecha),
        }))
        setError(null)
      } catch (e) {
        setError(traducirSinConexion(e, 'editar un gasto'))
        throw e
      }
    },

    borrarGasto: async (id) => {
      const r = repo ?? (await getRepo())
      try {
        await r.borrarGasto(id)
        aplicar((s) => ({ ...s, gastos: s.gastos.filter((x) => x.id !== id) }))
        setError(null)
      } catch (e) {
        setError(traducirSinConexion(e, 'borrar un gasto'))
        throw e
      }
    },

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
  }), [cargando, error, usuario, repo, datos, accion, recargarCon, aplicar])

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

    if (tocaRevisarFijos(hoyISO())) {
      const creados = await generarFijos(repo, actual)
      marcarFijosRevisados(hoyISO())
      if (creados > 0) await recargar(repo)
    }
  } finally {
    cerrojo.current = false
  }
}


/**
 * Apuntar un gasto sin cobertura funciona (se encola). Editar o borrar no:
 * habría que decidir quién gana si el otro móvil tocó lo mismo, y eso genera
 * más problemas de los que resuelve. Mejor decirlo claro.
 */
function traducirSinConexion(e: unknown, accion: string): string {
  const m = e instanceof Error ? e.message : String(e)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return `Sin conexión no se puede ${accion}. Apuntar gastos nuevos sí funciona: se suben solos al volver la señal.`
  }
  return m
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
