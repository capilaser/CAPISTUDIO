import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        ink: {
          50: '#f6f7f8',
          100: '#ebeef0',
          200: '#d4d7da',
          300: '#b4b8bc',
          400: '#8a8e92',
          500: '#5a5d61',
          600: '#3a3d40',
          700: '#2a2c2e',
          800: '#1f2123',
          900: '#16181a',
          950: '#0e0f10',
        },
        laser: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          muted: '#fca5a5',
        },
        op: {
          contorno: '#000000',
          corte: '#000000',
          'corte-laser': '#2563eb',
          gravacao: '#dc2626',
          marcacao: '#2563eb',
          aplique: '#7c3aed',
          'gravacao-aplique': '#d97706',
        },
        ok: '#15803d',
        warn: '#d4aa3a',
        danger: '#dc2626',

        // Fase G1 (Onda 12) — tokens semânticos do design system Stitch.
        // Convivem com os legados (laser, ink-*, op-*). Páginas novas usam
        // esses; páginas antigas migram conforme as fases B/C/D forem feitas.
        success: '#16A34A', // verde Aprovar
        warning: '#D97706', // âmbar Aguardando Info
        // Badges de operação por camada (LayerPanel painel direito):
        'op-cut-bg': '#1C1C1E',
        'op-cut-text': '#A1A1AA',
        'op-grav-bg': '#2D1515',
        'op-grav-text': '#EF4444',
        'op-marc-bg': '#0F1929',
        'op-marc-text': '#3B82F6',
        // Marketplaces (cards do Kanban futuro):
        'mkt-shopee': '#EE4D2D',
        'mkt-ml': '#FFE600',
        'mkt-whatsapp': '#25D366',
        // Cor de máquina ativa (badge M1/M2/M3) — derivada do violeta primary:
        'machine-active': '#4C1D95',

        // Onda 19.C — 4 níveis de superfície (hierarquia visual).
        // Convivem com background/card/popover semânticos: estes tokens
        // são pra dropdown/dialog/popover/tooltip que precisam ficar
        // visualmente ACIMA do card.
        //   surface-0 = mesma cor do background (deepest, sem elevação)
        //   surface-1 = mesma cor do card (elevação 1, default)
        //   surface-2 = dropdowns, popovers, tooltips (elevação 2)
        //   surface-3 = dialogs/modais (elevação 3, topo absoluto)
        'surface-0': '#0A0A0B',
        'surface-1': '#111113',
        'surface-2': '#16161A',
        'surface-3': '#1C1D22',
      },
      fontFamily: {
        display: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        body: ['"Geist Variable"', '"Geist"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
};

export default config;
