// 依存ライブラリなしのアニメーションGIFエンコーダ（GIF89a / メディアカット量子化 / LZW圧縮）

type Box = {
  pixels: number[]; // ピクセル先頭インデックス（rgba配列上の位置/4）
  rmin: number; rmax: number;
  gmin: number; gmax: number;
  bmin: number; bmax: number;
};

const makeBox = (data: Uint8ClampedArray, pixels: number[]): Box => {
  let rmin = 255, rmax = 0, gmin = 255, gmax = 0, bmin = 255, bmax = 0;
  for (let i = 0; i < pixels.length; i++) {
    const p = pixels[i] * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    if (r < rmin) rmin = r;
    if (r > rmax) rmax = r;
    if (g < gmin) gmin = g;
    if (g > gmax) gmax = g;
    if (b < bmin) bmin = b;
    if (b > bmax) bmax = b;
  }
  return { pixels, rmin, rmax, gmin, gmax, bmin, bmax };
};

const splitBox = (data: Uint8ClampedArray, box: Box): [Box, Box] | null => {
  const rr = box.rmax - box.rmin;
  const gr = box.gmax - box.gmin;
  const br = box.bmax - box.bmin;
  const ch = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2;
  if (box.pixels.length < 2) return null;
  const sorted = box.pixels.slice().sort((a, b) => data[a * 4 + ch] - data[b * 4 + ch]);
  const mid = sorted.length >> 1;
  const left = sorted.slice(0, mid);
  const right = sorted.slice(mid);
  if (left.length === 0 || right.length === 0) return null;
  return [makeBox(data, left), makeBox(data, right)];
};

const quantize = (
  data: Uint8ClampedArray,
  maxColors: number
): { palette: Uint8Array; indices: Uint8Array } => {
  const pixelCount = data.length / 4;
  // 量子化の標本抽出（大きい画像は間引いて高速化）
  const step = Math.max(1, Math.floor(pixelCount / 40000));
  const sample: number[] = [];
  for (let i = 0; i < pixelCount; i += step) sample.push(i);

  const boxes: Box[] = [makeBox(data, sample)];
  while (boxes.length < maxColors) {
    // 最も色幅の広い箱を分割
    let target = -1;
    let best = -1;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const vol = Math.max(b.rmax - b.rmin, b.gmax - b.gmin, b.bmax - b.bmin);
      const score = vol * Math.log(b.pixels.length + 1);
      if (score > best && b.pixels.length > 1) {
        best = score;
        target = i;
      }
    }
    if (target < 0) break;
    const sp = splitBox(data, boxes[target]);
    if (!sp) {
      boxes[target] = { ...boxes[target], pixels: boxes[target].pixels.slice(0, 1) };
      continue;
    }
    boxes.splice(target, 1, sp[0], sp[1]);
  }

  const colorCount = boxes.length;
  const palette = new Uint8Array(maxColors * 3);
  for (let i = 0; i < colorCount; i++) {
    let r = 0, g = 0, b = 0;
    const px = boxes[i].pixels;
    for (let j = 0; j < px.length; j++) {
      const p = px[j] * 4;
      r += data[p];
      g += data[p + 1];
      b += data[p + 2];
    }
    palette[i * 3] = Math.round(r / px.length);
    palette[i * 3 + 1] = Math.round(g / px.length);
    palette[i * 3 + 2] = Math.round(b / px.length);
  }

  // 最近傍探索のキャッシュ（5bit/ch）
  const cache = new Int16Array(32768).fill(-1);
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = cache[key];
    if (idx < 0) {
      let bestD = Infinity;
      idx = 0;
      for (let c = 0; c < colorCount; c++) {
        const dr = r - palette[c * 3];
        const dg = g - palette[c * 3 + 1];
        const db = b - palette[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestD) {
          bestD = d;
          idx = c;
        }
      }
      cache[key] = idx;
    }
    indices[i] = idx;
  }
  return { palette, indices };
};

class ByteWriter {
  private buf: number[] = [];
  byte(v: number) {
    this.buf.push(v & 0xff);
  }
  short(v: number) {
    this.byte(v);
    this.byte(v >> 8);
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.byte(arr[i]);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  toUint8Array() {
    return new Uint8Array(this.buf);
  }
}

// LZW圧縮 + サブブロック出力
const writeLzw = (out: ByteWriter, indices: Uint8Array, minCodeSize: number) => {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  let dict = new Map<number, number>();

  const block: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  const flushBlock = () => {
    while (block.length > 0) {
      const chunk = block.splice(0, 255);
      out.byte(chunk.length);
      out.bytes(chunk);
    }
  };
  const emit = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      block.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
      if (block.length >= 255) {
        out.byte(255);
        out.bytes(block.splice(0, 255));
      }
    }
  };

  out.byte(minCodeSize);
  emit(clearCode);

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
    } else {
      emit(prefix);
      dict.set(key, nextCode);
      nextCode++;
      if (nextCode > 4095) {
        emit(clearCode);
        dict = new Map();
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      } else if (nextCode - 1 === 1 << codeSize && codeSize < 12) {
        codeSize++;
      }
      prefix = k;
    }
  }
  emit(prefix);
  emit(eoiCode);
  if (bitCount > 0) {
    block.push(bitBuf & 0xff);
  }
  flushBlock();
  out.byte(0);
};

export type GifFrame = { data: Uint8ClampedArray; delayMs: number };

/** フレーム配列から無限ループのアニメーションGIFを生成する */
export const encodeGif = (width: number, height: number, frames: GifFrame[]): Blob => {
  const out = new ByteWriter();
  out.ascii('GIF89a');
  out.short(width);
  out.short(height);
  out.byte(0x00); // グローバルカラーテーブルなし
  out.byte(0x00);
  out.byte(0x00);

  // NETSCAPE2.0 拡張（無限ループ）
  out.byte(0x21);
  out.byte(0xff);
  out.byte(0x0b);
  out.ascii('NETSCAPE2.0');
  out.byte(0x03);
  out.byte(0x01);
  out.short(0);
  out.byte(0x00);

  for (const frame of frames) {
    const { palette, indices } = quantize(frame.data, 256);
    const delay = Math.max(2, Math.round(frame.delayMs / 10));

    out.byte(0x21); // グラフィック制御拡張
    out.byte(0xf9);
    out.byte(0x04);
    out.byte(0x04); // 廃棄方法なし（各フレームは全面描画）
    out.short(delay);
    out.byte(0x00);
    out.byte(0x00);

    out.byte(0x2c); // イメージ記述子
    out.short(0);
    out.short(0);
    out.short(width);
    out.short(height);
    out.byte(0x87); // ローカルカラーテーブルあり / 256色
    out.bytes(palette);

    writeLzw(out, indices, 8);
  }

  out.byte(0x3b);
  return new Blob([out.toUint8Array()], { type: 'image/gif' });
};
