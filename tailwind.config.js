/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Capi Studio dark theme
        studio: {
          bg:        '#1a1a1a',
          canvas:    '#2a2a2a',
          sidebar:   '#1e1e1e',
          surface:   '#252525',
          elevated:  '#2e2e2e',
          border:    '#333333',
          accent:    '#6366f1',
          'accent-hover': '#818cf8',
          'accent-muted': '#3730a3',
          text:      '#e5e5e5',
          muted:     '#888888',
          faint:     '#555555',
          artboard:  '#ffffff',
          danger:    '#ef4444',
          success:   '#22c55e',
          warning:   '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        xs:    ['0.75rem',  { lineHeight: '1rem' }],
      },
      spacing: {
        sidebar: '52px',
        'sidebar-wide': '220px',
        topbar:  '48px',
        statusbar: '24px',
      },
      borderRadius: {
        studio: '4px',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in':       'fade-in 0.15s ease-out',
        'slide-in-left': 'slide-in-left 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
