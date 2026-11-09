import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Stage, StageScene } from '@/data/stages'
import { ArrowRightIcon, CloseIcon } from './icons'

interface StageTicketProps {
  stage: Stage
  scene: StageScene
  onClose: () => void
}

const TEAR_DISTANCE = 31

export function StageTicket({ stage, scene, onClose }: StageTicketProps) {
  const href = stage.status === 'live' ? stage.href : undefined
  const [torn, setTorn] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ id: number; x: number; y: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!torn || !href) return
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420
    const timer = window.setTimeout(() => window.location.assign(href), delay)
    return () => window.clearTimeout(timer)
  }, [torn, href])

  function tilt(event: PointerEvent<HTMLDivElement>) {
    const card = cardRef.current
    if (!card || event.pointerType !== 'mouse' || drag.current ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const clamp = (value: number) => Math.max(-1, Math.min(1, value))
    const x = clamp((event.clientX - bounds.left - bounds.width / 2) / 360)
    const y = clamp((event.clientY - bounds.top - bounds.height / 2) / 360)
    card.style.setProperty('--ticket-tilt-x', `${-y * 14}deg`)
    card.style.setProperty('--ticket-tilt-y', `${x * 14}deg`)
    card.style.setProperty('--ticket-image-x', `${-x * 9}px`)
    card.style.setProperty('--ticket-image-y', `${-y * 9}px`)
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id !== event.pointerId) return
    drag.current = null
    event.currentTarget.style.removeProperty('--ticket-pull')
  }

  return (
    <div className="stage-ticket-overlay" onPointerMove={tilt}>
      <div className="stage-ticket-wrap">
        <button className="ticket-close" type="button" onClick={onClose} ref={closeRef} aria-label="关闭门票">
          <CloseIcon />
        </button>
        <div className="stage-ticket" ref={cardRef} data-torn={torn}>
          <div className="ticket-body">
            <img className="ticket-art" src={scene.src} alt={scene.alt} draggable={false} />
            <div className="ticket-copy">
              <span>星火长征 · 历史现场</span>
              <strong>{stage.name}</strong>
              <span>{scene.label}</span>
            </div>
          </div>
          {href ? (
            <button
              className="ticket-stub"
              type="button"
              aria-label="撕票进入立体书"
              aria-disabled={torn}
              onPointerDown={(event) => {
                if (torn || !event.isPrimary || event.button !== 0) return
                moved.current = false
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                const start = drag.current
                if (start?.id !== event.pointerId) return
                const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
                if (distance > 5) moved.current = true
                event.currentTarget.style.setProperty('--ticket-pull', `${Math.min(distance, TEAR_DISTANCE)}px`)
                if (distance >= TEAR_DISTANCE) {
                  finishDrag(event)
                  setTorn(true)
                }
              }}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              onLostPointerCapture={finishDrag}
              onClick={(event) => {
                if (!torn && (event.detail === 0 || !moved.current)) setTorn(true)
              }}
            >
              <span>第 {stage.number} 站</span>
              <strong>撕票入场</strong>
              <ArrowRightIcon />
              <small>拖动或点击</small>
            </button>
          ) : (
            <div className="ticket-stub">
              <span>第 {stage.number} 站</span>
              <strong>筹备中</strong>
              <small>立体书尚未开放</small>
            </div>
          )}
          <span className="ticket-perforation" aria-hidden="true">
            {Array.from({ length: 15 }, (_, index) => <i key={index} />)}
          </span>
        </div>
        <p className="ticket-status" role="status">{torn ? '正在进入立体书…' : ''}</p>
      </div>
    </div>
  )
}
