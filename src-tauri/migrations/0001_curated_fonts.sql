DELETE FROM fonts;

INSERT OR REPLACE INTO fonts (id, name, category, family, source, file) VALUES
  ('montserrat',       'Montserrat',       'Moderno',     'Montserrat',       'local', 'resources/fonts/Montserrat-Variable.ttf'),
  ('playfair-display', 'Playfair Display', 'Serifado',    'Playfair Display', 'local', 'resources/fonts/PlayfairDisplay-Variable.ttf'),
  ('bebas-neue',       'Bebas Neue',       'Display',     'Bebas Neue',       'local', 'resources/fonts/BebasNeue-Regular.ttf'),
  ('roboto-slab',      'Roboto Slab',      'Corporativo', 'Roboto Slab',      'local', 'resources/fonts/RobotoSlab-Variable.ttf'),
  ('caveat',           'Caveat',           'Script',      'Caveat',           'local', 'resources/fonts/Caveat-Variable.ttf');
