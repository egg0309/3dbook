import { useEffect, useRef, type CSSProperties } from 'react'
import type { Stage } from '@/data/stages'
import { ArrowRightIcon } from './icons'

interface StageGridProps {
  stages: Stage[]
  onOpen: (id: string) => void
}

export function StageGrid({ stages, onOpen }: StageGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || !('IntersectionObserver' in window)) return

    const cards = Array.from(grid.querySelectorAll<HTMLElement>('.stage-card'))
    grid.classList.add('reveal-ready')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.1 },
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="index-section" id="route-index" aria-labelledby="route-index-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            THE EIGHT COORDINATES
          </p>
          <h2 id="route-index-title">八个历史坐标</h2>
        </div>
        <p className="section-heading-copy">
          按时间顺序，从湘江到会宁。每一处，都是长征史上的关键节点；每一段，都值得被认真阅读。
        </p>
      </div>

      <div className="stage-grid" ref={gridRef}>
        {stages.map((stage, index) => (
          <article
            className={`stage-card${stage.status === 'live' ? ' is-live' : ''}`}
            key={stage.id}
            style={{ '--i': index } as CSSProperties}
          >
            <button
              className="stage-card-hit"
              type="button"
              onClick={() => onOpen(stage.id)}
              aria-label={`查看${stage.name}历史档案，${stage.date}，${
                stage.status === 'live' ? '互动已开放' : '互动内容筹备中'
              }`}
            >
              <span className="stage-card-visual">
                <img
                  className="stage-card-image"
                  src={stage.scenes[0].src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="stage-card-shade" aria-hidden="true" />
                <span className="stage-card-top">
                  <span className="stage-card-number">{stage.number}</span>
                  <span
                    className={`stage-card-status${stage.status === 'live' ? ' is-live' : ''}`}
                  >
                    {stage.status === 'live' ? '已开放' : '筹备中'}
                  </span>
                </span>
                <img
                  className="stage-card-title"
                  src={stage.titleArt}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span className="stage-card-scene-label">{stage.scenes[0].label}</span>
              </span>

              <span className="stage-card-body">
                <span className="stage-card-meta">
                  <span>{stage.date}</span>
                  <span>{stage.locationShort}</span>
                </span>
                <span className="stage-card-name">{stage.name}</span>
                <span className="stage-card-kicker">{stage.kicker}</span>
                <span className="stage-card-summary">{stage.summary}</span>
                <span className="stage-card-more">
                  {stage.status === 'live' ? '查看档案 · 进入推演' : '查看历史档案'}
                  <ArrowRightIcon />
                </span>
              </span>
            </button>
          </article>
        ))}
      </div>

      <p className="section-note">
        事件按历史时间顺序排列。地图为历史示意，路线与坐标经过艺术化处理；史实以事件说明为准。
      </p>
    </section>
  )
}
