import { getValue, setValue, clearMarkers } from './editor.js';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}
import { markExerciseAttempt, markExerciseCompleted, getExerciseProgress } from './progress.js';

let currentExercise = null;
let exerciseHint = null;

const EXERCISE_PATH_MAP = {
  'intro': '00_intro',
  'variables': '01_variables',
  'functions': '02_functions',
  'if': '03_if',
  'primitive_types': '04_primitive_types',
  'vecs': '05_vecs',
  'move_semantics': '06_move_semantics',
  'structs': '07_structs',
  'enums': '08_enums',
  'strings': '09_strings',
  'modules': '10_modules',
  'hashmaps': '11_hashmaps',
  'options': '12_options',
  'error_handling': '13_error_handling',
  'generics': '14_generics',
  'traits': '15_traits',
  'lifetimes': '16_lifetimes',
  'tests': '17_tests',
  'iterators': '18_iterators',
  'smart_pointers': '19_smart_pointers',
  'threads': '20_threads',
  'macros': '21_macros',
  'clippy': '22_clippy',
  'conversions': '23_conversions',
};

function getExercisePath(exerciseId) {
  const filename = exerciseId.endsWith('.rs') ? exerciseId : `${exerciseId}.rs`;
  const baseName = filename.replace('.rs', '');
  
  const match = baseName.match(/^([a-z_]+?)(\d*)$/);
  if (!match) {
    return `00_intro/${filename}`;
  }
  
  const topic = match[1].replace(/_$/, '');
  const dir = EXERCISE_PATH_MAP[topic];
  
  if (!dir) {
    for (const [key, value] of Object.entries(EXERCISE_PATH_MAP)) {
      if (topic.startsWith(key)) {
        return `${value}/${filename}`;
      }
    }
    return `00_intro/${filename}`;
  }
  
  return `${dir}/${filename}`;
}

export async function loadExercise(exerciseId) {
  try {
    const path = `rustlings/exercises/${getExercisePath(exerciseId)}`;
    const code = await invoke('read_resource', { path });
    
    currentExercise = {
      id: exerciseId,
      path: path,
      originalCode: code,
    };
    
    exerciseHint = extractHint(code);
    
    const progress = await getExerciseProgress(exerciseId);
    if (progress && progress.last_code) {
      setValue(progress.last_code);
    } else {
      setValue(code);
    }
    
    clearMarkers();
    updateExerciseInfo();
    
    window.dispatchEvent(new CustomEvent('exercise:loaded', { detail: currentExercise }));
    
    return true;
  } catch (error) {
    console.error('Failed to load exercise:', error);
    currentExercise = null;
    exerciseHint = null;
    return false;
  }
}

function extractHint(code) {
  const hintMatch = code.match(/\/\/\s*(?:HINT|Hint|hint):\s*(.+?)(?:\n|$)/s);
  if (hintMatch) {
    return hintMatch[1].trim();
  }
  
  const commentBlock = code.match(/\/\*[\s\S]*?\*\//);
  if (commentBlock) {
    const hintInBlock = commentBlock[0].match(/hint[:\s]+(.+?)(?:\n|\*\/)/is);
    if (hintInBlock) {
      return hintInBlock[1].trim();
    }
  }
  
  return null;
}

function updateExerciseInfo() {
  const infoEl = document.getElementById('exercise-info');
  if (!infoEl) return;
  
  if (!currentExercise) {
    infoEl.innerHTML = '';
    return;
  }
  
  infoEl.innerHTML = `
    <div class="flex items-center gap-2 text-sm">
      <span class="text-gray-400">Exercise:</span>
      <span class="text-white font-medium">${currentExercise.id}</span>
      ${exerciseHint ? `
        <button id="btn-hint" class="ml-2 px-2 py-1 text-xs bg-yellow-600 hover:bg-yellow-500 rounded transition-colors">
          Show Hint
        </button>
      ` : ''}
    </div>
  `;
  
  const hintBtn = document.getElementById('btn-hint');
  if (hintBtn) {
    hintBtn.addEventListener('click', showHint);
  }
}

export function showHint() {
  if (!exerciseHint) {
    alert('No hint available for this exercise.');
    return;
  }
  
  const hintEl = document.getElementById('hint-panel');
  if (hintEl) {
    hintEl.innerHTML = `
      <div class="p-3 bg-yellow-900/30 border border-yellow-700 rounded">
        <div class="text-yellow-400 font-medium mb-1">Hint</div>
        <div class="text-yellow-200 text-sm">${exerciseHint}</div>
      </div>
    `;
    hintEl.classList.remove('hidden');
  } else {
    alert(`Hint: ${exerciseHint}`);
  }
}

export function hideHint() {
  const hintEl = document.getElementById('hint-panel');
  if (hintEl) {
    hintEl.classList.add('hidden');
  }
}

export async function runExercise(mode = 'test') {
  if (!currentExercise) {
    console.warn('No exercise loaded');
    return;
  }
  
  const code = getValue();
  await markExerciseAttempt(currentExercise.id, code);
  
  window.dispatchEvent(new CustomEvent('exercise:run', { 
    detail: { exercise: currentExercise, code, mode } 
  }));
}

export async function onExerciseCompleted(success) {
  if (!currentExercise || !success) return;
  
  const code = getValue();
  await markExerciseCompleted(currentExercise.id, code);
  
  window.dispatchEvent(new CustomEvent('exercise:completed', { 
    detail: currentExercise 
  }));
}

export function resetExercise() {
  if (!currentExercise) return;
  
  setValue(currentExercise.originalCode);
  clearMarkers();
  hideHint();
}

export function getCurrentExercise() {
  return currentExercise;
}

export function getExerciseHint() {
  return exerciseHint;
}

export function isExerciseComplete(code) {
  return !code.includes('// I AM NOT DONE');
}

export function clearExercise() {
  currentExercise = null;
  exerciseHint = null;
  updateExerciseInfo();
}
