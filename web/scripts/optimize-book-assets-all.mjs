/**
 * 把立体书 public/book 里剩余的全部 JPG/PNG 转成 WebP（q82/effort5），
 * 已有的 .webp 跳过。原图备份到 .asset-backup（已 gitignore），git 历史也可回退。
 * 透明通道（laoduizhang.png 等）由 sharp 自动保留。
 *
 * 用法: node scripts/optimize-book-assets-all.mjs
 */
import { copyFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const webRoot = path.resolve(import.meta.dirname, '..');
const bookDir = path.join(webRoot, 'public', 'book');
const backupDir = path.join(webRoot, '.asset-backup');

await mkdir(backupDir, { recursive: true });

const entries = await readdir(bookDir);
const targets = entries.filter((name) => /\.(jpe?g|png)$/i.test(name));

let totalBefore = 0;
let totalAfter = 0;

for (const file of targets) {
  const input = path.join(bookDir, file);
  const outName = file.replace(/\.(jpe?g|png)$/i, '.webp');
  const output = path.join(bookDir, outName);

  const before = (await stat(input)).size;
  await copyFile(input, path.join(backupDir, file));

  await sharp(input)
    .rotate()
    .webp({ quality: 82, effort: 5 })
    .toFile(output);

  await unlink(input);

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
  `\n${targets.length} 个文件，合计 ${Math.round(totalBefore / 1024)}KB -> ${Math.round(
    totalAfter / 1024,
  )}KB；原图备份于 ${backupDir}`,
);
