use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod db_tx;

const MAX_SVG_BYTES: usize = 10 * 1024 * 1024; // 10 MB — limite defensivo pra IPC
const MAX_BACKUPS: usize = 10; // Onda 25 Fase H — rolling backup count

/// Onda 25 Fase H — backup automático do SQLite antes de qualquer migration
/// nova rodar. Copia `capi-studio.db` → `backups/capi-studio.<timestamp>.db`
/// e mantém só os MAX_BACKUPS mais recentes. Sem isso, qualquer migration
/// ruim ou crash de WAL destrói trabalho do operador permanentemente.
///
/// Chamado DENTRO do `.setup()` do Tauri builder, ANTES do plugin-sql tentar
/// abrir o DB. Falha silenciosa (loga em stderr) — backup é uma rede, não
/// pode bloquear boot. Se o usuário tem permissão pra abrir o app mas não
/// pra criar `backups/`, é melhor o app funcionar sem backup do que travar.
fn backup_db_if_exists(app: &tauri::AppHandle) {
    let app_data = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[capi-studio] backup skip: app_data_dir indisponível: {e}");
            return;
        }
    };

    let db_path = app_data.join("capi-studio.db");
    if !db_path.exists() {
        // Primeira execução — DB ainda não existe. Plugin-sql vai criar.
        return;
    }

    let backups_dir = app_data.join("backups");
    if let Err(e) = std::fs::create_dir_all(&backups_dir) {
        eprintln!("[capi-studio] backup skip: create_dir_all falhou: {e}");
        return;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let backup_path = backups_dir.join(format!("capi-studio.{}.db", timestamp));

    if let Err(e) = std::fs::copy(&db_path, &backup_path) {
        eprintln!("[capi-studio] backup falhou: {e}");
        return;
    }

    // Rolling: mantém só os MAX_BACKUPS mais recentes (por mtime).
    let mut entries: Vec<_> = match std::fs::read_dir(&backups_dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with("capi-studio.")
            })
            .collect(),
        Err(_) => return, // não consegui listar — desisto da rotação, não é fatal
    };
    entries.sort_by_key(|e| {
        std::cmp::Reverse(
            e.metadata()
                .and_then(|m| m.modified())
                .unwrap_or(UNIX_EPOCH),
        )
    });
    for old in entries.iter().skip(MAX_BACKUPS) {
        let _ = std::fs::remove_file(old.path());
    }
}

/// Hardening Onda 11.security — valida que `path` está sob um dos diretórios
/// permitidos (assets do usuário em appData OU resources bundled). Recusa
/// qualquer path que escape esses roots via `..`, symlinks ou caminho absoluto
/// arbitrário. Roda em TODOS os Tauri commands que tocam o filesystem.
///
/// `sub` é o nome da subpasta esperada (ex: "appliques", "engravings",
/// "markings"). Tanto `$appData/assets/<sub>/` quanto `$resource/fixtures/<sub>/`
/// são aceitos.
///
/// Importante: usa `canonicalize` em ambos os lados pra resolver symlinks +
/// `.` + `..` antes de comparar. Sem isso, `/path/../../etc/passwd` passaria
/// pela checagem prefix-based.
fn assert_under_assets(app: &tauri::AppHandle, path: &Path, sub: &str) -> Result<(), String> {
    let canonical_target = path
        .canonicalize()
        .map_err(|e| format!("path not found: {e}"))?;

    let app_data_assets = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("assets")
        .join(sub);
    let app_data_canonical = app_data_assets
        .canonicalize()
        .unwrap_or_else(|_| app_data_assets.clone());

    let resource_fixtures: PathBuf = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("resources")
        .join("fixtures")
        .join(sub);
    let resource_fixtures_canonical = resource_fixtures
        .canonicalize()
        .unwrap_or_else(|_| resource_fixtures.clone());

    if canonical_target.starts_with(&app_data_canonical)
        || canonical_target.starts_with(&resource_fixtures_canonical)
    {
        Ok(())
    } else {
        Err(format!(
            "path outside allowed scope: {:?} (allowed roots: {:?}, {:?})",
            canonical_target, app_data_canonical, resource_fixtures_canonical
        ))
    }
}

#[tauri::command]
async fn save_applique_file(
    id: String,
    content: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Hardening: limite defensivo de tamanho — evita IPC abuse com payload gigante.
    if content.len() > MAX_SVG_BYTES {
        return Err(format!(
            "SVG too large: {} bytes (max {})",
            content.len(),
            MAX_SVG_BYTES
        ));
    }
    // Hardening: aceita só ids alfanuméricos+hífen (uuid-like). Bloqueia
    // path traversal via `id="../../../etc/passwd"`.
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!("invalid applique id: {:?}", id));
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data_dir.join("assets").join("appliques");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_path = dir.join(format!("{}.svg", id));
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn delete_applique_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(()); // idempotente: deletar arquivo já-deletado não é erro
    }
    assert_under_assets(&app, p, "appliques")?;
    std::fs::remove_file(p).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn read_applique_file(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let p = Path::new(&path);
    assert_under_assets(&app, p, "appliques")?;
    std::fs::read_to_string(p).map_err(|e| format!("Erro ao ler arquivo: {}", e))
}

#[tauri::command]
async fn read_engraving_file(path: String, app: tauri::AppHandle) -> Result<String, String> {
    // Onda 8.5: helper read-only para SVGs de gravações bundled em
    // src-tauri/resources/fixtures/engravings/. Espelha read_applique_file.
    // Save/delete ficam para Onda 10 (UI de cadastro).
    let p = Path::new(&path);
    assert_under_assets(&app, p, "engravings")?;
    std::fs::read_to_string(p).map_err(|e| format!("Erro ao ler arquivo: {}", e))
}

#[tauri::command]
async fn read_marking_file(path: String, app: tauri::AppHandle) -> Result<String, String> {
    // Onda 9: helper read-only para SVGs de marcações. Espelha read_engraving_file.
    // Save/delete ficam para Onda 10.
    let p = Path::new(&path);
    assert_under_assets(&app, p, "markings")?;
    std::fs::read_to_string(p).map_err(|e| format!("Erro ao ler arquivo: {}", e))
}

#[tauri::command]
async fn save_logo_file(
    id: String,
    content: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    // Onda 14 — banco auto-crescente de logos. Mesma hardening do save_applique_file.
    if content.len() > MAX_SVG_BYTES {
        return Err(format!(
            "SVG too large: {} bytes (max {})",
            content.len(),
            MAX_SVG_BYTES
        ));
    }
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!("invalid logo id: {:?}", id));
    }

    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = app_data_dir.join("assets").join("logos");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_path = dir.join(format!("{}.svg", id));
    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
async fn read_logo_file(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let p = Path::new(&path);
    assert_under_assets(&app, p, "logos")?;
    std::fs::read_to_string(p).map_err(|e| format!("Erro ao ler arquivo: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/0000_lyrical_moon_knight.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "curated_fonts",
            sql: include_str!("../migrations/0001_curated_fonts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "rename_variable_fonts",
            sql: include_str!("../migrations/0002_rename_variable_fonts.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "fix_resource_paths",
            sql: include_str!("../migrations/0003_fix_resource_paths.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "wave6a_schema",
            sql: include_str!("../migrations/0004_wave6a_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "engraving_category_id",
            sql: include_str!("../migrations/0005_engraving_category_id.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "export_operation_machines",
            sql: include_str!("../migrations/0006_export_operation_machines.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "order_revisions",
            sql: include_str!("../migrations/0007_order_revisions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "orders_marketplace_kanban",
            sql: include_str!("../migrations/0008_orders_marketplace_kanban.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "order_items_multi",
            sql: include_str!("../migrations/0009_order_items_multi.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "clean_test_patterns",
            sql: include_str!("../migrations/0010_clean_test_patterns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "board_canvas_json",
            sql: include_str!("../migrations/0011_board_canvas_json.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "order_items_cascade",
            sql: include_str!("../migrations/0012_order_items_cascade.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // Onda 25 Fase G — single-instance lock. Quando o usuário tenta abrir
        // o exe uma 2ª vez, o callback roda no processo ORIGINAL e foca a
        // janela existente. A 2ª instância termina sem nunca tocar o DB.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        // Onda 9.F — plugins necessários pro fluxo de export PNG:
        //   dialog: usuário escolhe pasta de destino (Tauri file picker)
        //   fs:     gravar o PNG no disco escolhido
        //   shell:  abrir Windows Explorer na pasta após exportar
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:capi-studio.db", migrations)
                .build(),
        )
        // Onda 25 Fase H — backup do DB no boot. Roda ANTES do JS chamar
        // Database.load(...), garantindo que se a migration nova corromper
        // algo, o operador tem o estado anterior em $APPDATA/backups/.
        // Falhas no backup são não-fatais (loga em stderr, app segue).
        .setup(|app| {
            backup_db_if_exists(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_applique_file,
            delete_applique_file,
            read_applique_file,
            read_engraving_file,
            read_marking_file,
            save_logo_file,
            read_logo_file,
            db_tx::db_tx_execute
        ])
        .run(tauri::generate_context!())
        // Boot falho (DB lockado, porta 1420 ocupada em dev, etc): logar em
        // stderr antes de sair com código != 0. Sem isso, panic mostra crash
        // silencioso pro operador. MessageDialog não dá pra mostrar aqui —
        // a app builder falhou; sem app, sem janela.
        .unwrap_or_else(|err| {
            eprintln!("[capi-studio] erro fatal ao inicializar Tauri: {err:?}");
            std::process::exit(1);
        });
}
