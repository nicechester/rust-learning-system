import { initToolchain, isToolchainReady } from './toolchain.js';
import { initEditor, getValue, clearMarkers } from './editor.js';
import { initRunner } from './runner.js';
import { initSidebar } from './sidebar.js';
import { initProgress, getOverallProgress } from './progress.js';
import { loadLesson, nextMicroLesson, prevMicroLesson, hasNextMicroLesson, hasPrevMicroLesson, getCurrentLesson, getCurrentMicroIndex, setLessonsData } from './lessons.js';
import { resetExercise, getCurrentExercise } from './exercises.js';
import { initResize } from './resize.js';

async function initApp() {
  console.log('Rust Learning System initializing...');
  
  try {
    initResize();
    
    await initProgress();
    
    const [toolchain] = await Promise.all([
      initToolchain(),
      initRunner(),
    ]);
    
    initEditor('monaco-container');
    
    await initSidebar();
    
    setupEventListeners();
    setupKeyboardShortcuts();
    
    await updateProgressSummary();
    
    if (toolchain?.installed) {
      console.log('Toolchain ready:', toolchain);
    } else {
      console.warn('Rust toolchain not detected');
    }
    
    console.log('Rust Learning System ready!');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

function setupEventListeners() {
  const btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetExercise();
    });
  }
  
  const btnPrev = document.getElementById('btn-prev-micro');
  const btnNext = document.getElementById('btn-next-micro');
  
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      prevMicroLesson();
      updateLessonNav();
    });
  }
  
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      nextMicroLesson();
      updateLessonNav();
    });
  }
  
  window.addEventListener('lesson:loaded', (e) => {
    const lessonNav = document.getElementById('lesson-nav');
    if (lessonNav) {
      lessonNav.classList.remove('hidden');
    }
    updateLessonNav();
    
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.classList.add('hidden');
    }
  });
  
  window.addEventListener('microlesson:loaded', (e) => {
    updateLessonNav();
    clearMarkers();
  });
  
  window.addEventListener('exercise:loaded', (e) => {
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.classList.remove('hidden');
    }
  });
  
  window.addEventListener('exercise:completed', async () => {
    await updateProgressSummary();
  });
  
  window.addEventListener('editor:run', () => {
    const btnRun = document.getElementById('btn-run');
    if (btnRun) btnRun.click();
  });
  
  window.addEventListener('editor:test', () => {
    const btnTest = document.getElementById('btn-test');
    if (btnTest) btnTest.click();
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      prevMicroLesson();
      updateLessonNav();
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      nextMicroLesson();
      updateLessonNav();
    }
  });
}

function updateLessonNav() {
  const btnPrev = document.getElementById('btn-prev-micro');
  const btnNext = document.getElementById('btn-next-micro');
  const progressEl = document.getElementById('micro-progress');
  
  const lesson = getCurrentLesson();
  const index = getCurrentMicroIndex();
  
  if (btnPrev) {
    btnPrev.disabled = !hasPrevMicroLesson();
  }
  
  if (btnNext) {
    btnNext.disabled = !hasNextMicroLesson();
  }
  
  if (progressEl && lesson) {
    progressEl.textContent = `${index + 1} / ${lesson.micro_lessons.length}`;
  }
}

async function updateProgressSummary() {
  const summaryEl = document.getElementById('progress-summary');
  if (!summaryEl) return;
  
  try {
    const progress = await getOverallProgress();
    summaryEl.innerHTML = `
      <span class="text-green-400">${progress.lessons}</span> lessons · 
      <span class="text-blue-400">${progress.exercises}</span> exercises
    `;
  } catch (error) {
    console.warn('Could not load progress:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

export { loadLesson, setLessonsData };
