import { FALLBACK_TEXT, NEXT_STAGE, optionLabel } from './script';
import type {
  AgentChoices,
  AgentStage,
  AgentTurnRequest,
  AgentTurnResponse,
  ChoiceCode,
} from './types';

const STAGE_NUMBER: Partial<Record<AgentStage, string>> = {
  level1: '1',
  level2: '2',
  level3: '3',
};

const REPLIES: Record<ChoiceCode, string> = {
  '1A':
    '凯丰说毛泽东同志只照着两本书打仗，可他连《孙子兵法》有几篇都说不清楚。光听传言不行，还得看真凭实据。正想着，会议室里传出拍桌子的争吵声——有人说前几次反围剿都赢了，这次堡垒对堡垒却全拼光了。你说，这问题出在哪？',
  '1B':
    '八万六千人啊，过了湘江就剩三万了，博古的报告里连这个数都没敢提。回避这么惨痛的损失，说明指挥确实有大问题。正想着，会议室里传出拍桌子的争吵声——有人说前几次反围剿都赢了，这次堡垒对堡垒却全拼光了。你说，这问题出在哪？',
  '1C':
    '周恩来同志主动站出来担责了，还狠狠批评了博古和李德的指挥。敢于承认错误，这才是将领该有的担当。正想着，会议室里传出拍桌子的争吵声——有人说前几次反围剿都赢了，这次堡垒对堡垒却全拼光了。你说，这问题出在哪？',
  '1D':
    '刚才两个战士在争，一个说早就该换指挥了，另一个说读过书的肯定比咱们强。情绪和盲从，都代替不了事实啊。正想着，会议室里传出拍桌子的争吵声——有人说前几次反围剿都赢了，这次堡垒对堡垒却全拼光了。你说，这问题出在哪？',
  '2A':
    '以前是运动战、集中兵力；这次是堡垒对堡垒、分兵抵御，打法完全错了！湘江惨败不是偶然，是路线问题的集中爆发。正说着，里面传出散会的动静。会议结束了，你马上要回部队传达精神。小同志，你觉得今天这会，最核心的精神是什么？',
  '2B':
    '博古只强调敌人太强大，却不反思堡垒战的瞎指挥。不敢承认路线错误，这才是最要命的危险。正说着，里面传出散会的动静。会议结束了，你马上要回部队传达精神。小同志，你觉得今天这会，最核心的精神是什么？',
  '2C':
    '大家以前盲目服从上面的权威，直到血流成河才醒悟。盲从权威会带来灾难，坚持真理需要极大勇气。正说着，里面传出散会的动静。会议结束了，你马上要回部队传达精神。小同志，你觉得今天这会，最核心的精神是什么？',
  '2D':
    '战士们不怕死，但觉得死得太憋屈，都盼着换个明白人来指挥。脱离实际的指挥，就是拿人命填坑。正说着，里面传出散会的动静。会议结束了，你马上要回部队传达精神。小同志，你觉得今天这会，最核心的精神是什么？',
  '3A':
    '说得对！咱们红军终于有了真正懂打仗的人来掌舵，大家心里都有个底了。快去准备吧，天快亮了。要是想知道这一路的选择照出了怎样的你，就输入“复盘”。',
  '3B':
    '早就该骂醒他们了！纸上谈兵差点毁了咱们的队伍。你回去告诉大家，这种瞎指挥的日子，一去不复返了！想看看这一路的推演，就输入“复盘”。',
  '3C':
    '对！打得赢就打，打不赢就走。咱们不跟他们拼消耗，用咱们最拿手的运动战，把敌人拖垮！想复盘的话，就输入“复盘”。',
  '3D':
    '小同志，你算是悟透了啊。不管上面怎么说，咱们自己心里得有杆秤，得看事实。最靠得住的，是咱们自己核过的那一遍。带上这句话，去吧。想复盘的话，就输入“复盘”。',
};

const REVIEW_NUDGE =
  '老陈摆摆手：“这会儿不用再说别的了。想看这一路的选择照出了什么，就输入‘复盘’。”';

const EARLY_REVIEW_NUDGE =
  '别急，先把眼前这一关走完。等会议散了，咱们再复盘。';

function fallback(stage: AgentStage): AgentTurnResponse {
  return { reply: FALLBACK_TEXT, nextStage: stage, fallback: true };
}

function buildReport(choices: AgentChoices): string {
  const { choice_1, choice_2, choice_3 } = choices;

  const opening =
    choice_3 === '3D'
      ? '你最后选择了独立思考、实事求是，这正是这场会议最珍贵的收获。你没有停在口号上，而是把判断建立在事实之上。'
      : choice_3
        ? `你最后选择了“${optionLabel(choice_3)}”。无论是拥护核心、纠正错误还是改变打法，这背后都要靠对事实的核实，才能站得住脚。`
        : '你走完了这场推演，也留下了自己的判断。';

  const first =
    choice_1 === '1A' || choice_1 === '1B'
      ? '第一关里，你没有被传言和情绪带走，而是去追问一手信息和真实损失，这是很难得的。'
      : '第一关里，你更容易被态度和情绪影响；在复杂局面中，记得再往前追问一层更硬的证据。';

  const second =
    choice_2 === '2A' || choice_2 === '2B'
      ? '第二关里，你看到了打法和路线背后的底层逻辑，而不只是停留在情绪判断上。'
      : '第二关里，你已经有反思，但还可以把目光再抬高一寸，关注组织运作和战略层面的规则。';

  const closing =
    '会议的价值不在于换了谁，而在于教会我们：在众声喧哗中，最靠得住的是你亲自核实过的事实。下次遇到“大家都这么说”，记得先问一句依据是什么。';

  return [opening, first, second, closing].join('\n\n');
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function mockAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResponse> {
  await delay(680);

  if (request.stage === 'done') {
    return {
      reply: '推演已经结束了。想再来一次，就点下面的“重新推演”。',
      nextStage: 'done',
    };
  }

  if (request.stage === 'review') {
    if (request.message?.trim() === '复盘') {
      return {
        reply:
          '老陈把一张写满字的纸递给你：“拿着吧，这是这一路的复盘。往后的路，还得你自己走。”',
        nextStage: 'done',
        report: buildReport(request.choices),
      };
    }
    return {
      reply: REVIEW_NUDGE,
      nextStage: 'review',
      fallback: true,
    };
  }

  const stageNumber = STAGE_NUMBER[request.stage];

  if (request.choice) {
    if (!stageNumber || request.choice[0] !== stageNumber) {
      return fallback(request.stage);
    }
    return {
      reply: REPLIES[request.choice],
      nextStage: NEXT_STAGE[request.stage],
    };
  }

  const message = request.message?.trim() ?? '';

  if (!message) return fallback(request.stage);

  if (message === '复盘') {
    return {
      reply: EARLY_REVIEW_NUDGE,
      nextStage: request.stage,
      fallback: true,
    };
  }

  const upperCode = message.toUpperCase();
  if (/^[1-3][A-D]$/.test(upperCode)) {
    const code = upperCode as ChoiceCode;
    if (code[0] === stageNumber) {
      return {
        reply: REPLIES[code],
        nextStage: NEXT_STAGE[request.stage],
      };
    }
    return fallback(request.stage);
  }

  return fallback(request.stage);
}
