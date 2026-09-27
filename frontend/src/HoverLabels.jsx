// HoverLabels — wrap anything; rest the pointer on an element with a data-label attribute
// for `delay` ms (default 2 seconds) and its label appears next to the pointer.
// Used for characters (palette, gallery) and for everything in a scene (car, road lights, barrier…).
// Screen readers get the same text from each element's aria-label, so this is only a visual aid.
import { useEffect, useRef, useState } from 'react'

export default function HoverLabels({ children, delay = 2000, className = '' }) {
  const box = useRef(null)
  const timer = useRef(null)
  const current = useRef(null)      // the labelled element under the pointer
  const pointer = useRef({ x: 0, y: 0 })
  const [tip, setTip] = useState(null) // { text, x, y, flip } while showing

  useEffect(() => () => clearTimeout(timer.current), [])

  function reset() {
    clearTimeout(timer.current)
    current.current = null
    setTip(null)
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return // no hovering on touch screens
    const rect = box.current.getBoundingClientRect()
    pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    const el = e.target.closest?.('[data-label]')
    if (el === current.current) return // still on the same thing: let the timer run
    reset()
    if (!el || !box.current.contains(el)) return
    current.current = el
    timer.current = setTimeout(() => {
      const { x, y } = pointer.current
      setTip({ text: el.getAttribute('data-label'), x, y, flip: x > rect.width - 180 })
    }, delay)
  }

  return (
    <div ref={box} className={`hover-labels ${className}`} onPointerMove={onPointerMove} onPointerLeave={reset}>
      {children}
      {tip && (
        <div
          className="hover-label"
          style={tip.flip
            ? { right: `calc(100% - ${tip.x - 10}px)`, top: tip.y + 14 }
            : { left: tip.x + 12, top: tip.y + 14 }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
