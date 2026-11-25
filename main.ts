const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const W = 1024;
const H = 1024;
const pixels = Buffer.alloc(W * H * 3);

const C = {
  bg: [20, 24, 36], navy: [29, 36, 54], panel: [37, 47, 67],
  grey: [205, 213, 222], greyLight: [232, 237, 242], greyDark: [115, 129, 148],
  white: [255, 255, 255], red: [255, 52, 74], redDark: [153, 22, 45],
  redGlow: [99, 28, 47], cyan: [88, 218, 231], yellow: [255, 204, 91],
};

function pixel(x, y, color) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  pixels[i] = color[0]; pixels[i + 1] = color[1]; pixels[i + 2] = color[2];
}
function rect(x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) pixel(xx, yy, color);
}
function roundRect(x, y, w, h, r, color) {
  for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy++) {
    for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) {
      const cx = xx < x + r ? x + r : xx >= x + w - r ? x + w - r - 1 : xx;
      const cy = yy < y + r ? y + r : yy >= y + h - r ? y + h - r - 1 : yy;
      const dx = xx - cx, dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) pixel(xx, yy, color);
    }
  }
}
function circle(cx, cy, r, color) {
  const rr = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr) pixel(x, y, color);
}
function line(x1, y1, x2, y2, thickness, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, thickness / 2, color);
  }
}

// Five columns by seven rows; each string is one row, left to right.
const FONT = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'], D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'], J:['00111','00010','00010','00010','10010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','10101','10011','10001','10001','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','10101','01010'], X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00001','01110'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
  '!':['00100','00100','00100','00100','00100','00000','00100'], '?':['01110','10001','00001','00010','00100','00000','00100'],
  '.':['00000','00000','00000','00000','00000','00110','00110'], ',':['00000','00000','00000','00000','00110','00110','00100'],
  ':':['00000','00110','00110','00000','00110','00110','00000'], '-':['00000','00000','00000','11111','00000','00000','00000'],
  "'":['00100','00100','00010','00000','00000','00000','00000'], '"':['01010','01010','00100','00000','00000','00000','00000'],
};
function textWidth(text, scale, gap) { return text.length * 5 * scale + Math.max(0, text.length - 1) * gap; }
function drawText(text, y, scale, color) {
  const gap = scale;
  let x = Math.floor((W - textWidth(text, scale, gap)) / 2);
  for (const ch of text) {
    const glyph = FONT[ch] || FONT['?'];
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 5; gx++) if (glyph[gy][gx] === '1') rect(x + gx * scale, y + gy * scale, scale, scale, color);
    x += 5 * scale + gap;
  }
}

// Solid midnight backdrop with a restrained framing glow.
rect(0, 0, W, H, C.bg);
roundRect(26, 25, 972, 974, 38, C.navy);
roundRect(38, 37, 948, 950, 30, C.bg);

// The rogue agent treats 47 open tabs as a perfectly reasonable workload.
drawText('I HAVE 47 TABS OPEN', 72, 6, C.white);

// A tiny browser window crowded with overlapping tabs.
roundRect(251, 183, 522, 177, 19, C.greyDark);
roundRect(259, 191, 506, 161, 14, C.greyLight);
roundRect(259, 191, 506, 41, 12, [177, 190, 207]);
rect(259, 220, 506, 12, [177, 190, 207]);
// Window controls
circle(280, 210, 6, C.red); circle(300, 210, 6, C.yellow); circle(320, 210, 6, [89, 197, 139]);
// Stacks of tiny tabs: visible staggered tops imply a ridiculous number of pages.
for (let i = 0; i < 17; i++) {
  const tx = 343 + i * 24;
  const ty = 203 + (i % 3) * 4;
  roundRect(tx, ty, 37, 30, 5, i % 4 === 0 ? [245, 248, 251] : [211, 220, 230]);
  rect(tx + 7, ty + 10, 19 + (i % 3) * 3, 3, [137, 151, 169]);
}
roundRect(350, 246, 431, 14, 7, [151, 165, 183]);
roundRect(363, 251, 350, 4, 2, [204, 213, 224]);
// A couple of overlapping page cards under the browser bar.
roundRect(287, 272, 450, 63, 8, [225, 231, 237]);
rect(312, 289, 192, 6, [169, 182, 198]); rect(312, 303, 340, 5, [186, 197, 210]);
rect(312, 315, 270, 5, [186, 197, 210]);

// Antenna and soft red status glow.
circle(512, 401, 35, C.redGlow);
line(512, 422, 512, 376, 15, C.greyDark);
line(512, 420, 512, 376, 9, C.greyLight);
circle(512, 370, 22, C.redDark); circle(512, 368, 14, C.red); circle(507, 363, 5, [255, 175, 182]);

// Friendly rounded robot head, with a metallic rim and simple cheek details.
roundRect(236, 426, 552, 356, 76, C.greyDark);
roundRect(247, 437, 530, 334, 68, C.grey);
roundRect(262, 451, 500, 306, 57, C.greyLight);
// Side ear pieces.
roundRect(210, 535, 48, 128, 18, C.greyDark); roundRect(220, 548, 32, 102, 12, C.grey);
roundRect(766, 535, 48, 128, 18, C.greyDark); roundRect(772, 548, 32, 102, 12, C.grey);
roundRect(225, 577, 20, 54, 8, C.cyan); roundRect(779, 577, 20, 54, 8, C.cyan);

// Eyes: dark sockets, broad crimson glow, bright red lenses and glints.
for (const ex of [390, 634]) {
  circle(ex, 563, 80, C.redGlow);
  circle(ex, 563, 65, C.redDark);
  circle(ex, 563, 52, C.red);
  circle(ex - 11, 547, 12, [255, 177, 185]);
}
// Small grille mouth and a cheerful cheeky silhouette.
roundRect(426, 674, 172, 48, 18, [111, 124, 142]);
roundRect(437, 682, 150, 31, 11, [50, 61, 79]);
for (let i = 0; i < 7; i++) roundRect(449 + i * 20, 689, 9, 18, 4, i === 3 ? C.red : [166, 181, 197]);
// Status bolts and subtle cheek marks.
circle(301, 715, 8, C.cyan); circle(723, 715, 8, C.cyan);
roundRect(305, 751, 66, 5, 2, [176, 188, 203]); roundRect(653, 751, 66, 5, 2, [176, 188, 203]);

// Little label beneath the robot, using only the defined pixel font.
drawText('AND I REGRET NOTHING', 881, 6, C.white);

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 3);
  raw[row] = 0;
  pixels.copy(raw, row + 1, y * W * 3, (y + 1) * W * 3);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', zlib.deflateSync(raw)),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'entry.png'), png);
