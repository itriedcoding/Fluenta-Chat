#!/usr/bin/env node
/**
 * Generates the app icon set used by the Windows (Tauri) and Android
 * (Capacitor) shells: rounded gradient mark with the Fluenta "F".
 *
 * Usage: node tools/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const ACCENT_A = [124, 92, 255]
const ACCENT_B = [79, 54, 201]

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

const crc32 = (buf) => {
  let c = -1
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const radius = size * 0.22
  const cx = size / 2

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < size; x += 1) {
      // rounded-square mask
      const dx = Math.max(radius - x, x - (size - radius), 0)
      const dy = Math.max(radius - y, y - (size - radius), 0)
      const dist = Math.hypot(dx, dy)
      const alpha = dist > radius ? 0 : Math.min(1, (radius - dist) / 1.4)

      const t = (x + y) / (2 * size)
      const r = Math.round(ACCENT_A[0] * (1 - t) + ACCENT_B[0] * t)
      const g = Math.round(ACCENT_A[1] * (1 - t) + ACCENT_B[1] * t)
      const b = Math.round(ACCENT_A[2] * (1 - t) + ACCENT_B[2] * t)

      // "F" glyph: vertical stem + two bars
      const stemX = cx - size * 0.11
      const glyph =
        (x >= stemX && x <= stemX + size * 0.1 && y >= size * 0.26 && y <= size * 0.74) ||
        (y >= size * 0.26 && y <= size * 0.33 && x >= stemX && x <= size * 0.7) ||
        (y >= size * 0.45 && y <= size * 0.51 && x >= stemX && x <= size * 0.63)

      let pr = r
      let pg = g
      let pb = b
      if (glyph) {
        pr = 255
        pg = 255
        pb = 255
      }

      const pixel = rowStart + 1 + x * 3
      raw[pixel] = pr
      raw[pixel + 1] = pg
      raw[pixel + 2] = pb

      // bake alpha into color (RGBA chunk with alpha channel)
      raw[pixel + 3] = Math.round(alpha * 255)
    }
  }

  // Rebuild as RGBA (color type 6) for correct transparency.
  const rgba = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const srcRow = y * (size * 3 + 1)
    const dstRow = y * (size * 4 + 1)
    rgba[dstRow] = 0
    for (let x = 0; x < size; x += 1) {
      const s = srcRow + 1 + x * 3
      const d = dstRow + 1 + x * 4
      rgba[d] = raw[s]
      rgba[d + 1] = raw[s + 1]
      rgba[d + 2] = raw[s + 2]
      rgba[d + 3] = raw[s + 3]
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rgba, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Minimal ICO container wrapping PNG images (Windows Vista+). */
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(16 * entries.length)
  let offset = 6 + dir.length
  entries.forEach((entry, i) => {
    const base = i * 16
    dir[base] = entry.size >= 256 ? 0 : entry.size
    dir[base + 1] = entry.size >= 256 ? 0 : entry.size
    dir[base + 2] = 0
    dir[base + 3] = 0
    dir.writeUInt16LE(1, base + 4)
    dir.writeUInt16LE(32, base + 6)
    dir.writeUInt32LE(entry.png.length, base + 8)
    dir.writeUInt32LE(offset, base + 12)
    offset += entry.png.length
  })

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

const write = (relative, data) => {
  const target = resolve(root, relative)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, data)
  console.log(`wrote ${relative} (${data.length} bytes)`)
}

const sizes = [16, 32, 48, 64, 128, 256, 512]
const pngs = new Map(sizes.map((size) => [size, png(size)]))

write('public/icon.png', pngs.get(512))
write('src-tauri/icons/32x32.png', pngs.get(32))
write('src-tauri/icons/128x128.png', pngs.get(128))
write('src-tauri/icons/128x128@2x.png', pngs.get(256))
write('src-tauri/icons/icon.png', pngs.get(512))
write(
  'src-tauri/icons/icon.ico',
  ico([16, 32, 48, 64, 128, 256].map((size) => ({ size, png: pngs.get(size) }))),
)
