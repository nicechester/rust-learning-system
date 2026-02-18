use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct ToolchainStatus {
    pub installed: bool,
    pub cargo_version: Option<String>,
    pub rustc_version: Option<String>,
    pub rustup_version: Option<String>,
}

fn get_version(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| {
            String::from_utf8(output.stdout)
                .ok()
                .map(|s| s.trim().to_string())
        })
}

#[tauri::command]
pub async fn detect_toolchain() -> Result<ToolchainStatus, String> {
    let cargo_version = get_version("cargo", &["--version"]);
    let rustc_version = get_version("rustc", &["--version"]);
    let rustup_version = get_version("rustup", &["--version"]);

    let installed = cargo_version.is_some() && rustc_version.is_some();

    Ok(ToolchainStatus {
        installed,
        cargo_version,
        rustc_version,
        rustup_version,
    })
}
