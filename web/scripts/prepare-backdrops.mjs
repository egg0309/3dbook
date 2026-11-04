/**
 * 把 ../photo 里的原始 PNG 处理成适合网页轮播的 WebP。
 * 用法: npm run assets:backdrops
 * 输出: src/assets/backdrops/backdrop-01.webp ...
 */
import { readdir, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const webRoot = path.resolve(import.meta.dirname, '..');
const srcDir = path.resolve(webRoot, process.argv[2] ?? '../photo');
const outDir = path.resolve(webRoot, 'src/assets/backdrops');

await mkdir(outDir, { recursive: true });

const existing = await readdir(outDir).catch(() => []);
await Promise.all(
  existing
    .filter((file) => /^backdrop-\d+\.webp$/.test(file))
    .map((file) => rm(path.join(outDir, file))),
);

const files = (await readdir(srcDir))
  .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

if (!files.length) {
  throw new Error(`No images found in ${srcDir}`);
}

const manifest = [];

for (const [index, file] of files.entries()) {
  const input = path.join(srcDir, file);
  const name = `backdrop-${String(index + 1).padStart(2, '0')}.webp`;
  const output = path.join(outDir, name);

  const pipeline = sharp(input).rotate();
  const meta = await pipeline.metadata();
  const width = Math.min(1920, meta.width ?? 1920);

  await pipeline
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(output);

  const outMeta = await sharp(output).metadata();
  const outStat = await stat(output);
  manifest.push({
    file: name,
    source: file,
    width: outMeta.width,
    height: outMeta.height,
  });

  console.log(
    `${file} -> ${name} (${outMeta.width}x${outMeta.height}, ${Math.round(
      outStat.size / 1024,
    )} KB)`,
  );
}

await writeFile(
  path.join(outDir, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`\nDone: ${manifest.length} backdrops -> ${outDir}`);
