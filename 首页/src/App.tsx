import { useCallback, useEffect, useState } from 'react'
import { MapHero } from '@/components/MapHero'
import { SiteHeader } from '@/components/SiteHeader'
import { StageDialog } from '@/components/StageDialog'
import { stages } from '@/data/stages'

const STORAGE_KEY = 'long-march-route-visited-v1'

function readVisited(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.filter(
        (item): item is string =>
          typeof item === 'string' && stages.some((stage) => stage.id === item),
      ),
    )
  } catch {
    return new Set()
  }
}

export default function App() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<string>>(readVisited)

  const activeIndex = activeId ? stages.findIndex((stage) => stage.id === activeId) : -1
  const activeStage = activeIndex >= 0 ? stages[activeIndex] : null

  const openStage = useCallback((id: string) => {
    setActiveId(id)
    setVisited((previous) => {
      if (previous.has(id)) return previous
      const next = new Set(previous)
      next.add(id)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {
        // localStorage may be unavailable in private mode; the page still works.
      }
      return next
    })
  }, [])

  const closeStage = useCallback(() => setActiveId(null), [])

  const goPrevious = useCallback(() => {
    if (activeIndex < 0) return
    openStage(stages[(activeIndex - 1 + stages.length) % stages.length].id)
  }, [activeIndex, openStage])

  const goNext = useCallback(() => {
    if (activeIndex < 0) return
    openStage(stages[(activeIndex + 1) % stages.length].id)
  }, [activeIndex, openStage])

  useEffect(() => {
    if (!activeStage) return
    const previousTitle = document.title
    document.title = `${activeStage.name} · 长征之路`
    return () => {
      document.title = previousTitle
    }
  }, [activeStage])

  return (
    <div className="app" id="top">
      <a className="skip-link" href="#route-index">
        跳到路线索引
      </a>

      <SiteHeader />

      <main>
        <MapHero stages={stages} activeId={activeId} visited={visited} onOpen={openStage} />
      </main>

      {activeStage && (
        <StageDialog
          stage={activeStage}
          total={stages.length}
          onClose={closeStage}
          onPrev={goPrevious}
          onNext={goNext}
        />
      )}
    </div>
  )
}
