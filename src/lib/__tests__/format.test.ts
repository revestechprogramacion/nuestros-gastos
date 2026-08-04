import { describe, expect, it } from 'vitest'
import { aCentimos, euros, normalizar } from '../format'
import { desplazarMes, diasEntre, nombreMes, parsearFechaBanco } from '../fechas'

describe('aCentimos', () => {
  it('acepta el formato español', () => {
    expect(aCentimos('12,50')).toBe(1250)
    expect(aCentimos('1.234,56')).toBe(123456)
    expect(aCentimos('34,90 €')).toBe(3490)
  })

  it('acepta el formato inglés', () => {
    expect(aCentimos('12.50')).toBe(1250)
    expect(aCentimos('1,234.56')).toBe(123456)
  })

  it('acepta enteros y negativos', () => {
    expect(aCentimos('12')).toBe(1200)
    expect(aCentimos('-45,20')).toBe(-4520)
  })

  it('devuelve null si no hay número', () => {
    expect(aCentimos('hola')).toBeNull()
    expect(aCentimos('')).toBeNull()
  })

  it('no pierde céntimos por el redondeo de coma flotante', () => {
    // 0,1 + 0,2 en decimales daría 0,30000000000000004; en céntimos, nunca.
    expect(aCentimos('0,10')! + aCentimos('0,20')!).toBe(30)
    expect(aCentimos('19,99')).toBe(1999)
  })
})

describe('euros', () => {
  it('formatea en español con el símbolo detrás', () => {
    // Intl usa un espacio duro antes del €; comparamos sin él.
    // Ojo: en español los números de cuatro cifras van SIN punto de millar
    // ("1234,56"), y a partir de cinco sí lo llevan. Es lo correcto.
    expect(euros(123456).replace(/\s/g, ' ')).toBe('1234,56 €')
    expect(euros(1234567).replace(/\s/g, ' ')).toBe('12.345,67 €')
    expect(euros(0).replace(/\s/g, ' ')).toBe('0,00 €')
  })
})

describe('normalizar', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizar('  Farmacia CENTRAL Ñ  ')).toBe('farmacia central ñ')
    expect(normalizar('Máximo Ángel')).toBe('maximo angel')
  })
})

describe('parsearFechaBanco', () => {
  it('entiende los formatos habituales', () => {
    expect(parsearFechaBanco('04/08/2026')).toBe('2026-08-04')
    expect(parsearFechaBanco('4-8-26')).toBe('2026-08-04')
    expect(parsearFechaBanco('2026-08-04')).toBe('2026-08-04')
    expect(parsearFechaBanco('4 de agosto de 2026')).toBe('2026-08-04')
  })

  it('devuelve null con basura', () => {
    expect(parsearFechaBanco('mañana')).toBeNull()
    expect(parsearFechaBanco('')).toBeNull()
  })
})

describe('desplazarMes', () => {
  it('cruza bien el cambio de año', () => {
    expect(desplazarMes('2026-01', -1)).toBe('2025-12')
    expect(desplazarMes('2026-12', 1)).toBe('2027-01')
    expect(desplazarMes('2026-08', -6)).toBe('2026-02')
  })
})

describe('nombreMes', () => {
  it('devuelve el mes en español', () => {
    expect(nombreMes('2026-08')).toBe('agosto 2026')
    expect(nombreMes('2026-01', false)).toBe('enero')
  })
})

describe('diasEntre', () => {
  it('cuenta los días de diferencia, en cualquier orden', () => {
    expect(diasEntre('2026-08-04', '2026-08-04')).toBe(0)
    expect(diasEntre('2026-08-01', '2026-08-04')).toBe(3)
    expect(diasEntre('2026-08-04', '2026-08-01')).toBe(3)
    // Un fijo apuntado el 31 y cargado por el banco el 1: sigue siendo el mismo.
    expect(diasEntre('2026-07-31', '2026-08-01')).toBe(1)
  })

  it('no se despista con el cambio de hora', () => {
    // El último domingo de marzo España pasa a horario de verano.
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2)
  })
})
