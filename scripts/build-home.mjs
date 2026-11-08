// 把队长的首页子项目（首页/）构建为 /home/ 子路径静态包，
// 部署到主站 web/public/home/，与 3D 立体书同源提供。
// 用法：在 web/ 下执行 npm run build:home，或 node scripts/build-home.mjs
import { cpSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const homeDir = join(repoRoot, '首页')
const distDir = join(homeDir, 'dist')
const targetDir = join(repoRoot, 'web', 'public', 'home')

// vite 装在首页子项目里，从它的 package.json 位置解析，避免与主站版本耦合
const requireFromHome = createRequire(join(homeDir, 'package.json'))
const { build } = requireFromHome('vite')

// 遵义票根撕开后跳转到同源根路径的立体书
process.env.VITE_ZUNYI_URL = '/'

await build({
  root: homeDir,
  base: '/home/',
  logLevel: 'info',
})

rmSync(targetDir, { recursive: true, force: true })
cpSync(distDir, targetDir, { recursive: true })

console.log(`\n[build-home] 已部署到 ${targetDir}`)
console.log('[build-home] 本地访问 http://localhost:5173/home/，遵义票根跳转至 /')
