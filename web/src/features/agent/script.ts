import type {
  AgentLevel,
  AgentLevelStage,
  AgentMessage,
  AgentOption,
  AgentStage,
  ChoiceCode,
} from './types';

export const AGENT_OPENING = {
  narration:
    '1935年1月，遵义。湘江战役后，红军从8.6万人锐减至3万余人。你是负责传达精神的机要参谋，此刻等在会场外。',
  npc: '小同志，博古同志说失败是因为敌人太强。可凯丰同志说毛泽东同志“照着两本书打仗”。到底是该批评、还是不该批评，我也拿不准。',
} as const;

/** 探索阶段老陈引导语（固定文案，不调 LLM），先引导推门进屋，四处热点看完才进入问答 */
export const EXPLORE_OPENING =
  '小同志，先别急着问话。你瞧见那扇门没有？伸手点一下，把门推开，咱们进会场去——要找的线索全在这屋里头：围坐争论的人、将就当凳的木箱、驱不散寒的火盆、来不及放下的行囊。你一处一处点着看，四处都看遍了，心里有了底，咱们再好好唠。';

/** 计入探索进度的立体书热点 id，与 Book.tsx 的 POPUP_DIALOGS 键对应（bear 只保留 3D 弹窗，不计进度） */
export const HOTSPOT_IDS = [
  'zunyi_people',
  'zunyi_crates',
  'zunyi_stove',
  'zunyi_bag',
] as const;

export type HotspotId = (typeof HOTSPOT_IDS)[number];

export const LEVELS: AgentLevel[] = [
  {
    stage: 'level1',
    index: 1,
    title: '信息迷雾',
    focus: '事实与传言',
    options: [
      { code: '1A', label: '追问老陈“凯丰为什么这么说”' },
      { code: '1B', label: '问老陈“湘江到底损失了多少”' },
      { code: '1C', label: '问老陈“周恩来同志的报告说了什么”' },
      { code: '1D', label: '听听周围战士在议论什么' },
    ],
  },
  {
    stage: 'level2',
    index: 2,
    title: '路线之争',
    focus: '底层逻辑与机制',
    options: [
      { code: '2A', label: '现在的打法跟以前有什么不一样？' },
      { code: '2B', label: '博古的报告为什么只字不提打法？' },
      { code: '2C', label: '既然打错了，为什么之前没人反对？' },
      { code: '2D', label: '前线的战士们现在是什么态度？' },
    ],
  },
  {
    stage: 'level3',
    index: 3,
    title: '最终决断',
    focus: '认知升华',
    options: [
      { code: '3A', label: '坚决拥护确立毛泽东同志的领导！' },
      { code: '3B', label: '必须痛批博古、李德的瞎指挥！' },
      { code: '3C', label: '告诉大家换个打法，运动战才是王道！' },
      { code: '3D', label: '以后凡事都要独立思考，实事求是！' },
    ],
  },
];

export const LEVEL_BY_STAGE: Record<AgentLevelStage, AgentLevel> = {
  level1: LEVELS[0],
  level2: LEVELS[1],
  level3: LEVELS[2],
};

export const NEXT_STAGE: Record<AgentLevelStage, AgentStage> = {
  level1: 'level2',
  level2: 'level3',
  level3: 'review',
};

export const STAGE_INDEX: Record<AgentStage, number> = {
  level1: 0,
  level2: 1,
  level3: 2,
  review: 3,
  done: 3,
};

export const FALLBACK_TEXT =
  '老陈疑惑地看了看你：“小同志，发什么愣呢！马上要定红军的生死了，你别说别的，咱们到底该从哪儿查起？”';

export function optionLabel(code: ChoiceCode): string {
  for (const level of LEVELS) {
    const option = level.options.find((item) => item.code === code);
    if (option) return option.label;
  }
  return code;
}

export function optionsForStage(stage: AgentStage): AgentOption[] {
  if (stage === 'level1') return LEVEL_BY_STAGE.level1.options;
  if (stage === 'level2') return LEVEL_BY_STAGE.level2.options;
  if (stage === 'level3') return LEVEL_BY_STAGE.level3.options;
  return [];
}

export function createOpeningMessages(): AgentMessage[] {
  return [
    {
      id: 'opening-narration',
      role: 'narration',
      text: AGENT_OPENING.narration,
    },
    {
      id: 'opening-npc',
      role: 'npc',
      text: AGENT_OPENING.npc,
    },
  ];
}
