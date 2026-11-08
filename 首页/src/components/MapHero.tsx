import { useEffect, useRef, type CSSProperties } from 'react'
import { art, PLATFORM_TAGLINE } from '@/config'
import { mapBranch, routeNotes, type Stage } from '@/data/stages'
import { ArrowRightIcon } from './icons'
import { RouteRail } from './RouteRail'

interface MapHeroProps {
  stages: Stage[]
  activeId: string | null
  visited: Set<string>
  onOpen: (id: string) => void
}

export function MapHero({ stages, activeId, visited, onOpen }: MapHeroProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return

    const centerRoute = () => {
      if (element.scrollWidth > element.clientWidth + 8) {
        // Start just left of the 05 marker (the fifth stage) on narrow screens,
        // so the title-safe dark band of the map is mostly out of view.
        const focusX = (stages[4]?.marker.x ?? 42.1) / 100
        const target = element.scrollWidth * focusX - 80
        element.scrollLeft = Math.max(
          0,
          Math.min(target, element.scrollWidth - element.clientWidth),
        )
      } else {
        element.scrollLeft = 0
      }
    }

    const frame = window.requestAnimationFrame(centerRoute)
    window.addEventListener('resize', centerRoute)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', centerRoute)
    }
  }, [stages])

  const branchPath = `M ${mapBranch.from.x * 16} ${mapBranch.from.y * 9} C 790 250, 830 244, ${
    mapBranch.to.x * 16
  } ${mapBranch.to.y * 9}`

  return (
    <section className="hero" id="route-map" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-map-shell">
          <div
            className="hero-map-viewport"
            ref={scrollRef}
            tabIndex={0}
            role="region"
            aria-label="长征路线地图。点击红旗查看事件；窄屏可左右滑动地图。"
          >
            <div className="hero-map-frame">
              <img
                className="hero-map-image"
                src={art('map.webp')}
                alt="中国地图上的中央红军长征路线示意图，路线自江西于都出发，经湘江、通道、遵义、赤水、金沙江、大渡河、雪山草地、哈达铺，终至陕北吴起镇"
                draggable={false}
                fetchPriority="high"
              />

              <svg
                className="map-branch"
                viewBox="0 0 1600 900"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={branchPath} />
                <circle cx={mapBranch.to.x * 16} cy={mapBranch.to.y * 9} r="4" />
              </svg>

              <span className="branch-note" aria-hidden="true">
                {mapBranch.label}
              </span>

              {routeNotes.map((note) => (
                <span
                  className={`route-note route-note--${note.align}`}
                  key={note.label}
                  style={{ left: `${note.x}%`, top: `${note.y}%` } as CSSProperties}
                >
                  <span className="route-note-dot" aria-hidden="true" />
                  <span className="route-note-text">
                    <strong>{note.label}</strong>
                    <em>{note.date}</em>
                  </span>
                </span>
              ))}

              {stages.map((stage, index) => {
                const isActive = stage.id === activeId
                const isVisited = visited.has(stage.id)
                return (
                  <button
                    className={`stage-marker${
                      isActive ? ' is-active' : ''
                    }${isVisited ? ' is-visited' : ''}`}
                    key={stage.id}
                    type="button"
                    style={
                      {
                        left: `${stage.marker.x}%`,
                        top: `${stage.marker.y}%`,
                        '--i': index,
                      } as CSSProperties
                    }
                    onClick={() => onOpen(stage.id)}
                    aria-haspopup="dialog"
                    aria-label={`第${Number(stage.number)}站，${stage.name}，${stage.date}。${
                      stage.status === 'live' ? '已开放' : '互动内容筹备中'
                    }`}
                  >
                    <svg className="marker-flag" viewBox="0 0 32 32" aria-hidden="true">
                      <path className="marker-flag-cloth" d="M7 4c8-5 14 5 23 0l-4 7 4 5c-9 5-15-5-23 0Z" />
                      <path className="marker-flag-pole" d="M7 3v26" />
                      <text className="marker-flag-number" x="17" y="12.5" textAnchor="middle">
                        {stage.number}
                      </text>
                    </svg>
                  </button>
                )
              })}

              <div className="map-caption" aria-hidden="true">
                <span>中央红军长征路线 · 1934.10—1935.10</span>
                <span>点击红旗查看事件</span>
              </div>
            </div>
          </div>
          <div className="map-edge map-edge--left" aria-hidden="true" />
          <div className="map-edge map-edge--right" aria-hidden="true" />
          <div className="map-mobile-hint" aria-hidden="true">
            左右滑动 · 点击红旗
          </div>
        </div>

        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            {PLATFORM_TAGLINE} · 长征篇
          </p>
          <h1 className="hero-logo" id="hero-title">
            <img src={art('brand-long-march.webp')} alt="长征之路" />
          </h1>
          <p className="hero-subtitle">二万五千里，一条改变中国命运的路线</p>
          <p className="hero-desc">
            从湘江血战到三军会师，沿着地图上的八处历史坐标，走进长征的关键时刻。点击路线上的红旗，开始你的探索。
          </p>
          <div className="hero-actions">
            <button className="btn btn--gold" type="button" onClick={() => onOpen(stages[0].id)}>
              从第一站开始
              <ArrowRightIcon />
            </button>
          </div>
          <dl className="hero-stats">
            <div>
              <dt>历史坐标</dt>
              <dd>
                08<small>处</small>
              </dd>
            </div>
            <div>
              <dt>中央红军行程</dt>
              <dd>
                25,000<small>里</small>
              </dd>
            </div>
            <div>
              <dt>历史跨度</dt>
              <dd>
                1934<small>—1936</small>
              </dd>
            </div>
          </dl>
        </div>

        <div className="hero-bottom">
          <div className="hero-hint">
            <span className="hint-dot" aria-hidden="true" />
            <span className="hint-desktop">点击地图上的红旗，进入历史现场</span>
            <span className="hint-mobile">左右滑动地图 · 点击红旗</span>
          </div>
          <RouteRail stages={stages} activeId={activeId} visited={visited} onOpen={onOpen} />
        </div>
      </div>
    </section>
  )
}
