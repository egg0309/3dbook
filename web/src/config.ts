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

export type ChapterStatus = 'active' | 'soon';

export interface Chapter {
  id: string;
  index: string;
  title: string;
  status: ChapterStatus;
}

export const CHAPTERS: Chapter[] = [
  { id: 'zunyi', index: '01', title: '遵义会议', status: 'active' },
  { id: 'chishui', index: '02', title: '四渡赤水', status: 'soon' },
  { id: 'jinsha', index: '03', title: '巧渡金沙江', status: 'soon' },
  { id: 'luding', index: '04', title: '飞夺泸定桥', status: 'soon' },
  { id: 'snow', index: '05', title: '雪山草地', status: 'soon' },
  { id: 'join', index: '06', title: '会师陕北', status: 'soon' },
];

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
