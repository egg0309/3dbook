import { useEffect, useRef, useState } from 'react'
import { SceneNoise } from './SceneNoise'
import { StageTicket } from './StageTicket'
import { createPortal } from 'react-dom'
import type { Stage } from '@/data/stages'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
} from './icons'

interface StageDialogProps {
  stage: Stage
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function StageDialog({ stage, total, onClose, onPrev, onNext }: StageDialogProps) {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [ticketOpen, setTicketOpen] = useState(false)
  const titleRef = useRef<HTMLButtonElement>(null)
  const ticketWasOpen = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const capturedOpener = useRef(false)

  useBodyScrollLock(true)

  const scene = stage.scenes[sceneIndex] ?? stage.scenes[0]
  const closeTicket = () => setTicketOpen(false)

  useEffect(() => {
    if (!ticketOpen && ticketWasOpen.current) titleRef.current?.focus()
    ticketWasOpen.current = ticketOpen
  }, [ticketOpen])

  useEffect(() => {
    if (!capturedOpener.current) {
      openerRef.current = document.activeElement as HTMLElement | null
      capturedOpener.current = true
    }
    closeRef.current?.focus()

    return () => {
      openerRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    setSceneIndex(0)
  }, [stage.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (ticketOpen) setTicketOpen(false)
        else onClose()
        return
      }

      if (event.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return

        const list = Array.from(focusables).filter(
          (element) => !element.closest('[inert]') && element.getClientRects().length > 0,
        )
        const first = list[0]
        const last = list[list.length - 1]
        if (!first || !last) return

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
        return
      }

      const target = event.target as HTMLElement | null
      if (ticketOpen || target?.closest('.scene-tabs')) return

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNext, onPrev, ticketOpen])

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="stage-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={stage.name}
        ref={dialogRef}
      >
        <button
          className="dialog-close"
          type="button"
          aria-label="关闭历史场景"
          onClick={onClose}
          ref={closeRef}
          inert={ticketOpen}
        >
          <CloseIcon />
        </button>

        <div className="dialog-visual" inert={ticketOpen}>
          <img className="dialog-scene" src={scene.src} alt={scene.alt} decoding="async" />
          <SceneNoise />
          <div className="dialog-visual-shade" aria-hidden="true" />

          <div className="dialog-visual-top">
            <span className="dialog-count">
              第 {stage.number} 站 / 共 {String(total).padStart(2, '0')} 站
            </span>

            {stage.scenes.length > 1 && (
              <div className="scene-tabs" role="group" aria-label="选择场景">
                {stage.scenes.map((item, index) => (
                  <button
                    className={index === sceneIndex ? 'is-active' : ''}
                    key={item.label}
                    type="button"
                    aria-pressed={index === sceneIndex}
                    onClick={() => setSceneIndex(index)}
                  >
                    {item.label.split(' · ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="dialog-title"
            type="button"
            aria-label={`领取${stage.name}门票`}
            ref={titleRef}
            onClick={() => setTicketOpen(true)}
          >
            <img className={stage.id === 'tongdao' ? 'dialog-title--dark-ink' : undefined} src={stage.titleArt} alt="" />
            <span className="dialog-ticket-hint">领取门票 <ArrowRightIcon /></span>
          </button>

          <div className="dialog-visual-bottom">
            <span className="dialog-scene-label">{scene.label}</span>
            <p>{scene.caption}</p>
          </div>
        </div>

        <div className="dialog-nav" inert={ticketOpen}>
          <button type="button" onClick={onPrev}>
            <ArrowLeftIcon />
            上一站
          </button>
          <span className="dialog-nav-count">
            {stage.number} / {String(total).padStart(2, '0')}
          </span>
          <button type="button" onClick={onNext}>
            下一站
            <ArrowRightIcon />
          </button>
        </div>
        {ticketOpen && <StageTicket stage={stage} scene={scene} onClose={closeTicket} />}
      </div>
    </div>,
    document.body,
  )
}
