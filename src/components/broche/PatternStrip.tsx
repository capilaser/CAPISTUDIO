import React from 'react'
import { useBrocheStore } from '@/store/useBrocheStore'
import { TEMPLATES, FILTERS_BY_TYPE } from '@/data/brocheTemplates'

export function PatternStrip() {
  const store = useBrocheStore()
  const type = store.type
  const filters = FILTERS_BY_TYPE[type] ?? ['todos']

  const filtered = TEMPLATES.filter(t => {
    if (!t.types.includes(type)) return false
    if (store.activeFilter === 'todos') return true
    return t.filters.includes(store.activeFilter)
  })

  function thumbSvg(tId: string) {
    const tpl = TEMPLATES.find(t => t.id === tId)
    if (!tpl) return null
    const l = tpl.layout
    const isGold = store.color === 'dourado'
    const isRose = store.color === 'rose_gold'
    const grad = isGold
      ? '#ffdc70'
      : isRose
      ? '#f9c9c9'
      : '#f1f1ee'
    const gradEnd = isGold ? '#d5aa35' : isRose ? '#d4848a' : '#989992'

    const rectW = l.logo ? l.logo.width : 0
    const rectH = l.logo ? l.logo.height : 0

    return (
      <svg className="pattern-card-preview" viewBox="0 0 60 25" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`g_${tId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={grad}/>
            <stop offset="100%" stopColor={gradEnd}/>
          </linearGradient>
        </defs>
        <rect x="0.7" y="0.7" width="58.6" height="23.6" rx="4" fill={`url(#g_${tId})`}/>
        <rect x="3.1" y="3" width="53.8" height="19" rx="2.1" fill="none" stroke="#2f3030" strokeWidth="0.35" opacity="0.7"/>
        {l.hasDivider && <line x1={l.dividerX} y1="5.2" x2={l.dividerX} y2="20.8" stroke="#2f3030" strokeWidth="0.38"/>}
        {l.logo && <rect x={l.logo.x} y={l.logo.y} width={rectW} height={rectH} rx="1" fill="rgba(0,0,0,0.15)"/>}
        {l.name && (
          <rect
            x={l.name.x - 12} y={l.name.y - Math.min(l.name.size, 6) * 0.6}
            width="24" height={Math.min(l.name.size, 6) * 1.1}
            rx="1" fill="rgba(0,0,0,0.3)"
          />
        )}
        {l.profession && (
          <rect
            x={l.profession.x - 14} y={l.profession.y - l.profession.size}
            width="28" height={l.profession.size * 1.3}
            rx="0.5" fill="rgba(0,0,0,0.2)"
          />
        )}
      </svg>
    )
  }

  return (
    <div className="pattern-strip">
      <div className="pattern-strip-header">
        <span className="pattern-strip-title">Padrões disponíveis</span>
        <div className="filter-pills">
          {filters.map(f => (
            <button
              key={f}
              className={`filter-pill${store.activeFilter === f ? ' active' : ''}`}
              onClick={() => store.setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="pattern-gallery">
        {filtered.map(t => (
          <div
            key={t.id}
            className={`pattern-card${store.activePatternId === t.id ? ' active' : ''}`}
            onClick={() => store.applyPattern(t.id)}
          >
            {thumbSvg(t.id)}
            <div className="pattern-card-label">{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
