import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const outDir = path.resolve('build/icons');
await mkdir(outDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, checksum]);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function paint(size) {
  const scale = 512 / size;
  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(rowBytes * size);
  const points = [[150, 155], [362, 155], [256, 354]];
  const segments = [[points[0], [256, 254]], [points[1], [256, 254]], [[256, 254], points[2]]];

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * scale;
      const py = (y + 0.5) * scale;
      const qx = Math.abs(px - 256) - (224 - 52);
      const qy = Math.abs(py - 256) - (224 - 52);
      const roundedRectDistance = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 52;
      if (roundedRectDistance > 0) continue;

      let color = [12, 20, 37, 255];
      if (segments.some(([a, b]) => distanceToSegment(px, py, a[0], a[1], b[0], b[1]) < 15)) {
        color = [51, 191, 240, 255];
      }
      for (const [cx, cy] of points) {
        const distance = Math.hypot(px - cx, py - cy);
        if (distance < 43) color = [119, 229, 255, 255];
        if (distance < 20) color = [237, 250, 255, 255];
      }
      const central = Math.hypot(px - 256, py - 254);
      if (central < 54) color = [48, 111, 219, 255];
      if (central < 24) color = [246, 251, 255, 255];

      const offset = rowStart + 1 + x * 4;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;  // bit depth
  header[9] = 6;  // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [64, 128, 256, 512]) {
  await writeFile(path.join(outDir, `${size}x${size}.png`), paint(size));
}
console.log(`Generated MultiTorrent icons in ${outDir}`);
