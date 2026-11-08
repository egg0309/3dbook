export const SITE = {
  brand: '星火长征',
  brandEn: 'SPARKS OF THE LONG MARCH',
  platform: '数字思政育人平台',
  chapterIndex: '第一章',
  chapter: '遵义会议',
  chapterEn: 'THE ZUNYI CONFERENCE',
  date: '1935.01.15 — 01.17',
  location: '贵州 · 遵义',
  tagline: '生死攸关的转折点',
} as const;

/**
 * 章节 id。zunyi / xiangjiang / tongdao / chishui / luding / snow / hada /
 * huishi 已经接入 3D 书本场景，其余章节保留在导航里，状态为 soon。
 */
export type ChapterId =
  | 'zunyi'
  | 'xiangjiang'
  | 'tongdao'
  | 'chishui'
  | 'jinsha'
  | 'luding'
  | 'snow'
  | 'hada'
  | 'huishi';

/** active = 已接入，可点击阅读；soon = 筹备中，导航置灰 */
export type ChapterStatus = 'active' | 'soon';

export interface Chapter {
  id: ChapterId;
  index: string;
  title: string;
  status: ChapterStatus;
}

export const CHAPTERS: Chapter[] = [
  { id: 'zunyi', index: '01', title: '遵义会议', status: 'active' },
  { id: 'xiangjiang', index: '02', title: '湘江血战', status: 'active' },
  { id: 'tongdao', index: '03', title: '通道会议', status: 'active' },
  { id: 'chishui', index: '04', title: '四渡赤水', status: 'active' },
  { id: 'luding', index: '05', title: '飞夺泸定桥', status: 'active' },
  { id: 'snow', index: '06', title: '雪山草地', status: 'active' },
  { id: 'hada', index: '07', title: '哈达铺', status: 'active' },
  { id: 'huishi', index: '08', title: '三军会师', status: 'active' },
];

export interface ChapterMeta {
  /** 中文序号，例如「第一章」 */
  index: string;
  /** 英文序号，例如「CHAPTER 01」 */
  number: string;
  chapter: string;
  chapterEn: string;
  date: string;
  location: string;
  tagline: string;
}

/**
 * 已接入章节的标题 / 年代 / 地点文案。
 * 顶栏、左侧章节信息、开卷提示都从当前章节读取，
 * 这样切到雪山草地时，界面文案不会还停在遵义会议。
 */
const ZUNYI_META: ChapterMeta = {
  index: '第一章',
  number: 'CHAPTER 01',
  chapter: '遵义会议',
  chapterEn: 'THE ZUNYI CONFERENCE',
  date: '1935.01.15 — 01.17',
  location: '贵州 · 遵义',
  tagline: '生死攸关的转折点',
};

export const CHAPTER_META: Partial<Record<ChapterId, ChapterMeta>> = {
  zunyi: ZUNYI_META,
  xiangjiang: {
    index: '第二章',
    number: 'CHAPTER 02',
    chapter: '湘江血战',
    chapterEn: 'THE BATTLE OF XIANGJIANG',
    date: '1934.11.27 — 12.01',
    location: '广西 · 湘江',
    tagline: '向死而生的绝命后卫',
  },
  tongdao: {
    index: '第三章',
    number: 'CHAPTER 03',
    chapter: '通道会议',
    chapterEn: 'THE TONGDAO MEETING',
    date: '1934.12.12',
    location: '湖南 · 通道',
    tagline: '转兵贵州，绝处逢生',
  },
  chishui: {
    index: '第四章',
    number: 'CHAPTER 04',
    chapter: '四渡赤水',
    chapterEn: 'FOUR CROSSINGS OF THE CHISHUI RIVER',
    date: '1935.01 — 03',
    location: '贵州 · 赤水河',
    tagline: '运动战的巅峰',
  },
  luding: {
    index: '第五章',
    number: 'CHAPTER 05',
    chapter: '飞夺泸定桥',
    chapterEn: 'THE FLYING CAPTURE OF LUDING BRIDGE',
    date: '1935.05.29',
    location: '四川 · 泸定桥',
    tagline: '二十二勇士的生死突击',
  },
  snow: {
    index: '第六章',
    number: 'CHAPTER 06',
    chapter: '雪山草地',
    chapterEn: 'SNOW MOUNTAINS AND GRASSLANDS',
    date: '1935.06 — 08',
    location: '四川 · 夹金山 / 松潘草地',
    tagline: '生命极限的远征',
  },
  hada: {
    index: '第七章',
    number: 'CHAPTER 07',
    chapter: '哈达铺',
    chapterEn: 'HADAPU',
    date: '1935.09',
    location: '甘肃 · 哈达铺',
    tagline: '一张报纸定方向',
  },
  huishi: {
    index: '第八章',
    number: 'CHAPTER 08',
    chapter: '三军会师',
    chapterEn: 'JOINING OF THE THREE MAIN FORCES',
    date: '1936.10',
    location: '甘肃 · 会宁',
    tagline: '长征胜利结束',
  },
};

/** 未接入章节回退到遵义会议文案，避免导航始终显示空白 */
export function getChapterMeta(id: ChapterId): ChapterMeta {
  return CHAPTER_META[id] ?? ZUNYI_META;
}

/**
 * 美术资产接入位。
 *
 * 默认全部为 null，程序会用 Canvas 现场生成占位材质。
 * 队友拿到 AI 图后，把文件放进 `public/book/`，再把对应路径填进来即可，
 * 场景无需改代码就会自动替换。推荐尺寸与提示词见仓库根目录
 * `docs/ART_ASSET_PROMPTS.md`。
 */
export const BOOK_ASSETS: {
  coverFront: string | null;
  coverBack: string | null;
  cloth: string | null;
  endpaper: string | null;
  paper: string | null;
  pageEdge: string | null;
} = {
  // 封面底图：只放布料/做旧底纹，不要文字、金属边框和五角星，
  // 标题、印章、立体星徽与金属包角都由代码叠加。
  coverFront: null,
  // 封底底图：只放底纹，不要文字。
  coverBack: null,
  cloth: null,
  endpaper: null,
  paper: null,
  pageEdge: null,
};

/** 轮播节奏（秒） */
export const BACKDROP_TIMING = {
  hold: 8.5,
  transition: 2.4,
} as const;

/** 书本翻开动画时长（秒） */
export const BOOK_OPEN_DURATION = 4.4;
