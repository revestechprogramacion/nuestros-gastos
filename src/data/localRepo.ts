import { CATEGORIAS_INICIALES } from './seed'
import { nuevoId, type Repo } from './repo'
import type {
  Budget, Category, Expense, ImportRule, Recurring, SessionUser, Snapshot,
} from './types'

const CLAVE = 'nuestros-gastos:local:v1'
const CLAVE_SESION = 'nuestros-gastos:local:sesion'

interface Almacen extends Snapshot {
  tickets: Record<string, string> // path -> dataURL
}

/**
 * Modo local: todo vive en este navegador (localStorage). Sirve para probar la
 * app en el Mac antes de crear las cuentas de Supabase y Vercel. NO sincroniza
 * entre móviles — para eso está el modo nube.
 */
export class LocalRepo implements Repo {
  readonly modo = 'local' as const
  private oyentes = new Set<() => void>()

  private leer(): Almacen {
    const crudo = localStorage.getItem(CLAVE)
    if (crudo) {
      try { return JSON.parse(crudo) as Almacen } catch { /* datos corruptos, re-sembramos */ }
    }
    const inicial: Almacen = {
      miembros: [
        { id: 'demo-1', nombre: 'Miguel', email: 'miguel@ejemplo.com' },
        { id: 'demo-2', nombre: 'Mi mujer', email: null },
      ],
      categorias: CATEGORIAS_INICIALES.map((c) => ({ ...c, id: nuevoId() })),
      gastos: [],
      presupuestos: [],
      fijos: [],
      reglas: [],
      tickets: {},
    }
    this.escribir(inicial)
    return inicial
  }

  private escribir(a: Almacen) {
    localStorage.setItem(CLAVE, JSON.stringify(a))
  }

  private async mutar<T>(fn: (a: Almacen) => T): Promise<T> {
    const a = this.leer()
    const r = fn(a)
    this.escribir(a)
    this.oyentes.forEach((cb) => cb())
    return r
  }

  async sesionActual(): Promise<SessionUser | null> {
    const crudo = localStorage.getItem(CLAVE_SESION)
    return crudo ? (JSON.parse(crudo) as SessionUser) : null
  }

  async entrar(email: string): Promise<void> {
    const usuario: SessionUser = { id: 'demo-1', email, nombre: email.split('@')[0] || 'Yo' }
    localStorage.setItem(CLAVE_SESION, JSON.stringify(usuario))
  }

  async registrarse(email: string): Promise<boolean> {
    // En modo prueba no hay cuentas de verdad: entrar y registrarse es lo mismo.
    await this.entrar(email)
    return true
  }

  async salir(): Promise<void> {
    localStorage.removeItem(CLAVE_SESION)
  }

  async cargarTodo(): Promise<Snapshot> {
    const { tickets: _tickets, ...resto } = this.leer()
    return resto
  }

  escucharCambios(cb: () => void): () => void {
    this.oyentes.add(cb)
    return () => this.oyentes.delete(cb)
  }

  async crearGasto(g: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>): Promise<Expense> {
    const [creado] = await this.crearGastos([g])
    return creado
  }

  async crearGastos(gs: Omit<Expense, 'id' | 'creadoEn' | 'creadoPor'>[]): Promise<Expense[]> {
    const sesion = await this.sesionActual()
    const nuevos: Expense[] = gs.map((g) => ({
      ...g,
      id: nuevoId(),
      creadoEn: new Date().toISOString(),
      creadoPor: sesion?.id ?? null,
    }))
    return this.mutar((a) => { a.gastos.push(...nuevos); return nuevos })
  }

  async actualizarGasto(g: Expense): Promise<Expense> {
    return this.mutar((a) => {
      const i = a.gastos.findIndex((x) => x.id === g.id)
      if (i >= 0) a.gastos[i] = g
      return g
    })
  }

  async actualizarGastos(gs: Expense[]): Promise<void> {
    const porId = new Map(gs.map((g) => [g.id, g]))
    await this.mutar((a) => {
      a.gastos = a.gastos.map((g) => porId.get(g.id) ?? g)
    })
  }

  async borrarGasto(id: string): Promise<void> {
    await this.mutar((a) => { a.gastos = a.gastos.filter((x) => x.id !== id) })
  }

  async guardarCategoria(c: Omit<Category, 'id'> & { id?: string }): Promise<Category> {
    return this.mutar((a) => {
      if (c.id) {
        const i = a.categorias.findIndex((x) => x.id === c.id)
        const actualizada = { ...a.categorias[i], ...c } as Category
        a.categorias[i] = actualizada
        return actualizada
      }
      const nueva = { ...c, id: nuevoId() } as Category
      a.categorias.push(nueva)
      return nueva
    })
  }

  async borrarCategoria(id: string): Promise<void> {
    await this.mutar((a) => {
      a.categorias = a.categorias.filter((x) => x.id !== id)
      a.gastos = a.gastos.map((g) => (g.categoriaId === id ? { ...g, categoriaId: null } : g))
      a.presupuestos = a.presupuestos.filter((p) => p.categoriaId !== id)
      a.reglas = a.reglas.filter((r) => r.categoriaId !== id)
    })
  }

  async guardarPresupuesto(b: Budget): Promise<void> {
    await this.mutar((a) => {
      const i = a.presupuestos.findIndex((x) => x.categoriaId === b.categoriaId)
      if (i >= 0) a.presupuestos[i] = b
      else a.presupuestos.push(b)
    })
  }

  async guardarFijo(r: Omit<Recurring, 'id'> & { id?: string }): Promise<Recurring> {
    return this.mutar((a) => {
      if (r.id) {
        const i = a.fijos.findIndex((x) => x.id === r.id)
        const actualizado = { ...a.fijos[i], ...r } as Recurring
        a.fijos[i] = actualizado
        return actualizado
      }
      const nuevo = { ...r, id: nuevoId() } as Recurring
      a.fijos.push(nuevo)
      return nuevo
    })
  }

  async borrarFijo(id: string): Promise<void> {
    await this.mutar((a) => { a.fijos = a.fijos.filter((x) => x.id !== id) })
  }

  async guardarRegla(r: Omit<ImportRule, 'id'> & { id?: string }): Promise<void> {
    await this.mutar((a) => {
      const existente = a.reglas.find((x) => x.patron === r.patron)
      if (existente) {
        existente.categoriaId = r.categoriaId
        existente.aciertos += 1
      } else {
        a.reglas.push({ ...r, id: nuevoId() } as ImportRule)
      }
    })
  }

  async subirTicket(file: File): Promise<string> {
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = rej
      fr.readAsDataURL(file)
    })
    const path = `local/${nuevoId()}`
    await this.mutar((a) => { a.tickets[path] = dataUrl })
    return path
  }

  async urlTicket(path: string): Promise<string | null> {
    return this.leer().tickets[path] ?? null
  }

  async borrarTicket(path: string): Promise<void> {
    await this.mutar((a) => { delete a.tickets[path] })
  }
}
