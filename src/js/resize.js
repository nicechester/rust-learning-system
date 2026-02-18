let activeResizer = null;
let startPos = 0;
let startSize = 0;

const STORAGE_KEY = 'rust-learn-panel-sizes';

function loadSavedSizes() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveSizes(sizes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {}
}

function getSavedSize(panelId) {
  const sizes = loadSavedSizes();
  return sizes[panelId];
}

function setSavedSize(panelId, size) {
  const sizes = loadSavedSizes();
  sizes[panelId] = size;
  saveSizes(sizes);
}

export function initResize() {
  const dividers = document.querySelectorAll('.divider');
  
  dividers.forEach(divider => {
    divider.addEventListener('mousedown', startResize);
  });
  
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
  
  initCollapse();
  
  restoreSavedSizes();
}

function startResize(e) {
  activeResizer = e.target;
  const isVertical = activeResizer.classList.contains('divider-vertical');
  
  startPos = isVertical ? e.clientX : e.clientY;
  
  const targetId = activeResizer.dataset.target;
  const target = document.getElementById(targetId);
  
  if (target) {
    startSize = isVertical ? target.offsetWidth : target.offsetHeight;
  }
  
  document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';
  activeResizer.classList.add('active');
  
  e.preventDefault();
}

function doResize(e) {
  if (!activeResizer) return;
  
  const isVertical = activeResizer.classList.contains('divider-vertical');
  const currentPos = isVertical ? e.clientX : e.clientY;
  const delta = currentPos - startPos;
  
  const targetId = activeResizer.dataset.target;
  const target = document.getElementById(targetId);
  
  if (!target) return;
  
  const min = parseInt(activeResizer.dataset.min) || 100;
  const mode = activeResizer.dataset.mode;
  
  let max;
  if (mode === 'percent') {
    const parent = target.parentElement;
    const maxPercent = parseInt(activeResizer.dataset.maxPercent) || 80;
    max = isVertical ? parent.offsetWidth * (maxPercent / 100) : parent.offsetHeight * (maxPercent / 100);
  } else {
    max = parseInt(activeResizer.dataset.max) || 800;
  }
  
  let isInverted = false;
  if (targetId === 'console-panel') {
    isInverted = true;
  }
  
  let newSize;
  if (isInverted) {
    newSize = startSize - delta;
  } else {
    newSize = startSize + delta;
  }
  
  newSize = Math.max(min, Math.min(max, newSize));
  
  if (isVertical) {
    if (mode === 'percent') {
      const parent = target.parentElement;
      const percent = (newSize / parent.offsetWidth) * 100;
      target.style.width = `${percent}%`;
    } else {
      target.style.width = `${newSize}px`;
    }
  } else {
    target.style.height = `${newSize}px`;
  }
  
  window.dispatchEvent(new Event('resize'));
}

function stopResize() {
  if (activeResizer) {
    const targetId = activeResizer.dataset.target;
    const target = document.getElementById(targetId);
    
    if (target) {
      const isVertical = activeResizer.classList.contains('divider-vertical');
      const size = isVertical ? target.offsetWidth : target.offsetHeight;
      setSavedSize(targetId, size);
    }
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    activeResizer.classList.remove('active');
    activeResizer = null;
  }
}

function initCollapse() {
  const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
  const btnExpandSidebar = document.getElementById('btn-expand-sidebar');
  const btnCollapseConsole = document.getElementById('btn-collapse-console');
  const btnCollapseEditor = document.getElementById('btn-collapse-editor');
  const btnExpandEditor = document.getElementById('btn-expand-editor');
  
  if (btnCollapseSidebar) {
    btnCollapseSidebar.addEventListener('click', () => toggleSidebar(false));
  }
  
  if (btnExpandSidebar) {
    btnExpandSidebar.addEventListener('click', () => toggleSidebar(true));
  }
  
  if (btnCollapseConsole) {
    btnCollapseConsole.addEventListener('click', toggleConsole);
  }
  
  if (btnCollapseEditor) {
    btnCollapseEditor.addEventListener('click', toggleEditor);
  }
  
  if (btnExpandEditor) {
    btnExpandEditor.addEventListener('click', toggleEditor);
  }
  
  const savedCollapsed = loadSavedSizes();
  if (savedCollapsed.sidebarCollapsed) {
    toggleSidebar(false, true);
  }
  if (savedCollapsed.consoleCollapsed) {
    toggleConsole(null, true);
  }
  if (savedCollapsed.savedLessonPanelWidth) {
    savedLessonPanelWidth = savedCollapsed.savedLessonPanelWidth;
  }
  if (savedCollapsed.editorCollapsed) {
    toggleEditor(null, true);
  }
}

function toggleSidebar(expand, skipSave = false) {
  const sidebar = document.getElementById('sidebar');
  const divider = document.getElementById('divider-sidebar');
  const expandBtn = document.getElementById('btn-expand-sidebar');
  const contentWrapper = document.getElementById('content-wrapper');
  
  if (!sidebar || !divider || !expandBtn) return;
  
  if (expand) {
    const savedSize = getSavedSize('sidebar') || 288;
    sidebar.style.width = `${savedSize}px`;
    sidebar.classList.remove('collapsed');
    divider.classList.remove('hidden');
    expandBtn.classList.add('hidden');
    if (contentWrapper) contentWrapper.classList.remove('sidebar-collapsed');
  } else {
    sidebar.classList.add('collapsed');
    sidebar.style.width = '0px';
    divider.classList.add('hidden');
    expandBtn.classList.remove('hidden');
    if (contentWrapper) contentWrapper.classList.add('sidebar-collapsed');
  }
  
  if (!skipSave) {
    const sizes = loadSavedSizes();
    sizes.sidebarCollapsed = !expand;
    saveSizes(sizes);
  }
  
  window.dispatchEvent(new Event('resize'));
}

let consoleCollapsed = false;
let savedConsoleHeight = 192;

function toggleConsole(e, skipSave = false) {
  const console = document.getElementById('console-panel');
  const divider = document.getElementById('divider-console');
  const icon = document.querySelector('#btn-collapse-console .collapse-icon');
  
  if (!console || !divider) return;
  
  if (consoleCollapsed) {
    console.style.height = `${savedConsoleHeight}px`;
    console.classList.remove('collapsed');
    divider.classList.remove('hidden');
    if (icon) icon.style.transform = '';
    consoleCollapsed = false;
  } else {
    savedConsoleHeight = console.offsetHeight;
    console.classList.add('collapsed');
    console.style.height = '36px';
    divider.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
    consoleCollapsed = true;
  }
  
  if (!skipSave) {
    const sizes = loadSavedSizes();
    sizes.consoleCollapsed = consoleCollapsed;
    saveSizes(sizes);
  }
  
  window.dispatchEvent(new Event('resize'));
}

function restoreSavedSizes() {
  const sizes = loadSavedSizes();
  
  if (sizes.sidebar && !sizes.sidebarCollapsed) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.width = `${sizes.sidebar}px`;
  }
  
  if (sizes['lesson-panel'] && !sizes.editorCollapsed) {
    const lessonPanel = document.getElementById('lesson-panel');
    if (lessonPanel) {
      const parent = lessonPanel.parentElement;
      const percent = (sizes['lesson-panel'] / parent.offsetWidth) * 100;
      lessonPanel.style.width = `${Math.min(80, percent)}%`;
    }
  }
  
  if (sizes['console-panel'] && !sizes.consoleCollapsed) {
    const consolePanel = document.getElementById('console-panel');
    if (consolePanel) consolePanel.style.height = `${sizes['console-panel']}px`;
  }
}

export function isSidebarCollapsed() {
  return document.getElementById('sidebar')?.classList.contains('collapsed') || false;
}

export function isConsoleCollapsed() {
  return consoleCollapsed;
}

export function expandConsole() {
  if (consoleCollapsed) {
    const console = document.getElementById('console-panel');
    const divider = document.getElementById('divider-console');
    const icon = document.querySelector('#btn-collapse-console .collapse-icon');
    
    if (!console || !divider) return;
    
    console.style.height = `${savedConsoleHeight}px`;
    console.classList.remove('collapsed');
    divider.classList.remove('hidden');
    if (icon) icon.style.transform = '';
    consoleCollapsed = false;
    
    const sizes = loadSavedSizes();
    sizes.consoleCollapsed = false;
    saveSizes(sizes);
    
    window.dispatchEvent(new Event('resize'));
  }
}

let editorCollapsed = false;
let savedLessonPanelWidth = null;

function toggleEditor(e, skipSave = false) {
  const editor = document.getElementById('editor-panel');
  const lessonPanel = document.getElementById('lesson-panel');
  const divider = document.getElementById('divider-editor');
  const expandBtn = document.getElementById('btn-expand-editor');
  
  if (!editor || !divider || !expandBtn || !lessonPanel) return;
  
  if (editorCollapsed) {
    if (savedLessonPanelWidth) {
      lessonPanel.style.width = savedLessonPanelWidth;
    } else {
      lessonPanel.style.width = '50%';
    }
    editor.style.flex = '1';
    editor.classList.remove('collapsed');
    lessonPanel.classList.remove('editor-collapsed');
    divider.classList.remove('hidden');
    expandBtn.classList.add('hidden');
    editorCollapsed = false;
  } else {
    if (!savedLessonPanelWidth) {
      savedLessonPanelWidth = lessonPanel.style.width || '50%';
    }
    lessonPanel.style.width = '100%';
    editor.classList.add('collapsed');
    lessonPanel.classList.add('editor-collapsed');
    divider.classList.add('hidden');
    expandBtn.classList.remove('hidden');
    editorCollapsed = true;
  }
  
  if (!skipSave) {
    const sizes = loadSavedSizes();
    sizes.editorCollapsed = editorCollapsed;
    sizes.savedLessonPanelWidth = savedLessonPanelWidth;
    saveSizes(sizes);
  }
  
  window.dispatchEvent(new Event('resize'));
}

export function isEditorCollapsed() {
  return editorCollapsed;
}

export function expandEditor() {
  if (editorCollapsed) {
    toggleEditor(null, false);
  }
}
