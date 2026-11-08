import { art, ZUNYI_URL } from '@/config'

export interface StageScene {
  src: string
  alt: string
  label: string
  caption: string
}

export interface StageFact {
  label: string
  value: string
}

export interface Stage {
  id: string
  number: string
  name: string
  kicker: string
  date: string
  dateShort: string
  location: string
  locationShort: string
  summary: string
  paragraphs: string[]
  facts: StageFact[]
  significance: string
  scenes: StageScene[]
  titleArt: string
  marker: {
    x: number
    y: number
  }
  status: 'live' | 'soon'
  href?: string
}

export const stages: Stage[] = [
  {
    id: 'xiangjiang',
    number: '01',
    name: '湘江血战',
    kicker: '长征以来最惨烈的一战',
    date: '1934.11.27 — 12.01',
    dateShort: '1934.11',
    location: '广西 · 全州 / 兴安 / 灌阳',
    locationShort: '广西 · 湘江',
    summary:
      '中央红军突破第四道封锁线，在湘江两岸与数倍于己的国民党军殊死搏杀。此役之后，中央红军由出发时的8.6万余人锐减至3万余人。',
    paragraphs: [
      '1934年11月，中央红军连续突破国民党军三道封锁线后进抵湘江以东。蒋介石调集中央军和湘军、桂军等约30万兵力，企图将红军围歼于湘江以东。',
      '11月27日至12月1日，红军在广西全州、兴安、灌阳之间抢渡湘江。红一军团、红三军团在脚山铺、光华铺、新圩等地顽强阻击，红五军团第三十四师担任全军后卫，浴血奋战。',
      '12月1日，中央红军主力渡过湘江，粉碎了国民党军围歼红军于湘江以东的企图，但付出了极其惨重的代价。',
    ],
    facts: [
      { label: '兵力对比', value: '国民党军约30万，企图围歼红军于湘江以东' },
      { label: '重大损失', value: '中央红军由8.6万余人减至3万余人' },
      { label: '后卫部队', value: '红五军团第三十四师担任全军后卫' },
      { label: '历史回响', value: '惨重损失促使党内深刻反思“左”倾错误路线' },
    ],
    significance:
      '湘江血战是长征以来最惨烈的一战。惨重的代价让越来越多的红军指战员认识到错误路线的危害，为通道转兵、黎平会议和遵义会议的召开准备了思想条件。',
    scenes: [
      {
        src: art('stages/01-xiangjiang/scene.webp'),
        alt: '湘江夜色中，红军队伍涉水渡河，远处一面红旗在雾中飘扬',
        label: '湘江 · 1934',
        caption: '寒夜渡江，断后部队以血肉之躯为中央纵队争取渡河时间。',
      },
    ],
    titleArt: art('stages/01-xiangjiang/title.webp'),
    marker: { x: 60.4, y: 61.9 },
    status: 'soon',
  },
  {
    id: 'tongdao',
    number: '02',
    name: '通道会议',
    kicker: '转折的开端',
    date: '1934.12.12',
    dateShort: '1934.12',
    location: '湖南 · 通道县溪镇',
    locationShort: '湖南 · 通道',
    summary:
      '中央红军抵达湖南通道后，中共中央召开紧急会议。毛泽东提出放弃北上湘西、改向贵州前进的主张，会议采纳了这一建议。',
    paragraphs: [
      '1934年12月，中央红军突破湘江后进至湖南通道地区。原定计划是北上湘西，与红二、红六军团会合，但国民党军已在沿途布下重兵。',
      '12月12日，中共中央负责人在通道县溪镇恭城书院召开紧急会议，讨论红军行动方向。毛泽东力主放弃原定北上湘西的计划，改向敌人力量薄弱的贵州前进。',
      '会议采纳了毛泽东的建议，决定红军西进贵州。通道会议是长征中第一次改变原定行军方向的重要会议。',
    ],
    facts: [
      { label: '会议时间', value: '1934年12月12日' },
      { label: '会议地点', value: '湖南通道县溪镇恭城书院' },
      { label: '核心决策', value: '放弃北上湘西，改向贵州进军' },
      { label: '历史定位', value: '长征中第一次改变原定行军方向的重要会议' },
    ],
    significance:
      '通道会议打开了红军摆脱被动局面的缺口，为黎平会议、猴场会议和遵义会议的召开奠定了基础，被称为“转折的开端”。',
    scenes: [
      {
        src: art('stages/02-tongdao/scene.webp'),
        alt: '油灯下，红军指挥员围在地图前讨论行军方向',
        label: '通道 · 1934.12',
        caption: '一盏油灯，一张地图，一次改变行军方向的紧急会议。',
      },
    ],
    titleArt: art('stages/02-tongdao/title.webp'),
    marker: { x: 55.25, y: 57.3 },
    status: 'soon',
  },
  {
    id: 'zunyi',
    number: '03',
    name: '遵义会议',
    kicker: '生死攸关的转折点',
    date: '1935.01.15 — 01.17',
    dateShort: '1935.01',
    location: '贵州 · 遵义',
    locationShort: '贵州 · 遵义',
    summary:
      '中共中央政治局扩大会议在遵义召开，总结第五次反“围剿”失败和长征初期失利的教训，事实上确立了毛泽东在党中央和红军的领导地位。',
    paragraphs: [
      '1935年1月，中央红军攻占遵义。1月15日至17日，中共中央政治局扩大会议在遵义老城子尹路96号召开。',
      '会议集中总结第五次反“围剿”失败和长征初期失利的教训，批评博古、李德在军事指挥上的“左”倾错误，肯定了毛泽东关于红军作战的基本原则。',
      '会议增选毛泽东为中央政治局常委，取消“三人团”，仍由朱德、周恩来指挥军事。会后不久，政治局常委分工，由张闻天代替博古在党内负总责，毛泽东协助周恩来负责军事指挥。',
    ],
    facts: [
      { label: '会议时间', value: '1935年1月15日至17日' },
      { label: '会议地点', value: '贵州遵义老城子尹路96号' },
      { label: '重要决定', value: '增选毛泽东为中央政治局常委，取消“三人团”' },
      { label: '历史地位', value: '党的历史上一个生死攸关的转折点' },
    ],
    significance:
      '遵义会议在极端危急的历史关头，挽救了党、挽救了红军、挽救了中国革命，是党的历史上一个生死攸关的转折点。它标志着中国共产党在政治上开始走向成熟，开始形成以毛泽东为核心的党的第一代中央领导集体。',
    scenes: [
      {
        src: art('stages/03-zunyi/scene.webp'),
        alt: '遵义夜色中，中共中央政治局扩大会议在油灯下召开',
        label: '遵义 · 1935.01',
        caption: '1935年1月，遵义老城。一次会议，成为中国革命的转折点。',
      },
    ],
    titleArt: art('stages/03-zunyi/title.webp'),
    marker: { x: 53.9, y: 54.0 },
    status: 'live',
    href: ZUNYI_URL,
  },
  {
    id: 'siduchishui',
    number: '04',
    name: '四渡赤水',
    kicker: '运动战的得意之笔',
    date: '1935.01.19 — 03.22',
    dateShort: '1935.01—03',
    location: '贵州 · 四川 · 云南交界',
    locationShort: '川黔滇 · 赤水河',
    summary:
      '遵义会议后，中央红军在毛泽东等指挥下四次渡过赤水河，在川黔滇边界的崇山峻岭间穿插迂回，摆脱了国民党军的围追堵截。',
    paragraphs: [
      '1935年1月遵义会议后，中央红军计划北渡长江，与红四方面军会合。国民党军调集重兵，企图在川黔边界围歼红军。',
      '1月29日，红军一渡赤水，进入川南；2月18日至21日二渡赤水，回师黔北，取得娄山关战斗和遵义战役的胜利；3月16日至17日三渡赤水，再入川南；3月21日至22日四渡赤水，南渡乌江，佯攻贵阳，调出滇军，为西进云南、巧渡金沙江创造了条件。',
      '四渡赤水历时两个多月，红军在国民党重兵集团之间灵活穿插，由被动变为主动。',
    ],
    facts: [
      { label: '一渡赤水', value: '1935年1月29日' },
      { label: '二渡赤水', value: '1935年2月18日至21日' },
      { label: '三渡赤水', value: '1935年3月16日至17日' },
      { label: '四渡赤水', value: '1935年3月21日至22日' },
      { label: '重要胜利', value: '娄山关战斗、遵义战役' },
    ],
    significance:
      '四渡赤水是毛泽东军事指挥艺术的得意之笔。红军以高度机动的运动战，粉碎了国民党军围歼红军于川黔滇边界的计划，掌握了战略主动权。',
    scenes: [
      {
        src: art('stages/04-sidu/scene.webp'),
        alt: '月色与浓雾笼罩的赤水河上，红军乘木筏渡河',
        label: '赤水河 · 1935',
        caption: '雾夜行舟，四渡赤水。红军在重兵之间走出了一条生路。',
      },
    ],
    titleArt: art('stages/04-sidu/title.webp'),
    marker: { x: 50.6, y: 51.3 },
    status: 'soon',
  },
  {
    id: 'tianxian',
    number: '05',
    name: '抢夺天险',
    kicker: '巧渡金沙江 · 飞夺泸定桥',
    date: '1935.05',
    dateShort: '1935.05',
    location: '云南 · 禄劝 / 四川 · 泸定',
    locationShort: '金沙江 · 大渡河',
    summary:
      '红军巧渡金沙江、强渡大渡河、飞夺泸定桥，粉碎了蒋介石让红军成为“石达开第二”的企图，打开了北上通道。',
    paragraphs: [
      '1935年5月，中央红军渡过金沙江，摆脱了数十万国民党军的围追堵截。5月3日至9日，红军在云南禄劝皎平渡等渡口，依靠37名船工和6只木船，历时7天7夜渡过金沙江。',
      '随后，红军北上大渡河。5月25日，红一团17名勇士在安顺场强渡大渡河；5月29日，红四团22名突击队员冒着枪林弹雨，攀踏铁索，夺取泸定桥。',
      '巧渡金沙江、强渡大渡河、飞夺泸定桥环环相扣，使红军跳出了国民党军的包围圈，为继续北上打开了通道。',
    ],
    facts: [
      { label: '巧渡金沙江', value: '1935年5月3日至9日 · 皎平渡' },
      { label: '强渡大渡河', value: '1935年5月25日 · 安顺场 · 17名勇士' },
      { label: '飞夺泸定桥', value: '1935年5月29日 · 22名突击队员' },
      { label: '战略意义', value: '粉碎“石达开第二”的企图，打开北上通道' },
    ],
    significance:
      '抢夺天险，展现了红军将士英勇顽强、不怕牺牲的革命精神。红军由此跳出了国民党军的围追堵截，为北上川陕甘创造了条件。',
    scenes: [
      {
        src: art('stages/05-tianxian/scene.webp'),
        alt: '红军突击队员攀着泸定桥铁索前进，桥下是奔腾的大渡河',
        label: '泸定桥 · 1935.05.29',
        caption: '十三根铁索，二十二名突击队员，一条通往北上的生路。',
      },
    ],
    titleArt: art('stages/05-tianxian/title.webp'),
    marker: { x: 42.1, y: 56.7 },
    status: 'soon',
  },
  {
    id: 'xueshan',
    number: '06',
    name: '雪山草地',
    kicker: '意志与牺牲',
    date: '1935.06 — 08',
    dateShort: '1935.06—08',
    location: '四川 · 夹金山 / 松潘草地',
    locationShort: '四川 · 雪山草地',
    summary:
      '红军翻越终年积雪的夹金山，穿越茫茫松潘草地，在极端恶劣的自然环境中，以坚定信念和顽强意志完成了人类行军史上的壮举。',
    paragraphs: [
      '1935年6月，中央红军抵达四川宝兴，翻越长征途中第一座大雪山——夹金山。山上空气稀薄、气候严寒，红军将士互相搀扶，艰难前行。6月12日，先头部队翻越夹金山，在达维与红四方面军会师；6月18日，中共中央率中央红军到达懋功。',
      '1935年8月，红军从毛儿盖出发，穿越松潘草地。草地沼泽密布、气候多变，粮食极度匮乏，许多红军将士牺牲在长征路上。',
      '雪山草地是长征中最艰苦的一段行程，也是长征精神最集中的体现之一。',
    ],
    facts: [
      { label: '翻越夹金山', value: '1935年6月12日' },
      { label: '懋功会师', value: '1935年6月18日' },
      { label: '穿越松潘草地', value: '1935年8月21日至27日' },
      { label: '极端环境', value: '高寒缺氧、沼泽密布、粮食断绝' },
    ],
    significance:
      '雪山草地见证了红军将士革命理想高于天的坚定信念，展现了不怕牺牲、艰苦奋斗、团结互助的长征精神。',
    scenes: [
      {
        src: art('stages/06-xueshan/scene-snow.webp'),
        alt: '红军队伍在风雪中翻越夹金山，红旗在雪线上前行',
        label: '雪山 · 夹金山',
        caption: '空气稀薄，风雪漫天。队伍沿着雪线，一步一步向上。',
      },
      {
        src: art('stages/06-xueshan/scene-grass.webp'),
        alt: '红军队伍在茫茫草地上艰难前行',
        label: '草地 · 松潘',
        caption: '沼泽、寒雨与饥饿。走出草地，靠的是信念与彼此的搀扶。',
      },
    ],
    titleArt: art('stages/06-xueshan/title.webp'),
    marker: { x: 43.6, y: 40.6 },
    status: 'soon',
  },
  {
    id: 'hadapu',
    number: '07',
    name: '哈达铺',
    kicker: '一份报纸决定的落脚点',
    date: '1935.09.18 — 09.22',
    dateShort: '1935.09',
    location: '甘肃 · 宕昌 · 哈达铺',
    locationShort: '甘肃 · 哈达铺',
    summary:
      '红军在哈达铺休整，从报纸上得知陕北有红军和根据地，毛泽东等决定把长征的落脚点放在陕北。',
    paragraphs: [
      '1935年9月，中央红军突破腊子口，进入甘肃宕昌哈达铺。红军在哈达铺进行休整，补充给养，恢复体力。',
      '在哈达铺的邮政代办所，红军获得《大公报》等报纸，得知陕北有红军和根据地，以及徐海东、刘志丹等领导的红军活动消息。',
      '9月22日，中共中央在哈达铺召开团以上干部会议，正式宣布向陕北进军，把长征的落脚点放在陕北。',
    ],
    facts: [
      { label: '到达哈达铺', value: '1935年9月18日' },
      { label: '哈达铺会议', value: '1935年9月22日' },
      { label: '关键信息', value: '陕北有红军和革命根据地' },
      { label: '历史佳话', value: '“一张报纸定乾坤”' },
      { label: '长征加油站', value: '休整补给，恢复体力' },
    ],
    significance:
      '哈达铺是长征落脚点的重要决策地。“一张报纸定乾坤”的佳话，折射出中国共产党人从实际出发、审时度势的战略智慧。',
    scenes: [
      {
        src: art('stages/07-hadapu/scene.webp'),
        alt: '油灯下摊开的旧报纸与放大镜，窗外是陇南群山',
        label: '哈达铺 · 1935.09',
        caption: '一张旧报纸，让长征的落脚点转向陕北。',
      },
    ],
    titleArt: art('stages/07-hadapu/title.webp'),
    marker: { x: 46.0, y: 29.3 },
    status: 'soon',
  },
  {
    id: 'huishi',
    number: '08',
    name: '三军会师',
    kicker: '长征胜利结束',
    date: '1936.10.09 / 10.22',
    dateShort: '1936.10',
    location: '甘肃 · 会宁 / 将台堡（今宁夏西吉）',
    locationShort: '会宁 · 将台堡',
    summary:
      '1936年10月，红一、红二、红四方面军在甘肃会宁、将台堡地区胜利会师，标志着举世闻名的长征胜利结束。',
    paragraphs: [
      '1936年10月9日，红四方面军指挥部到达甘肃会宁，与红一方面军会合。10月22日，红二方面军与红一方面军在将台堡会师。',
      '至此，红一、红二、红四方面军三大主力胜利会师，长征胜利结束。',
      '三军会师，是中国革命转危为安的重要标志，为抗日民族统一战线的形成和革命新局面的开创奠定了基础。',
    ],
    facts: [
      { label: '会宁会师', value: '1936年10月9日' },
      { label: '将台堡会师', value: '1936年10月22日' },
      { label: '会师部队', value: '红一、红二、红四方面军' },
      { label: '历史意义', value: '长征胜利结束' },
    ],
    significance:
      '三军会师宣告了长征的胜利结束。长征的胜利，粉碎了国民党军消灭红军的企图，保存了党和红军的基干力量，播下了革命的火种，铸就了伟大的长征精神。',
    scenes: [
      {
        src: art('stages/08-huishi/scene.webp'),
        alt: '晨曦中的黄土高原上，三面红旗迎风招展，红军将士相拥会师',
        label: '会宁 · 1936.10',
        caption: '三面红旗在晨曦中交汇。长征，在这里写下胜利的句点。',
      },
    ],
    titleArt: art('stages/08-huishi/title.webp'),
    marker: { x: 54.8, y: 26.5 },
    status: 'soon',
  },
]

export const routeNotes = [
  {
    label: '于都出发',
    date: '1934.10.17',
    x: 77.2,
    y: 65.1,
    align: 'right' as const,
  },
  {
    label: '吴起镇',
    date: '1935.10.19',
    x: 57.5,
    y: 7.2,
    align: 'left' as const,
  },
]

export const mapBranch = {
  from: { x: 48.0, y: 28.4 },
  to: { x: 54.8, y: 26.5 },
  label: '1936.10 三军会师方向',
}
