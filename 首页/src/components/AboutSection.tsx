import { ZUNYI_URL } from '@/config'
import { ArrowRightIcon } from './icons'

export function AboutSection() {
  return (
    <section className="about" id="about" aria-labelledby="about-title">
      <div className="about-inner">
        <div className="about-copy">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            WHY THE LONG MARCH
          </p>
          <h2 id="about-title">长征，是一次理想信念的伟大远征</h2>
          <blockquote>
            “长征是一次理想信念的伟大远征，是一次检验真理的伟大远征，是一次唤醒民众的伟大远征，是一次开创新局的伟大远征。”
          </blockquote>
          <p className="about-source">
            —— 习近平在纪念红军长征胜利80周年大会上的讲话（2016年10月21日）
          </p>
          <p>
            从1934年10月到1936年10月，中国共产党领导红军第一、第二、第四方面军和第二十五军进行了伟大的长征。红军将士跨越滔滔江河，翻越巍巍雪山，穿过茫茫草地，冲破层层封锁，创造了气吞山河的人间奇迹。
          </p>
          <p>
            今天，我们沿着地图上的八处坐标重走这段历史，不是为了复述苦难，而是为了理解：是什么力量，让一支队伍在绝境中一次次站起来，走向胜利。
          </p>
        </div>

        <div className="about-figures" aria-label="长征关键数据">
          <div>
            <strong>24</strong>
            <span>个月</span>
            <small>1934.10 — 1936.10</small>
          </div>
          <div>
            <strong>14</strong>
            <span>个省</span>
            <small>红军长征先后经过</small>
          </div>
          <div>
            <strong>25,000</strong>
            <span>里</span>
            <small>中央红军行程</small>
          </div>
          <div>
            <strong>08</strong>
            <span>处坐标</span>
            <small>本页选取的关键事件</small>
          </div>
        </div>
      </div>

      <div className="about-cta">
        <div>
          <p className="eyebrow">CHAPTER 01 · ZUNYI</p>
          <h3>走进遵义会议</h3>
          <p>在 3D 立体书中翻开历史，与“老陈”完成一次三关历史推演。</p>
        </div>
        <a className="btn btn--gold" href={ZUNYI_URL} target="_blank" rel="noreferrer">
          进入 3D 展馆
          <ArrowRightIcon />
        </a>
      </div>
    </section>
  )
}
