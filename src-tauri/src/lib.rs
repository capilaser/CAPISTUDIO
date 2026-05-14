use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod db_tx;

const MAX_SVG_BYTES: usize = 10 * 1024 * 1024; // 10 MB — limite defensivo pra IPC

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
    ];

    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![
            save_applique_file,
            delete_applique_file,
            read_applique_file,
            read_engraving_file,
            read_marking_file,
            db_tx::db_tx_execute
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
