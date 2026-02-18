import { loadLesson, setLessonsData } from './lessons.js';
import { getAllLessonProgress } from './progress.js';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

let lessonsData = null;
let progressMap = {};

function getStatusIcon(status) {
  if (status === 'completed') {
    return `
      <span class="status-icon completed">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
        </svg>
      </span>
    `;
  } else if (status === 'in_progress' || status === 'in-progress') {
    return `
      <span class="status-icon in-progress">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4"/>
        </svg>
      </span>
    `;
  } else {
    return `
      <span class="status-icon not-started">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" stroke-width="2"/>
        </svg>
      </span>
    `;
  }
}

export async function initSidebar() {
  const treeEl = document.getElementById('lesson-tree');
  
  try {
    const lessonsJson = await invoke('read_lessons_json');
    lessonsData = JSON.parse(lessonsJson);
    setLessonsData(lessonsData);
    
    await loadProgressMap();
    
    renderLessonTree(lessonsData);
  } catch (error) {
    console.warn('Could not load lessons:', error);
    treeEl.innerHTML = `
      <div class="text-gray-500 text-sm p-2">
        <p class="mb-2">No lessons loaded.</p>
        <p class="text-xs">Content will be available after bundling.</p>
      </div>
    `;
  }
}

async function loadProgressMap() {
  try {
    const progress = await getAllLessonProgress();
    progressMap = {};
    for (const p of progress) {
      progressMap[p.lesson_id] = p.status;
    }
  } catch (error) {
    console.warn('Could not load progress:', error);
    progressMap = {};
  }
}

function getChapterLabel(moduleId) {
  const match = moduleId.match(/^ch(\d+)-/);
  if (match) return `${parseInt(match[1], 10)}.`;
  const appendixMatch = moduleId.match(/^appendix-(\w+)/);
  if (appendixMatch) return `App.`;
  return null;
}

function renderLessonTree(data) {
  const treeEl = document.getElementById('lesson-tree');
  treeEl.innerHTML = '';

  if (!data.modules || data.modules.length === 0) {
    treeEl.innerHTML = '<div class="text-gray-500 text-sm">No lessons available</div>';
    return;
  }

  data.modules.forEach((module, moduleIndex) => {
    const moduleEl = document.createElement('div');
    moduleEl.className = 'module mb-2';

    const headerEl = document.createElement('div');
    headerEl.className = 'module-header';
    const chapterLabel = getChapterLabel(module.id);
    headerEl.innerHTML = `
      <svg class="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
      </svg>
      ${chapterLabel ? `<span class="chapter-badge">${chapterLabel}</span>` : ''}
      <span class="text-sm">${module.title}</span>
    `;
    
    const lessonsEl = document.createElement('div');
    lessonsEl.className = 'module-lessons hidden';
    
    let lessonsToRender = module.lessons || [];
    
    if (lessonsToRender.length === 0 && module.intro_lessons && module.intro_lessons.length > 0) {
      const syntheticLesson = {
        id: module.id,
        title: module.title,
        micro_lessons: module.intro_lessons
      };
      lessonsToRender = [syntheticLesson];
    }
    
    if (lessonsToRender.length > 0) {
      lessonsToRender.forEach((lesson) => {
        const lessonEl = document.createElement('div');
        lessonEl.className = 'lesson-item text-sm text-gray-300';
        
        const status = progressMap[lesson.id] || 'not-started';
        lessonEl.innerHTML = `
          ${getStatusIcon(status)}
          <span class="lesson-title">${lesson.title}</span>
        `;
        lessonEl.dataset.lessonId = lesson.id;
        
        lessonEl.addEventListener('click', () => {
          selectLesson(lesson);
        });
        
        lessonsEl.appendChild(lessonEl);
      });
    }
    
    headerEl.addEventListener('click', () => {
      headerEl.classList.toggle('expanded');
      lessonsEl.classList.toggle('hidden');
    });
    
    if (moduleIndex === 0) {
      headerEl.classList.add('expanded');
      lessonsEl.classList.remove('hidden');
    }
    
    moduleEl.appendChild(headerEl);
    moduleEl.appendChild(lessonsEl);
    treeEl.appendChild(moduleEl);
  });
  
  if (data.stats) {
    const statsEl = document.createElement('div');
    statsEl.className = 'mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500 px-2';
    statsEl.innerHTML = `
      <div>${data.stats.total_modules} modules</div>
      <div>${data.stats.total_lessons} lessons</div>
      <div>${data.stats.total_micro_lessons} micro-lessons</div>
      <div>~${data.stats.estimated_hours} hours</div>
    `;
    treeEl.appendChild(statsEl);
  }
}

async function selectLesson(lesson) {
  console.log('Selecting lesson:', lesson.id, lesson);
  
  document.querySelectorAll('.lesson-item').forEach(el => {
    el.classList.remove('active');
  });
  
  const lessonEl = document.querySelector(`[data-lesson-id="${lesson.id}"]`);
  if (lessonEl) {
    lessonEl.classList.add('active');
  }
  
  try {
    await loadLesson(lesson);
  } catch (error) {
    console.error('Failed to load lesson:', error);
    const contentEl = document.getElementById('lesson-content');
    if (contentEl) {
      contentEl.innerHTML = `<div class="text-red-400">Failed to load lesson: ${error}</div>`;
    }
  }
}

export function updateLessonStatus(lessonId, status) {
  progressMap[lessonId] = status;
  
  const lessonEl = document.querySelector(`[data-lesson-id="${lessonId}"]`);
  if (lessonEl) {
    const oldIcon = lessonEl.querySelector('.status-icon');
    if (oldIcon) {
      const newIcon = document.createElement('span');
      newIcon.innerHTML = getStatusIcon(status);
      oldIcon.replaceWith(newIcon.firstElementChild);
    }
  }
}

export async function refreshSidebar() {
  await loadProgressMap();
  if (lessonsData) {
    renderLessonTree(lessonsData);
  }
}

export function getLessonsData() {
  return lessonsData;
}
