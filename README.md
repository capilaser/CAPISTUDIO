# Capi Studio v2

Sistema desktop Windows para criação de artes de gravação e corte a laser. Re-write informado do v1 (HTML monolítico).

> **Status:** Onda 0 — bootstrap. Estrutura instalada, sem features. Próximas ondas dependem dos JSONs do v1.

## Stack

Tauri 2 · React 19 · TypeScript · Vite · Fabric.js 6 · SQLite (via `tauri-plugin-sql`) · Drizzle · shadcn/ui · Tailwind · Zustand · Zod · React Hook Form · React Router · Lucide.

## Pré-requisitos

- Node 20+ (testado com 25.9)
- [Rust + Cargo](https://rustup.rs/)
- Microsoft C++ Build Tools (Windows)

## Scripts

```bash
npm install            # JS deps
npm run dev            # Vite dev server (sem janela Tauri)
npm run tauri dev      # janela Tauri + Vite
npm run build          # bundle de produção
npm run tauri build    # MSI installer
npm run typecheck
npm run lint
npm run format
```

## Estrutura

Ver `CLAUDE.md` (seção "Extensões v2 → Estrutura de pastas") e `../03-CLAUDE-CODE-KICKOFF.md` para o roadmap das 13 ondas.

## Regras

`CLAUDE.md` é a fonte de verdade. Em conflito com qualquer outro doc, CLAUDE.md vence.
