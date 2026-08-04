import { useState } from 'react'
import { useTienda } from '../estado/Tienda'

export function Entrar() {
  const t = useTienda()
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const esLocal = t.modo === 'local'
  const creando = modo === 'crear'

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      if (creando) {
        const dentro = await t.registrarse(email.trim(), password)
        if (!dentro) {
          setAviso(
            'Cuenta creada. Te hemos mandado un correo para confirmarla: '
            + 'ábrelo, pincha el enlace y vuelve aquí a entrar.',
          )
          setModo('entrar')
          setOcupado(false)
        }
      } else {
        await t.entrar(email.trim(), password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido continuar')
      setOcupado(false)
    }
  }

  return (
    <form className="entrar" onSubmit={enviar}>
      <div className="entrar__marca">
        <span className="entrar__logo" aria-hidden />
        <h1>Nuestros Gastos</h1>
        <p className="suave peque" style={{ marginTop: 6 }}>
          {esLocal ? 'Modo de prueba en este dispositivo' : 'La cuenta de casa, en el móvil'}
        </p>
      </div>

      {error && <div className="aviso">{error}</div>}
      {aviso && <div className="nota-info">{aviso}</div>}

      {esLocal && (
        <div className="nota-info">
          Aún no está conectada la nube. Escribe cualquier email para probar la app:
          los datos se guardan solo en este navegador.
        </div>
      )}

      <div className="campo">
        <label className="campo__etiqueta" htmlFor="email">Email</label>
        <input id="email" type="email" value={email} required autoComplete="username"
          autoCapitalize="none" placeholder="tu@email.com"
          onChange={(e) => setEmail(e.target.value)} />
      </div>

      {!esLocal && (
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            required
            minLength={6}
            autoComplete={creando ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
          {creando && (
            <p className="peque tenue" style={{ marginTop: 6 }}>
              Mínimo 6 caracteres. Guárdala en el llavero cuando te lo ofrezca.
            </p>
          )}
        </div>
      )}

      <button className="boton" type="submit" disabled={ocupado || !email.trim()}
        style={{ marginTop: 8 }}>
        {ocupado ? 'Un momento…' : creando ? 'Crear mi cuenta' : 'Entrar'}
      </button>

      {!esLocal && (
        <button
          type="button"
          className="boton--texto"
          style={{ margin: '18px auto 0', display: 'block' }}
          onClick={() => { setModo(creando ? 'entrar' : 'crear'); setError(null) }}
        >
          {creando ? 'Ya tengo cuenta, quiero entrar' : 'Es la primera vez: crear mi cuenta'}
        </button>
      )}
    </form>
  )
}
