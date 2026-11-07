import { useEffect, useRef } from 'react'

// React Bits Noise reference: grain opacity 0, dust 0.15, scanlines 0.25.
export function SceneNoise() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined

    const paint = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      context.clearRect(0, 0, width, height)

      const specks = Math.round(0.15 * 42 * (width * height / 400_000) * (0.6 + Math.random() * 0.8))
      for (let index = 0; index < specks; index++) {
        const radius = 0.3 + Math.random() ** 2.5 * 1.7
        context.fillStyle = Math.random() < 0.3 ? 'rgba(255, 250, 240, 0.7)' : 'rgba(18, 14, 10, 0.7)'
        context.beginPath()
        context.arc(Math.random() * width, Math.random() * height, radius, 0, Math.PI * 2)
        context.fill()
      }
    }

    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvas.clientWidth * scale)
      canvas.height = Math.round(canvas.clientHeight * scale)
      context.setTransform(scale, 0, 0, scale, 0, 0)
      paint()
    }

    const syncMotion = () => {
      window.clearInterval(timer)
      if (!motion.matches && !document.hidden) timer = window.setInterval(paint, 1000 / 24)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    syncMotion()
    motion.addEventListener('change', syncMotion)
    document.addEventListener('visibilitychange', syncMotion)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
      motion.removeEventListener('change', syncMotion)
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="scene-dust" aria-hidden="true" />
      <div className="scene-scanlines" aria-hidden="true" />
    </>
  )
}
