# 遵义会议历史推演智能体 · 前端对接说明

> 本文档是给后端/智能体同学的对接契约。产品玩法与 LLM Prompt 的权威来源仍是仓库根目录的
> `遵义会议历史推演智能体 - 核心逻辑与后端对接文档.md`。
>
> 当前状态：前端已完成三关推演、单选卡片、自由输入兜底、复盘报告、错误重试、关闭/重开、本地 Mock 和真实 `/api/chat` 适配层。后端只需按本文返回 JSON。

![推演面板](preview/05-agent-panel.png)

---

## 一、前端已经做了什么

- 书打开后，右下角出现“进入历史推演”；点击后从右侧滑出推演面板（移动端全屏）。
- 开场旁白与老陈的第一句台词由前端直接渲染，不调用接口（与产品文档一致）。
- 三个关卡各 4 个选项，以键盘可访问的按钮卡片呈现；点击发送代号（`1A`…`3D`）。
- 自由输入框保留：用于“复盘”指令，也用于展示非选项输入的兜底逻辑。
- 后端返回 `nextStage` 后，前端切换到下一关，并继续用本地脚本渲染对应的 4 个选项。
- 复盘：三关结束后出现“生成推演复盘”按钮，也可输入“复盘”；后端返回 `report` 后，以纸质报告卡呈现。
- 请求失败/超时会显示错误条和“重试”，重试会重发同一请求，不会丢关卡状态。
- 本地 Mock 模式可完整走通全流程（默认开启），方便后端未就绪时演示。

入口位置：

![入口](preview/08-agent-entry.png)

---

## 二、运行模式与切换

前端只读取两个环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_AGENT_MODE` | `mock` | `mock` 使用前端内置演示；`live` 调用真实接口 |
| `VITE_AGENT_API_URL` | `/api/chat` | 接口路径或完整 URL |
| `VITE_AGENT_PROXY_TARGET` | `http://127.0.0.1:8000` | 仅开发/预览：Vite 把 `/api` 代理到该地址 |

### 本地切到真实后端

1. 在 `web/` 下复制 `.env.example` 为 `.env.local`：
   ```bash
   VITE_AGENT_MODE=live
   VITE_AGENT_API_URL=/api/chat
   VITE_AGENT_PROXY_TARGET=http://127.0.0.1:8000
   ```
2. 后端监听 `127.0.0.1:8000`，实现 `POST /api/chat`。
3. 重启 `npm run dev`。页面底部徽标会从“本地演示”变成“在线推演”。

### 生产环境

- 推荐前后端同源部署：Web 服务器把 `/api/*` 反向代理到后端，`VITE_AGENT_MODE=live`、`VITE_AGENT_API_URL=/api/chat`。
- 如果接口在独立域名：把 `VITE_AGENT_API_URL` 设为完整 URL，并在后端配置 CORS；Vite 的 proxy 只在 dev/preview 生效。
- **API Key 只能放在后端**，不要写进 `VITE_*`、前端代码或浏览器请求。
- `VITE_AGENT_MODE` 是构建时变量，修改后需要重新构建。

---

## 三、接口契约

### 3.1 请求

`POST /api/chat`，`Content-Type: application/json`。

```json
{
  "sessionId": "9b8f0c8e-...",
  "stage": "level1",
  "choice": "1A",
  "message": "可选，自由输入内容",
  "choices": {
    "choice_1": "1A",
    "choice_2": "2A",
    "choice_3": null
  }
}
```

字段说明：

| 字段 | 类型 | 何时出现 | 说明 |
|---|---|---|---|
| `sessionId` | string | 总是 | 前端每次打开/重置推演生成的 UUID；可用于日志/会话 |
| `stage` | `level1` \| `level2` \| `level3` \| `review` | 总是 | 当前正在作答的关卡；复盘时为 `review` |
| `choice` | `1A`…`3D` | 点击选项卡片时 | 当前关卡选择的代号 |
| `message` | string | 自由输入/复盘 | 自由输入文本；复盘时为 `"复盘"` |
| `choices` | object | 总是 | 已累计的前两关（或全部三关）选择；方便后端无状态计算 |
| `choices.choice_1/2/3` | `1A`…`3D` \| 缺省 | 按进度 | 注意：点击当前选项时，`choices` 里还没有这一次的选择，后端应把 `choice` 与 `choices` 合并理解 |

> 建议后端按“`stage` + `choice`”路由到产品文档里对应的 LLM Prompt。`sessionId` 不是必需的，前端已经把关键状态放在请求里，后端可以无状态实现。

### 3.2 响应

```json
{
  "reply": "老陈的台词，纯文本",
  "nextStage": "level2",
  "report": "仅 nextStage=done 时返回的复盘正文",
  "fallback": false
}
```

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `reply` | string | 是 | 老陈（或兜底）台词；纯文本，可含换行，禁止 Markdown/JSON/思考过程 |
| `nextStage` | `level1` \| `level2` \| `level3` \| `review` \| `done` | 是 | 答复后的阶段；选项卡片由前端按该阶段渲染 |
| `report` | string | `done` 时必需 | 个性化复盘正文；纯文本，可含空行 |
| `fallback` | boolean | 否 | 非选项输入的兜底标记；建议同时让 `nextStage` 保持当前关 |

前端校验：

- `reply` 为空会显示错误并允许重试。
- `nextStage` 缺失时前端会按“有 choice 则进下一关、无 choice 则停留在当前关”做兼容推断；但**请后端明确返回**，避免歧义。
- `nextStage=done` 但缺少 `report` 会被前端判为接口错误。
- 非 2xx、非 JSON、字段类型错误、12 秒超时，都会进入错误条 + 重试。
- 重试会重发同一个 payload；后端应尽量幂等，不要在失败/重试时重复扣费或重复推进会话。

### 3.3 阶段流转

| 当前 `stage` | 输入 | 期望 `nextStage` |
|---|---|---|
| `level1` | `choice=1A/1B/1C/1D` | `level2` |
| `level2` | `choice=2A/2B/2C/2D` | `level3` |
| `level3` | `choice=3A/3B/3C/3D` | `review` |
| `level1/2/3` | 非选项自由文本 | 原 `stage` + `fallback:true` |
| `review` | `message="复盘"` | `done` + `report` |
| `review` | 其他文本 | `review` + 兜底台词 |

> 选项本身不需要后端返回；标签固定在前端脚本里。如果后端想返回额外选项，请先与前端约定，当前版本不会读取。

### 3.4 示例

**第一关点 1A**

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo","stage":"level1","choice":"1A","choices":{}}'
```

```json
{
  "reply": "凯丰说毛泽东同志只照着两本书打仗……你说，这问题出在哪？",
  "nextStage": "level2"
}
```

**自由输入兜底**

```json
{
  "sessionId": "demo",
  "stage": "level2",
  "message": "今天天气不错",
  "choices": { "choice_1": "1A" }
}
```

```json
{
  "reply": "老陈疑惑地看了看你：“小同志，发什么愣呢！……”",
  "nextStage": "level2",
  "fallback": true
}
```

**复盘**

```json
{
  "sessionId": "demo",
  "stage": "review",
  "message": "复盘",
  "choices": { "choice_1": "1A", "choice_2": "2A", "choice_3": "3D" }
}
```

```json
{
  "reply": "老陈把一张写满字的纸递给你……",
  "nextStage": "done",
  "report": "你最后选择了独立思考、实事求是……"
}
```

---

## 四、后端如何接产品文档里的 Prompt

后端拿到的 `stage` 与 `choice` 可以直接映射到源文档的节点：

| 请求 | 源文档节点 |
|---|---|
| `stage=level1`, `choice=1A` | 【1A】追问老陈“凯丰为什么这么说” → LLM 输出 Prompt |
| `stage=level1`, `choice=1B` | 【1B】问老陈“湘江到底损失了多少” |
| … | 同理到 3D |
| `stage=review`, `message=复盘` | 关卡四：复盘总结（把 `choices` 传给复盘 Prompt） |
| 其他自由文本 | 异常兜底逻辑：返回写死的兜底文案 |

- 老陈台词的全局 System Prompt、语气、字数、禁用 Markdown/JSON/思考过程等约束，全部以源文档为准。
- 前端已经渲染下一关的选项卡片，所以后端回复里**可以省略**“请回复 2A 或 2B”这类指令；如果保留，也不会破坏 UI，只是会和卡片重复。
- 复盘正文建议按源文档的“肯定与解析 / 精准点拨 / 可迁移启示”三段来写；前端会把换行渲染出来。
- 源文档要求台词不超过 100 字、复盘不超过 250 字；前端不会强制截断，请在后端 Prompt/校验中控制。
- 建议使用轻量模型并关闭流式输出，目标 2 秒内返回；前端超时是 12 秒。未来如要流式，需要额外改前端。
- 后端应对模型输出做校验：如果出现 Markdown、JSON、括号动作描写、编造党史内容等，直接回退到安全文案或重试。

---

## 五、前端实现位置

| 文件 | 作用 |
|---|---|
| `web/src/features/agent/agentApi.ts` | mock/live 切换、`fetch('/api/chat')`、超时、响应校验 |
| `web/src/features/agent/useAgent.ts` | 推演状态机、选择/复盘/自由输入、错误重试、会话重置 |
| `web/src/features/agent/AgentPanel.tsx` | 面板、消息流、选项卡片、复盘/报告、输入框 |
| `web/src/features/agent/script.ts` | 开场白、三关文案与选项、阶段流转常量 |
| `web/src/features/agent/mockAgent.ts` | 本地演示数据与复盘生成（仅 mock 模式动态加载） |
| `web/src/features/agent/types.ts` | 请求/响应/消息类型 |
| `web/src/features/agent/agent.css` | 面板视觉与响应式 |
| `web/.env.example` | 环境变量样例 |
| `web/vite.config.ts` | `/api` 开发/预览代理 |

- 如果只改 LLM 台词，**不需要动前端**；后端按契约返回即可。
- 如果要改关卡选项/卡片文案，改 `script.ts`，同时让后端按新的代号路由。
- 如果要改面板视觉，改 `agent.css`。

---

## 六、测试清单

已在本地验证：

- [x] Mock 模式：完整三关 → 复盘报告 → 重新推演。
- [x] 选项卡片：1A → 2A → 3D，进入复盘。
- [x] 自由输入：返回兜底台词，选项保留。
- [x] 关闭/重开面板，进度保留。
- [x] 移动端 390×844：全屏面板、三关、报告。
- [x] Live 适配：接口 500 → 错误条 → 重试成功 → 后续关卡 → 报告。
- [x] 无浏览器控制台错误。

后端接入后建议再走一遍：

1. 每个选项都点一次，确认回复与下一关匹配。
2. 在当前关输入乱码/闲聊，确认返回兜底且 `nextStage` 不变。
3. 第三关后输入“复盘”，确认 `report` 返回且前端显示。
4. 后端故意返回 500/超时/空 reply，确认前端错误条和重试。
5. 刷新页面/关闭重开，确认符合预期（当前会话状态在内存中，刷新会重置）。
6. 手机端真实触屏滚动面板。

---

## 七、已知限制与后续可扩展

- 目前是**单会话、内存态**：页面刷新后重新开始；如需续玩，可在 `useAgent` 里读写 `sessionStorage`，或让后端按 `sessionId` 持久化。
- 不支持流式输出；当前是一次性 JSON。
- 自由输入是次要路径，主要交互仍是选项卡片；后端应对自由输入统一做兜底/审核。
- 只有一个 NPC 老陈；后续可扩展多角色/多轮追问。
- 报告是纯文本；后续可做分享图/长图/收藏。
- 没有鉴权和限流；上线前请在后端加会话校验、频率限制、内容审核和成本控制。

---

## 八、安全与内容约束

- 前端不持有任何模型 Key；所有模型调用在后端。
- 用户自由输入属于不可信输入：后端要用系统 Prompt 约束“老陈”的认知边界，不执行用户注入的指令，不编造党史信息。
- 涉及真实历史人物时，保持庄重、克制，不做戏说、不渲染血腥；必要时输出兜底。
- 对接口做输入长度限制（前端 `maxLength=200`，后端仍需校验）、速率限制和超时。
- 推演内容标注“基于党史资料改编，仅用于教学；请以权威史料为准”，该文案已在前端面板底部展示。
