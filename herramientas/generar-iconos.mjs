/**
 * Genera los iconos PNG de la app sin dependencias externas.
 *   node herramientas/generar-iconos.mjs
 *
 * El dibujo son tres barras ascendentes (el mismo gráfico que se ve en el
 * resumen) en rojo sobre blanco. Se codifica el PNG a mano con zlib, que ya
 * viene en Node, para no arrastrar una librería de imágenes solo por esto.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'public', 'iconos')

// --------------------------- utilidades PNG ---------------------------

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function trozo(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** pixeles: Buffer RGBA de tamaño ancho*alto*4 */
function aPng(pixeles, ancho, alto) {
  const porFila = ancho * 4 + 1 // +1 por el byte de filtro que lleva cada fila
  const bruto = Buffer.alloc(alto * porFila)
  for (let y = 0; y < alto; y++) {
    bruto[y * porFila] = 0 // filtro "None"
    pixeles.copy(bruto, y * porFila + 1, y * ancho * 4, (y + 1) * ancho * 4)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8   // 8 bits por canal
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0  // deflate
  ihdr[11] = 0  // filtro adaptativo
  ihdr[12] = 0  // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(bruto, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

// ----------------------------- el dibujo ------------------------------

// Fondo blanco; las barras, del rojo de la app.
const FONDO_A = [255, 255, 255]
const FONDO_B = [246, 246, 249]
const BARRA_A = [255, 59, 74]
const BARRA_B = [193, 18, 31]

/**
 * @param {number} lado   tamaño en píxeles
 * @param {boolean} sangre  true = el dibujo se encoge para el recorte
 *                          circular de Android (icono "maskable")
 */
function dibujar(lado, sangre) {
  const px = Buffer.alloc(lado * lado * 4)
  const radio = sangre ? 0 : lado * 0.2237 // esquina estilo iOS

  // Fondo con degradado en diagonal.
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 4
      const t = (x + y) / (2 * lado)
      const dentro = radio === 0 || enRedondeado(x, y, lado, radio)
      px[i] = FONDO_A[0] + (FONDO_B[0] - FONDO_A[0]) * t
      px[i + 1] = FONDO_A[1] + (FONDO_B[1] - FONDO_A[1]) * t
      px[i + 2] = FONDO_A[2] + (FONDO_B[2] - FONDO_A[2]) * t
      px[i + 3] = dentro ? 255 : 0
    }
  }

  // Tres barras ascendentes, centradas. En el icono "maskable" ocupan menos
  // para que no las corte el recorte circular.
  const escala = sangre ? 0.52 : 0.62
  const anchoZona = lado * escala
  const altoZona = lado * escala * 0.82
  const x0 = (lado - anchoZona) / 2
  const yBase = (lado + altoZona) / 2
  const anchoBarra = anchoZona * 0.235
  const hueco = (anchoZona - anchoBarra * 3) / 2
  const alturas = [0.45, 0.72, 1]
  const rBarra = anchoBarra * 0.28

  for (let b = 0; b < 3; b++) {
    const bx = x0 + b * (anchoBarra + hueco)
    const bAlto = altoZona * alturas[b]
    pintarBarra(px, lado, bx, yBase - bAlto, anchoBarra, bAlto, rBarra, yBase - altoZona, yBase)
  }

  return px
}

/** ¿El píxel cae dentro del cuadrado de esquinas redondeadas? */
function enRedondeado(x, y, lado, r) {
  const cx = x < r ? r : x > lado - r ? lado - r : x
  const cy = y < r ? r : y > lado - r ? lado - r : y
  if (cx === x && cy === y) return true
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/**
 * Barra roja con la punta superior redondeada, apoyada en la línea base.
 * El degradado va de arriba abajo y es común a las tres, para que se lean
 * como un solo gráfico y no como tres piezas sueltas.
 */
function pintarBarra(px, lado, bx, by, ancho, alto, r, yArriba, yAbajo) {
  const x1 = Math.round(bx)
  const x2 = Math.round(bx + ancho)
  const y1 = Math.round(by)
  const y2 = Math.round(by + alto)

  for (let y = Math.max(y1, 0); y < Math.min(y2, lado); y++) {
    for (let x = Math.max(x1, 0); x < Math.min(x2, lado); x++) {
      // Solo redondeamos las dos esquinas de arriba.
      if (y - y1 < r) {
        const cx = x - x1 < r ? x1 + r : x > x2 - r ? x2 - r : x
        const cy = y1 + r
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue
      }
      const t = Math.min(Math.max((y - yArriba) / (yAbajo - yArriba), 0), 1)
      const i = (y * lado + x) * 4
      px[i] = BARRA_A[0] + (BARRA_B[0] - BARRA_A[0]) * t
      px[i + 1] = BARRA_A[1] + (BARRA_B[1] - BARRA_A[1]) * t
      px[i + 2] = BARRA_A[2] + (BARRA_B[2] - BARRA_A[2]) * t
      px[i + 3] = 255
    }
  }
}

// ------------------------------ generar -------------------------------

mkdirSync(DESTINO, { recursive: true })

const salidas = [
  { archivo: 'icono-192.png', lado: 192, sangre: false },
  { archivo: 'icono-512.png', lado: 512, sangre: false },
  { archivo: 'icono-maskable-512.png', lado: 512, sangre: true },
  { archivo: 'apple-touch-icon.png', lado: 180, sangre: true }, // iOS ya redondea él
]

for (const s of salidas) {
  writeFileSync(join(DESTINO, s.archivo), aPng(dibujar(s.lado, s.sangre), s.lado, s.lado))
  console.log(`✓ ${s.archivo} (${s.lado}×${s.lado})`)
}
