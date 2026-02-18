use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tempfile::TempDir;

#[derive(Debug, Clone, Serialize)]
pub struct OutputLine {
    pub job_id: String,
    pub line: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunCompleted {
    pub job_id: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub enum RunMode {
    #[serde(rename = "run")]
    Run,
    #[serde(rename = "test")]
    Test,
}

const CARGO_TOML_TEMPLATE: &str = r#"[package]
name = "user_code"
version = "0.1.0"
edition = "2021"

[dependencies]
"#;

fn create_temp_project(code: &str, mode: &RunMode) -> Result<TempDir, String> {
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let cargo_toml_path = temp_dir.path().join("Cargo.toml");
    std::fs::write(&cargo_toml_path, CARGO_TOML_TEMPLATE)
        .map_err(|e| format!("Failed to write Cargo.toml: {}", e))?;

    let src_dir = temp_dir.path().join("src");
    std::fs::create_dir(&src_dir).map_err(|e| format!("Failed to create src dir: {}", e))?;

    let file_name = match mode {
        RunMode::Run => "main.rs",
        RunMode::Test => "lib.rs",
    };
    let code_path = src_dir.join(file_name);
    std::fs::write(&code_path, code).map_err(|e| format!("Failed to write code: {}", e))?;

    Ok(temp_dir)
}

#[tauri::command]
pub async fn run_code(
    app: AppHandle,
    code: String,
    mode: String,
    job_id: String,
) -> Result<(), String> {
    let run_mode = match mode.as_str() {
        "test" => RunMode::Test,
        _ => RunMode::Run,
    };

    let temp_dir = create_temp_project(&code, &run_mode)?;
    let start_time = Instant::now();

    let cargo_cmd = match run_mode {
        RunMode::Run => "run",
        RunMode::Test => "test",
    };

    let mut child = Command::new("cargo")
        .arg(cargo_cmd)
        .current_dir(temp_dir.path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn cargo: {}", e))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let job_id_clone = job_id.clone();
    let app_clone = app.clone();
    let stdout_handle = std::thread::spawn(move || {
        if let Some(stdout) = stdout {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_clone.emit(
                        "run:stdout",
                        OutputLine {
                            job_id: job_id_clone.clone(),
                            line,
                        },
                    );
                }
            }
        }
    });

    let job_id_clone = job_id.clone();
    let app_clone = app.clone();
    let stderr_handle = std::thread::spawn(move || {
        if let Some(stderr) = stderr {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(line) = line {
                    let _ = app_clone.emit(
                        "run:stderr",
                        OutputLine {
                            job_id: job_id_clone.clone(),
                            line,
                        },
                    );
                }
            }
        }
    });

    let status = child.wait().map_err(|e| format!("Failed to wait for cargo: {}", e))?;

    stdout_handle.join().ok();
    stderr_handle.join().ok();

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let exit_code = status.code().unwrap_or(-1);

    app.emit(
        "run:completed",
        RunCompleted {
            job_id,
            exit_code,
            duration_ms,
        },
    )
    .map_err(|e| format!("Failed to emit completion: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_run(_job_id: String) -> Result<(), String> {
    // For now, just acknowledge - full implementation would track PIDs
    Ok(())
}
