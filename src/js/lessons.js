import { markLessonViewed, getLessonProgress } from './progress.js';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

let currentLesson = null;
let currentMicroIndex = 0;
let lessonsData = null;

export function setLessonsData(data) {
  lessonsData = data;
}

export function getLessonsData() {
  return lessonsData;
}

export function getCurrentLesson() {
  return currentLesson;
}

export function getCurrentMicroIndex() {
  return currentMicroIndex;
}

export function getCurrentMicroLesson() {
  if (!currentLesson || !currentLesson.micro_lessons) return null;
  return currentLesson.micro_lessons[currentMicroIndex] || null;
}

export async function loadLesson(lesson) {
  console.log('Loading lesson:', lesson.id);
  
  currentLesson = lesson;
  currentMicroIndex = 0;
  
  try {
    const progress = await getLessonProgress(lesson.id);
    if (progress && progress.current_micro > 0) {
      currentMicroIndex = Math.min(progress.current_micro, lesson.micro_lessons.length - 1);
    }
  } catch (error) {
    console.warn('Could not load lesson progress:', error);
  }
  
  renderLessonHeader(lesson);
  renderMicroLessonTabs(lesson);
  await loadMicroLesson(currentMicroIndex);
  
  window.dispatchEvent(new CustomEvent('lesson:loaded', { detail: lesson }));
}

function renderLessonHeader(lesson) {
  const headerEl = document.getElementById('lesson-header');
  if (!headerEl) return;
  
  headerEl.innerHTML = `
    <h1 class="text-2xl font-bold text-white mb-2">${lesson.title}</h1>
    <div class="text-sm text-gray-400">
      ${lesson.micro_lessons.length} sections
    </div>
  `;
}

function renderMicroLessonTabs(lesson) {
  const tabsEl = document.getElementById('micro-lesson-tabs');
  if (!tabsEl) return;
  
  tabsEl.innerHTML = '';
  
  lesson.micro_lessons.forEach((micro, index) => {
    const tab = document.createElement('button');
    tab.className = `micro-tab px-3 py-2 text-sm rounded-t-lg transition-colors ${
      index === currentMicroIndex 
        ? 'bg-gray-700 text-white' 
        : 'bg-gray-800 text-gray-400 hover:text-gray-200'
    }`;
    tab.textContent = micro.title.length > 25 
      ? micro.title.substring(0, 22) + '...' 
      : micro.title;
    tab.title = micro.title;
    tab.dataset.index = index;
    
    tab.addEventListener('click', () => loadMicroLesson(index));
    tabsEl.appendChild(tab);
  });
}

export async function loadMicroLesson(index) {
  if (!currentLesson || !currentLesson.micro_lessons) return;
  
  const micro = currentLesson.micro_lessons[index];
  if (!micro) return;
  
  currentMicroIndex = index;
  
  updateTabsActive(index);
  
  const contentEl = document.getElementById('lesson-content');
  if (!contentEl) return;
  
  contentEl.innerHTML = '<div class="text-gray-400">Loading...</div>';
  
  try {
    const html = await invoke('read_resource', { path: micro.content_file });
    contentEl.innerHTML = `
      <div class="prose prose-invert max-w-none lesson-html">
        ${html}
      </div>
    `;
    
    await markLessonViewed(currentLesson.id, index);
    
    window.dispatchEvent(new CustomEvent('microlesson:loaded', { 
      detail: { lesson: currentLesson, micro, index } 
    }));
    
  } catch (error) {
    console.error('Failed to load micro-lesson:', error);
    contentEl.innerHTML = `
      <div class="text-red-400">
        Failed to load content: ${error}
      </div>
    `;
  }
}

function updateTabsActive(activeIndex) {
  const tabs = document.querySelectorAll('.micro-tab');
  tabs.forEach((tab, index) => {
    if (index === activeIndex) {
      tab.classList.remove('bg-gray-800', 'text-gray-400');
      tab.classList.add('bg-gray-700', 'text-white');
    } else {
      tab.classList.remove('bg-gray-700', 'text-white');
      tab.classList.add('bg-gray-800', 'text-gray-400');
    }
  });
}

export function nextMicroLesson() {
  if (!currentLesson) return false;
  
  if (currentMicroIndex < currentLesson.micro_lessons.length - 1) {
    loadMicroLesson(currentMicroIndex + 1);
    return true;
  }
  return false;
}

export function prevMicroLesson() {
  if (!currentLesson) return false;
  
  if (currentMicroIndex > 0) {
    loadMicroLesson(currentMicroIndex - 1);
    return true;
  }
  return false;
}

export function hasNextMicroLesson() {
  if (!currentLesson) return false;
  return currentMicroIndex < currentLesson.micro_lessons.length - 1;
}

export function hasPrevMicroLesson() {
  if (!currentLesson) return false;
  return currentMicroIndex > 0;
}

export function findLessonById(lessonId) {
  if (!lessonsData || !lessonsData.modules) return null;
  
  for (const module of lessonsData.modules) {
    for (const lesson of module.lessons || []) {
      if (lesson.id === lessonId) {
        return lesson;
      }
    }
  }
  return null;
}

export function getExercisesForCurrentMicro() {
  const micro = getCurrentMicroLesson();
  if (!micro) return [];
  return micro.exercises || [];
}
