use super::{Document, Documents};
use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct Workspaces(pub Mutex<HashMap<String, PathBuf>>);
#[derive(Serialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
}
#[derive(Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub directory: bool,
    pub document: Option<Document>,
}

impl Workspaces {
    pub fn grant(&self, path: PathBuf) -> Result<Workspace, String> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        if !path.is_dir() {
            return Err("Select a folder".into());
        }
        let mut roots = self.0.lock().unwrap();
        let id = format!("workspace-{}", roots.len() + 1);
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        roots.insert(id.clone(), path);
        Ok(Workspace { id, name })
    }
    fn resolve(&self, id: &str, relative: &str) -> Result<(PathBuf, PathBuf), String> {
        let roots = self.0.lock().unwrap();
        let root = roots.get(id).ok_or("Workspace has not been opened")?;
        let path = root
            .join(relative)
            .canonicalize()
            .map_err(|e| e.to_string())?;
        if !path.starts_with(root) {
            return Err("Path is outside the workspace".into());
        }
        Ok((root.clone(), path))
    }
}

#[tauri::command]
pub async fn open_workspace(app: tauri::AppHandle) -> Result<Option<Workspace>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Open workspace folder")
            .blocking_pick_folder()
            .map(|f| {
                app.state::<Workspaces>()
                    .grant(f.into_path().map_err(|e| e.to_string())?)
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn list_directory(
    app: tauri::AppHandle,
    workspace: String,
    relative: String,
) -> Result<Vec<Entry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (root, directory) = app.state::<Workspaces>().resolve(&workspace, &relative)?;
        let mut entries = Vec::new();
        for result in std::fs::read_dir(directory).map_err(|e| e.to_string())? {
            let entry = result.map_err(|e| e.to_string())?;
            let Ok(canonical) = entry.path().canonicalize() else {
                continue;
            };
            // Do not traverse links outside the grant or cycles through directory symlinks.
            if !canonical.starts_with(&root)
                || (canonical.is_dir()
                    && entry.file_type().map_err(|e| e.to_string())?.is_symlink())
            {
                continue;
            }
            if !canonical.is_file() && !canonical.is_dir() {
                continue;
            }
            let path = entry
                .path()
                .strip_prefix(&root)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .into_owned();
            let directory = canonical.is_dir();
            entries.push(Entry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path,
                directory,
                document: if directory {
                    None
                } else {
                    Some(app.state::<Documents>().add(canonical)?)
                },
            });
        }
        entries.sort_by(|a, b| {
            b.directory
                .cmp(&a.directory)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(entries)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_text(id: String, app: tauri::AppHandle) -> Result<String, String> {
    use std::io::Read;
    let path = app
        .state::<Documents>()
        .paths
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or("Document has not been opened")?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut bytes = Vec::new();
        std::fs::File::open(super::validated_path(&path)?)
            .map_err(|e| e.to_string())?
            .take(2 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|e| e.to_string())?;
        let truncated = bytes.len() > 2 * 1024 * 1024;
        bytes.truncate(2 * 1024 * 1024);
        if bytes.iter().take(8192).any(|b| *b == 0) {
            return Err("Binary file — no text preview available".into());
        }
        let mut text = String::from_utf8_lossy(&bytes).into_owned();
        if truncated {
            text.push_str("\n\n[Preview limited to 2 MiB]");
        }
        Ok(text)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn roots_reject_parent_and_ungranted_access() {
        let root = std::env::temp_dir().join(format!("workspace-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let state = Workspaces::default();
        let grant = state.grant(root.clone()).unwrap();
        assert!(state.resolve(&grant.id, "").is_ok());
        assert!(state.resolve(&grant.id, "..").is_err());
        assert!(state.resolve("unknown", "").is_err());
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(std::path::Path::new("/"), root.join("escape")).unwrap();
            assert!(state.resolve(&grant.id, "escape").is_err());
        }
        std::fs::remove_dir_all(root).unwrap();
    }
}
