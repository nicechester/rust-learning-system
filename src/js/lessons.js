import { markLessonViewed, getLessonProgress, markLessonCompleted } from './progress.js';
import { marked } from 'marked';

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

marked.setOptions({
  gfm: true,
  breaks: false,
});

function preprocessMarkdown(md) {
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  
  md = md.replace(/<Listing[^>]*number="([^"]*)"[^>]*caption="([^"]*)"[^>]*>/g, 
    '\n**Listing $1:** _$2_\n');
  md = md.replace(/<Listing[^>]*>/g, '');
  md = md.replace(/<\/Listing>/g, '');
  
  md = md.replace(/<span class="filename">Filename:\s*([^<]+)<\/span>/g, '**📄 $1**');
  
  return md;
}

async function resolveIncludes(content) {
  const includeRegex = /{{#(?:rustdoc_)?include\s+([^}]+)}}/g;
  const matches = [...content.matchAll(includeRegex)];
  
  console.log('Found', matches.length, 'includes to resolve');
  
  for (const match of matches) {
    const fullMatch = match[0];
    let includePath = match[1].trim();
    
    includePath = includePath.replace(/^\.\.\//, '');
    
    let lineSpec = null;
    const lineSpecMatch = includePath.match(/^(.+?):(\d*):?(\d*)$/);
    if (lineSpecMatch) {
      includePath = lineSpecMatch[1];
      const startLine = lineSpecMatch[2];
      const endLine = lineSpecMatch[3];
      if (startLine || endLine) {
        lineSpec = `${startLine}:${endLine}`;
      }
    } else {
      const anchorMatch = includePath.match(/^(.+):(\w+)$/);
      if (anchorMatch && !anchorMatch[2].match(/^\d+$/)) {
        includePath = anchorMatch[1];
        lineSpec = anchorMatch[2];
      }
    }
    
    console.log('Resolving:', includePath, 'lineSpec:', lineSpec);
    
    try {
      let code = await invoke('read_resource', { path: includePath });
      console.log('Loaded code, length:', code.length);
      
      if (lineSpec) {
        code = extractLines(code, lineSpec);
        console.log('Extracted lines, length:', code.length);
      }
      
      code = stripAnchors(code);
      
      content = content.replace(fullMatch, code);
    } catch (e) {
      console.error('Could not resolve include:', includePath, e);
      content = content.replace(fullMatch, `// Error loading: ${includePath}`);
    }
  }
  
  return content;
}

function extractLines(code, lineSpec) {
  const lines = code.split('\n');
  
  if (lineSpec.includes(':')) {
    const [start, end] = lineSpec.split(':');
    const startLine = start ? parseInt(start) - 1 : 0;
    const endLine = end ? parseInt(end) : lines.length;
    return lines.slice(startLine, endLine).join('\n');
  }
  
  const anchorMatch = lineSpec.match(/^([a-zA-Z_]\w*)$/);
  if (anchorMatch) {
    const anchor = anchorMatch[1];
    const startPattern = new RegExp(`^\\s*//\\s*ANCHOR:\\s*${anchor}\\s*$`);
    const endPattern = new RegExp(`^\\s*//\\s*ANCHOR_END:\\s*${anchor}\\s*$`);
    
    let inAnchor = false;
    let foundStart = false;
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (startPattern.test(line)) {
        if (foundStart) {
          break;
        }
        inAnchor = true;
        foundStart = true;
        continue;
      }
      if (endPattern.test(line)) {
        break;
      }
      if (inAnchor) {
        result.push(line);
      }
    }
    
    if (result.length > 0) {
      return result.join('\n');
    }
  }
  
  return code;
}

function stripAnchors(code) {
  return code
    .split('\n')
    .filter(line => !line.trim().startsWith('// ANCHOR'))
    .join('\n');
}

function getMdPath(micro) {
  if (micro.lesson_id) {
    return `book/${micro.lesson_id}.md`;
  }
  
  const htmlPath = micro.content_file;
  const match = htmlPath.match(/html\/(ch\d+-\d+-[^-]+(?:-[^-]+)*)-\d+\.html$/);
  if (match) {
    const chapterName = match[1];
    return `book/${chapterName}.md`;
  }
  return htmlPath.replace(/\.html$/, '.md').replace('html/', 'book/');
}

function cleanupHtml(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  html = html.replace(/&lt;Listing[^&]*&gt;/g, '<div class="listing">');
  html = html.replace(/&lt;\/Listing&gt;/g, '</div>');
  html = html.replace(/<Listing[^>]*number="([^"]*)"[^>]*caption="([^"]*)"[^>]*>/g, 
    '<div class="listing"><div class="listing-header"><strong>Listing $1:</strong> <em>$2</em></div>');
  html = html.replace(/<Listing[^>]*>/g, '<div class="listing">');
  html = html.replace(/<\/Listing>/g, '</div>');
  
  html = html.replace(/<span class="filename">Filename:\s*([^<]+)<\/span>/g, 
    '<div class="filename">📄 $1</div>');
  
  html = html.replace(/^\s*\/\/\s*ANCHOR.*$/gm, '');
  
  html = html.replace(/<p>```(\w+)?(?:,\w+)*<\/p>/g, '<pre><code class="language-$1">');
  html = html.replace(/<p>```<\/p>/g, '</code></pre>');
  html = html.replace(/<pre><code>\s*```<\/code><\/pre>/g, '</code></pre>');
  
  html = html.replace(/```(\w+)?(?:,\w+)*\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'rust';
    let cleanCode = stripAnchors(code.trim());
    cleanCode = cleanCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code class="language-${language}">${cleanCode}</code></pre>`;
  });
  
  html = html.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
    let cleanCode = stripAnchors(code);
    return `<pre><code class="language-rust">${cleanCode}</code></pre>`;
  });
  
  return html;
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
    let content;
    let html;
    
    const mdPath = getMdPath(micro);
    
    try {
      content = await invoke('read_resource', { path: mdPath });

      if (micro.start_line !== undefined && micro.end_line !== undefined) {
        const lines = content.split('\n');
        // Extract reference link definitions from the full file before slicing,
        // otherwise marked can't resolve reference-style links like [Chapter 6][enums]
        const refDefs = lines
          .filter(line => /^\[[\w-]+\]:\s+\S/.test(line))
          .join('\n');
        content = lines.slice(micro.start_line, micro.end_line + 1).join('\n');
        if (refDefs) content += '\n\n' + refDefs;
      }
      
      content = await resolveIncludes(content);
      content = preprocessMarkdown(content);
      content = stripAnchors(content);
      html = marked.parse(content);
    } catch (e) {
      console.warn('Markdown load failed, falling back to HTML:', e);
      content = await invoke('read_resource', { path: micro.content_file });
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        content = bodyMatch[1];
      }
      content = await resolveIncludes(content);
      html = cleanupHtml(content);
    }
    
    contentEl.innerHTML = `
      <div class="prose prose-invert max-w-none lesson-html">
        ${html}
      </div>
    `;

    wireInternalLinks(contentEl);

    await markLessonViewed(currentLesson.id, index);
    
    const isLastMicro = index === currentLesson.micro_lessons.length - 1;
    if (isLastMicro) {
      await markLessonCompleted(currentLesson.id);
      window.dispatchEvent(new CustomEvent('lesson:completed', { 
        detail: { lesson: currentLesson } 
      }));
    }
    
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

function wireInternalLinks(container) {
  container.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');

    // Internal: Rust Book chapter hrefs like "ch04-01-what-is-ownership.html"
    const internalMatch = href.match(/^(ch\d+-\d+[^#.]*)(?:\.html)?(#.*)?$/);
    if (internalMatch) {
      const lessonId = internalMatch[1];
      link.classList.add('internal-link');
      link.removeAttribute('target');
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const lesson = findLessonById(lessonId);
        if (lesson) {
          loadLesson(lesson);
          highlightLessonInSidebar(lesson.id);
        } else {
          console.warn('Internal link target not found:', lessonId);
        }
      });
      return;
    }

    // External: open in the system browser
    if (href.startsWith('http://') || href.startsWith('https://')) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.__TAURI__.opener.openUrl(href);
      });
    }
  });
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

export async function nextMicroLesson() {
  if (!currentLesson) return false;
  
  if (currentMicroIndex < currentLesson.micro_lessons.length - 1) {
    await loadMicroLesson(currentMicroIndex + 1);
    return true;
  }
  
  const nextLesson = getNextLesson();
  if (nextLesson) {
    await loadLesson(nextLesson);
    highlightLessonInSidebar(nextLesson.id);
    return true;
  }
  
  return false;
}

export async function prevMicroLesson() {
  if (!currentLesson) return false;
  
  if (currentMicroIndex > 0) {
    await loadMicroLesson(currentMicroIndex - 1);
    return true;
  }
  
  const prevLesson = getPreviousLesson();
  if (prevLesson) {
    await loadLesson(prevLesson);
    if (prevLesson.micro_lessons && prevLesson.micro_lessons.length > 0) {
      await loadMicroLesson(prevLesson.micro_lessons.length - 1);
    }
    highlightLessonInSidebar(prevLesson.id);
    return true;
  }
  
  return false;
}

export function hasNextMicroLesson() {
  if (!currentLesson) return false;
  if (currentMicroIndex < currentLesson.micro_lessons.length - 1) return true;
  return getNextLesson() !== null;
}

export function hasPrevMicroLesson() {
  if (!currentLesson) return false;
  if (currentMicroIndex > 0) return true;
  return getPreviousLesson() !== null;
}

export function isLastMicroOfLesson() {
  if (!currentLesson) return false;
  return currentMicroIndex === currentLesson.micro_lessons.length - 1;
}

export function isFirstMicroOfLesson() {
  if (!currentLesson) return false;
  return currentMicroIndex === 0;
}

function getAllLessonsFlat() {
  if (!lessonsData || !lessonsData.modules) return [];
  
  const allLessons = [];
  for (const module of lessonsData.modules) {
    if (module.lessons && module.lessons.length > 0) {
      allLessons.push(...module.lessons);
    } else if (module.intro_lessons && module.intro_lessons.length > 0) {
      allLessons.push({
        id: module.id,
        title: module.title,
        micro_lessons: module.intro_lessons
      });
    }
  }
  return allLessons;
}

function getNextLesson() {
  if (!currentLesson) return null;
  
  const allLessons = getAllLessonsFlat();
  const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
  
  if (currentIndex >= 0 && currentIndex < allLessons.length - 1) {
    return allLessons[currentIndex + 1];
  }
  return null;
}

function getPreviousLesson() {
  if (!currentLesson) return null;
  
  const allLessons = getAllLessonsFlat();
  const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
  
  if (currentIndex > 0) {
    return allLessons[currentIndex - 1];
  }
  return null;
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

export function getFirstLesson() {
  const allLessons = getAllLessonsFlat();
  return allLessons.length > 0 ? allLessons[0] : null;
}

export function findLessonById(lessonId) {
  if (!lessonsData || !lessonsData.modules) return null;
  
  for (const module of lessonsData.modules) {
    for (const lesson of module.lessons || []) {
      if (lesson.id === lessonId) {
        return lesson;
      }
    }
    
    if (module.id === lessonId && module.intro_lessons && module.intro_lessons.length > 0) {
      return {
        id: module.id,
        title: module.title,
        micro_lessons: module.intro_lessons
      };
    }
  }
  return null;
}

export function getExercisesForCurrentMicro() {
  const micro = getCurrentMicroLesson();
  if (!micro) return [];
  return micro.exercises || [];
}
