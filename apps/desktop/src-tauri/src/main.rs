#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize)]
struct Document {
    id: String,
    name: String,
    size: u64,
}

#[derive(Default)]
struct Documents {
    paths: Mutex<HashMap<String, PathBuf>>,
    pending: Mutex<Vec<Document>>,
}

impl Documents {
    fn add(&self, path: PathBuf) -> Result<Document, String> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        let meta = path.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() {
            return Err("Please select a file, not a folder".into());
        }
        let mut paths = self.paths.lock().map_err(|e| e.to_string())?;
        let id = paths
            .iter()
            .find(|(_, p)| **p == path)
            .map(|(id, _)| id.clone())
            .unwrap_or_else(|| format!("document-{}", paths.len() + 1));
        let doc = Document {
            id: id.clone(),
            name: path.file_name().unwrap().to_string_lossy().into_owned(),
            size: meta.len(),
        };
        paths.insert(id, path);
        Ok(doc)
    }
}

#[tauri::command]
async fn open_files(app: tauri::AppHandle) -> Result<Vec<Document>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let files = app
            .dialog()
            .file()
            .set_title("Open images or 3D files")
            .blocking_pick_files();
        files
            .unwrap_or_default()
            .into_iter()
            .map(|f| {
                let path = f.into_path().map_err(|e| e.to_string())?;
                app.state::<Documents>().add(path)
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn pending_files(state: tauri::State<Documents>) -> Vec<Document> {
    std::mem::take(&mut *state.pending.lock().unwrap())
}

#[tauri::command]
async fn read_document(id: String, app: tauri::AppHandle) -> Result<tauri::ipc::Response, String> {
    let path = app
        .state::<Documents>()
        .paths
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .ok_or("This document has not been opened")?;
    tauri::async_runtime::spawn_blocking(move || {
        std::fs::read(path)
            .map(tauri::ipc::Response::new)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

// Choose the destination natively. No arbitrary write-path command is exposed.
#[tauri::command]
async fn save_export(
    request: tauri::ipc::Request<'_>,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let name = percent_encoding::percent_decode_str(
        request
            .headers()
            .get("x-file-name")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("export"),
    )
    .decode_utf8_lossy()
    .into_owned();
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => bytes.clone(),
        _ => return Err("Export requires a binary payload".into()),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let safe_name = std::path::Path::new(&name)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        let Some(file) = app
            .dialog()
            .file()
            .set_file_name(safe_name.as_ref())
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = file.into_path().map_err(|e| e.to_string())?;
        std::fs::write(path, bytes).map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn diagnostic(message: String) {
    // Used by the native smoke run; no filesystem writes or remote logging.
    println!("[desktop] {message}");
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Documents::default())
        .invoke_handler(tauri::generate_handler![
            open_files,
            pending_files,
            read_document,
            save_export,
            diagnostic
        ])
        .setup(|app| {
            // Command-line paths are explicitly supplied by the user (also useful for native smoke tests).
            let state = app.state::<Documents>();
            for arg in std::env::args_os().skip(1) {
                match state.add(PathBuf::from(arg)) {
                    Ok(doc) => state.pending.lock().unwrap().push(doc),
                    Err(error) => eprintln!("Could not open argument: {error}"),
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let state = window.state::<Documents>();
                for path in paths {
                    match state.add(path.clone()) {
                        Ok(doc) => state.pending.lock().unwrap().push(doc),
                        Err(error) => {
                            let _ = window.emit("file-error", error);
                        }
                    }
                }
                let _ = window.emit("files-pending", ());
            }
        })
        .build(tauri::generate_context!())
        .expect("Could not start Visualizer");
    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let state = app.state::<Documents>();
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Ok(doc) = state.add(path) {
                        state.pending.lock().unwrap().push(doc);
                    }
                }
            }
            let _ = app.emit("files-pending", ());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn document_handles_only_resolve_opened_regular_files() {
        let state = Documents::default();
        let path = std::env::temp_dir().join(format!("visualizer-{}.ply", std::process::id()));
        std::fs::write(&path, b"ply").unwrap();
        let first = state.add(path.clone()).unwrap();
        assert_eq!(first.id, state.add(path.clone()).unwrap().id);
        assert_eq!(first.size, 3);
        assert!(state.add(std::env::temp_dir()).is_err());
        assert!(state.paths.lock().unwrap().get("unopened").is_none());
        std::fs::remove_file(path).unwrap();
    }
}
