// Minimal "stored" (uncompressed) ZIP writer. Pure JS, no deps.
// Produces a valid .zip that any OS/tool can open. Compression is omitted because
// our payloads are small CSV bundles — clarity beats a few KB saved.

const SIG_LOCAL = 0x04034b50;
const SIG_CDIR = 0x02014b50;
const SIG_END = 0x06054b50;

type Entry = { name: string; data: Uint8Array; crc: number };

export function buildZip(files: { name: string; content: string }[]): Uint8Array {
  const enc = new TextEncoder();
  const entries: (Entry & { localOffset: number; localHeader: Uint8Array })[] = [];

  let offset = 0;
  const parts: Uint8Array[] = [];

  for (const f of files) {
    const data = enc.encode(f.content);
    const nameBytes = enc.encode(f.name);
    const crc = crc32(data);
    const localHeader = makeLocalHeader(nameBytes, data.length, crc);
    parts.push(localHeader, data);
    entries.push({
      name: f.name,
      data,
      crc,
      localOffset: offset,
      localHeader,
    });
    offset += localHeader.length + data.length;
  }

  const cdirStart = offset;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const cdirRec = makeCentralRecord(nameBytes, e.data.length, e.crc, e.localOffset);
    parts.push(cdirRec);
    offset += cdirRec.length;
  }
  const cdirSize = offset - cdirStart;

  const end = makeEndRecord(entries.length, cdirSize, cdirStart);
  parts.push(end);

  // Concatenate
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

function makeLocalHeader(name: Uint8Array, dataLen: number, crc: number): Uint8Array {
  const buf = new Uint8Array(30 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, SIG_LOCAL, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0, true); // flags
  view.setUint16(8, 0, true); // compression: 0 = stored
  view.setUint16(10, 0, true); // mod time
  view.setUint16(12, 0, true); // mod date
  view.setUint32(14, crc, true);
  view.setUint32(18, dataLen, true); // compressed size
  view.setUint32(22, dataLen, true); // uncompressed size
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true); // extra length
  buf.set(name, 30);
  return buf;
}

function makeCentralRecord(name: Uint8Array, dataLen: number, crc: number, localOffset: number): Uint8Array {
  const buf = new Uint8Array(46 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, SIG_CDIR, true);
  view.setUint16(4, 20, true); // version made by
  view.setUint16(6, 20, true); // version needed
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, dataLen, true);
  view.setUint32(24, dataLen, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true); // comment length
  view.setUint16(34, 0, true); // disk number
  view.setUint16(36, 0, true); // internal attrs
  view.setUint32(38, 0, true); // external attrs
  view.setUint32(42, localOffset, true);
  buf.set(name, 46);
  return buf;
}

function makeEndRecord(entryCount: number, cdirSize: number, cdirOffset: number): Uint8Array {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, SIG_END, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, cdirSize, true);
  view.setUint32(16, cdirOffset, true);
  view.setUint16(20, 0, true);
  return buf;
}

let CRC_TABLE: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!CRC_TABLE) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    CRC_TABLE = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
