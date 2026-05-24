import React, { useRef } from 'react'
import { useBrocheStore } from '@/store/useBrocheStore'
import { TEMPLATES } from '@/data/brocheTemplates'
import { generateBrocheDXF, downloadText } from '@/utils/exportDXF'

export function BrocheCanvas() {
  const store = useBrocheStore()
  const svgRef = useRef<SVGSVGElement>(null)

  const type = store.type
  const hasLogo    = type.includes('logo') || type === 'apenas_logo'
  const hasProfissao = type.includes('profissao')
  const apenasLogo = type === 'apenas_logo'

  const tpl = TEMPLATES.find(t => t.id === store.activePatternId)
  const showDivider = !!(tpl?.layout?.hasDivider && hasLogo && !apenasLogo)
  const dividerX = tpl?.layout?.dividerX ?? 18.7

  const gradFill = {
    dourado:   'url(#goldGradient)',
    prata:     'url(#silverGradient)',
    rose_gold: 'url(#roseGoldGradient)',
  }[store.color]

  const ne = store.elements.name
  const pe = store.elements.profession
  const le = store.elements.logo

  function exportSVG() {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGElement
    clone.setAttribute('width', '60mm')
    clone.setAttribute('height', '25mm')
    clone.querySelectorAll('.guide-line').forEach(n => n.remove())
    const content = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`
    downloadText('broche.svg', content, 'image/svg+xml')
  }

  function exportPNG() {
    if (!svgRef.current) return
    const clone = svgRef.current.cloneNode(true) as SVGElement
    clone.setAttribute('width', '60mm')
    clone.setAttribute('height', '25mm')
    clone.querySelectorAll('.guide-line').forEach(n => n.remove())
    const svgText = `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1800; canvas.height = 750
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => {
        if (!blob) return
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = 'broche-cliente.png'
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(pngUrl), 300)
      }, 'image/png')
    }
    img.src = url
  }

  function exportDXF() {
    const dxf = generateBrocheDXF({
      hasDivider: showDivider,
      dividerX,
      showName: !apenasLogo,
      nameText: store.nameText,
      nameX: ne.x,
      nameY: ne.y,
      nameSize: ne.size,
      showProfession: hasProfissao,
      professionText: store.professionText,
      professionX: pe.x,
      professionY: pe.y,
      professionSize: pe.size,
    })
    downloadText('broche.dxf', dxf, 'application/dxf')
  }

  return (
    <div className="canvas-area">
      <div className="canvas-bg" />
      <div className="canvas-shell">

        {/* ── Badge SVG preview ── */}
        <svg
          ref={svgRef}
          className="badge-preview"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 60 25"
        >
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#ffdc70"/>
              <stop offset="48%"  stopColor="#f2c955"/>
              <stop offset="100%" stopColor="#d5aa35"/>
            </linearGradient>
            <linearGradient id="silverGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f1f1ee"/>
              <stop offset="48%"  stopColor="#c9c9c3"/>
              <stop offset="100%" stopColor="#989992"/>
            </linearGradient>
            <linearGradient id="roseGoldGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#f9c9c9"/>
              <stop offset="48%"  stopColor="#f7adaf"/>
              <stop offset="100%" stopColor="#d4848a"/>
            </linearGradient>
            <filter id="brushed" x="-5%" y="-10%" width="110%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9 0.035" numOctaves="2" seed="8" result="noise"/>
              <feColorMatrix in="noise" type="saturate" values="0"/>
              <feComponentTransfer>
                <feFuncA type="table" tableValues="0 0.11"/>
              </feComponentTransfer>
              <feBlend in="SourceGraphic" mode="multiply"/>
            </filter>
          </defs>

          {/* Base */}
          <rect x="0.7" y="0.7" width="58.6" height="23.6" rx="4" fill={gradFill} filter="url(#brushed)"/>
          <rect x="3.1" y="3" width="53.8" height="19" rx="2.1" fill="none" stroke="#2f3030" strokeWidth="0.35" opacity="0.9"/>

          {/* Divider */}
          {showDivider && (
            <line x1={dividerX} y1="5.2" x2={dividerX} y2="20.8" stroke="#2f3030" strokeWidth="0.38"/>
          )}

          {/* Logo */}
          {hasLogo && store.hasLogo && (
            <image href={store.logoHref} x={le.x} y={le.y} width={le.width} height={le.height} preserveAspectRatio="xMidYMid meet"/>
          )}

          {/* Name */}
          {!apenasLogo && (
            <text
              x={ne.x} y={ne.y}
              textAnchor="middle"
              fontFamily={store.nameFont}
              fontSize={ne.size}
              fontWeight="700"
              fill="#2f3030"
              dominantBaseline="middle"
            >
              {store.nameText || 'Nome'}
            </text>
          )}

          {/* Profession */}
          {hasProfissao && (
            <text
              x={pe.x} y={pe.y}
              textAnchor="middle"
              fontFamily={store.professionFont}
              fontSize={pe.size}
              fill="#2f3030"
              letterSpacing="0.1"
              dominantBaseline="middle"
            >
              {store.professionText}
            </text>
          )}

          {/* Guide lines */}
          {store.showGuides && (
            <g className="guide-line">
              <line x1="30" y1="0" x2="30" y2="25" stroke="#b0aac8" strokeWidth="0.25" strokeDasharray="1.2,0.8" opacity="0.8"/>
              <line x1="0" y1="12.5" x2="60" y2="12.5" stroke="#b0aac8" strokeWidth="0.25" strokeDasharray="1.2,0.8" opacity="0.8"/>
            </g>
          )}
        </svg>

        {/* ── Action buttons ── */}
        <div className="canvas-actions">
          <button
            className={`btn btn-outline${store.showGuides ? ' btn-active' : ''}`}
            onClick={store.toggleGuides}
            title="Mostrar/ocultar linhas guia"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="2" x2="12" y2="22"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
            Guias
          </button>

          <button className="btn btn-outline" onClick={exportSVG} title="Exportar SVG para Corel">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            SVG
          </button>

          <button className="btn btn-primary" onClick={exportPNG} title="Exportar PNG para aprovação do cliente">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            PNG (cliente)
          </button>

          <button className="btn btn-dxf" onClick={exportDXF} title="Exportar DXF para EzCad / RDWorks">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            DXF (máquina)
          </button>
        </div>

      </div>
    </div>
  )
}
