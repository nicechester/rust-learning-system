let toolchainStatus = null;

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

export async function initToolchain() {
  const statusEl = document.getElementById('toolchain-status');
  
  try {
    toolchainStatus = await invoke('detect_toolchain');
    
    if (toolchainStatus.installed) {
      const cargoVer = toolchainStatus.cargo_version?.split(' ')[1] || 'unknown';
      const rustcVer = toolchainStatus.rustc_version?.split(' ')[1] || 'unknown';
      
      statusEl.innerHTML = `
        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
        <span class="text-green-400 font-medium">Toolchain Ready</span>
        <span class="text-gray-500 text-xs" title="${toolchainStatus.rustc_version}">
          rustc ${rustcVer}
        </span>
      `;
      statusEl.classList.add('toolchain-ok');
    } else {
      statusEl.innerHTML = `
        <span class="w-2 h-2 bg-red-500 rounded-full"></span>
        <span class="text-red-400 font-medium">Toolchain Not Found</span>
        <a href="https://rustup.rs" target="_blank" class="text-blue-400 hover:text-blue-300 text-xs underline">
          Install Rust
        </a>
      `;
      statusEl.classList.add('toolchain-error');
    }
  } catch (error) {
    statusEl.innerHTML = `
      <span class="w-2 h-2 bg-red-500 rounded-full"></span>
      <span class="text-red-400 font-medium">Error detecting toolchain</span>
    `;
    console.error('Toolchain detection error:', error);
  }
  
  return toolchainStatus;
}

export function getToolchainStatus() {
  return toolchainStatus;
}

export function isToolchainReady() {
  return toolchainStatus?.installed === true;
}
