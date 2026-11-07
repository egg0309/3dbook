import type { Stage } from '@/data/stages'
import { CheckIcon } from './icons'

interface RouteRailProps {
  stages: Stage[]
  activeId: string | null
  visited: Set<string>
  onOpen: (id: string) => void
}

export function RouteRail({ stages, activeId, visited, onOpen }: RouteRailProps) {
  return (
    <nav className="route-rail" aria-label="长征路线索引">
      <span className="route-rail-label">路线索引</span>
      <div className="route-rail-track">
        {stages.map((stage) => {
          const isActive = stage.id === activeId
          const isVisited = visited.has(stage.id)
          return (
            <button
              className={`rail-item${isActive ? ' is-active' : ''}${isVisited ? ' is-visited' : ''}`}
              key={stage.id}
              type="button"
              onClick={() => onOpen(stage.id)}
              aria-label={`第${Number(stage.number)}站，${stage.name}，${stage.date}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="rail-number">
                {stage.number}
                {isVisited && <CheckIcon className="rail-check" />}
              </span>
              <span className="rail-name">{stage.name}</span>
              <span className="rail-date">{stage.dateShort}</span>
              {stage.status === 'live' && <span className="rail-live">已开放</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
