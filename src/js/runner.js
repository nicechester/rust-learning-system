import { getValue } from './editor.js';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

function listen(event, handler) {
  return window.__TAURI__.event.listen(event, handler);
}
import { onExerciseCompleted, getCurrentExercise, isExerciseComplete } from './exercises.js';

let isRunning = false;
let currentJobId = null;
let unlistenStdout = null;
let unlistenStderr = null;
let unlistenCompleted = null;

function generateJobId() {
  return 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getElements() {
  return {
    output: document.getElementById('console-output'),
    status: document.getElementById('run-status'),
    btnRun: document.getElementById('btn-run'),
    btnTest: document.getElementById('btn-test'),
    btnClear: document.getElementById('btn-clear'),
  };
}

function appendOutput(line, type = 'stdout') {
  const { output } = getElements();
  const lineEl = document.createElement('div');
  lineEl.className = type;
  lineEl.textContent = line;
  output.appendChild(lineEl);
  output.scrollTop = output.scrollHeight;
}

function clearOutput() {
  const { output } = getElements();
  output.innerHTML = '<div class="text-gray-500">Ready to run code.</div>';
}

function setRunning(running) {
  isRunning = running;
  const { btnRun, btnTest, status } = getElements();
  
  if (btnRun) btnRun.disabled = running;
  if (btnTest) btnTest.disabled = running;
  
  if (running) {
    if (btnRun) btnRun.classList.add('running');
    if (status) {
      status.textContent = 'Compiling...';
      status.className = 'text-xs text-yellow-400';
    }
  } else {
    if (btnRun) btnRun.classList.remove('running');
  }
}

async function setupListeners() {
  if (unlistenStdout) await unlistenStdout();
  if (unlistenStderr) await unlistenStderr();
  if (unlistenCompleted) await unlistenCompleted();

  unlistenStdout = await listen('run:stdout', (event) => {
    if (event.payload.job_id === currentJobId) {
      appendOutput(event.payload.line, 'stdout');
    }
  });

  unlistenStderr = await listen('run:stderr', (event) => {
    if (event.payload.job_id === currentJobId) {
      appendOutput(event.payload.line, 'stderr');
    }
  });

  unlistenCompleted = await listen('run:completed', (event) => {
    if (event.payload.job_id === currentJobId) {
      const { status } = getElements();
      const { exit_code, duration_ms } = event.payload;
      
      const success = exit_code === 0;
      
      if (success) {
        if (status) {
          status.textContent = `Completed in ${duration_ms}ms`;
          status.className = 'text-xs text-green-400';
        }
        appendOutput(`\n✓ Process exited with code 0 (${duration_ms}ms)`, 'success');
        
        const exercise = getCurrentExercise();
        const code = getValue();
        if (exercise && isExerciseComplete(code)) {
          onExerciseCompleted(true);
        }
      } else {
        if (status) {
          status.textContent = `Failed (exit code ${exit_code})`;
          status.className = 'text-xs text-red-400';
        }
        appendOutput(`\n✗ Process exited with code ${exit_code} (${duration_ms}ms)`, 'error');
      }
      
      setRunning(false);
      currentJobId = null;
    }
  });
}

export async function runCode(mode = 'run') {
  if (isRunning) return;
  
  const { output, status } = getElements();
  const code = getValue().trim();
  
  if (!code) {
    if (status) {
      status.textContent = 'No code to run';
      status.className = 'text-xs text-yellow-400';
    }
    return;
  }
  
  if (output) output.innerHTML = '';
  currentJobId = generateJobId();
  setRunning(true);
  
  appendOutput(`$ cargo ${mode}`, 'info');
  appendOutput('', 'stdout');
  
  try {
    await invoke('run_code', {
      code: code,
      mode: mode,
      jobId: currentJobId,
    });
  } catch (error) {
    appendOutput(`Error: ${error}`, 'error');
    setRunning(false);
    currentJobId = null;
    
    const { status } = getElements();
    if (status) {
      status.textContent = 'Failed to start';
      status.className = 'text-xs text-red-400';
    }
  }
}

export async function initRunner() {
  await setupListeners();
  
  const { btnRun, btnTest, btnClear } = getElements();
  
  if (btnRun) btnRun.addEventListener('click', () => runCode('run'));
  if (btnTest) btnTest.addEventListener('click', () => runCode('test'));
  if (btnClear) btnClear.addEventListener('click', clearOutput);
}

export function isCodeRunning() {
  return isRunning;
}
