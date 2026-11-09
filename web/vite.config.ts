import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// 入口编排：根路径 / 302 到长征首页子站 /home/（首页产物用相对路径，
// 必须落在 /home/ 下资源才能解析）；立体书展馆改由 /zunyi 进入，
// 目录 URL 会被 SPA 回退截走，这里显式改写到对应 index.html
function entryMiddleware(
  req: { url?: string },
  res: {
    statusCode: number
    setHeader: (name: string, value: string) => void
    end: () => void
  },
  next: () => void,
) {
  const path = (req.url ?? '/').split('?')[0]
  if (path === '/') {
    res.statusCode = 302
    res.setHeader('Location', '/home/')
    res.end()
    return
  }
  if (path === '/home' || path === '/home/') {
    req.url = '/home/index.html'
  } else if (path === '/zunyi' || path === '/zunyi/') {
    req.url = '/index.html'
  }
  next()
}

const homeSubpath: Plugin = {
  name: 'home-subpath-rewrite',
  configureServer(server) {
    server.middlewares.use(entryMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use(entryMiddleware)
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
    // 内网穿透域名白名单（内测用）
    server: {
      proxy,
      allowedHosts: [
        '.loca.lt',
        '.trycloudflare.com',
        '.lhr.life',
        '.pinggy.link',
        '.pinggy-free.link',
        '.pinggy.net',
        '.natappfree.cc',
        '.natapp1.cc',
        '.natapp4.cc',
      ],
    },
    preview: {
      proxy,
      allowedHosts: [
        '.loca.lt',
        '.trycloudflare.com',
        '.lhr.life',
        '.pinggy.link',
        '.pinggy-free.link',
        '.pinggy.net',
        '.natappfree.cc',
        '.natapp1.cc',
        '.natapp4.cc',
      ],
    },
  }
})
