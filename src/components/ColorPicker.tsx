import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Pipette } from 'lucide-react'
import { hexToHsv, hsvToHex } from '../lib/color'

const HEX = /^#[0-9a-f]{6}$/i
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

/**
 * Saturation/brightness area + hue slider + hex field + presets
 * (+ the browser EyeDropper where supported). Fully keyboard operable.
 */
export default function ColorPicker({ value, onChange, presets = [], label = 'Colour' }: { value: string; onChange: (hex: string) => void; presets?: string[]; label?: string }) {
  const [hsv, setHsv] = useState(() => hexToHsv(HEX.test(value) ? value : '#6d001a'))
  const [text, setText] = useState(value)
  const area = useRef<HTMLDivElement>(null)
  const last = useRef(value)

  // External value changes (presets, reset) → sync, without fighting our own updates.
  useEffect(() => {
    if (value !== last.current && HEX.test(value)) {
      setHsv(hexToHsv(value))
      setText(value)
      last.current = value
    }
  }, [value])

  const emit = (h: number, s: number, v: number) => {
    setHsv({ h, s, v })
    const hex = hsvToHex(h, s, v)
    last.current = hex
    setText(hex)
    onChange(hex)
  }

  const fromPointer = (e: RPointerEvent) => {
    const r = area.current!.getBoundingClientRect()
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
    emit(hsv.h, s, v)
  }

  const dropper = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined

  return (
    <div className="cpick">
      <div
        ref={area}
        className="cpick-area"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        role="slider"
        tabIndex={0}
        aria-label={`${label}: saturation and brightness`}
        aria-valuetext={`${Math.round(hsv.s * 100)}% saturation, ${Math.round(hsv.v * 100)}% brightness`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => e.buttons && fromPointer(e)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.1 : 0.02
          if (e.key === 'ArrowLeft') emit(hsv.h, Math.max(0, hsv.s - step), hsv.v)
          else if (e.key === 'ArrowRight') emit(hsv.h, Math.min(1, hsv.s + step), hsv.v)
          else if (e.key === 'ArrowUp') emit(hsv.h, hsv.s, Math.min(1, hsv.v + step))
          else if (e.key === 'ArrowDown') emit(hsv.h, hsv.s, Math.max(0, hsv.v - step))
          else return
          e.preventDefault()
        }}
      >
        <span className="cpick-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv.h, hsv.s, hsv.v) }} />
      </div>
      <input
        className="cpick-hue"
        type="range"
        min={0}
        max={359}
        value={Math.round(hsv.h)}
        onChange={(e) => emit(+e.target.value, hsv.s || 0.6, hsv.v || 0.5)}
        aria-label={`${label}: hue`}
      />
      <div className="row gap-s" style={{ flexWrap: 'nowrap' }}>
        <span className="cpick-swatch" style={{ background: HEX.test(text) ? text : value }} aria-hidden />
        <input
          className="input mono"
          value={text}
          onChange={(e) => {
            const v = e.target.value.trim()
            setText(v)
            const hex = v.startsWith('#') ? v : `#${v}`
            if (HEX.test(hex)) {
              setHsv(hexToHsv(hex))
              last.current = hex.toLowerCase()
              onChange(hex.toLowerCase())
            }
          }}
          aria-label={`${label}: hex`}
          maxLength={7}
          style={{ flex: 1 }}
        />
        {dropper && (
          <button
            type="button"
            className="round-btn"
            aria-label="Pick a colour from the screen"
            title="Pick from screen"
            onClick={async () => {
              try {
                const r = await new dropper().open()
                const hsvNext = hexToHsv(r.sRGBHex)
                emit(hsvNext.h, hsvNext.s, hsvNext.v)
              } catch {
                /* cancelled */
              }
            }}
          >
            <Pipette size={16} />
          </button>
        )}
      </div>
      {!HEX.test(text.startsWith('#') ? text : `#${text}`) && <small className="field-error">Use a 6-digit hex like #6d001a</small>}
      {presets.length > 0 && (
        <div className="swatches" role="group" aria-label="Presets">
          {presets.map((c) => (
            <button key={c} type="button" className={`swatch ${value.toLowerCase() === c.toLowerCase() ? 'on' : ''}`} style={{ background: c }} aria-label={`Use ${c}`} onClick={() => { const n = hexToHsv(c); emit(n.h, n.s, n.v) }} />
          ))}
        </div>
      )}
    </div>
  )
}
