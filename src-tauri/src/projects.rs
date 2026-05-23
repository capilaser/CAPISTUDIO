/*!
 * projects.rs — comandos Tauri para CRUD de projetos no filesystem.
 *
 * O Capi Studio armazena cada projeto como uma PASTA no disco do usuário,
 * com a estrutura definida em PROJECT_VISION §10. O filesystem é a fonte de
 * verdade — não há tabela SQL para projetos.
 *
 * Estrutura:
 *   <root>/<project-folder>/
 *     projeto.cps.json        ← canvas + camadas + meta (texto JSON)
 *     thumbnail.png           ← miniatura para tela inicial
 *     assets/{logos,imagens,svgs,fontes}/
 *     base/
 *     templates/
 *     exports/png/, svg/{MB,FB,DL}/, dxf/{MB,FB,DL}/
 *     mockups/
 *     historico/
 *     config/
 *
 * Hardening:
 *   - nome de projeto sanitizado (sem path traversal, sem caracteres ilegais
 *     no Windows: <>:"|?*\/).
 *   - todas as operações ficam restritas à raiz configurada — checadas via
 *     canonicalize + starts_with.
 *   - escrita atômica: temp file + rename.
 *   - tamanho de payload limitado.
 */

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const MAX_PROJECT_FILE_BYTES: usize = 50 * 1024 * 1024; // 50 MB — projetos grandes com muitos paths/SVGs cabem aqui
const PROJECT_FILE_NAME: &str = "projeto.cps.json";
const THUMBNAIL_FILE_NAME: &str = "thumbnail.png";
const SETTINGS_KEY_ROOT: &str = "projects_root";

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectSummary {
    /// Nome da pasta (igual ao nome humano).
    pub folder_name: String,
    /// Caminho absoluto da pasta do projeto.
    pub folder_path: String,
    /// Nome humano dentro de projeto.cps.json (pode divergir do folder se renomear fora).
    pub name: Option<String>,
    /// productId dentro de projeto.cps.json.
    pub product_id: Option<String>,
    /// ISO 8601 do updatedAt no JSON; None se não conseguiu ler.
    pub updated_at: Option<String>,
    /// Caminho do thumbnail.png se existir.
    pub thumbnail_path: Option<String>,
    /// Tamanho do projeto.cps.json em bytes (ajuda em debug).
    pub file_size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ProjectMetaLite {
    name: Option<String>,
    #[serde(rename = "productId")]
    product_id: Option<String>,
    #[serde(rename = "updatedAt")]
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProjectFileLite {
    meta: Option<ProjectMetaLite>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanitização de nome de pasta
// ─────────────────────────────────────────────────────────────────────────────

/// Caracteres proibidos em nome de pasta (Windows). Mantém ASCII safe.
const FORBIDDEN_CHARS: &[char] = &['<', '>', ':', '"', '|', '?', '*', '\\', '/', '\0'];

/// Nomes reservados no Windows (case-insensitive).
const RESERVED_NAMES: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// Valida que o nome de pasta é seguro. Retorna o nome trimado se OK, ou erro.
fn validate_folder_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Nome do projeto não pode ser vazio.".into());
    }
    if trimmed.len() > 100 {
        return Err("Nome do projeto excede 100 caracteres.".into());
    }
    if trimmed.starts_with('.') || trimmed.ends_with('.') || trimmed.ends_with(' ') {
        return Err("Nome do projeto não pode começar/terminar com ponto ou espaço.".into());
    }
    if trimmed.chars().any(|c| FORBIDDEN_CHARS.contains(&c)) {
        return Err(format!(
            "Nome contém caracteres inválidos. Não pode usar: {}",
            FORBIDDEN_CHARS.iter().collect::<String>()
        ));
    }
    if trimmed.chars().any(|c| (c as u32) < 32) {
        return Err("Nome contém caracteres de controle inválidos.".into());
    }
    let upper = trimmed.to_uppercase();
    let stem = upper.split('.').next().unwrap_or(&upper);
    if RESERVED_NAMES.contains(&stem) {
        return Err(format!("Nome '{}' é reservado pelo Windows.", trimmed));
    }
    Ok(trimmed.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Raiz dos projetos
// ─────────────────────────────────────────────────────────────────────────────

/// Caminho default da raiz dos projetos: <Documents>/Capi Studio/projetos/
fn default_projects_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| format!("document_dir indisponível: {e}"))?;
    Ok(docs.join("Capi Studio").join("projetos"))
}

/// Lê a raiz configurada de `settings.projects_root` ou usa default. Garante
/// que a pasta existe (cria recursivamente).
fn resolve_projects_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Primeiro tenta ler de um arquivo simples em app_data_dir, depois SQLite,
    // depois default. Por ora: lê arquivo simples; settings SQL podem migrar pra
    // cá depois sem mudar API.
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir indisponível: {e}"))?;
    let settings_path = app_data.join("projects_root.txt");

    let root = if settings_path.exists() {
        let txt = std::fs::read_to_string(&settings_path)
            .map_err(|e| format!("Erro lendo projects_root.txt: {e}"))?;
        let trimmed = txt.trim();
        if trimmed.is_empty() {
            default_projects_root(app)?
        } else {
            PathBuf::from(trimmed)
        }
    } else {
        default_projects_root(app)?
    };

    std::fs::create_dir_all(&root)
        .map_err(|e| format!("Erro criando raiz de projetos {:?}: {}", root, e))?;
    Ok(root)
}

#[tauri::command]
pub async fn get_projects_root(app: tauri::AppHandle) -> Result<String, String> {
    let root = resolve_projects_root(&app)?;
    Ok(root.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn set_projects_root(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    if !p.is_absolute() {
        return Err("Caminho da raiz precisa ser absoluto.".into());
    }
    // Cria se não existe.
    std::fs::create_dir_all(&p).map_err(|e| format!("Erro criando pasta: {e}"))?;
    let canonical = p
        .canonicalize()
        .map_err(|e| format!("Erro canonicalizando: {e}"))?;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&app_data).map_err(|e| format!("Erro criando app_data: {e}"))?;

    let settings_path = app_data.join("projects_root.txt");
    let canonical_str = canonical.to_string_lossy().into_owned();
    std::fs::write(&settings_path, &canonical_str)
        .map_err(|e| format!("Erro salvando projects_root.txt: {e}"))?;

    Ok(canonical_str)
}

// ─────────────────────────────────────────────────────────────────────────────
// Validação de paths (proteção contra escape da raiz)
// ─────────────────────────────────────────────────────────────────────────────

/// Confirma que `path` está sob `root` (após canonicalização). Bloqueia ../, symlinks, etc.
fn assert_under_root(path: &Path, root: &Path) -> Result<(), String> {
    let canonical_target = path
        .canonicalize()
        .map_err(|e| format!("path inválido: {e}"))?;
    let canonical_root = root
        .canonicalize()
        .unwrap_or_else(|_| root.to_path_buf());
    if canonical_target.starts_with(&canonical_root) {
        Ok(())
    } else {
        Err(format!(
            "Path fora da raiz permitida: {:?} (raiz: {:?})",
            canonical_target, canonical_root
        ))
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Criação de projeto
// ─────────────────────────────────────────────────────────────────────────────

/// Subpastas obrigatórias de cada projeto.
const PROJECT_SUBDIRS: &[&[&str]] = &[
    &["assets", "logos"],
    &["assets", "imagens"],
    &["assets", "svgs"],
    &["assets", "fontes"],
    &["base"],
    &["templates"],
    &["exports", "png"],
    &["exports", "svg", "MB"],
    &["exports", "svg", "FB"],
    &["exports", "svg", "DL"],
    &["exports", "dxf", "MB"],
    &["exports", "dxf", "FB"],
    &["exports", "dxf", "DL"],
    &["mockups"],
    &["historico"],
    &["config"],
];

#[tauri::command]
pub async fn create_project(
    name: String,
    cps_json: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    if cps_json.len() > MAX_PROJECT_FILE_BYTES {
        return Err(format!(
            "Arquivo do projeto muito grande: {} bytes (max {})",
            cps_json.len(),
            MAX_PROJECT_FILE_BYTES
        ));
    }
    let safe_name = validate_folder_name(&name)?;
    let root = resolve_projects_root(&app)?;
    let project_dir = root.join(&safe_name);

    if project_dir.exists() {
        return Err(format!(
            "Já existe um projeto chamado '{}'. Escolha outro nome.",
            safe_name
        ));
    }

    // Cria todas as subpastas.
    for parts in PROJECT_SUBDIRS {
        let mut sub = project_dir.clone();
        for p in *parts {
            sub = sub.join(p);
        }
        std::fs::create_dir_all(&sub)
            .map_err(|e| format!("Erro criando subpasta {:?}: {}", sub, e))?;
    }

    // Escreve o arquivo do projeto (write atômico via temp + rename).
    let cps_path = project_dir.join(PROJECT_FILE_NAME);
    let tmp_path = project_dir.join(format!("{}.tmp", PROJECT_FILE_NAME));
    std::fs::write(&tmp_path, &cps_json)
        .map_err(|e| format!("Erro escrevendo projeto.cps.json: {e}"))?;
    std::fs::rename(&tmp_path, &cps_path)
        .map_err(|e| format!("Erro promovendo projeto.cps.json: {e}"))?;

    Ok(project_dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn write_project(
    folder_path: String,
    cps_json: String,
    thumbnail_png_base64: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    if cps_json.len() > MAX_PROJECT_FILE_BYTES {
        return Err(format!(
            "Arquivo do projeto muito grande: {} bytes (max {})",
            cps_json.len(),
            MAX_PROJECT_FILE_BYTES
        ));
    }
    let root = resolve_projects_root(&app)?;
    let dir = PathBuf::from(folder_path);
    assert_under_root(&dir, &root)?;

    let cps_path = dir.join(PROJECT_FILE_NAME);
    let tmp_path = dir.join(format!("{}.tmp", PROJECT_FILE_NAME));
    std::fs::write(&tmp_path, &cps_json)
        .map_err(|e| format!("Erro escrevendo projeto.cps.json: {e}"))?;
    std::fs::rename(&tmp_path, &cps_path)
        .map_err(|e| format!("Erro promovendo projeto.cps.json: {e}"))?;

    if let Some(b64) = thumbnail_png_base64 {
        // base64 sem dependência externa: usa a stdlib via fonte simples.
        // Para evitar adicionar crate `base64`, decodifica num helper inline.
        match decode_base64(&b64) {
            Ok(bytes) => {
                let thumb_path = dir.join(THUMBNAIL_FILE_NAME);
                let tmp = dir.join(format!("{}.tmp", THUMBNAIL_FILE_NAME));
                if let Err(e) = std::fs::write(&tmp, &bytes) {
                    eprintln!("[capi-studio] thumbnail write falhou: {e}");
                } else if let Err(e) = std::fs::rename(&tmp, &thumb_path) {
                    eprintln!("[capi-studio] thumbnail rename falhou: {e}");
                }
            }
            Err(e) => eprintln!("[capi-studio] thumbnail base64 inválido: {e}"),
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn read_project(folder_path: String, app: tauri::AppHandle) -> Result<String, String> {
    let root = resolve_projects_root(&app)?;
    let dir = PathBuf::from(folder_path);
    assert_under_root(&dir, &root)?;
    let cps_path = dir.join(PROJECT_FILE_NAME);
    std::fs::read_to_string(&cps_path)
        .map_err(|e| format!("Erro lendo projeto.cps.json: {e}"))
}

#[tauri::command]
pub async fn list_projects(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let root = resolve_projects_root(&app)?;
    let entries = match std::fs::read_dir(&root) {
        Ok(rd) => rd,
        Err(e) => return Err(format!("Erro lendo raiz {:?}: {}", root, e)),
    };

    let mut out: Vec<ProjectSummary> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder_name = match path.file_name() {
            Some(n) => n.to_string_lossy().into_owned(),
            None => continue,
        };
        let cps_path = path.join(PROJECT_FILE_NAME);
        if !cps_path.exists() {
            // Pasta sem projeto.cps.json não é projeto Capi — ignora.
            continue;
        }

        let file_size = std::fs::metadata(&cps_path).ok().map(|m| m.len());
        let thumb_path = {
            let t = path.join(THUMBNAIL_FILE_NAME);
            if t.exists() {
                Some(t.to_string_lossy().into_owned())
            } else {
                None
            }
        };

        // Lê o JSON parcialmente para extrair meta (não falha se quebrar).
        let (name, product_id, updated_at) = match std::fs::read_to_string(&cps_path) {
            Ok(txt) => match serde_json::from_str::<ProjectFileLite>(&txt) {
                Ok(parsed) => {
                    let meta = parsed.meta.unwrap_or(ProjectMetaLite {
                        name: None,
                        product_id: None,
                        updated_at: None,
                    });
                    (meta.name, meta.product_id, meta.updated_at)
                }
                Err(_) => (None, None, None),
            },
            Err(_) => (None, None, None),
        };

        out.push(ProjectSummary {
            folder_name,
            folder_path: path.to_string_lossy().into_owned(),
            name,
            product_id,
            updated_at,
            thumbnail_path: thumb_path,
            file_size,
        });
    }

    // Ordena por updated_at desc; sem updated_at vai para o fim.
    out.sort_by(|a, b| match (&a.updated_at, &b.updated_at) {
        (Some(x), Some(y)) => y.cmp(x),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.folder_name.cmp(&b.folder_name),
    });
    Ok(out)
}

#[tauri::command]
pub async fn delete_project(folder_path: String, app: tauri::AppHandle) -> Result<(), String> {
    let root = resolve_projects_root(&app)?;
    let dir = PathBuf::from(folder_path);
    assert_under_root(&dir, &root)?;

    // Trash-like: renomeia para _trash-<timestamp>-<name> dentro da raiz, em vez de remover.
    // Cliente decide se quer remover de vez (fora do MVP).
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let trash_dir = root.join("_trash");
    std::fs::create_dir_all(&trash_dir)
        .map_err(|e| format!("Erro criando _trash: {e}"))?;
    let base_name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "projeto".to_string());
    let dest = trash_dir.join(format!("{}-{}", ts, base_name));
    std::fs::rename(&dir, &dest)
        .map_err(|e| format!("Erro movendo para _trash: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn open_project_folder(
    folder_path: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let root = resolve_projects_root(&app)?;
    let dir = PathBuf::from(&folder_path);
    assert_under_root(&dir, &root)?;
    // tauri-plugin-opener: abre path no app default do SO (Explorer no Windows).
    tauri_plugin_opener::OpenerExt::opener(&app)
        .open_path(folder_path, None::<String>)
        .map_err(|e| format!("Erro abrindo pasta: {e}"))?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Base SVG do produto — hoje só broche 60×25
// ─────────────────────────────────────────────────────────────────────────────

/// Conteúdo SVG embarcado da base do broche 60×25mm.
/// Mantém viewBox em mm (já alinhado com PROJECT_VISION §0.2).
const BROCHE_60X25_BASE_SVG: &str = include_str!("../resources/products/broche-60x25.svg");

#[tauri::command]
pub async fn get_product_base_svg(product_id: String) -> Result<String, String> {
    match product_id.as_str() {
        "broche-60x25" => Ok(BROCHE_60X25_BASE_SVG.to_string()),
        other => Err(format!("Produto sem base embarcada: {}", other)),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings helper (silencia warning sobre constante não usada)
// ─────────────────────────────────────────────────────────────────────────────

#[allow(dead_code)]
fn _settings_key_root() -> &'static str {
    SETTINGS_KEY_ROOT
}

// ─────────────────────────────────────────────────────────────────────────────
// base64 (decode minimal, sem crate adicional)
// ─────────────────────────────────────────────────────────────────────────────

fn decode_base64(s: &str) -> Result<Vec<u8>, String> {
    let cleaned: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = cleaned.as_bytes();
    if bytes.len() % 4 != 0 {
        return Err("base64 length não múltiplo de 4".into());
    }
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len() / 4 * 3);
    let val = |c: u8| -> Result<u8, String> {
        match c {
            b'A'..=b'Z' => Ok(c - b'A'),
            b'a'..=b'z' => Ok(c - b'a' + 26),
            b'0'..=b'9' => Ok(c - b'0' + 52),
            b'+' => Ok(62),
            b'/' => Ok(63),
            b'=' => Ok(0),
            _ => Err(format!("caractere base64 inválido: {}", c as char)),
        }
    };
    for chunk in bytes.chunks(4) {
        let a = val(chunk[0])?;
        let b = val(chunk[1])?;
        let c = val(chunk[2])?;
        let d = val(chunk[3])?;
        let triple: u32 =
            ((a as u32) << 18) | ((b as u32) << 12) | ((c as u32) << 6) | (d as u32);
        out.push(((triple >> 16) & 0xFF) as u8);
        if chunk[2] != b'=' {
            out.push(((triple >> 8) & 0xFF) as u8);
        }
        if chunk[3] != b'=' {
            out.push((triple & 0xFF) as u8);
        }
    }
    Ok(out)
}
