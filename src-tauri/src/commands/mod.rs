pub mod toolchain;
pub mod runner;
pub mod resources;

pub use toolchain::*;
pub use runner::*;
pub use resources::*;

/// Resolve the full path to a Rust toolchain binary (cargo, rustc, rustup).
/// macOS GUI apps don't inherit the shell PATH, so ~/.cargo/bin won't be
/// found by name alone. We check the standard rustup install location first.
pub fn cargo_bin_dir() -> std::path::PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        let bin = std::path::PathBuf::from(home).join(".cargo").join("bin");
        if bin.exists() {
            return bin;
        }
    }
    // Fallback: rely on whatever PATH the process has
    std::path::PathBuf::from("")
}

pub fn toolchain_cmd(name: &str) -> std::process::Command {
    let bin_dir = cargo_bin_dir();
    let path = if bin_dir.as_os_str().is_empty() {
        std::path::PathBuf::from(name)
    } else {
        bin_dir.join(name)
    };
    std::process::Command::new(path)
}
