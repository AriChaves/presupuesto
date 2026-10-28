// Genera los íconos PNG de la app (cuadro verde con un círculo blanco).
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const r = size * 0.24, cx = size / 2, cy = size / 2
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy)
      const ring = d < r && d > r * 0.62
      const bar = Math.abs(x - cx) < size * 0.035 && Math.abs(y - cy) < r * 1.35
      const [R, G, B] = ring || bar ? [255, 255, 255] : [0x1f, 0x6f, 0x4a]
      const i = y * (size * 3 + 1) + 1 + x * 3
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/apple-touch-icon.png', png(180))

// Íconos de la app de Android (si ya existe el proyecto de Capacitor).
import { existsSync } from 'node:fs'
const res = 'android/app/src/main/res'
if (existsSync(res)) {
  const densidades = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [d, t] of Object.entries(densidades)) {
    writeFileSync(`${res}/mipmap-${d}/ic_launcher.png`, png(t))
    writeFileSync(`${res}/mipmap-${d}/ic_launcher_round.png`, png(t))
    writeFileSync(`${res}/mipmap-${d}/ic_launcher_foreground.png`, png(Math.round(t * 2.25)))
  }
  writeFileSync(
    `${res}/values/ic_launcher_background.xml`,
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F6F4A</color>\n</resources>\n',
  )
}
