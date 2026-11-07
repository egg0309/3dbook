import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '..')
const outRoot = path.join(projectRoot, 'public', 'art')

const MAP_SOURCE = path.join(projectRoot, '长征之路：首页', '图片.jpg')
const BRAND_SOURCE = path.join(projectRoot, '长征之路：首页', '古金色长征之路书法字标.png')

const stages = [
  {
    id: '01-xiangjiang',
    title: '湘江血战/文字.png',
    scenes: [{ file: 'scene.webp', source: '湘江血战/场景.png' }],
  },
  {
    id: '02-tongdao',
    title: '通道会议/通道会议墨韵书法.png',
    scenes: [{ file: 'scene.webp', source: '通道会议/油灯下的分岔地图.png' }],
  },
  {
    id: '03-zunyi',
    title: '遵义会议/遵义会议金色书法标志.png',
    scenes: [{ file: 'scene.webp', source: '遵义会议/遵义夜会：油灯与军图.png' }],
  },
  {
    id: '04-sidu',
    title: '四渡赤水/四渡赤水行草书法.png',
    scenes: [{ file: 'scene.webp', source: '四渡赤水/赤水四渡，雾夜行舟.png' }],
  },
  {
    id: '05-tianxian',
    title: '抢夺天险/铁灰碑刻：抢夺天险.png',
    scenes: [{ file: 'scene.webp', source: '抢夺天险/飞夺泸定桥.png' }],
  },
  {
    id: '06-xueshan',
    title: '雪山草地/霜雪笔意·雪山草地.png',
    scenes: [
      { file: 'scene-snow.webp', source: '雪山草地/雪山.png' },
      { file: 'scene-grass.webp', source: '雪山草地/草地.png' },
    ],
  },
  {
    id: '07-hadapu',
    title: '哈达铺/哈达铺木刻报头.png',
    scenes: [{ file: 'scene.webp', source: '哈达铺/油灯下的旧报与远山.png' }],
  },
  {
    id: '08-huishi',
    title: '三军会师/朱金行楷三军会师.png',
    scenes: [{ file: 'scene.webp', source: '三军会师/会宁晨曦中的三面红旗.png' }],
  },
]

const MAP_OVERLAY = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <linearGradient id="left" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#070504" stop-opacity="0.985"/>
      <stop offset="0.30" stop-color="#070504" stop-opacity="0.96"/>
      <stop offset="0.38" stop-color="#070504" stop-opacity="0.88"/>
      <stop offset="0.43" stop-color="#070504" stop-opacity="0.54"/>
      <stop offset="0.48" stop-color="#070504" stop-opacity="0.16"/>
      <stop offset="0.55" stop-color="#070504" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070504" stop-opacity="0.97"/>
      <stop offset="0.06" stop-color="#070504" stop-opacity="0.82"/>
      <stop offset="0.12" stop-color="#070504" stop-opacity="0.3"/>
      <stop offset="0.18" stop-color="#070504" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="topRight" cx="100%" cy="0%" r="42%">
      <stop offset="0" stop-color="#070504" stop-opacity="0.96"/>
      <stop offset="0.45" stop-color="#070504" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#070504" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.80" stop-color="#070504" stop-opacity="0"/>
      <stop offset="1" stop-color="#070504" stop-opacity="0.62"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="47%" r="74%">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.5"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#vignette)"/>
  <rect width="1600" height="900" fill="url(#left)"/>
  <rect width="1600" height="900" fill="url(#top)"/>
  <rect width="1600" height="900" fill="url(#topRight)"/>
  <rect width="1600" height="900" fill="url(#bottom)"/>
</svg>`)

async function fileSize(file) {
  const stat = await fs.stat(file)
  return stat.size
}

async function makeTitle(source, destination) {
  const image = sharp(source).ensureAlpha().trim({ threshold: 1 })
  const trimmed = await image.toBuffer({ resolveWithObject: true })
  await sharp(trimmed.data)
    .extend({
      top: 14,
      bottom: 14,
      left: 14,
      right: 14,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize({ width: 1500, withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(destination)

  return `${trimmed.info.width}×${trimmed.info.height}`
}

async function makeScene(source, destination) {
  await sharp(source)
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 84, effort: 6 })
    .toFile(destination)
}

async function main() {
  await fs.mkdir(outRoot, { recursive: true })
  await fs.mkdir(path.join(outRoot, 'stages'), { recursive: true })

  const mapOutput = path.join(outRoot, 'map.webp')
  await sharp(MAP_SOURCE)
    .resize(1600, 900, { fit: 'cover' })
    .composite([{ input: MAP_OVERLAY, top: 0, left: 0 }])
    .webp({ quality: 90, effort: 6 })
    .toFile(mapOutput)
  console.log(`map.webp  ${(await fileSize(mapOutput) / 1024).toFixed(0)} KB`)

  const brandOutput = path.join(outRoot, 'brand-long-march.webp')
  const brandSize = await makeTitle(BRAND_SOURCE, brandOutput)
  console.log(`brand-long-march.webp  ${brandSize}  ${(await fileSize(brandOutput) / 1024).toFixed(0)} KB`)

  for (const stage of stages) {
    const stageDir = path.join(outRoot, 'stages', stage.id)
    await fs.mkdir(stageDir, { recursive: true })

    const titleOutput = path.join(stageDir, 'title.webp')
    const titleSize = await makeTitle(path.join(projectRoot, stage.title), titleOutput)
    console.log(`${stage.id}/title.webp  ${titleSize}  ${(await fileSize(titleOutput) / 1024).toFixed(0)} KB`)

    for (const scene of stage.scenes) {
      const sceneOutput = path.join(stageDir, scene.file)
      await makeScene(path.join(projectRoot, scene.source), sceneOutput)
      console.log(`${stage.id}/${scene.file}  ${(await fileSize(sceneOutput) / 1024).toFixed(0)} KB`)
    }
  }

  console.log(`\nAssets written to ${outRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
