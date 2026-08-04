import { supabase } from '../lib/supabase'
import type { Repo } from './repo'
import { marcarMiembro, yaEsMiembro } from './cache'
import type {
  Budget, Category, Expense, ImportRule, Recurring, SessionUser, Snapshot,
} from './types'

const BUCKET = 'casa-tickets'

/* --------------------------- Sin cobertura ---------------------------
   El súper del pueblo no tiene cobertura y la app tiene que seguir
   sirviendo. La receta es sencilla:

     · De cada carga guardamos una COPIA en el móvil. Si al abrir no hay
       internet, se muestra esa copia en vez de una pantalla en blanco.
     · Los gastos que apuntes sin conexión van a una COLA. En cuanto
       vuelve la señal se envían solos, en orden.

   Lo demás (editar, borrar, presupuestos) sí necesita conexión: son
   cosas que se hacen sentado en casa, no en la cola del súper.
--------------------------------------------------------------------- */

const CLAVE_COPIA = 'nuestros-gastos:copia'
const CLAVE_COLA = 'nuestros-gastos:cola'

type GastoNuevo = Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>

function esFalloDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const m = e instanceof Error ? e.message : String(e)
  return /failed to fetch|networkerror|load failed|network request failed|timeout/i.test(m)
}

function leerJson<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? (JSON.parse(crudo) as T) : null
  } catch {
    return null
  }
}

/** Filas tal y como vienen de Postgres (snake_case). */
interface FilaGasto {
  id: string; importe: number; categoria_id: string | null; fecha: string
  nota: string | null; ticket_path: string | null; origen: string
  creado_por: string | null; creado_en: string
}
interface FilaCategoria {
  id: string; nombre: string; icono: string; color: string; orden: number
  archivada: boolean; excluida_de_totales: boolean
}
interface FilaFijo {
  id: string; nombre: string; importe: number; categoria_id: string | null
  dia_del_mes: number; activo: boolean; ultimo_mes_generado: string | null
}
interface FilaRegla { id: string; patron: string; categoria_id: string; aciertos: number }
interface FilaPresupuesto { categoria_id: string; importe: number }
interface FilaMiembro { id: string; nombre: string; email: string | null }

function aGasto(f: FilaGasto): Expense {
  return {
    id: f.id,
    importe: f.importe,
    categoriaId: f.categoria_id,
    fecha: f.fecha,
    nota: f.nota,
    ticketPath: f.ticket_path,
    origen: f.origen as Expense['origen'],
    creadoPor: f.creado_por,
    creadoEn: f.creado_en,
  }
}

function deGasto(g: Partial<Expense>) {
  return {
    ...(g.id !== undefined && { id: g.id }),
    ...(g.importe !== undefined && { importe: g.importe }),
    ...(g.categoriaId !== undefined && { categoria_id: g.categoriaId }),
    ...(g.fecha !== undefined && { fecha: g.fecha }),
    ...(g.nota !== undefined && { nota: g.nota }),
    ...(g.ticketPath !== undefined && { ticket_path: g.ticketPath }),
    ...(g.origen !== undefined && { origen: g.origen }),
  }
}

function fallar(error: { message: string } | null, contexto: string): void {
  if (error) throw new Error(`${contexto}: ${error.message}`)
}

export class SupabaseRepo implements Repo {
  readonly modo = 'nube' as const

  /** Avisos para que la app se entere de que hay cambios pendientes. */
  private oyentes = new Set<() => void>()

  constructor() {
    // Al recuperar la señal, vaciamos la cola sin que nadie haga nada.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.vaciarCola().catch(() => { /* se reintenta la próxima vez */ })
      })
    }
  }

  /** Gastos apuntados sin cobertura, esperando a que vuelva. */
  private cola(): GastoNuevo[] {
    return leerJson<GastoNuevo[]>(CLAVE_COLA) ?? []
  }

  private guardarCola(gs: GastoNuevo[]): void {
    if (gs.length === 0) localStorage.removeItem(CLAVE_COLA)
    else localStorage.setItem(CLAVE_COLA, JSON.stringify(gs))
  }

  hayPendientes(): number {
    return this.cola().length
  }

  /** Envía lo que quedó pendiente. Si sigue sin haber red, lo deja para luego. */
  async vaciarCola(): Promise<number> {
    const pendientes = this.cola()
    if (pendientes.length === 0) return 0
    try {
      const { error } = await supabase.from('casa_gastos').insert(pendientes.map(deGasto))
      if (error) throw new Error(error.message)
      this.guardarCola([])
      this.oyentes.forEach((cb) => cb())
      return pendientes.length
    } catch (e) {
      if (esFalloDeRed(e)) return 0
      throw e
    }
  }

  async sesionActual(): Promise<SessionUser | null> {
    const { data } = await supabase.auth.getSession()
    const u = data.session?.user
    if (!u) return null

    await this.asegurarMiembro(u.id)

    // El nombre bonito llega en la carga general; aquí basta con el del
    // correo para no encadenar otra consulta antes de pintar nada.
    return {
      id: u.id,
      email: u.email ?? null,
      nombre: u.email?.split('@')[0] ?? 'Yo',
    }
  }

  /**
   * Te apunta en la casa la primera vez que entras.
   *
   * Este proyecto de Supabase lo comparte otra aplicación, así que aquí no
   * hay ningún disparador sobre los usuarios: es la app la que pide entrar,
   * y la base de datos solo deja pasar a dos personas. Quien use la otra app
   * nunca llega a llamar a esto, y aunque llamara, con la casa llena se
   * queda fuera y no ve un solo dato.
   */
  private async asegurarMiembro(idUsuario?: string): Promise<void> {
    // Entrar en el hogar es cosa de una vez. Repetirlo en cada arranque era
    // un viaje a la red para que te contestaran "ya estabas dentro".
    if (idUsuario && yaEsMiembro(idUsuario)) return

    const { error } = await supabase.rpc('casa_entrar', { nombre_visible: null })
    if (!error) {
      if (idUsuario) marcarMiembro(idUsuario)
      return
    }

    // "La casa ya tiene sus dos miembros" no es un fallo que deba romper la
    // app: simplemente este usuario no es de la casa y no verá nada.
    if (/dos miembros/i.test(error.message)) return
    throw new Error(traducirErrorAuth(error.message))
  }

  async entrar(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(traducirErrorAuth(error.message))
    await this.asegurarMiembro()
  }

  async registrarse(email: string, password: string): Promise<boolean> {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(traducirErrorAuth(error.message))

    // Si el proyecto exige confirmar el email, no hay sesión todavía.
    if (!data.session) return false

    await this.asegurarMiembro()
    return true
  }

  async salir(): Promise<void> {
    await supabase.auth.signOut()
  }

  async cargarTodo(): Promise<Snapshot> {
    try {
      const snap = await this.cargarDeLaNube()
      localStorage.setItem(CLAVE_COPIA, JSON.stringify(snap))
      // Lo apuntado sin cobertura se ve ya, aunque aún no haya subido.
      return this.conPendientes(snap)
    } catch (e) {
      const copia = leerJson<Snapshot>(CLAVE_COPIA)
      if (esFalloDeRed(e) && copia) return this.conPendientes(copia)
      throw e
    }
  }

  /** Los que aún no han subido llevan este prefijo en el identificador. */
  static esPendiente = (id: string) => id.startsWith('pendiente-')

  /** Mete en la lista los gastos que están esperando a subir. */
  private conPendientes(snap: Snapshot): Snapshot {
    const pendientes = this.cola()
    if (pendientes.length === 0) return snap
    return {
      ...snap,
      gastos: [
        ...pendientes.map((g, i) => ({
          ...g,
          id: `pendiente-${i}`,
          creadoPor: null,
          creadoEn: new Date().toISOString(),
        })),
        ...snap.gastos,
      ],
    }
  }

  private async cargarDeLaNube(): Promise<Snapshot> {
    const [miembros, categorias, gastos, presupuestos, fijos, reglas] = await Promise.all([
      supabase.from('casa_miembros').select('id,nombre,email'),
      supabase.from('casa_categorias').select('*').order('orden'),
      supabase.from('casa_gastos').select('*').order('fecha', { ascending: false }),
      supabase.from('casa_presupuestos').select('categoria_id,importe'),
      supabase.from('casa_fijos').select('*').order('dia_del_mes'),
      supabase.from('casa_reglas_import').select('*'),
    ])
    fallar(miembros.error, 'Cargando miembros')
    fallar(categorias.error, 'Cargando categorías')
    fallar(gastos.error, 'Cargando gastos')
    fallar(presupuestos.error, 'Cargando presupuestos')
    fallar(fijos.error, 'Cargando gastos fijos')
    fallar(reglas.error, 'Cargando reglas')

    return {
      miembros: (miembros.data ?? []) as FilaMiembro[],
      categorias: ((categorias.data ?? []) as FilaCategoria[]).map((c) => ({
        id: c.id,
        nombre: c.nombre,
        icono: c.icono,
        color: c.color,
        orden: c.orden,
        archivada: c.archivada,
        excluidaDeTotales: c.excluida_de_totales ?? false,
      })),
      gastos: ((gastos.data ?? []) as FilaGasto[]).map(aGasto),
      presupuestos: ((presupuestos.data ?? []) as FilaPresupuesto[])
        .map((p) => ({ categoriaId: p.categoria_id, importe: p.importe })),
      fijos: ((fijos.data ?? []) as FilaFijo[]).map((f) => ({
        id: f.id,
        nombre: f.nombre,
        importe: f.importe,
        categoriaId: f.categoria_id,
        diaDelMes: f.dia_del_mes,
        activo: f.activo,
        ultimoMesGenerado: f.ultimo_mes_generado,
      })),
      reglas: ((reglas.data ?? []) as FilaRegla[]).map((r) => ({
        id: r.id, patron: r.patron, categoriaId: r.categoria_id, aciertos: r.aciertos,
      })),
    }
  }

  escucharCambios(cb: () => void): () => void {
    this.oyentes.add(cb)
    // Por si la app se abre ya con señal y quedaba algo pendiente de ayer.
    void this.vaciarCola().then((n) => { if (n > 0) cb() })

    const canal = supabase
      .channel('cambios-hogar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casa_gastos' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casa_categorias' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casa_presupuestos' }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'casa_fijos' }, cb)
      .subscribe()
    return () => {
      this.oyentes.delete(cb)
      void supabase.removeChannel(canal)
    }
  }

  async crearGasto(g: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>): Promise<Expense | null> {
    const [creado] = await this.crearGastos([g])
    // Sin cobertura se queda en la cola y todavía no tiene identificador:
    // devolver null lo dice claro en vez de un `undefined` a traición.
    return creado ?? null
  }

  async crearGastos(gs: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>[]): Promise<Expense[]> {
    if (gs.length === 0) return []
    try {
      const { data, error } = await supabase.from('casa_gastos').insert(gs.map(deGasto)).select()
      if (error) throw new Error(error.message)
      return ((data ?? []) as FilaGasto[]).map(aGasto)
    } catch (e) {
      // Sin cobertura: a la cola. Se sube solo en cuanto vuelva la señal.
      if (!esFalloDeRed(e)) throw new Error(`Guardando el gasto: ${
        e instanceof Error ? e.message : String(e)}`)
      this.guardarCola([...this.cola(), ...gs])
      return []
    }
  }

  async actualizarGasto(g: Expense): Promise<Expense> {
    const { data, error } = await supabase
      .from('casa_gastos').update(deGasto(g)).eq('id', g.id).select().single()
    fallar(error, 'Actualizando el gasto')
    return aGasto(data as FilaGasto)
  }

  async actualizarGastos(gs: Expense[]): Promise<void> {
    if (gs.length === 0) return
    // En tandas: un upsert de cientos de filas puede pasarse del límite de la
    // petición y fallar entero.
    for (let i = 0; i < gs.length; i += 200) {
      const tanda = gs.slice(i, i + 200).map((g) => ({ id: g.id, ...deGasto(g) }))
      const { error } = await supabase.from('casa_gastos').upsert(tanda)
      fallar(error, 'Actualizando los gastos')
    }
  }

  async borrarGasto(id: string): Promise<void> {
    const { error } = await supabase.from('casa_gastos').delete().eq('id', id)
    fallar(error, 'Borrando el gasto')
  }

  async guardarCategoria(c: Omit<Category, 'id'> & { id?: string }): Promise<Category> {
    const fila = {
      ...(c.id && { id: c.id }),
      nombre: c.nombre, icono: c.icono, color: c.color,
      orden: c.orden, archivada: c.archivada,
      excluida_de_totales: c.excluidaDeTotales,
    }
    const { data, error } = await supabase
      .from('casa_categorias').upsert(fila).select().single()
    fallar(error, 'Guardando la categoría')
    const f = data as FilaCategoria
    return {
      id: f.id, nombre: f.nombre, icono: f.icono, color: f.color,
      orden: f.orden, archivada: f.archivada,
      excluidaDeTotales: f.excluida_de_totales ?? false,
    }
  }

  async borrarCategoria(id: string): Promise<void> {
    const { error } = await supabase.from('casa_categorias').delete().eq('id', id)
    fallar(error, 'Borrando la categoría')
  }

  async guardarPresupuesto(b: Budget): Promise<void> {
    const { error } = await supabase.from('casa_presupuestos')
      .upsert({ categoria_id: b.categoriaId, importe: b.importe }, { onConflict: 'categoria_id' })
    fallar(error, 'Guardando el presupuesto')
  }

  async guardarFijo(r: Omit<Recurring, 'id'> & { id?: string }): Promise<Recurring> {
    const fila = {
      ...(r.id && { id: r.id }),
      nombre: r.nombre, importe: r.importe, categoria_id: r.categoriaId,
      dia_del_mes: r.diaDelMes, activo: r.activo, ultimo_mes_generado: r.ultimoMesGenerado,
    }
    const { data, error } = await supabase.from('casa_fijos').upsert(fila).select().single()
    fallar(error, 'Guardando el gasto fijo')
    const f = data as FilaFijo
    return {
      id: f.id, nombre: f.nombre, importe: f.importe, categoriaId: f.categoria_id,
      diaDelMes: f.dia_del_mes, activo: f.activo, ultimoMesGenerado: f.ultimo_mes_generado,
    }
  }

  async borrarFijo(id: string): Promise<void> {
    const { error } = await supabase.from('casa_fijos').delete().eq('id', id)
    fallar(error, 'Borrando el gasto fijo')
  }

  async guardarRegla(r: Omit<ImportRule, 'id'> & { id?: string }): Promise<void> {
    const { error } = await supabase.from('casa_reglas_import').upsert(
      { patron: r.patron, categoria_id: r.categoriaId, aciertos: r.aciertos },
      { onConflict: 'hogar_id,patron' },
    )
    fallar(error, 'Guardando la regla')
  }

  async subirTicket(file: File): Promise<string> {
    const { data: userData } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userData.user?.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    fallar(error, 'Subiendo la foto del ticket')
    return path
  }

  async urlTicket(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
    if (error) return null
    return data.signedUrl
  }

  async borrarTicket(path: string): Promise<void> {
    await supabase.storage.from(BUCKET).remove([path])
  }
}

function traducirErrorAuth(mensaje: string): string {
  if (/casa_entrar|function .* does not exist/i.test(mensaje)) {
    return 'La base de datos aún no está preparada. Falta ejecutar el archivo '
      + 'supabase/esquema.sql en el SQL Editor de Supabase.'
  }
  if (/invalid login credentials/i.test(mensaje)) return 'Email o contraseña incorrectos.'
  if (/email not confirmed/i.test(mensaje)) return 'Tienes que confirmar el email primero. Mira tu bandeja de entrada.'
  if (/rate limit/i.test(mensaje)) return 'Demasiados intentos. Espera un minuto y vuelve a probar.'
  return mensaje
}
