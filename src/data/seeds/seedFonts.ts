import type Database from '@tauri-apps/plugin-sql';

// Source: v1-data/fonts.json
const FONTS = [
  {
    id: 'bebas-neue',
    name: 'Bebas Neue',
    category: 'Display',
    family: 'Bebas Neue',
    source: 'local',
    file: 'assets/fonts/BebasNeue-Regular.ttf',
  },
  {
    id: 'anton',
    name: 'Anton',
    category: 'Display',
    family: 'Anton',
    source: 'google',
    file: null,
  },
  {
    id: 'oswald',
    name: 'Oswald',
    category: 'Display',
    family: 'Oswald',
    source: 'google',
    file: null,
  },
  {
    id: 'barlow-condensed',
    name: 'Barlow Condensed',
    category: 'Display',
    family: 'Barlow Condensed',
    source: 'google',
    file: null,
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    category: 'Moderno',
    family: 'Montserrat',
    source: 'google',
    file: null,
  },
  {
    id: 'raleway',
    name: 'Raleway',
    category: 'Moderno',
    family: 'Raleway',
    source: 'google',
    file: null,
  },
  {
    id: 'cinzel',
    name: 'Cinzel',
    category: 'Moderno',
    family: 'Cinzel',
    source: 'google',
    file: null,
  },
  {
    id: 'playfair-display',
    name: 'Playfair Display',
    category: 'Serifado',
    family: 'Playfair Display',
    source: 'google',
    file: null,
  },
  {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    category: 'Serifado',
    family: 'Libre Baskerville',
    source: 'google',
    file: null,
  },
  {
    id: 'dancing-script',
    name: 'Dancing Script',
    category: 'Script',
    family: 'Dancing Script',
    source: 'google',
    file: null,
  },
  {
    id: 'great-vibes',
    name: 'Great Vibes',
    category: 'Script',
    family: 'Great Vibes',
    source: 'google',
    file: null,
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    category: 'Sem Serifa',
    family: 'Open Sans',
    source: 'google',
    file: null,
  },
  {
    id: 'lato',
    name: 'Lato',
    category: 'Sem Serifa',
    family: 'Lato',
    source: 'google',
    file: null,
  },
  {
    id: 'inter',
    name: 'Inter',
    category: 'Sem Serifa',
    family: 'Inter',
    source: 'google',
    file: null,
  },
] as const;

export async function seedFonts(db: Database): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const font of FONTS) {
    const result = await db.execute(
      'INSERT OR IGNORE INTO fonts (id, name, category, family, source, file) VALUES (?, ?, ?, ?, ?, ?)',
      [font.id, font.name, font.category, font.family, font.source, font.file]
    );
    if (result.rowsAffected === 1) inserted++;
    else skipped++;
  }

  return { inserted, skipped };
}
