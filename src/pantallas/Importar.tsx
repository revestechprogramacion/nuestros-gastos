import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTienda } from '../estado/Tienda'
import { leerCsvBanco, leerFilas, type ResultadoLectura } from '../lib/csv'
import { leerXlsx } from '../lib/xlsx'
import { patronDesdeConcepto, sugerirCategoria } from '../lib/categorizar'
import { euros } from '../lib/format'
import { diasEntre, etiquetaFecha } from '../lib/fechas'
import { Hoja } from '../componentes/Hoja'
import { SelectorCategoria } from '../componentes/SelectorCategoria'
import { IconoAtras } from '../componentes/Iconos'

interface Candidato {
  fecha: string
  concepto: string
  importe: number
  categoriaId: string | null
  /** El usuario la ha cambiado a mano: se guardará como regla para la próxima vez. */
  corregida: boolean
  incluir: boolean
  duplicado: boolean
}

export function Importar() {
  const t = useTienda()
  const navegar = useNavigate()
  const inputArchivo = useRef<HTMLInputElement>(null)

  const [lectura, setLectura] = useState<ResultadoLectura | null>(null)
  const [candidatos, setCandidatos] = useState<Candidato[]>([])
  const [error, setError] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [hecho, setHecho] = useState<number | null>(null)
  const [editandoIndice, setEditandoIndice] = useState<number | null>(null)

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setHecho(null)
    try {
      const res = esExcel(file)
        ? leerFilas(await leerXlsx(file))
        : leerCsvBanco(await leerComoTexto(file))
      if (res.movimientos.length === 0) {
        throw new Error('No he encontrado ningún gasto en el archivo (solo ingresos o filas vacías).')
      }
      setLectura(res)
      setCandidatos(res.movimientos.map((m) => {
        const sug = sugerirCategoria(m.concepto, t.datos.categorias, t.datos.reglas)
        // Mismo importe y fecha parecida. El margen de días es lo que evita
        // contar dos veces un gasto fijo: la app lo apuntó el día que tocaba y
        // el banco lo carga uno o dos días después.
        const duplicado = t.datos.gastos.some(
          (g) => g.importe === m.importe && diasEntre(g.fecha, m.fecha) <= 4,
        )
        return {
          ...m,
          categoriaId: sug.categoriaId,
          corregida: false,
          incluir: !duplicado,
          duplicado,
        }
      }))
    } catch (err) {
      setLectura(null)
      setCandidatos([])
      setError(err instanceof Error ? err.message : 'No he podido leer el archivo')
    } finally {
      if (inputArchivo.current) inputArchivo.current.value = ''
    }
  }

  const aImportar = candidatos.filter((c) => c.incluir)
  const totalImportar = aImportar.reduce((s, c) => s + c.importe, 0)
  const numDuplicados = candidatos.filter((c) => c.duplicado).length
  const sinCategoria = aImportar.filter((c) => c.categoriaId === null).length

  async function importar() {
    setImportando(true)
    setError(null)
    try {
      // Primero aprendemos de las categorías que has corregido a mano.
      for (const c of candidatos.filter((x) => x.corregida && x.categoriaId && x.incluir)) {
        const patron = patronDesdeConcepto(c.concepto)
        if (patron.length >= 3) {
          await t.guardarRegla({ patron, categoriaId: c.categoriaId!, aciertos: 1 })
        }
      }

      await t.crearGastos(aImportar.map((c) => ({
        importe: c.importe,
        categoriaId: c.categoriaId,
        fecha: c.fecha,
        nota: c.concepto.slice(0, 120),
        ticketPath: null,
        origen: 'csv' as const,
      })))

      setHecho(aImportar.length)
      setLectura(null)
      setCandidatos([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido importar los gastos')
    } finally {
      setImportando(false)
    }
  }

  function cambiarCategoria(indice: number, categoriaId: string) {
    setCandidatos((prev) => prev.map((c, i) =>
      i === indice ? { ...c, categoriaId, corregida: true } : c))
    setEditandoIndice(null)
  }

  return (
    <>
      <div className="cabecera">
        <button className="boton--texto fila-flex" onClick={() => navegar('/ajustes')}>
          <IconoAtras /> Ajustes
        </button>
        <h1 className="cabecera__titulo">Importar</h1>
        <span className="cabecera__hueco" />
      </div>

      {error && <div className="aviso">{error}</div>}

      {hecho !== null && (
        <div className="tarjeta centrado">
          <span className="vacio__emoji">✅</span>
          <p><strong>{hecho} {hecho === 1 ? 'gasto importado' : 'gastos importados'}</strong></p>
          <button className="boton" style={{ marginTop: 14 }} onClick={() => navegar('/')}>
            Ver el resumen
          </button>
        </div>
      )}

      {!lectura && hecho === null && (
        <>
          <div className="nota-info">
            <strong>Cómo se hace:</strong> entra en la web de tu banco, ve a los movimientos
            de la cuenta y busca «Exportar» o «Descargar». Vale tanto{' '}
            <strong>Excel (.xlsx)</strong> como <strong>CSV</strong>. Luego sube aquí
            ese archivo.
          </div>
          <p className="peque suave" style={{ margin: '0 4px 16px' }}>
            Solo se importan los cargos: los ingresos y las nóminas se ignoran.
            Antes de guardar nada verás la lista y podrás corregir categorías o quitar líneas.
          </p>
          <button className="boton" onClick={() => inputArchivo.current?.click()}>
            Elegir archivo
          </button>
          <input
            ref={inputArchivo}
            type="file"
            accept=".csv,.txt,.xlsx,.xlsm,.xls,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={elegirArchivo}
            style={{ display: 'none' }}
          />
        </>
      )}

      {lectura && (
        <>
          <div className="tarjeta">
            <div className="entre">
              <span className="peque suave">A importar</span>
              <span className="cifra" style={{ fontWeight: 700 }}>{euros(totalImportar)}</span>
            </div>
            <p className="peque suave" style={{ marginTop: 6 }}>
              {aImportar.length} de {candidatos.length} líneas
              {numDuplicados > 0 && ` · ${numDuplicados} parecen repetidas (desmarcadas)`}
              {lectura.ingresosIgnorados > 0 && ` · ${lectura.ingresosIgnorados} ingresos ignorados`}
            </p>
            <p className="peque tenue" style={{ marginTop: 4 }}>
              Columnas detectadas: {lectura.columnas.fecha} · {lectura.columnas.concepto} · {lectura.columnas.importe}
            </p>
            {sinCategoria > 0 && (
              <p className="peque" style={{ marginTop: 8, color: 'var(--aviso)' }}>
                {sinCategoria} sin categoría. Tócalas para asignarla: la app lo recordará
                para las próximas importaciones.
              </p>
            )}
          </div>

          <div className="lista">
            {candidatos.map((c, i) => {
              const cat = t.categoriaPorId(c.categoriaId)
              return (
                <div key={`${c.fecha}-${i}`} className="fila">
                  <button
                    onClick={() => setCandidatos((prev) => prev.map((x, j) =>
                      j === i ? { ...x, incluir: !x.incluir } : x))}
                    aria-label={c.incluir ? 'Quitar de la importación' : 'Incluir en la importación'}
                    style={{ fontSize: 20, width: 28, flexShrink: 0 }}
                  >
                    {c.incluir ? '☑️' : '⬜️'}
                  </button>
                  <button className="fila__principal" onClick={() => setEditandoIndice(i)}
                    style={{ opacity: c.incluir ? 1 : .45, textAlign: 'left' }}>
                    <span className="fila__titulo" style={{ display: 'block' }}>{c.concepto}</span>
                    <span className="fila__sub">
                      {etiquetaFecha(c.fecha)} ·{' '}
                      {cat ? `${cat.icono} ${cat.nombre}` : 'sin categoría — tócalo para elegirla'}
                      {c.duplicado && ' · ya existe'}
                    </span>
                  </button>
                  <span className="fila__importe cifra" style={{ opacity: c.incluir ? 1 : .45 }}>
                    {euros(c.importe)}
                  </span>
                </div>
              )
            })}
          </div>

          <button className="boton" onClick={importar}
            disabled={importando || aImportar.length === 0}>
            {importando ? 'Importando…' : `Importar ${aImportar.length} gastos`}
          </button>
          <button className="boton boton--secundario" style={{ marginTop: 8 }}
            onClick={() => { setLectura(null); setCandidatos([]) }}>
            Cancelar
          </button>
        </>
      )}

      <Hoja
        abierta={editandoIndice !== null}
        titulo="Elegir categoría"
        onCerrar={() => setEditandoIndice(null)}
      >
        {editandoIndice !== null && (
          <>
            <p className="peque suave" style={{ marginBottom: 14 }}>
              {candidatos[editandoIndice]?.concepto}
            </p>
            <SelectorCategoria
              categorias={t.datos.categorias}
              seleccionada={candidatos[editandoIndice]?.categoriaId ?? null}
              onSeleccionar={(id) => cambiarCategoria(editandoIndice, id)}
            />
            <p className="peque tenue" style={{ marginTop: 16 }}>
              A partir de ahora la app asignará esta categoría sola a los movimientos parecidos.
            </p>
          </>
        )}
      </Hoja>
    </>
  )
}

function esExcel(file: File): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name)
    || file.type.includes('spreadsheet')
    || file.type.includes('excel')
}

/** Los bancos españoles exportan a veces en Windows-1252 en vez de UTF-8. */
async function leerComoTexto(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  // El carácter de reemplazo delata una codificación equivocada.
  if (utf8.includes('�')) {
    return new TextDecoder('windows-1252').decode(buffer)
  }
  return utf8
}
