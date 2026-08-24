// 生成 App 图标：橙色背景 + 白色对话气泡 + 三个橙色圆点（代表 AI 对话学习）
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SIZE = 1024;
const png = new PNG({ width: SIZE, height: SIZE });

const ORANGE = { r: 234, g: 88, b: 12 }; // #ea580c
const WHITE = { r: 255, g: 255, b: 255 };

function setPx(x, y, c) {
  const i = (SIZE * y + x) << 2;
  png.data[i] = c.r;
  png.data[i + 1] = c.g;
  png.data[i + 2] = c.b;
  png.data[i + 3] = 255;
}

function inRoundedRect(x, y, left, top, right, bottom, r) {
  const cx = Math.min(Math.max(x, left + r), right - r);
  const cy = Math.min(Math.max(y, top + r), bottom - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, a, b, c) {
  const s1 = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
  const s2 = (c[0] - b[0]) * (py - b[1]) - (c[1] - b[1]) * (px - b[0]);
  const s3 = (a[0] - c[0]) * (py - c[1]) - (a[1] - c[1]) * (px - c[0]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

function inCircle(x, y, cx, cy, r) {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// 气泡（居中圆角矩形）+ 尾巴
const bubble = { left: 172, top: 272, right: 852, bottom: 736, r: 140 };
const tail = [[320, 736], [480, 736], [360, 852]];

// 三个点
const dots = [
  { cx: 362, cy: 504, r: 52 },
  { cx: 512, cy: 504, r: 52 },
  { cx: 662, cy: 504, r: 52 },
];

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let c = ORANGE;
    if (
      inRoundedRect(x, y, bubble.left, bubble.top, bubble.right, bubble.bottom, bubble.r) ||
      inTriangle(x, y, tail[0], tail[1], tail[2])
    ) {
      c = WHITE;
    }
    for (const d of dots) {
      if (inCircle(x, y, d.cx, d.cy, d.r)) c = ORANGE;
    }
    setPx(x, y, c);
  }
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'icon.png');
fs.writeFileSync(outPath, PNG.sync.write(png));
console.log('generated: ' + outPath);
