import type { Category } from './types'

/**
 * Las categorías de la casa.
 *
 * El orden no es alfabético ni caprichoso: primero va lo que se apunta a mano
 * en el día a día (súper, comer fuera, coche…) y al final lo que llega solo
 * del banco (recibos, préstamos, impuestos, traspasos). Así, en la pantalla de
 * añadir un gasto, lo que más se usa cae arriba del todo.
 *
 * Los colores NO son decorativos: esta secuencia está validada para que dos
 * categorías contiguas se distingan también con daltonismo (deltaE >= 8 en
 * deuteranopía) y contrasten al menos 3:1 contra el fondo. Si cambias un
 * color o mueves una categoría de sitio, revalida la lista entera.
 */
export const CATEGORIAS_INICIALES: Omit<Category, 'id'>[] = [
  // --- El día a día ---
  { nombre: 'Súper', icono: '🛒', color: '#16a34a', orden: 1, archivada: false, excluidaDeTotales: false },
  { nombre: 'Comer fuera', icono: '🍽️', color: '#ea580c', orden: 2, archivada: false, excluidaDeTotales: false },
  { nombre: 'Casa', icono: '🏠', color: '#2563eb', orden: 3, archivada: false, excluidaDeTotales: false },
  { nombre: 'Coche', icono: '🚗', color: '#dc2626', orden: 4, archivada: false, excluidaDeTotales: false },
  { nombre: 'Ocio', icono: '🎬', color: '#7c3aed', orden: 5, archivada: false, excluidaDeTotales: false },
  { nombre: 'Salud', icono: '💊', color: '#0891b2', orden: 6, archivada: false, excluidaDeTotales: false },
  { nombre: 'Ropa', icono: '👕', color: '#db2777', orden: 7, archivada: false, excluidaDeTotales: false },
  { nombre: 'Amigos y extras', icono: '🍻', color: '#7e22ce', orden: 8, archivada: false, excluidaDeTotales: false },
  { nombre: 'Efectivo', icono: '💶', color: '#be123c', orden: 9, archivada: false, excluidaDeTotales: false },
  { nombre: 'Regalos', icono: '🎁', color: '#a855f7', orden: 10, archivada: false, excluidaDeTotales: false },
  { nombre: 'Viajes', icono: '✈️', color: '#b4530a', orden: 11, archivada: false, excluidaDeTotales: false },

  // --- Lo que llega solo del banco ---
  { nombre: 'Luz, agua, gas', icono: '💡', color: '#9333ea', orden: 12, archivada: false, excluidaDeTotales: false },
  { nombre: 'Teléfono e internet', icono: '📱', color: '#a16207', orden: 13, archivada: false, excluidaDeTotales: false },
  { nombre: 'Suscripciones', icono: '📺', color: '#0284c7', orden: 14, archivada: false, excluidaDeTotales: false },
  { nombre: 'Seguros', icono: '🛡️', color: '#e11d48', orden: 15, archivada: false, excluidaDeTotales: false },
  { nombre: 'Préstamos', icono: '🏦', color: '#0d9488', orden: 16, archivada: false, excluidaDeTotales: false },
  { nombre: 'Educación', icono: '🎓', color: '#6366f1', orden: 17, archivada: false, excluidaDeTotales: false },
  { nombre: 'Impuestos y comisiones', icono: '🧾', color: '#059669', orden: 18, archivada: false, excluidaDeTotales: false },

  // --- Dinero que no se gasta, solo cambia de sitio ---
  { nombre: 'Traspasos', icono: '🔄', color: '#b45309', orden: 19, archivada: false, excluidaDeTotales: true },

  { nombre: 'Otros', icono: '📦', color: '#65a30d', orden: 20, archivada: false, excluidaDeTotales: false },
]

export const EMOJIS_CATEGORIA = [
  '🛒', '🍽️', '🏠', '🚗', '🎬', '💊', '👕', '🍻', '💶', '🎁', '✈️', '💡',
  '📱', '📺', '🛡️', '🏦', '🎓', '🧾', '🔄', '📦', '⛽', '🚌', '🐶', '👶',
  '📚', '🏋️', '💇', '🍺', '☕', '🔧', '💳', '🌱',
]

/** Mismos colores validados, disponibles al crear o editar una categoría. */
export const COLORES_CATEGORIA = CATEGORIAS_INICIALES.map((c) => c.color)
