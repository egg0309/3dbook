import * as THREE from 'three';

type Ctx = CanvasRenderingContext2D;

const SERIF = '"STZhongsong", "华文中宋", "Songti SC", "Noto Serif SC", "SimSun", serif';
const KAI = '"KaiTi", "STKaiti", "FangSong", "STFangsong", "SimSun", serif';

function createCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return [canvas, ctx];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function toTexture(canvas: HTMLCanvasElement, srgb = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function roundRectPath(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStar(
  ctx: Ctx,
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  points = 5,
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function addFineGrain(
  ctx: Ctx,
  width: number,
  height: number,
  rand: () => number,
  amount = 0.05,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * 255 * amount;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);
}

function drawPaperBase(ctx: Ctx, width: number, height: number, rand: () => number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ddcfad');
  gradient.addColorStop(0.42, '#d5c5a2');
  gradient.addColorStop(1, '#c6b48c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 46; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const radius = 60 + rand() * 260;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const warm = rand() > 0.5;
    stain.addColorStop(0, warm ? 'rgba(156, 112, 62, 0.05)' : 'rgba(74, 55, 34, 0.04)');
    stain.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const len = 2 + rand() * 14;
    const angle = rand() * Math.PI;
    ctx.strokeStyle = rand() > 0.4 ? 'rgba(255, 249, 226, 0.13)' : 'rgba(80, 58, 34, 0.08)';
    ctx.lineWidth = rand() > 0.9 ? 1.4 : 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  for (let i = 0; i < 900; i++) {
    const x = rand() * width;
    const y = rand() * height;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(75, 52, 30, 0.12)' : 'rgba(255, 247, 218, 0.16)';
    ctx.beginPath();
    ctx.arc(x, y, 0.4 + rand() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  addFineGrain(ctx, width, height, rand, 0.035);
}

function makeCloth(rand: () => number) {
  const size = 1024;
  const [canvas, ctx] = createCanvas(size, size);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#71251d');
  gradient.addColorStop(0.45, '#601c17');
  gradient.addColorStop(1, '#481310');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1100; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(0, 0, 0, 0.035)' : 'rgba(255, 190, 155, 0.02)';
    ctx.beginPath();
    ctx.ellipse(
      rand() * size,
      rand() * size,
      5 + rand() * 80,
      3 + rand() * 40,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.globalAlpha = 0.09;
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? '#150705' : '#e9b79d';
    ctx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? '#150705' : '#d9a68c';
    ctx.fillRect(x, 0, 1, size);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.strokeStyle = 'rgba(255, 220, 190, 0.055)';
    ctx.lineWidth = rand() > 0.8 ? 1.4 : 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 8);
    ctx.stroke();
  }

  for (let i = 0; i < 14; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const radius = 70 + rand() * 210;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, 'rgba(24, 6, 4, 0.16)');
    stain.addColorStop(0.6, 'rgba(24, 6, 4, 0.06)');
    stain.addColorStop(1, 'rgba(24, 6, 4, 0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const vignette = ctx.createRadialGradient(
    size * 0.5,
    size * 0.46,
    size * 0.15,
    size * 0.5,
    size * 0.5,
    size * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  addFineGrain(ctx, size, size, rand, 0.055);

  const bumpSize = 512;
  const [bumpCanvas, bumpCtx] = createCanvas(bumpSize, bumpSize);
  bumpCtx.fillStyle = '#7d7d7d';
  bumpCtx.fillRect(0, 0, bumpSize, bumpSize);
  for (let y = 0; y < bumpSize; y += 2) {
    bumpCtx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
    bumpCtx.fillRect(0, y, bumpSize, 1);
  }
  for (let x = 0; x < bumpSize; x += 2) {
    bumpCtx.fillStyle = x % 4 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)';
    bumpCtx.fillRect(x, 0, 1, bumpSize);
  }
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(70 + rand() * 130);
    bumpCtx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    bumpCtx.fillRect(rand() * bumpSize, rand() * bumpSize, 2, 2);
  }
  addFineGrain(bumpCtx, bumpSize, bumpSize, rand, 0.12);

  const map = toTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 1);
  const bump = toTexture(bumpCanvas, false);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 1);

  return { map, bump };
}

function drawTrackedText(
  ctx: Ctx,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
) {
  const chars = Array.from(text);
  const widths = chars.map((char) => ctx.measureText(char).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (chars.length - 1);
  let x = centerX - total / 2;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((char, index) => {
    ctx.fillText(char, x, y);
    x += widths[index] + spacing;
  });
  ctx.textAlign = previousAlign;
}

function drawCornerFlourish(ctx: Ctx, x: number, y: number, sx: number, sy: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = 'rgba(211, 173, 101, 0.62)';
  ctx.fillStyle = 'rgba(211, 173, 101, 0.62)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(118, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 118);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 24);
  ctx.quadraticCurveTo(74, 24, 74, 72);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 24);
  ctx.quadraticCurveTo(24, 54, 48, 68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(24, 96, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(96, 24, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function makeCoverArt(rand: () => number) {
  const width = 1024;
  const height = 1416;
  const [canvas, ctx] = createCanvas(width, height);

  ctx.strokeStyle = 'rgba(211, 173, 101, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 48, width - 96, height - 96);

  drawCornerFlourish(ctx, 92, 92, 1, 1);
  drawCornerFlourish(ctx, width - 92, 92, -1, 1);
  drawCornerFlourish(ctx, 92, height - 92, 1, -1);
  drawCornerFlourish(ctx, width - 92, height - 92, -1, -1);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(227, 198, 139, 0.72)';
  ctx.font = `500 23px "Times New Roman", "Georgia", serif`;
  drawTrackedText(ctx, 'LONG MARCH · 1935', width / 2, 466, 7);

  const titleTop = 576;
  const lineHeight = 176;
  const titleGradient = ctx.createLinearGradient(0, titleTop - 90, 0, titleTop + lineHeight * 3 + 90);
  titleGradient.addColorStop(0, '#f7e5af');
  titleGradient.addColorStop(0.35, '#d9b76d');
  titleGradient.addColorStop(0.68, '#97702f');
  titleGradient.addColorStop(1, '#e9cd8c');

  ctx.font = `700 168px ${SERIF}`;
  Array.from('遵义会议').forEach((char, index) => {
    const x = width / 2;
    const y = titleTop + index * lineHeight;
    ctx.fillStyle = 'rgba(16, 5, 4, 0.6)';
    ctx.fillText(char, x + 4, y + 6);
    ctx.fillStyle = titleGradient;
    ctx.fillText(char, x, y);
    ctx.strokeStyle = 'rgba(255, 239, 190, 0.24)';
    ctx.lineWidth = 1.4;
    ctx.strokeText(char, x, y - 1.5);
  });

  const ruleY = titleTop + lineHeight * 3 + 54;
  ctx.strokeStyle = 'rgba(211, 173, 101, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 112, ruleY);
  ctx.lineTo(width / 2 + 112, ruleY);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, ruleY, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(211, 173, 101, 0.7)';
  ctx.fill();

  ctx.fillStyle = 'rgba(236, 216, 174, 0.82)';
  ctx.font = `400 30px ${KAI}`;
  drawTrackedText(ctx, '一九三五 · 贵州遵义', width / 2, ruleY + 54, 5);

  ctx.save();
  ctx.translate(748, 1178);
  ctx.rotate(-0.055);
  ctx.fillStyle = 'rgba(151, 40, 30, 0.94)';
  roundRectPath(ctx, 0, 0, 126, 126, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242, 216, 174, 0.62)';
  ctx.lineWidth = 4;
  roundRectPath(ctx, 10, 10, 106, 106, 6);
  ctx.stroke();
  ctx.fillStyle = '#f1dfbe';
  ctx.textAlign = 'center';
  ctx.font = `700 48px ${KAI}`;
  ctx.fillText('转', 63, 48);
  ctx.fillText('折', 63, 96);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.1 + rand() * 0.35;
    ctx.beginPath();
    ctx.arc(rand() * 126, rand() * 126, 0.5 + rand() * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 150; i++) {
    ctx.globalAlpha = 0.12 + rand() * 0.4;
    ctx.beginPath();
    ctx.ellipse(
      rand() * width,
      rand() * height,
      0.5 + rand() * 3.6,
      0.5 + rand() * 1.6,
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.04 + rand() * 0.09;
    ctx.fillStyle = rand() > 0.4 ? '#20100b' : '#f4d9a0';
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height, 0.6 + rand() * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  return toTexture(canvas);
}

function makeBackCoverArt(rand: () => number) {
  const width = 1024;
  const height = 1416;
  const [canvas, ctx] = createCanvas(width, height);

  ctx.strokeStyle = 'rgba(209, 170, 98, 0.13)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.ellipse(
      width * 0.5,
      height * 0.47,
      140 + i * 26 + rand() * 12,
      200 + i * 24 + rand() * 14,
      (rand() - 0.5) * 0.25,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  drawCornerFlourish(ctx, 90, 90, 1, 1);
  drawCornerFlourish(ctx, width - 90, 90, -1, 1);
  drawCornerFlourish(ctx, 90, height - 90, 1, -1);
  drawCornerFlourish(ctx, width - 90, height - 90, -1, -1);

  ctx.strokeStyle = 'rgba(211, 173, 101, 0.42)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.47, 252, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.47, 238, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    const inner = 244;
    const outer = i % 4 === 0 ? 260 : 253;
    ctx.beginPath();
    ctx.moveTo(width / 2 + Math.cos(angle) * inner, height * 0.47 + Math.sin(angle) * inner);
    ctx.lineTo(width / 2 + Math.cos(angle) * outer, height * 0.47 + Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(211, 173, 101, 0.5)';
  ctx.font = `500 26px "Times New Roman", "Georgia", serif`;
  ctx.textAlign = 'center';
  drawTrackedText(ctx, 'THE LONG MARCH', width / 2, height * 0.47 + 330, 6);

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.12 + rand() * 0.35;
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height, 0.5 + rand() * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  return toTexture(canvas);
}

function makeEndpaper(rand: () => number) {
  const width = 1024;
  const height = 1416;
  const [canvas, ctx] = createCanvas(width, height);
  drawPaperBase(ctx, width, height, rand);

  ctx.strokeStyle = 'rgba(150, 108, 54, 0.34)';
  ctx.lineWidth = 2;
  ctx.strokeRect(46, 46, width - 92, height - 92);
  ctx.strokeStyle = 'rgba(150, 108, 54, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(58, 58, width - 116, height - 116);

  ctx.strokeStyle = 'rgba(83, 57, 33, 0.075)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 86) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 86) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const base = 30 + rand() * 130;
    const rot = rand() * Math.PI;
    for (let ring = 0; ring < 3; ring++) {
      ctx.strokeStyle = `rgba(79, 56, 34, ${0.1 - ring * 0.022})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        base + ring * 15 + rand() * 8,
        base * 0.62 + ring * 12 + rand() * 7,
        rot,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  }

  const route: Array<[number, number]> = [
    [120, 1080],
    [215, 1010],
    [268, 900],
    [252, 792],
    [330, 700],
    [430, 690],
    [492, 610],
    [588, 586],
    [648, 556],
    [722, 500],
  ];

  ctx.strokeStyle = 'rgba(146, 40, 29, 0.58)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  route.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else {
      const [px, py] = route[index - 1];
      const mx = (px + x) / 2;
      const my = (py + y) / 2;
      ctx.quadraticCurveTo(px, py, mx, my);
    }
  });
  const [lastX, lastY] = route[route.length - 1];
  ctx.lineTo(lastX, lastY);
  ctx.stroke();

  route.forEach(([x, y], index) => {
    ctx.fillStyle = index === route.length - 1 ? 'rgba(146, 40, 29, 0.9)' : 'rgba(146, 40, 29, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, index === route.length - 1 ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.translate(800, 430);
  ctx.fillStyle = 'rgba(146, 40, 29, 0.7)';
  drawStar(ctx, 0, 0, 26, 10.5);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(88, 38, 27, 0.72)';
  ctx.font = `600 34px ${KAI}`;
  ctx.textAlign = 'center';
  ctx.fillText('遵义', 800, 500);
  ctx.fillStyle = 'rgba(146, 40, 29, 0.55)';
  ctx.font = `500 23px "Times New Roman", serif`;
  ctx.fillText('1935.1', 800, 538);

  ctx.save();
  ctx.translate(760, 1180);
  ctx.rotate(0.055);
  ctx.strokeStyle = 'rgba(146, 40, 29, 0.3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 116, 116);
  ctx.fillStyle = 'rgba(146, 40, 29, 0.24)';
  ctx.font = `700 44px ${KAI}`;
  ctx.textAlign = 'center';
  ctx.fillText('转折', 58, 52);
  ctx.fillText('之点', 58, 99);
  ctx.restore();

  const spineShadow = ctx.createLinearGradient(width - 110, 0, width, 0);
  spineShadow.addColorStop(0, 'rgba(55, 36, 18, 0)');
  spineShadow.addColorStop(1, 'rgba(55, 36, 18, 0.38)');
  ctx.fillStyle = spineShadow;
  ctx.fillRect(width - 110, 0, 110, height);

  const edgeShadow = ctx.createLinearGradient(0, 0, 0, height);
  edgeShadow.addColorStop(0, 'rgba(58, 39, 20, 0.28)');
  edgeShadow.addColorStop(0.08, 'rgba(58, 39, 20, 0)');
  edgeShadow.addColorStop(0.92, 'rgba(58, 39, 20, 0)');
  edgeShadow.addColorStop(1, 'rgba(58, 39, 20, 0.32)');
  ctx.fillStyle = edgeShadow;
  ctx.fillRect(0, 0, width, height);

  return toTexture(canvas);
}

function makePaper(rand: () => number) {
  const size = 1024;
  const [canvas, ctx] = createCanvas(size, size);
  drawPaperBase(ctx, size, size, rand);
  const map = toTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

function makeFirstPage(rand: () => number) {
  const width = 1024;
  const height = 1416;
  const [canvas, ctx] = createCanvas(width, height);
  drawPaperBase(ctx, width, height, rand);

  ctx.strokeStyle = 'rgba(143, 43, 32, 0.24)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(118, 150);
  ctx.lineTo(118, height - 150);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(143, 43, 32, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(132, 150);
  ctx.lineTo(132, height - 150);
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, height * 0.47);
  ctx.fillStyle = 'rgba(143, 43, 32, 0.035)';
  drawStar(ctx, 0, 0, 250, 100);
  ctx.fill();
  ctx.restore();

  const gutter = ctx.createLinearGradient(0, 0, 80, 0);
  gutter.addColorStop(0, 'rgba(74, 50, 26, 0.24)');
  gutter.addColorStop(1, 'rgba(74, 50, 26, 0)');
  ctx.fillStyle = gutter;
  ctx.fillRect(0, 0, 80, height);

  return toTexture(canvas);
}

function makePageEdge(rand: () => number) {
  const width = 256;
  const height = 1024;
  const [canvas, ctx] = createCanvas(width, height);
  ctx.fillStyle = '#c7b692';
  ctx.fillRect(0, 0, width, height);

  let x = 0;
  while (x < width) {
    const step = 0.8 + rand() * 2.5;
    const light = rand() > 0.33;
    ctx.fillStyle = light
      ? `rgba(255, 248, 226, ${0.1 + rand() * 0.28})`
      : `rgba(78, 58, 32, ${0.06 + rand() * 0.18})`;
    ctx.fillRect(x, 0, Math.max(0.6, step * 0.55), height);
    x += step;
  }

  const vertical = ctx.createLinearGradient(0, 0, 0, height);
  vertical.addColorStop(0, 'rgba(70, 50, 26, 0.22)');
  vertical.addColorStop(0.08, 'rgba(70, 50, 26, 0)');
  vertical.addColorStop(0.9, 'rgba(70, 50, 26, 0)');
  vertical.addColorStop(1, 'rgba(70, 50, 26, 0.26)');
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, width, height);

  const map = toTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

export interface BookTextures {
  clothMap: THREE.Texture;
  clothBump: THREE.Texture;
  coverArt: THREE.Texture;
  backCoverArt: THREE.Texture;
  /** AI 封面底图：无文字、无金属边框，由代码叠加标题与立体徽章 */
  coverBase: THREE.Texture | null;
  backCoverBase: THREE.Texture | null;
  endpaper: THREE.Texture;
  paper: THREE.Texture;
  firstPage: THREE.Texture;
  pageEdge: THREE.Texture;
}

export type BookTextureOverrides = Partial<BookTextures>;

export function createBookTextures(): BookTextures {
  const rand = mulberry32(19350115);
  const cloth = makeCloth(rand);
  return {
    clothMap: cloth.map,
    clothBump: cloth.bump,
    coverArt: makeCoverArt(rand),
    backCoverArt: makeBackCoverArt(rand),
    coverBase: null,
    backCoverBase: null,
    endpaper: makeEndpaper(rand),
    paper: makePaper(rand),
    firstPage: makeFirstPage(rand),
    pageEdge: makePageEdge(rand),
  };
}

function makeRadialTexture(
  size: number,
  stops: Array<[number, string]>,
  srgb = true,
) {
  const [canvas, ctx] = createCanvas(size, size);
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas, srgb);
}

export function createGlowTexture() {
  return makeRadialTexture(256, [
    [0, 'rgba(255, 214, 164, 0.5)'],
    [0.35, 'rgba(196, 88, 58, 0.18)'],
    [0.7, 'rgba(120, 30, 22, 0.05)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
}

export function createDustTexture() {
  return makeRadialTexture(64, [
    [0, 'rgba(255, 244, 220, 0.95)'],
    [0.3, 'rgba(255, 226, 184, 0.45)'],
    [1, 'rgba(255, 220, 170, 0)'],
  ]);
}

export function createShadowTexture() {
  return makeRadialTexture(256, [
    [0, 'rgba(0, 0, 0, 0.72)'],
    [0.42, 'rgba(0, 0, 0, 0.38)'],
    [0.72, 'rgba(0, 0, 0, 0.1)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ]);
}
