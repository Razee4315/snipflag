import { deflateSync } from 'node:zlib';

const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
}
/** Minimal RGBA PNG encoder for test fixtures, so tests need no image dependency. */
export function solidPng(width: number, height: number, rgba: [number, number, number, number]) {
  return patternPng(width, height, () => rgba);
}
export function patternPng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const raw = Buffer.concat(Array.from({ length: height }, (_, y) => {
    const row = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) row.set(pixel(x, y), 1 + x * 4);
    return row;
  }));
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
