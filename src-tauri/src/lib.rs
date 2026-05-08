use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

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
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:capi-studio.db", migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
