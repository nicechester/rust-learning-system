use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
pub struct ResourceEntry {
    pub name: String,
    pub is_dir: bool,
}

fn get_resource_path(app: &AppHandle, relative_path: &str) -> Result<PathBuf, String> {
    // Determine if this is a rustlings resource or content resource
    let (sub_folder, actual_path) = if relative_path.starts_with("rustlings/") {
        ("rustlings", relative_path.strip_prefix("rustlings/").unwrap_or(relative_path))
    } else {
        ("content", relative_path)
    };

    // Try bundled resources first (production)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join(sub_folder).join(actual_path);
        if resource_path.exists() {
            return Ok(resource_path);
        }
    }

    // Fallback for development: look in the resources folder relative to src-tauri
    let dev_resources = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("resources").join(sub_folder).join(actual_path));

    if let Some(dev_path) = dev_resources {
        if dev_path.exists() {
            return Ok(dev_path);
        }
    }

    Err(format!("Resource not found: {}", relative_path))
}

#[tauri::command]
pub fn read_resource(app: AppHandle, path: String) -> Result<String, String> {
    let resource_path = get_resource_path(&app, &path)?;

    fs::read_to_string(&resource_path)
        .map_err(|e| format!("Failed to read resource '{}': {}", path, e))
}

#[tauri::command]
pub fn list_resources(app: AppHandle, dir: String) -> Result<Vec<ResourceEntry>, String> {
    let resource_path = get_resource_path(&app, &dir)?;

    if !resource_path.is_dir() {
        return Err(format!("Not a directory: {}", dir));
    }

    let entries = fs::read_dir(&resource_path)
        .map_err(|e| format!("Failed to read directory '{}': {}", dir, e))?;

    let mut results = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
            results.push(ResourceEntry { name, is_dir });
        }
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
}

#[tauri::command]
pub fn read_lessons_json(app: AppHandle) -> Result<String, String> {
    read_resource(app, "lessons.json".to_string())
}
