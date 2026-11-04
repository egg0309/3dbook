# 星火长征 · 前端工程

第一章“遵义会议”的 3D 立体书前端，含历史推演智能体面板。技术栈：Vite 8 + React 19 + TypeScript 7 + Three.js / React Three Fiber / drei + anime.js 4。项目总览、设计说明、美术资产提示词和智能体对接契约见仓库根目录 [README](../README.md)、[docs/ART_ASSET_PROMPTS.md](../docs/ART_ASSET_PROMPTS.md) 与 [docs/AGENT_INTEGRATION.md](../docs/AGENT_INTEGRATION.md)。

## 命令

```bash
npm install
npm run dev              # 开发服务器
npm run build            # tsc 类型检查 + 生产构建
npm run preview          # 预览 dist
npm run assets:backdrops # 把 ../photo 的图片压成 src/assets/backdrops/*.webp
```

要求 Node ≥ 20（当前环境 Node 24）。浏览器建议 Chrome / Edge 110+（需要 WebGL2）。

> 远端 `前端` 分支未包含 `../photo/` 未压缩原图；仓库里已经带好生成后的 `src/assets/backdrops/*.webp`，直接启动即可。只有替换背景图时才需要本地准备 `photo/` 后重新运行压缩脚本。

## 目录

```
src/
├─ App.tsx                  # 场景 + DOM 覆盖层 + 加载幕
├─ config.ts                # 品牌、章节、资产槽位、轮播与开书时长
├─ journey.ts               # idle → spinning → opening → open 外部 store
├─ styles.css               # 全部 DOM 视觉与响应式
├─ components/
│  ├─ Overlay.tsx           # 品牌、章节信息、目录、进度、推演入口、重置
│  └─ LoadingVeil.tsx       # 加载幕
├─ features/agent/
│  ├─ AgentPanel.tsx        # 推演面板：消息流、选项、复盘、输入
│  ├─ useAgent.ts           # 状态机、请求、重试、重置
│  ├─ agentApi.ts           # mock/live 适配、fetch /api/chat、校验
│  ├─ mockAgent.ts          # 本地演示台词与复盘（动态加载）
│  ├─ script.ts             # 开场白、三关文案/选项
│  ├─ types.ts              # 请求/响应/消息类型
│  └─ agent.css             # 面板视觉与响应式
├─ three/
│  ├─ Scene.tsx             # Canvas、相机、渲染器
│  ├─ Experience.tsx        # 场景装配 + onReady
│  ├─ Book.tsx              # 书体、材质、滚轮/触摸/键盘、相机
│  ├─ bookGeometry.ts       # 五角星挤出、金属包角挤出
│  ├─ textures.ts           # 程序化布纹/封面/封底/内衬/纸纹/书口
│  ├─ useBookTextures.ts    # AI 资产可选覆盖（失败自动回退）
│  ├─ Atmosphere.tsx        # 灯光、环境反射、辉光、投影
│  ├─ Dust.tsx              # 尘埃粒子
│  ├─ HalftoneBackdrop.tsx  # 相机对齐的全屏背景、轮播、指针 uniform
│  └─ halftoneShader.ts     # 半调网点 + 做旧调色 + 转场 + 悬停显影
├─ assets/backdrops/        # 8 张生成的 WebP（由脚本产出）
└─ assets/backdrops/manifest.json
```

## 交互状态机

```
idle --wheel/touch/key--> spinning --(target=1 且平滑值≥0.985)--> opening --4.4s--> open
  ^                                                                                  |
  └──────────────────────────── reset（右下角按钮）────────────────────────────────┘
```

- 滚轮灵敏度：`deltaY * 0.00085`，单次夹到 ±0.18；约 12–15 格走完 360°。
- 展开由时间驱动，不跟手：`BOOK_OPEN_DURATION = 4.4s`，`easeInOutQuart`。
- 展开后相机横向平移到跨页中心，纵轴推近（桌面 `5.0 → 4.75`，竖向屏 `5.8 → 6.8`）。
- 桌面书体缩放 1；竖屏闭合 0.8、展开 0.52，确保 390×844 下跨页完整可见。
- 触屏拖动通过 `PointerEvent` 的 `pointerType === 'touch'` 实现，窗口级监听；画布 `touch-action: none`，推演面板单独 `pan-y` 以支持滚动。
- `--journey` / `--book-open` 由 `useFrame` 写入 `document.documentElement`，DOM 进度条直接读 CSS 变量，避免每帧 React 渲染。

## 背景半调

- 8 张背景在组件内用 `THREE.TextureLoader` **手动加载**（不用 Suspense），加载完成后才挂载背景平面；这样即使某台设备纹理异常，书本场景也不会被卡住。
- 轮播：`hold 8.5s + transition 2.4s`，循环；A/B 纹理 + 对角线噪波扫过的网点显影。
- 网点：45° 旋转网格，`cell 11.5 CSS px`，亮度决定网点半径；深色底、暖铜色墨。
- 在网点下叠了 32% 的做旧原图（sepia 混色），保证背景影像可读，不会只剩噪点。
- 鼠标悬停：指针附近半径 0.142–0.188 的软圆内显示原色照片（React Bits 的显影签名效果）。
- 背景平面挂在“复制相机位置/朝向”的 group 上，位于相机前方 10 个单位，动态按 FOV 缩放，始终铺满视口。
- 视觉语言参考 React Bits 的 Halftone Reveal；着色器为本项目独立实现。

## 3D 书要点

- 尺寸：1.7 × 2.35 × 0.34（世界单位）；封面/封底为 `RoundedBox`，书脊为半圆柱 + 端盖 + 3 道竹节环。
- 页块为 Box，六面材质：书口（+X）、书脊侧（-X，布）、上下切口（±Y，书口纹理）、前后（±Z，纸）。
- 前封面绕书脊侧铰链旋转 -180°；内衬页、金属边框、包角、五角星、书名贴图、印章都是独立层。
- 材质：布面 `MeshPhysicalMaterial`（sheen 0.26 + 程序化 bump）、黄铜 `metalness 0.94`、红漆星徽、纸/书口标准材质。
- 光照：环境光 + 暖色主光 + 红色轮廓光 + 冷色补光 + drei `Environment` 的 Lightformer（无外部 HDR）；书页内有一盏随展开进度亮起的点光。
- 背景/尘埃/辉光都是场景内对象；没有引入后处理（Bloom 等），用 CSS 暗角和颗粒控制氛围，减少透明通道与性能风险。

## 历史推演智能体

开卷后右下角“进入历史推演”打开面板。前端有两种模式：

```bash
# 默认：本地 Mock，不依赖后端，完整体验三关 + 复盘
npm run dev

# 真实后端：复制 env 文件后修改
cp .env.example .env.local       # Windows 可用 copy
# VITE_AGENT_MODE=live
# VITE_AGENT_API_URL=/api/chat
# VITE_AGENT_PROXY_TARGET=http://127.0.0.1:8000
npm run dev
```

- `agentApi.ts` 根据 `VITE_AGENT_MODE` 选择内置 Mock 或 `POST /api/chat`；12 秒超时、非 2xx/空 reply/缺报告都会进入错误条 + 重试。
- `useAgent.ts` 维护 `stage: level1 | level2 | level3 | review | done`、当前选择、消息、报告和失败重试；选项卡片由 `script.ts` 渲染，后端只返回 `reply / nextStage / report / fallback`。
- 三关结束后可点“生成推演复盘”或输入“复盘”；自由输入在非选项情况下由后端返回兜底，前端保留当前选项。
- 面板底部会显示“本地演示 / 在线推演”，方便确认当前模式。
- 接口字段、阶段流转、错误约定、后端 Prompt 映射见 [docs/AGENT_INTEGRATION.md](../docs/AGENT_INTEGRATION.md)。

## 美术资产接入

`src/config.ts`：

```ts
export const BOOK_ASSETS = {
  coverFront: null, // 封面底图（无文字/无边框/无星徽）
  coverBack: null,  // 封底底图
  cloth: null,      // 四方连续布纹
  endpaper: null,   // 内衬地图
  paper: null,      // 四方连续纸纹（同时用于第一页）
  pageEdge: null,   // 书口
};
```

- 把文件放到 `public/book/`，填 `/book/xxx.webp` 即可；`useBookTextures` 会用 `TextureLoader` 异步加载，失败时警告并保留程序化材质。
- **封面底图是叠在程序化书名、金属边框和立体星徽下面的**。所以 AI 图只需做底纹，不要文字/边框/星徽。
- 封底同理：程序会在底图上叠加金属圆环、`THE LONG MARCH` 和金色五角星。
- 详细尺寸、提示词和验收清单见 `docs/ART_ASSET_PROMPTS.md`。

## ReactBits / shadcn 注册表

`components.json` 已加入：

```json
"registries": {
  "@react-bits": "https://reactbits.dev/r/{name}.json"
}
```

因此可以直接在 `web` 下执行：

```bash
npx shadcn@latest add @react-bits/HalftoneReveal-TS-CSS
```

拉取官方组件到 `src/components`。当前背景不依赖官方组件，使用的是定制着色器；官方组件留给后续图文页/画廊使用。`vite.config.ts` 和 `tsconfig.app.json` 已配置 `@/* -> src/*` 别名，便于 shadcn 组件导入。

## 性能与已知限制

- 首屏 JS 约 1.29MB（gzip ~364KB），主要来自 three.js 与 drei；Mock 台词单独切成约 5.8KB 的 chunk，只在 `mock` 模式加载。后续如果增加章节，建议按路由动态 import。
- DPR 上限 1.75；8 张背景 1920 宽、总量约 1.4MB。
- 书名使用系统字体（华文中宋 / 宋体）在 Canvas 里绘制；跨平台时字体会回退，若需要固定书法字体，建议提供字体文件或透明书名贴图。
- 右侧页面当前是空白占位；左内衬页是装饰性路线图，不是严格地理地图。
- 移动端竖屏展开后的书页偏小（受屏幕宽度限制），但完整可见；后续可为手机做“单页阅读”模式。
- 智能体默认是 Mock 演示；真实 LLM 台词/复盘需要后端实现 `/api/chat` 后切 `live`。会话目前只在内存中，刷新页面会重新开始。
- 没有自动化测试；改动后建议在桌面 1600×900 与移动 390×844 各走一遍“滚轮转一圈 → 自动展开 → 进入推演 → 三关 → 复盘 → 重置”，并验证自由输入兜底与接口错误重试。
