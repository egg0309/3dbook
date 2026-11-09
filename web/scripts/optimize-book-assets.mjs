/**
 * 把立体书 public/book 里体积最大的几张照片纹理转成 WebP，
 * 显著降低免费隧道下的首屏体积。原图备份到 .asset-backup（已 gitignore），
 * 且 git 历史里仍有原文件，可随时回退。
 *
 * 用法: node scripts/optimize-book-assets.mjs
 * 透明通道（building / hada_magnifier）由 sharp 自动保留。
 */
import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const webRoot = path.resolve(import.meta.dirname, '..');
const bookDir = path.join(webRoot, 'public', 'book');
const backupDir = path.join(webRoot, '.asset-backup');

const TARGETS = [
  'building.png',
  'hada_magnifier.png',
  'ld_river.png',
  'room_bg.png',
  'td_map.png',
  'xj_river.jpg',
];

await mkdir(backupDir, { recursive: true });

let totalBefore = 0;
let totalAfter = 0;

for (const file of TARGETS) {
  const input = path.join(bookDir, file);
  const outName = file.replace(/\.(png|jpe?g)$/i, '.webp');
  const output = path.join(bookDir, outName);

  const before = (await stat(input)).size;
  await copyFile(input, path.join(backupDir, file));

  await sharp(input)
    .rotate()
    .webp({ quality: 82, effort: 5 })
    .toFile(output);

  const after = (await stat(output)).size;
  totalBefore += before;
  totalAfter += after;
  console.log(
    `${file} -> ${outName}  ${Math.round(before / 1024)}KB -> ${Math.round(
      after / 1024,
    )}KB (${Math.round((1 - after / before) * 100)}% 减小)`,
  );
}

console.log(
  `\n合计 ${Math.round(totalBefore / 1024)}KB -> ${Math.round(
    totalAfter / 1024,
  )}KB；原图备份于 ${backupDir}`,
);
