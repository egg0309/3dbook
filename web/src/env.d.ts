interface ImportMetaEnv {
  /** mock = 前端内置演示；live = 调用真实 /api/chat */
  readonly VITE_AGENT_MODE?: 'mock' | 'live';
  /** 真实智能体接口地址，默认 /api/chat */
  readonly VITE_AGENT_API_URL?: string;
  /** 仅开发/预览：Vite 代理目标，默认 http://127.0.0.1:8000 */
  readonly VITE_AGENT_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
