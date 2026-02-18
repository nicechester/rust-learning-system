import { initToolchain, isToolchainReady } from './toolchain.js';
import { initEditor, getValue, clearMarkers } from './editor.js';
import { initRunner } from './runner.js';
import { initSidebar, updateLessonStatus } from './sidebar.js';
import { initProgress, getOverallProgress, getLastViewedLesson } from './progress.js';
import { loadLesson, nextMicroLesson, prevMicroLesson, hasNextMicroLesson, hasPrevMicroLesson, getCurrentLesson, getCurrentMicroIndex, setLessonsData, findLessonById, getFirstLesson, isLastMicroOfLesson, isFirstMicroOfLesson } from './lessons.js';
import { resetExercise, getCurrentExercise, loadExercise, clearExercise } from './exercises.js';
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
    setupWelcomePage();
    
    await updateProgressSummary();
    await restoreLastPosition();
    
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
  
  window.addEventListener('microlesson:loaded', async (e) => {
    updateLessonNav();
    clearMarkers();
    
    const micro = e.detail?.micro;
    if (micro?.exercises && micro.exercises.length > 0) {
      const exercisePath = micro.exercises[0];
      await loadExercise(exercisePath);
    } else {
      clearExercise();
    }
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
  
  window.addEventListener('lesson:completed', async (e) => {
    const lesson = e.detail?.lesson;
    if (lesson) {
      updateLessonStatus(lesson.id, 'completed');
    }
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
    if (isFirstMicroOfLesson() && hasPrevMicroLesson()) {
      btnPrev.innerHTML = '← Prev Lesson';
    } else {
      btnPrev.innerHTML = '← Previous';
    }
  }
  
  if (btnNext) {
    btnNext.disabled = !hasNextMicroLesson();
    if (isLastMicroOfLesson() && hasNextMicroLesson()) {
      btnNext.innerHTML = 'Next Lesson →';
    } else {
      btnNext.innerHTML = 'Next →';
    }
  }
  
  if (progressEl && lesson) {
    progressEl.textContent = `${index + 1} / ${lesson.micro_lessons.length}`;
  }
}

function setupWelcomePage() {
  const startBtn = document.getElementById('btn-start-learning');
  if (!startBtn) return;
  
  startBtn.addEventListener('click', async () => {
    const firstLesson = getFirstLesson();
    if (firstLesson) {
      await loadLesson(firstLesson);
      highlightLessonInSidebar(firstLesson.id);
    }
  });
}

function highlightLessonInSidebar(lessonId) {
  document.querySelectorAll('.lesson-item').forEach(el => {
    el.classList.remove('active');
  });
  
  const lessonEl = document.querySelector(`[data-lesson-id="${lessonId}"]`);
  if (lessonEl) {
    lessonEl.classList.add('active');
    
    const moduleEl = lessonEl.closest('.module');
    if (moduleEl) {
      const header = moduleEl.querySelector('.module-header');
      const lessons = moduleEl.querySelector('.module-lessons');
      if (header && !header.classList.contains('expanded')) {
        header.classList.add('expanded');
      }
      if (lessons && lessons.classList.contains('hidden')) {
        lessons.classList.remove('hidden');
      }
    }
  }
}

async function restoreLastPosition() {
  try {
    const lastLessonId = await getLastViewedLesson();
    if (lastLessonId) {
      const lesson = findLessonById(lastLessonId);
      if (lesson) {
        console.log('Restoring last position:', lastLessonId);
        await loadLesson(lesson);
        highlightLessonInSidebar(lastLessonId);
      }
    }
  } catch (error) {
    console.warn('Could not restore last position:', error);
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
