import React, { useRef } from 'react'
import { useBrocheStore } from '@/store/useBrocheStore'
import { BrocheType } from '@/data/brocheTemplates'

const TYPES: { value: BrocheType; icon: string; label: string }[] = [
  { value: 'logo_nome_profissao', icon: '🏢', label: 'Logo + Nome + Profissão' },
  { value: 'logo_nome',           icon: '🏷️', label: 'Logo + Nome'            },
  { value: 'nome_profissao',      icon: '👤', label: 'Nome + Profissão'        },
  { value: 'apenas_nome',         icon: '✏️', label: 'Apenas Nome'            },
  { value: 'apenas_logo',         icon: '🖼️', label: 'Apenas Logo'            },
]

const NAME_FONTS = [
  'Arial', 'Georgia', 'Trebuchet MS', 'Verdana', 'Impact', 'Courier New',
]
const PROF_FONTS = [
  'Arial', 'Georgia', 'Trebuchet MS', 'Verdana', 'Tahoma',
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="section-label">{children}</div>
}

function NudgeControl({ target }: { target: 'logo' | 'name' | 'profession' }) {
  const { nudge, centerElement } = useBrocheStore()
  const step = 0.25
  return (
    <div className="pos-control">
      <div className="section-label" style={{ marginBottom: 4 }}>Posição</div>
      <div className="pos-row">
        <button className="pos-btn" onClick={() => nudge(target, 0, -step)} title="Cima">↑</button>
      </div>
      <div className="pos-row">
        <button className="pos-btn" onClick={() => nudge(target, -step, 0)} title="Esquerda">←</button>
        <button className="pos-center-btn" onClick={() => centerElement(target)}>Centralizar</button>
        <button className="pos-btn" onClick={() => nudge(target, step, 0)} title="Direita">→</button>
      </div>
      <div className="pos-row">
        <button className="pos-btn" onClick={() => nudge(target, 0, step)} title="Baixo">↓</button>
      </div>
    </div>
  )
}

export function BrocheSidebar() {
  const store = useBrocheStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const type = store.type
  const hasLogoSection = type.includes('logo') || type === 'apenas_logo'
  const hasNameSection = type !== 'apenas_logo'
  const hasProfissao   = type.includes('profissao')

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => store.setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <aside className="sidebar">

      {/* ── TIPO DE BROCHE ── */}
      <div>
        <SectionLabel>Tipo de broche</SectionLabel>
        <div className="type-grid">
          {TYPES.map(t => (
            <button
              key={t.value}
              className={`type-btn${store.type === t.value ? ' active' : ''}`}
              onClick={() => store.setType(t.value)}
            >
              <span className="type-icon">{t.icon}</span>
              <span className="type-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divider"/>

      {/* ── LOGO ── */}
      {hasLogoSection && (
        <div>
          <SectionLabel>Logo</SectionLabel>

          {/* Source selector */}
          <div className="logo-source-grid">
            {(['upload', 'banco', 'nao'] as const).map((src) => (
              <button
                key={src}
                className={`logo-src-btn${store.logoSource === src ? ' active' : ''}`}
                onClick={() => store.setLogoSource(src)}
              >
                <span className="logo-src-icon">
                  {src === 'upload' ? '⬆️' : src === 'banco' ? '🗂️' : '🚫'}
                </span>
                <span className="logo-src-label">
                  {src === 'upload' ? 'Upar arquivo' : src === 'banco' ? 'Banco' : 'Sem logo'}
                </span>
              </button>
            ))}
          </div>

          {/* Upload panel */}
          {store.logoSource === 'upload' && (
            <>
              {!store.hasLogo ? (
                <div className="logo-upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept="image/*,.svg" onChange={handleLogoFile} style={{ display: 'none' }}/>
                  <div className="upload-icon">🖼️</div>
                  <div className="upload-text">Clique ou arraste a logo aqui<br/><small>SVG, PNG, JPG</small></div>
                </div>
              ) : (
                <div className="logo-preview-wrap" style={{ display: 'flex' }}>
                  <img src={store.logoHref} alt="logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 4 }}/>
                  <span className="logo-preview-name">Logo carregada</span>
                  <button className="logo-remove-btn" onClick={store.removeLogo}>✕</button>
                </div>
              )}
            </>
          )}

          {/* Banco panel */}
          {store.logoSource === 'banco' && (
            <div className="logo-nao-msg">Banco de logos em breve.</div>
          )}

          {/* Nao panel */}
          {store.logoSource === 'nao' && (
            <div className="logo-nao-msg">Broche será gerado sem logo.</div>
          )}

          {/* Size + position controls */}
          {store.logoSource !== 'nao' && (
            <div style={{ marginTop: 12 }}>
              <SectionLabel>Tamanho da logo</SectionLabel>
              <div className="size-control">
                <button className="size-btn" onClick={() => store.adjustLogo(-0.5)}>−</button>
                <div className="size-value">{store.elements.logo.width.toFixed(1)}</div>
                <button className="size-btn" onClick={() => store.adjustLogo(0.5)}>+</button>
                <button className="size-extra-btn" onClick={store.resetLogoSize}>Reset</button>
              </div>
              <NudgeControl target="logo"/>
            </div>
          )}
        </div>
      )}

      {/* ── NOME ── */}
      {hasNameSection && (
        <div>
          <SectionLabel>Nome</SectionLabel>
          <div className="field-group">
            <div className="field">
              <label>Texto do nome</label>
              <input
                type="text"
                value={store.nameText}
                onChange={e => store.setNameText(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="field">
              <label>Fonte</label>
              <select value={store.nameFont} onChange={e => store.setNameFont(e.target.value)}>
                {NAME_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel>Tamanho</SectionLabel>
              <div className="size-control">
                <button className="size-btn" onClick={() => store.adjustText('name', -0.1)}>−</button>
                <div className="size-value">{store.elements.name.size.toFixed(1)}</div>
                <button className="size-btn" onClick={() => store.adjustText('name', 0.1)}>+</button>
              </div>
            </div>
            <NudgeControl target="name"/>
          </div>
        </div>
      )}

      {/* ── PROFISSÃO ── */}
      {hasProfissao && (
        <div>
          <SectionLabel>Profissão</SectionLabel>
          <div className="field-group">
            <div className="field">
              <label>Texto da profissão</label>
              <input
                type="text"
                value={store.professionText}
                onChange={e => store.setProfessionText(e.target.value)}
                placeholder="Cargo / Especialidade"
              />
            </div>
            <div className="field">
              <label>Fonte</label>
              <select value={store.professionFont} onChange={e => store.setProfessionFont(e.target.value)}>
                {PROF_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel>Tamanho</SectionLabel>
              <div className="size-control">
                <button className="size-btn" onClick={() => store.adjustText('profession', -0.05)}>−</button>
                <div className="size-value">{store.elements.profession.size.toFixed(2)}</div>
                <button className="size-btn" onClick={() => store.adjustText('profession', 0.05)}>+</button>
              </div>
            </div>
            <NudgeControl target="profession"/>
            <div className="pos-row" style={{ marginTop: 4 }}>
              <button
                className="pos-center-btn"
                style={{ width: '100%' }}
                onClick={store.alignProfToName}
              >
                ⬆ Alinhar ao nome
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divider"/>

      {/* ── COR ── */}
      <div>
        <SectionLabel>Cor do ABS</SectionLabel>
        <div className="color-row">
          <div
            className={`color-opt gold${store.color === 'dourado' ? ' active' : ''}`}
            onClick={() => store.setColor('dourado')}
          >⚱️ Dourado</div>
          <div
            className={`color-opt silver${store.color === 'prata' ? ' active' : ''}`}
            onClick={() => store.setColor('prata')}
          >🥈 Prata</div>
          <div
            className={`color-opt rose-gold${store.color === 'rose_gold' ? ' active' : ''}`}
            onClick={() => store.setColor('rose_gold')}
          >🌸 Rose Gold</div>
        </div>
      </div>

    </aside>
  )
}
