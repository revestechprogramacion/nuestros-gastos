import { useMemo, useState } from 'react'
import { Hoja } from './Hoja'
import { useTienda } from '../estado/Tienda'
import { detectarFijos, type CandidatoFijo } from '../lib/periodicos'
import { euros, normalizar } from '../lib/format'

interface Props {
  abierta: boolean
  onCerrar: () => void
}

/**
 * Propone convertir en gastos fijos lo que ya se repite en el histórico del
 * banco. Nada se crea sin que lo confirmes: la lista sale marcada, pero se
 * puede desmarcar lo que no toque.
 */
export function DetectarFijos({ abierta, onCerrar }: Props) {
  const t = useTienda()
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [creando, setCreando] = useState(false)
  const [hecho, setHecho] = useState<number | null>(null)
  const [clave, setClave] = useState('')

  const { candidatos, variables } = useMemo(() => {
    if (!abierta) return { candidatos: [], variables: [] }
    const yaExisten = new Set(t.datos.fijos.map((f) => normalizar(f.nombre)))
    const { fijos, variables } = detectarFijos(t.datos.gastos)
    return {
      candidatos: fijos.filter((c) => !yaExisten.has(normalizar(c.nombre))),
      variables,
    }
  }, [abierta, t.datos.gastos, t.datos.fijos])

  // Al abrir, todo marcado.
  const claveActual = `${abierta}-${candidatos.length}`
  if (clave !== claveActual) {
    setClave(claveActual)
    setMarcados(new Set(candidatos.map((c) => c.nombre)))
    setHecho(null)
  }

  const seleccionados = candidatos.filter((c) => marcados.has(c.nombre))
  const totalMes = seleccionados.reduce((s, c) => s + c.importe, 0)

  function alternar(nombre: string) {
    setMarcados((prev) => {
      const s = new Set(prev)
      if (s.has(nombre)) s.delete(nombre)
      else s.add(nombre)
      return s
    })
  }

  async function crear() {
    setCreando(true)
    try {
      for (const c of seleccionados) {
        await t.guardarFijo({
          nombre: c.nombre,
          importe: c.importe,
          categoriaId: c.categoriaId,
          diaDelMes: c.diaDelMes,
          activo: true,
          // Ya existen hasta este mes en el histórico: que empiece por el siguiente.
          ultimoMesGenerado: c.ultimoMes,
        })
      }
      setHecho(seleccionados.length)
    } finally {
      setCreando(false)
    }
  }

  return (
    <Hoja abierta={abierta} titulo="Gastos fijos detectados" onCerrar={onCerrar}>
      {hecho !== null ? (
        <div className="centrado">
          <span className="vacio__emoji">✅</span>
          <p><strong>{hecho} gastos fijos creados</strong></p>
          <p className="peque suave" style={{ marginTop: 8 }}>
            A partir del mes que viene se apuntarán solos el día que les toca.
            El histórico que ya importaste se queda como está.
          </p>
          <button className="boton" style={{ marginTop: 16 }} onClick={onCerrar}>Listo</button>
        </div>
      ) : candidatos.length === 0 ? (
        <div className="vacio">
          <span className="vacio__emoji">🔍</span>
          <p><strong>No he encontrado nada nuevo</strong></p>
          <p className="peque" style={{ marginTop: 6 }}>
            Necesito ver un movimiento repetido en la mayoría de los últimos
            seis meses. Importa más histórico del banco y vuelve a probar.
          </p>
        </div>
      ) : (
        <>
          <div className="nota-info">
            Esto se paga todos los meses <strong>y siempre por el mismo
            importe</strong>, así que la app puede darlo por hecho y apuntarlo
            sola el día que toca.
          </div>

          {variables.length > 0 && (
            <p className="peque tenue" style={{ margin: '0 4px 14px' }}>
              He dejado fuera {variables.length} recibos que cambian de importe
              cada mes ({variables.slice(0, 3).map((v) => v.nombre.toLowerCase()).join(', ')}).
              Esos es mejor que lleguen del banco con su cifra real: apuntarlos
              por adelantado con un importe inventado descuadraría el mes.
            </p>
          )}

          {candidatos.map((c) => (
            <FilaCandidato
              key={c.nombre}
              candidato={c}
              marcado={marcados.has(c.nombre)}
              onAlternar={() => alternar(c.nombre)}
              nombreCategoria={t.categoriaPorId(c.categoriaId)?.nombre ?? 'Sin categoría'}
              iconoCategoria={t.categoriaPorId(c.categoriaId)?.icono ?? '❓'}
              colorCategoria={t.categoriaPorId(c.categoriaId)?.color ?? '#888'}
            />
          ))}

          <div className="entre" style={{ padding: '10px 4px' }}>
            <span className="peque suave">{seleccionados.length} seleccionados</span>
            <span className="cifra" style={{ fontWeight: 700 }}>{euros(totalMes)}/mes</span>
          </div>

          <button className="boton" onClick={crear} disabled={creando || seleccionados.length === 0}>
            {creando ? 'Creando…' : `Crear ${seleccionados.length} gastos fijos`}
          </button>
        </>
      )}
    </Hoja>
  )
}

function FilaCandidato({ candidato: c, marcado, onAlternar, nombreCategoria, iconoCategoria, colorCategoria }: {
  candidato: CandidatoFijo
  marcado: boolean
  onAlternar: () => void
  nombreCategoria: string
  iconoCategoria: string
  colorCategoria: string
}) {
  const varia = c.importeMax - c.importeMin > c.importe * 0.05

  return (
    <button
      className="fila"
      onClick={onAlternar}
      aria-pressed={marcado}
      aria-label={`${c.nombre}, ${euros(c.importe)}, día ${c.diaDelMes}`}
      style={{ borderRadius: 12, marginBottom: 8, opacity: marcado ? 1 : .5 }}
    >
      <span style={{ fontSize: 20, width: 28, flexShrink: 0 }} aria-hidden>
        {marcado ? '☑️' : '⬜️'}
      </span>
      <span className="icono icono--s"
        style={{ background: `color-mix(in srgb, ${colorCategoria} 22%, var(--tarjeta))` }}
        aria-hidden>{iconoCategoria}</span>
      <span className="fila__principal">
        {/* Sin recortar: el importe del final es lo que distingue dos recibos
            que comparten concepto (los dos préstamos). */}
        <span className="fila__titulo" style={{ whiteSpace: 'normal', overflow: 'visible' }}>
          {c.nombre}
        </span>
        <span className="fila__sub">
          Día {c.diaDelMes} · {nombreCategoria} · {c.meses} de {c.mesesAnalizados} meses
          {varia && ` · varía ${euros(c.importeMin)}–${euros(c.importeMax)}`}
        </span>
      </span>
      <span className="fila__importe cifra">{euros(c.importe)}</span>
    </button>
  )
}
