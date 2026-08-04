import { describe, expect, it } from 'vitest'
import { coincide, distancia, prepararTexto, puntuar, singular } from '../buscar'

/** Un gasto real del extracto, tal y como se indexa. */
const MERCADONA = prepararTexto([
  'COMPRA TARJETA MERCADONA ALICANTE', 'Mercadona Alicante', 'Súper', '62,45',
])
const IBERDROLA = prepararTexto([
  'ELECTRICIDAD IBERDROLA CLIENTES,SA', 'Electricidad Iberdrola', 'Luz, agua, gas', '440,29',
])
const SANITAS = prepararTexto([
  'ADEUDO RECIBO SANITAS S A DE SEGUROS', 'Sanitas', 'Salud', '208,19',
])

describe('la búsqueda encuentra lo que buscas', () => {
  const casos: [string, string, string][] = [
    ['tal cual', 'mercadona', MERCADONA],
    ['a medias', 'merca', MERCADONA],
    ['sin tildes', 'telefonica', prepararTexto(['Telefónica', 'Teléfono e internet'])],
    ['en mayúsculas', 'MERCADONA', MERCADONA],
    ['por la categoría', 'super', MERCADONA],
    ['por el importe', '62,45', MERCADONA],
    ['por el importe sin coma', '6245', MERCADONA],
    ['por el nombre limpio', 'sanitas', SANITAS],
    ['por el texto original del banco', 'adeudo', SANITAS],
    ['sinónimo: luz → electricidad', 'luz', IBERDROLA],
    ['sinónimo: recibo médico', 'medico', SANITAS],
    ['plural: seguros → seguro', 'seguros', SANITAS],
    ['errata de una letra', 'mercadonna', MERCADONA],
    ['errata de dos letras', 'iberdrolla', IBERDROLA],
    ['le falta una letra', 'mercadna', MERCADONA],
    ['dos palabras a la vez', 'merca alicante', MERCADONA],
  ]

  for (const [nombre, consulta, texto] of casos) {
    it(nombre, () => {
      expect(coincide(consulta, texto)).toBe(true)
    })
  }
})

describe('la búsqueda no trae lo que no es', () => {
  it('una palabra que no aparece descarta el gasto', () => {
    expect(coincide('gasolina', MERCADONA)).toBe(false)
    expect(coincide('mercadona madrid', MERCADONA)).toBe(false)
  })

  it('tienen que estar TODAS las palabras', () => {
    expect(coincide('mercadona gasolina', MERCADONA)).toBe(false)
  })

  it('una consulta vacía no filtra nada', () => {
    expect(coincide('', MERCADONA)).toBe(true)
    expect(coincide('   ', MERCADONA)).toBe(true)
  })

  it('no confunde palabras cortas parecidas', () => {
    // Con tres letras no se perdona ninguna errata: 'luz' no es 'paz'.
    expect(coincide('paz', prepararTexto(['LUZ']))).toBe(false)
  })
})

describe('el orden de los resultados', () => {
  it('la coincidencia exacta puntúa más que la aproximada', () => {
    expect(puntuar('mercadona', MERCADONA)).toBeGreaterThan(puntuar('mercadonna', MERCADONA))
  })

  it('el principio de la palabra puntúa más que el medio', () => {
    const texto = prepararTexto(['Mercadona', 'Supermercado'])
    expect(puntuar('merca', texto)).toBeGreaterThan(puntuar('cado', texto))
  })

  it('lo literal puntúa más que el sinónimo', () => {
    expect(puntuar('iberdrola', IBERDROLA)).toBeGreaterThan(puntuar('luz', IBERDROLA))
  })
})

describe('piezas sueltas', () => {
  it('singular', () => {
    expect(singular('seguros')).toBe('seguro')
    expect(singular('luces')).toBe('luz')
    expect(singular('coches')).toBe('coche')
    expect(singular('mes')).toBe('mes')
  })

  it('distancia entre palabras, con tope', () => {
    expect(distancia('casa', 'casa', 2)).toBe(0)
    expect(distancia('casa', 'caso', 2)).toBe(1)
    expect(distancia('casa', 'coche', 2)).toBeGreaterThan(2)
  })

  it('escribir n donde va ñ también encuentra', () => {
    // Nadie se pelea con la ñ en el buscador del móvil: "pena" tiene que
    // sacar "PEÑA". La ñ se conserva en los datos, pero al buscar se perdona.
    expect(coincide('pena', prepararTexto(['PEÑA MARKET']))).toBe(true)
  })
})

describe('días sin apuntar', () => {
  it('cuenta desde el último gasto', async () => {
    const { diasSinApuntar } = await import('../avisos')
    expect(diasSinApuntar(['2026-08-01', '2026-07-20'], '2026-08-04')).toBe(3)
    expect(diasSinApuntar(['2026-08-04'], '2026-08-04')).toBe(0)
    expect(diasSinApuntar([], '2026-08-04')).toBeNull()
  })

  it('no se despista con el cambio de hora', async () => {
    const { diasSinApuntar } = await import('../avisos')
    expect(diasSinApuntar(['2026-03-28'], '2026-03-30')).toBe(2)
  })
})
