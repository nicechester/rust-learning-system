mod commands;

use commands::{
    cancel_run, detect_toolchain, list_resources, read_lessons_json, read_resource, run_code,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            detect_toolchain,
            run_code,
            cancel_run,
            read_resource,
            list_resources,
            read_lessons_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
