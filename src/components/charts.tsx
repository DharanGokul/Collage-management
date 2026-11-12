/** Lightweight dependency-free charts that follow the brand colour. */

export function BarChart({ data, format = (v) => String(v), height = 180, max }: { data: { label: string; value: number; short?: string }[]; format?: (v: number) => string; height?: number; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="barchart" style={{ height }}>
      {data.map((d) => (
        <div className="bar-col" key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <span className="bar-val">{format(d.value)}</span>
          <div className="bar-track">
            <div className="bar" style={{ height: `${(d.value / top) * 100}%` }} />
          </div>
          <span className="bar-label">
            <span className="bar-label-long">{d.label}</span>
            {d.short && <span className="bar-label-short">{d.short}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

export function Donut({ value, size = 120, label }: { value: number; size?: number; label?: string }) {
  const r = 42
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${v}%`}>
        <circle cx="50" cy="50" r={r} className="donut-track" strokeWidth="10" fill="none" />
        <circle cx="50" cy="50" r={r} className="donut-value" strokeWidth="10" fill="none" strokeDasharray={`${(v / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 50 50)" />
      </svg>
      <div className="donut-label">
        <strong>{v}%</strong>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
}
