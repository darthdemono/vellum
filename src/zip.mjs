import zlib from 'node:zlib'

const TABLE = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const dos = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() })

/**
 * Build a zip (deflate, UTF-8 names) from [{ name, data: Buffer, mtime: Date }].
 * Same input gives the same bytes, so an unchanged vault leaves the file untouched and rsync sends nothing.
 */
export function makeZip(entries) {
  const parts = [], central = []; let offset = 0
  for (const { name, data, mtime } of entries) {
    const nm = Buffer.from(name, 'utf8'), packed = zlib.deflateRawSync(data, { level: 9 }), { time, date } = dos(mtime), crc = crc32(data)
    const head = Buffer.alloc(30); head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8)
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nm.length, 26)
    const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10)
    cd.writeUInt16LE(time, 12); cd.writeUInt16LE(date, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(packed.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(offset, 42)
    parts.push(head, nm, packed); central.push(cd, nm); offset += 30 + nm.length + packed.length
  }
  const size = central.reduce((n, b) => n + b.length, 0), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, ...central, end])
}
