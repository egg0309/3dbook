import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// /home 是构建后放入 public/home 的首页子站；目录 URL 会被 SPA 回退截走，
// 显式改写到它的 index.html，保留 /home/ 这个干净网址
const homeSubpath: Plugin = {
  name: 'home-subpath-rewrite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/home' || req.url === '/home/') {
        req.url = '/home/index.html'
      }
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/home' || req.url === '/home/') {
        req.url = '/home/index.html'
      }
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': {
      target: env.VITE_AGENT_PROXY_TARGET || 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), homeSubpath],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    // 内网穿透域名白名单（内测用）：localtunnel 与 cloudflare quick tunnel
    server: { proxy, allowedHosts: ['.loca.lt', '.trycloudflare.com'] },
    preview: { proxy, allowedHosts: ['.loca.lt', '.trycloudflare.com'] },
  }
})
