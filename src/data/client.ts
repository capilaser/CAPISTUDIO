import Database from '@tauri-apps/plugin-sql';

// DB path resolves to %APPDATA%\com.capilaser.studio\capi-studio.db on Windows.
const DB_PATH = 'sqlite:capi-studio.db';

let _db: Database | null = null;
let _loading: Promise<Database> | null = null;

export async function getDb(): Promise<Database> {
  if (_db) return _db;
  if (_loading) return _loading;
  _loading = Database.load(DB_PATH)
    .then((db) => {
      _db = db;
      _loading = null;
      return db;
    })
    .catch((err) => {
      // Sem reset, próximas chamadas ficariam presas com a promise rejeitada
      // até reload do app — DB corrompido em DEV bloqueia retry após fix.
      _loading = null;
      throw err;
    });
  return _loading;
}
