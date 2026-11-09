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
    '1934年10月，第五次反“围剿”失败，中央红军8.6万余人被迫撤离中央苏区。湘江血战后，队伍锐减到3万余人。通道、黎平、猴场会议接连召开，红军改向贵州进军，1935年1月7日占领遵义。1月15日，中共中央政治局扩大会议在这座小楼里召开，会期三天。你是负责传达会议精神的机要参谋，此刻等在会场外。',
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

/** 三关结束后向所有路径展示的史实要点，保证后测考点与选择无关 */
export const POST_MEETING_BRIEF = [
  '1935年1月15日至17日，中共中央政治局扩大会议在遵义召开，会期三天。',
  '博古作正报告，把失败归于敌人强大；周恩来作副报告，主动承担指挥责任；张闻天按照会前与毛泽东、王稼祥商定的提纲作“反报告”，系统批判错误的军事路线。',
  '前四次反“围剿”靠运动战、集中兵力各个击破取胜；第五次却以堡垒对堡垒、分兵抵御，同敌人硬拼消耗。',
  '会议增选毛泽东为中央政治局常委；王稼祥提议由毛泽东参与军事指挥，这一票后来被称为“关键的一票”。',
  '会后，张闻天起草的总结决议在扎西会议上通过；不久组成毛泽东、周恩来、王稼祥新的三人军事指挥小组，紧接着的四渡赤水让红军重新掌握主动。',
  '遵义会议被称为“生死攸关的转折点”：这是中国共产党第一次独立自主地运用马克思主义，解决自己的路线和组织问题。',
] as const;

/** 每一关选项下方的背景知识卡：先读来龙去脉，再做选择 */
export const LEVEL_BRIEFS: Record<
  AgentLevelStage,
  { headline: string; items: readonly string[] }
> = {
  level1: {
    headline: '背景知识：湘江血战后，中央红军只剩3万余人',
    items: [
      '1934年10月，第五次反“围剿”失败，中央红军被迫撤离中央苏区，8.6万余人开始战略转移。',
      '11月底，红军血战五昼夜突破湘江第四道封锁线，过江后只剩3万余人。',
      '通道、黎平、猴场会议后，中央放弃北上湘西的原定计划，改向敌人力量薄弱的贵州进军，并开始限制博古、李德的军事指挥权。',
      '1935年1月7日红军占领遵义；1月15日，中央政治局扩大会议召开。会上博古作正报告，周恩来作副报告，张闻天按会前与毛泽东、王稼祥商定的提纲作“反报告”。',
    ],
  },
  level2: {
    headline: '背景知识：前四次靠运动战，第五次却堡垒对堡垒',
    items: [
      '前四次反“围剿”，红军靠运动战、集中兵力各个击破，打得灵活主动。',
      '第五次反“围剿”，博古、李德命令分兵把守、以堡垒对堡垒，同装备占优的敌人硬拼消耗。',
      '湘江惨败不是偶然，是错误路线的集中爆发；根子不在士兵不卖命，而在打法错了。',
    ],
  },
  level3: {
    headline: '背景知识：会议增选毛泽东为中央政治局常委',
    items: [
      '会议增选毛泽东为中央政治局常委，取消博古、李德、周恩来的最高“三人团”。',
      '军事指挥改由朱德、周恩来负责；带着伤参会的王稼祥提议由毛泽东参与军事指挥，这一票后来被称为“关键的一票”。',
      '会后，张闻天起草的《中央关于反对敌人五次“围剿”的总结决议》在扎西会议上通过；不久组成毛泽东、周恩来、王稼祥新的三人军事指挥小组。',
      '紧接着的四渡赤水，红军重新打出运动战的灵气，摆脱数十万追兵。遵义会议后来被称为“生死攸关的转折点”。',
    ],
  },
};

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
