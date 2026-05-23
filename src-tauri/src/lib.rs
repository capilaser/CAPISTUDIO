use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod db_tx;
mod projects;

const MAX_BACKUPS: usize = 10; // rolling backup count

/// Backup automático do SQLite antes de cada boot que possa migrar.
/// Copia `capi-studio.db` → `backups/capi-studio.<timestamp>.db` e mantém
/// só os MAX_BACKUPS mais recentes.
///
/// Falha silenciosa (loga em stderr) — backup é uma rede, não pode bloquear boot.
fn backup_db_if_exists(app: &tauri::AppHandle) {
    let app_data: PathBuf = match app.path().app_data_dir() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[capi-studio] backup skip: app_data_dir indisponível: {e}");
            return;
        }
    };

    let db_path = app_data.join("capi-studio.db");
    if !db_path.exists() {
        return; // Primeira execução — DB ainda não existe.
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

    // Rolling: mantém só os MAX_BACKUPS mais recentes.
    let mut entries: Vec<_> = match std::fs::read_dir(&backups_dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("capi-studio."))
            .collect(),
        Err(_) => return,
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
        Migration {
            version: 14,
            description: "drop_dead_tables",
            sql: include_str!("../migrations/0013_drop_dead_tables.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:capi-studio.db", migrations)
                .build(),
        )
        .setup(|app| {
            backup_db_if_exists(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Onda 2B — comandos de projeto (filesystem-first).
            projects::create_project,
            projects::list_projects,
            projects::read_project,
            projects::write_project,
            projects::delete_project,
            projects::open_project_folder,
            projects::get_projects_root,
            projects::set_projects_root,
            projects::get_product_base_svg,
            // Onda 11.A — transação SQL multi-statement.
            db_tx::db_tx_execute,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("[capi-studio] erro fatal ao inicializar Tauri: {err:?}");
            std::process::exit(1);
        });
}
