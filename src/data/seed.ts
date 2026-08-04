import type { Category } from './types'

/**
 * Categorías por defecto. Las ajustaremos cuando Miguel pase el CSV del banco
 * con los gastos reales de estos meses.
 *
 * Los colores NO son decorativos: esta secuencia está validada para que dos
 * categorías contiguas se distingan también con daltonismo (deltaE >= 8 en
 * deuteranopía) y contrasten al menos 3:1 contra el fondo, tanto en modo claro
 * como en oscuro. Si cambias un color, revalida la lista entera.
 */
export const CATEGORIAS_INICIALES: Omit<Category, 'id'>[] = [
  { nombre: 'Súper', icono: '🛒', color: '#16a34a', orden: 1, archivada: false, excluidaDeTotales: false },
  { nombre: 'Casa', icono: '🏠', color: '#2563eb', orden: 2, archivada: false, excluidaDeTotales: false },
  { nombre: 'Coche', icono: '🚗', color: '#dc2626', orden: 3, archivada: false, excluidaDeTotales: false },
  { nombre: 'Ocio', icono: '🎬', color: '#7c3aed', orden: 4, archivada: false, excluidaDeTotales: false },
  { nombre: 'Luz, agua, gas', icono: '💡', color: '#a16207', orden: 5, archivada: false, excluidaDeTotales: false },
  { nombre: 'Salud', icono: '💊', color: '#0891b2', orden: 6, archivada: false, excluidaDeTotales: false },
  { nombre: 'Comer fuera', icono: '🍽️', color: '#ea580c', orden: 7, archivada: false, excluidaDeTotales: false },
  { nombre: 'Ropa', icono: '👕', color: '#db2777', orden: 8, archivada: false, excluidaDeTotales: false },
  { nombre: 'Suscripciones', icono: '📺', color: '#0284c7', orden: 9, archivada: false, excluidaDeTotales: false },
  { nombre: 'Regalos', icono: '🎁', color: '#b4530a', orden: 10, archivada: false, excluidaDeTotales: false },
  { nombre: 'Viajes', icono: '✈️', color: '#a855f7', orden: 11, archivada: false, excluidaDeTotales: false },
  { nombre: 'Otros', icono: '📦', color: '#65a30d', orden: 12, archivada: false, excluidaDeTotales: false },
  // Las que salieron al importar el extracto real del banco.
  { nombre: 'Préstamos', icono: '🏦', color: '#6366f1', orden: 13, archivada: false, excluidaDeTotales: false },
  { nombre: 'Seguros', icono: '🛡️', color: '#0d9488', orden: 14, archivada: false, excluidaDeTotales: false },
  { nombre: 'Educación', icono: '🎓', color: '#e11d48', orden: 15, archivada: false, excluidaDeTotales: false },
  { nombre: 'Teléfono e internet', icono: '📱', color: '#9333ea', orden: 16, archivada: false, excluidaDeTotales: false },
  { nombre: 'Impuestos y comisiones', icono: '🧾', color: '#b45309', orden: 17, archivada: false, excluidaDeTotales: false },
  { nombre: 'Traspasos', icono: '🔄', color: '#059669', orden: 18, archivada: false, excluidaDeTotales: true },
  { nombre: 'Efectivo', icono: '💶', color: '#be123c', orden: 19, archivada: false, excluidaDeTotales: false },
  // Pagos sueltos a terceros: comidas con amigos, devoluciones, extras.
  { nombre: 'Amigos y extras', icono: '🍻', color: '#7e22ce', orden: 20, archivada: false, excluidaDeTotales: false },
]

export const EMOJIS_CATEGORIA = [
  '🛒', '🏠', '🚗', '🎬', '💡', '💊', '🍽️', '👕', '📺', '🎁', '✈️', '📦',
  '🏦', '🛡️', '🎓', '📱', '🧾', '🔄', '💶', '⛽', '🚌', '🐶', '👶', '📚',
  '🏋️', '💇', '🍺', '☕', '🔧', '💳', '🌱', '🎾',
]

/** Mismos colores validados, disponibles al crear o editar una categoría. */
export const COLORES_CATEGORIA = CATEGORIAS_INICIALES.map((c) => c.color)
