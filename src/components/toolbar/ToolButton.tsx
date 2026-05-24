import React, { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

interface ToolButtonProps {
  icon: LucideIcon
  label: string
  shortcut?: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
}

export function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active = false,
  onClick,
  disabled = false,
}: ToolButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative flex justify-center">
      <button
        className={`tool-btn ${active ? 'active' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
        onClick={disabled ? undefined : onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={label}
      >
        <Icon size={16} strokeWidth={1.75} />
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="studio-tooltip left-full top-1/2 -translate-y-1/2 ml-2 flex items-center gap-2">
          <span>{label}</span>
          {shortcut && (
            <kbd className="px-1 py-0.5 bg-studio-bg border border-studio-border rounded text-studio-faint font-mono text-2xs">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  )
}
