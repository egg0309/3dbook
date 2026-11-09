# 《星火长征 · 遵义会议》3D 立体书 · 美术资产提示词包

> 版本：v0.1（2026-11-04）
> 用途：交给 Midjourney / Stable Diffusion / Flux / 即梦 / 可灵 / 通义万相等图像生成工具，产出可替换进 `web` 的 3D 书美术资产。
> 当前状态：程序内已有一整套 Canvas 程序化占位材质，**不替换也能完整运行**；按本文档产出后，只需在 `web/src/config.ts` 填路径即可无缝替换。

---

## 一、先看这里：资产怎么进项目

### 1.1 代码槽位与文件命名

所有封面/内页图片放进 `web/public/book/`，通过 `web/src/config.ts` 的 `BOOK_ASSETS` 接入：

| `BOOK_ASSETS` 键 | 推荐文件名 | 推荐尺寸 | 用途 | 代码是否再叠加内容 |
|---|---|---|---|---|
| `coverFront` | `cover-front-base.webp` | 1240 × 1712 | 封面**底图** | 是：金色书名、印章、金属边框、立体五角星、金属包角 |
| `coverBack` | `cover-back-base.webp` | 1240 × 1712 | 封底**底图** | 是：金属圆环、`THE LONG MARCH`、金属边框、金色五角星 |
| `cloth` | `cloth-crimson.webp` | 1024 × 1024（四方连续） | 书壳布面 | 否 |
| `endpaper` | `endpaper-map.webp` | 1240 × 1712 | 打开后左页（内衬页） | 否 |
| `paper` | `paper-aged.webp` | 1024 × 1024（四方连续） | 内页纸纹（同时用于第一页） | 否 |
| `pageEdge` | `page-edge.webp` | 512 × 1024 | 书口/页块侧边 | 否 |

> **最重要的一条：封面和封底的 AI 图不要带任何文字、金属边框、五角星或样机透视。**
> 那本书的“书”是程序里的 3D 网格，书名、印章、星徽和金属包角都由 Three.js 叠加。AI 只负责提供布料/纸张/做旧底纹，这样中文字不会被 AI 画歪，且实物金属件有真实立体感和反光。

### 1.2 接入步骤

1. 把图片按上表命名，放进 `web/public/book/`。
2. 打开 `web/src/config.ts`，把对应项从 `null` 改成 `/book/xxx.webp`：
   ```ts
   coverFront: '/book/cover-front-base.webp',
   endpaper: '/book/endpaper-map.webp',
   ```
3. 重新运行 `npm run dev`（或刷新页面）。加载失败时程序会自动保留占位材质并在控制台给出警告，不会崩。
4. 背景图片放进仓库根目录 `photo/`，然后在 `web` 下运行：
   ```bash
   npm run assets:backdrops
   ```
   脚本会把所有图片压成 1920 宽的 WebP，轮播自动读取。

### 1.3 尺寸与比例

- 封面/封底：书壳比例约 **0.723**（宽/高）。生成 3:4 后裁成 **1240 × 1712**（或 1536 × 2120），不要直接拉伸。
- 内衬页：约 **0.717**，同样按 3:4 生成后裁到 1240 × 1712。
- 布面、纸纹必须是**四方连续**（左右和上下边缘能无缝拼接），否则书脊和封面会上出现明显接缝。
- 单张控制在 1.5MB 以内，全部资产建议不超过 8MB，WebP 质量 80–85。

---

## 二、统一美术方向

### 2.1 一句话风格

> 1935 年遵义会议时期的一本旧书：深朱砂红粗布书壳、土黄手工纸、黄铜包角与五角星、低照度油灯、冷蓝灰雾气、旧照片颗粒、克制而肃穆，像博物馆档案而不是商业海报。

### 2.2 色彩

| 名称 | 色值 | 用法 |
|---|---|---|
| 深朱砂红 | `#4C0A06` | 书壳、星徽暗部 |
| 朱砂红 | `#A62B22` | 封面主色、印章、强调 |
| 旧纸黄 | `#D9C9A8` | 内页、内衬页 |
| 黄铜金 | `#C8A45C` | 书名、边框、包角、封底圆环 |
| 炭黑 | `#0B0908` | 背景、阴影 |
| 灯焰橙 | `#FFC98F` | 油灯光、页面暖光 |
| 军灰 | `#6B6B5E` | 背景人物服装（不要抢主色） |

### 2.3 材质与光线

- **布**：粗棉/粗麻，能看到经纬线，有褪色、水渍、磨损、轻微起毛；不要光面皮革、不要塑料。
- **纸**：手工纸/宣纸，纤维、茶渍、边缘发黄，局部有很淡的霉点；不要纯白、不要现代打印纸。
- **金属**：旧黄铜/青铜，有氧化和指纹，不要镜面不锈钢、不要亮金。
- **红星**：暗红漆面，边缘有磨损，不要发光、不要塑料红。
- **光线**：单一暖色油灯作主光，冷蓝灰环境光做对比；低照度、体积雾、轻胶片颗粒；避免影棚打光和 HDR。
- **构图**：封面中间留一条低对比竖向区域给金色书名，顶部中央留一块相对干净的区域给立体星徽；四角可以深一点，让金属包角压得住。

### 2.4 史实与表达

- 时代：1935 年 1 月，贵州遵义；红军灰蓝色军装、红领章/红星、绑腿、草鞋、斗笠、油灯、马灯、地图、竹筏、电报机。
- 不要出现现代拉链、迷彩、战术头盔、塑料制品、现代logo、日式/西式军装。
- 不要画真实历史人物的可辨识正脸特写；用群像、背影、侧影、手部、剪影和物件叙事。这是思政教育平台，庄重、克制、尊重史实，不做戏说、不做血腥。
- 所有场景都要有“历史现场”的质感，而不是游戏 CG 或动漫。

### 2.5 通用正向词（英文，可粘在每条提示词后面）

```text
historical Chinese Red Army, Long March 1935, Zunyi Conference period, 1930s Chinese revolutionary material culture, cinematic low-key lighting, warm oil lantern key light, cold blue-grey mist, weathered textures, handmade paper, aged brass, dark crimson cloth, fine film grain, muted desaturated palette, solemn restrained atmosphere, museum archive, photorealistic, ultra detailed, no modern elements
```

### 2.6 通用负向词

```text
text, watermark, signature, logo, modern clothing, modern equipment, plastic, glossy CGI, anime, cartoon, illustration, 3D render look, oversaturated, neon, lens flare, HDR, bright daylight, clean studio background, gore, blood, violence, western military uniforms, Japanese uniforms, sci-fi, deformed hands, extra fingers, distorted perspective, book mockup, perspective shadow, frame, border
```

> 注：做**书壳底图**时，负向词里务必再加 `text, Chinese characters, star, emblem, metal frame, metal corners, spine, pages, mockup`。

### 2.7 一致性技巧

- 先做一张“风格母图”（建议用封面底图），后续所有资产用它做 `--sref` / 图生图 / 参考图，保持同一套红、黄、灰和金。
- 同一系列用同一个种子/参考图；背景人物只换姿势和场景，不换服装体系。
- 不要每条都重新描述风格；把 2.5 的通用正向词固定追加。
- 生成后统一做一次轻度降饱和 + 加胶片颗粒 + 压暗四角，保证放进 3D 场景里不跳。

---

## 三、资产 1：封面底图（coverFront）

### 3.1 画面要求

- 满版深朱砂红粗布，布纹清晰但整体低对比。
- 下半部可以极淡地融入贵州喀斯特山峦/长征路线的水墨剪影（不超过 10% 对比度）。
- 中间偏下留一条**低对比竖向区域**给金色书名；顶部中央留干净区域给立体星徽。
- 不出现文字、汉字、五角星、徽章、金属边框、包角、书脊、书页、阴影、透视、样机。
- 这是“平面扫描纹理”，不是一本书的照片。

### 3.2 英文提示词（Midjourney / Flux / SD）

```text
Flat-lay texture of an antique 1930s Chinese hardcover book cover, full-bleed dark crimson hand-woven cotton cloth over board, deep garnet red with subtle indigo-black undertones, visibly coarse weave, faded and weathered, faint water stains, rubbed edges, aged patina, very subtle ink-wash silhouette of Guizhou karst mountains and a winding Long March trail ghosted into the lower third at about 8 percent contrast, faint hand-drawn contour lines and an old route map barely visible in the cloth, small cracks and scratches, central vertical strip kept calm and low-contrast for a gold Chinese title overlay, top-center area relatively clean for a three-dimensional star medallion, absolutely no text, no Chinese characters, no star, no emblem, no metal frame, no border, no metal corners, no spine, no pages, no mockup, flat orthographic scan, even diffuse museum lighting, no perspective, no shadow, ultra detailed fabric texture, muted cinematic palette, solemn historical atmosphere --ar 3:4 --style raw --v 7
```

### 3.3 中文提示词（即梦 / 可灵 / 通义万相）

```text
平铺扫描的1930年代中国旧书封面底纹，满版深朱砂红手工粗棉布，暗红透一点黑，布面有清晰但柔和的经纬织纹、褪色、水渍、磨损和细小裂纹；下三分之一以极低对比度隐约融入贵州喀斯特山峦和蜿蜒长征路线的水墨剪影，布面还残留极淡的手绘等高线和旧地图痕迹；画面中间竖向留出一条低对比区域，方便后期叠加金色中文书名；顶部中央相对干净，方便放置立体五角星徽章；绝对不要任何文字、汉字、五角星、徽章、金属边框、金属包角、书脊、书页、阴影、透视或书籍样机；正面平扫、均匀柔光、博物馆档案质感、超细节布纹、低饱和电影感、庄重历史氛围，比例3:4。
```

### 3.4 负向词

```text
text, Chinese characters, calligraphy, title, star, emblem, badge, metal frame, border, metal corners, book mockup, spine, pages, perspective, shadow, highlight, glossy leather, plastic, bright red, oversaturated, modern
```

### 3.5 验收标准

- [ ] 完全没有文字/汉字/星徽/边框/包角。
- [ ] 中间竖向区域足够暗、足够平，金色书名叠上去能读清。
- [ ] 顶部中央没有强烈花纹，立体星徽放上去不打架。
- [ ] 四周边缘和中心的色差不要太大，金属边框压上去自然。
- [ ] 裁切到 1240×1712 后没有拉伸变形。

---

## 四、资产 2：封底底图（coverBack）

### 4.1 画面要求

- 比封面更暗、更安静，仍为深朱砂红粗布。
- 中央可以有一个极淡的圆形压痕/旧印痕，给代码叠加的金属圆环和 `THE LONG MARCH` 让位。
- 不出现文字、金属件、五角星、样机。

### 4.2 英文提示词

```text
Flat-lay texture of the back cover of an antique 1930s Chinese hardcover book, full-bleed very dark crimson hand-woven cotton cloth over board, deep oxblood red with black undertones, coarse visible weave, heavy aging, faded patches, water stains, rubbed corners, faint circular embossed ghost in the center like an old medallion imprint removed, very subtle ink-wash mountain contours in the background at low contrast, no text, no Chinese characters, no star, no emblem, no metal frame, no metal corners, no spine, no pages, no mockup, flat orthographic scan, even diffuse museum lighting, no perspective, no shadow, ultra detailed fabric, muted cinematic palette, solemn and quiet historical atmosphere --ar 3:4 --style raw --v 7
```

### 4.3 中文提示词

```text
平铺扫描的1930年代中国旧书封底底纹，满版极暗的朱砂红手工粗棉布，暗红近黑，粗布经纬明显，重度做旧、褪色斑块、水渍、四角磨白；中央有一个非常淡的圆形压痕，像旧徽章被取下后留下的印子，给后期叠加的金属圆环和英文文字让位；背景有极低对比度的水墨山峦轮廓；不要任何文字、汉字、五角星、徽章、金属边框、包角、书脊、书页、阴影、透视或样机；正面平扫、均匀柔光、超细节布纹、低饱和电影感、安静肃穆，比例3:4。
```

### 4.4 负向词

同封面底图。

---

## 五、资产 3：内衬页 / 长征路线地图（endpaper）

### 5.1 画面要求

- 旧手工纸，茶黄、纤维、淡淡霉点。
- 一张手绘感的贵州北部地形图：等高线、河流、极淡的网格，一条红色路线从东侧蜿蜒到遵义，遵义位置有一颗小红星和细小的红色标记。
- 建议**不要依赖 AI 写中文**；画面可以完全无文字，靠路线、红星和纸张质感叙事。如果一定要字，只用极小的、模糊的“遵义/1935”作为装饰，不要求可读。
- 四周有一圈很细的做旧金色双线边框（因为内衬页没有物理金属框）。
- 这是平铺扫描，不是地图册照片。

### 5.2 英文提示词

```text
Flat scan of an aged Chinese handmade paper endpaper, warm tea-stained ivory, visible fibers, subtle foxing and stains, a faint hand-inked topographical map of northern Guizhou with delicate contour lines, rivers and a light pencil grid, a thin muted red route line winding from the east to Zunyi, a small red five-pointed star marker at the destination, very subtle faded red seal impressions in the corners, a fine aged-gold double-line border inset from the edges, no legible text, no large Chinese characters, no modern map symbols, no perspective, no shadow, no book mockup, museum archive paper texture, muted palette, solemn and quiet, ultra detailed --ar 3:4 --style raw --v 7
```

### 5.3 中文提示词

```text
平铺扫描的旧中国手工纸内衬页，茶黄色、可见纤维、淡淡霉点和污渍；纸上有一张很淡的手绘贵州北部地形图，细等高线、河流和轻铅笔网格，一条低饱和的红色路线从东侧蜿蜒到遵义，终点有一颗小红五角星标记，角落有极淡的红色旧印章痕迹；四周有一圈很细的做旧金色双线边框；不要可读文字、不要大号汉字、不要现代地图符号、不要透视、阴影或书籍样机；博物馆档案纸张质感、低饱和、安静肃穆、超细节，比例3:4。
```

### 5.4 负向词

```text
legible text, large Chinese characters, modern map, google maps, satellite image, bright colors, glossy paper, perspective, shadow, mockup, cartoon, infographic, arrows, labels
```

> 注意：内衬页是打开后大面积正对镜头的一页，对比度要低，不能抢内页内容；路线和红星是唯一的视觉焦点。

---

## 六、资产 4：内页纸纹（paper）

### 6.1 画面要求

- 1024×1024，**四方连续**，可无缝平铺。
- 旧手工纸/宣纸，暖象牙色，细纤维、极淡茶渍、轻微云斑。
- 不要文字、格子、横线、水印、亮斑。

### 6.2 英文提示词

```text
Seamless tileable texture of aged Chinese handmade paper, warm ivory and light tea yellow, fine visible cellulose fibers, subtle mottling, faint tea stains, tiny dark specks, soft uneven tone, no text, no lines, no grid, no watermark, no border, flat scan, even diffuse light, ultra detailed, 1024x1024, seamless on all four edges --tile --ar 1:1 --style raw --v 7
```

### 6.3 中文提示词

```text
可无缝平铺的旧中国手工纸纹理，暖象牙色偏茶黄，细纤维清晰，轻微云斑、淡茶渍和细小暗点，色调柔和不均匀；不要文字、横线、格子、水印、边框；平扫、均匀柔光、超细节，1024×1024，上下左右四方连续。
```

### 6.4 负向词

```text
text, lines, grid, ruled paper, watermark, border, bright white, glossy, plastic, crumpled, torn, perspective, shadow
```

---

## 七、资产 5：书口页边纹（pageEdge）

### 7.1 画面要求

- 512×1024，竖向细密层纹，模拟几百张纸叠在一起的侧边。
- 米黄/旧纸色，深浅不一的细线，端部略深，带一点灰尘感。
- 不要文字、图案、强对比。

### 7.2 英文提示词

```text
Extreme close-up texture of the fore-edge of an old hardcover book, hundreds of tightly stacked aged paper pages seen edge-on, fine vertical striations, cream and warm ivory tones, subtle dust, slight uneven page alignment, soft shadows between layers, no text, no pattern, no leather, no cover, flat macro scan, even diffuse light, ultra detailed --ar 1:2 --style raw --v 7
```

### 7.3 中文提示词

```text
旧精装书书口的超近距平扫纹理，几百张叠在一起的旧纸页侧边，细密竖向层纹，米黄和暖象牙色，轻微灰尘、纸张轻微不齐、层与层之间柔和阴影；不要文字、图案、皮革或封面；平扫微距、均匀柔光、超细节，比例1:2。
```

---

## 八、资产 6：布面纹理（cloth，可选）

### 8.1 画面要求

- 1024×1024，四方连续。
- 深朱砂红粗棉/粗麻，经纬线清晰，做旧但不要大块图案。
- 用于书脊、书壳边缘和封面底图之下的布料；如果封面底图已经带布纹，这一张仍然用于书脊，建议同色系。

### 8.2 英文提示词

```text
Seamless tileable texture of dark crimson hand-woven cotton cloth, deep garnet red with subtle black undertones, coarse visible warp and weft, slightly irregular threads, faded and worn, very subtle stains, soft sheen, no pattern, no text, no border, flat macro scan, even lighting, ultra detailed, 1024x1024, seamless on all four edges --tile --ar 1:1 --style raw --v 7
```

### 8.3 中文提示词

```text
可无缝平铺的深朱砂红手工粗棉布纹理，暗红透黑，经纬线清晰、纱线略不匀、褪色磨损、极淡污渍、柔和微光；不要图案、文字、边框；平扫微距、均匀光照、超细节，1024×1024，四方连续。
```

---

## 九、背景影像（photo/，循环轮播）

### 9.1 现有素材

当前 `photo/` 里已有 8 张 16:9 电影感长征场景，程序会用 Halftone 半调 + 做旧棕褐色调循环播放。新增背景只需要：

1. 把图片放进 `photo/`（≥1920 宽，21:9 或 16:9 均可）。
2. 在 `web` 目录运行 `npm run assets:backdrops`。
3. 程序按文件名排序循环，数量不限。

### 9.2 背景统一要求

- 21:9 或 16:9，2560×1097 / 2048×878，≥2K。
- 低照度电影感，单一暖光源（油灯/火把/窗光）建立明暗结构；画面平均亮度不要过低，否则半调网点会变成一片黑。
- 不要文字、字幕、水印、现代物品；人物以背影/剪影/群像为主，不刻意刻画真实历史人物正脸。
- 半调效果会把亮部变成大网点、暗部变成小网点，所以背景需要有明确的亮/暗层次，避免整张中间调灰成一片。

### 9.3 可追加的背景提示词

**A. 遵义会议会址·夜（室内）**

```text
Cinematic wide shot inside a 1930s Chinese wooden meeting hall at night, long wooden table, large hand-drawn military map, two brass oil lanterns glowing warm, several Red Army officers in worn grey-blue uniforms seen from behind and in silhouette, cold blue-grey mist drifting through the room, red cloth banner on the wall, low-key chiaroscuro, fine film grain, muted desaturated palette, solemn and tense atmosphere, no text, no modern objects, no gore, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

**B. 夜渡浮桥**

```text
Cinematic night river crossing during the Long March, bamboo rafts and a narrow pontoon bridge over a fast dark river, soldiers in worn grey uniforms crossing in silhouette, torches and one warm lantern reflecting on the water, cold blue fog, steep karst cliffs, low-key lighting, film grain, muted palette, epic but restrained, no text, no modern equipment, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

**C. 雪山行军**

```text
Cinematic wide shot of a Long March column crossing a snow mountain pass at dawn, tiny silhouettes winding along the ridge, tattered red flag, cold blue snow and warm first light on the peaks, low clouds, wind-blown snow, solemn and quiet, film grain, desaturated palette, no text, no gore, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

**D. 草地夜雨**

```text
Cinematic Long March grassland at night in cold rain, muddy marsh, a line of exhausted soldiers in grey uniforms moving with one dim lantern, reflections in the water, cold blue-grey fog, low-key lighting, film grain, muted palette, solemn, no text, no gore, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

**E. 电报房**

```text
Cinematic close shot of a 1930s Chinese field telegraph room at night, a brass Morse key, old radio equipment, a folded military map, a single oil lamp, a soldier's hand sending a message, warm key light against cold shadows, dust in the air, film grain, muted palette, no text, no modern electronics, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

**F. 地图与油灯**

```text
Cinematic close-up of a hand-drawn Long March route map on a wooden table, brass oil lantern, ink brush, red pencil, a small red star marker at Zunyi, warm lantern light, deep shadows, dust, film grain, muted crimson and amber palette, no text, no modern objects, 21:9, ultra detailed --ar 21:9 --style raw --v 7
```

---

## 十、平台主视觉 / Logo（可选，后续）

当前页面用 CSS/SVG 红星 + 文字标识，没有强制图片 Logo。若需要做比赛主视觉或易班封面，可用：

```text
Minimalist emblem for a Chinese Long March digital education platform, a dark crimson five-pointed star rising above a few ink-wash mountain ridges, aged gold thin ring, deep charcoal background, elegant, solemn, historical archive feeling, vector-like clarity, no text, transparent background, centered, 2048x2048 --ar 1:1 --style raw
```

要求：纯色/透明底、不要文字、不要复杂渐变；交给设计同学加“星火长征”字样。

---

## 十一、3D 道具（可选，后续章节）

以后做内页立体场景时，可以把小道具做成 GLB（Meshy / Tripo / Blender）：

- 黄铜马灯 / 煤油灯：低多边形、PBR、玻璃罩半透明、金属磨损。
- 旧地图卷：卷曲纸边、红铅笔路线。
- 铜印章/墨盒：旧黄铜、木柄。
- 老式电报键：黑漆金属、木质底座。

统一要求：真实比例（灯高 25–35cm）、低多边形（< 20k tris）、单张 2K 贴图、无文字、无品牌、PBR 金属/粗糙度贴图。

---

## 十二、质量检查表（交付前逐项打勾）

- [ ] 封面底图：无文字、无星徽、无金属边框/包角、无书脊/书页/阴影/透视。
- [ ] 封面底图：中间竖条低对比，顶部中央干净，金色书名和立体星徽叠上去不打架。
- [ ] 封底底图：无文字、无星徽，中央有淡圆形压痕。
- [ ] 内衬页：无大号文字，路线和红星清楚，纸张质感真实，四周有细金边。
- [ ] 纸纹/布纹：四方连续，拼接无明显接缝。
- [ ] 所有图像没有 AI 手指/文字/水印/现代物品；人物没有可辨识的真人正脸。
- [ ] 尺寸/比例正确（封面 3:4 裁 1240×1712；纸纹 1024²；书口 512×1024）。
- [ ] WebP 压缩后单张 ≤1.5MB，无明显色带/块状。
- [ ] 在 3D 场景里从正面、侧面、旋转中、打开后各看一遍，颜色和亮度不跳。
- [ ] 史实与表达经团队/指导老师确认，符合思政教育基调。

---

## 十三、版权、史实与合规

- **史实**：遵义会议为 1935 年 1 月 15—17 日，贵州遵义；艺术创作可以集中、象征化，但不要编造具体人物对话、军令或夸张战斗场面。涉及真实历史人物时，避免 AI 生成可辨识面孔，优先用背影、群像、手部、物件。
- **表达**：庄重、克制、尊重；不渲染血腥、不戏说、不娱乐化；这是思政教育平台，不是战争游戏。
- **版权**：AI 生成图请保留所用工具的授权/生成记录；现有 `photo/` 素材需确认团队有权使用；不要直接使用影视剧截图、历史照片或未授权画作。
- **字体**：程序内书名使用系统宋体/华文中宋绘制；如果后续换成商用书法字体，请确认字体授权。
- **开源致谢**：背景半调效果的视觉语言参考了 React Bits 的 Halftone Reveal（MIT + Commons Clause），本项目为独立着色器实现；Three.js / React Three Fiber / anime.js 均为 MIT 等开源许可，详见 `README.md`。

---

## 附：最省事的交付顺序

1. 先生成 **封面底图**，确认红布/金/灰的整体调性。
2. 用同一张参考图生成 **封底底图**、**布纹**，保证一套书壳统一。
3. 生成 **内衬页地图** 和 **纸纹**，这时书的内部质感就完整了。
4. 最后生成 **背景场景**（可以先用现有 8 张），跑 `npm run assets:backdrops`。
5. 把文件放进 `web/public/book/`，改 `web/src/config.ts`，刷新检查。
