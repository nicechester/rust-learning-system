import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

self.MonacoEnvironment = {
  getWorker: () => new editorWorker()
};

let editor = null;
let currentFile = null;

const DEFAULT_CODE = `fn main() {
    println!("Hello, Rust!");
    
    // Try modifying this code and click Run!
    let x = 5;
    let y = 10;
    println!("x + y = {}", x + y);
}`;

export function initEditor(containerId = 'monaco-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Editor container '${containerId}' not found`);
    return null;
  }

  editor = monaco.editor.create(container, {
    value: DEFAULT_CODE,
    language: 'rust',
    theme: 'vs-dark',
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    minimap: { enabled: false },
    automaticLayout: true,
    tabSize: 4,
    insertSpaces: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    padding: { top: 10, bottom: 10 },
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    suggest: {
      showKeywords: true,
      showSnippets: true,
    },
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    window.dispatchEvent(new CustomEvent('editor:run'));
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
    window.dispatchEvent(new CustomEvent('editor:test'));
  });

  return editor;
}

export function getEditor() {
  return editor;
}

export function getValue() {
  return editor?.getValue() || '';
}

export function setValue(code) {
  if (editor) {
    editor.setValue(code);
  }
}

export function setLanguage(language) {
  if (editor) {
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }
  }
}

export function setReadOnly(readOnly) {
  if (editor) {
    editor.updateOptions({ readOnly });
  }
}

export function focus() {
  if (editor) {
    editor.focus();
  }
}

export function setCurrentFile(filename) {
  currentFile = filename;
}

export function getCurrentFile() {
  return currentFile;
}

export function addMarker(startLine, startCol, endLine, endCol, message, severity = 'error') {
  if (!editor) return;
  
  const model = editor.getModel();
  if (!model) return;

  const severityMap = {
    error: monaco.MarkerSeverity.Error,
    warning: monaco.MarkerSeverity.Warning,
    info: monaco.MarkerSeverity.Info,
    hint: monaco.MarkerSeverity.Hint,
  };

  monaco.editor.setModelMarkers(model, 'rust-learn', [
    {
      startLineNumber: startLine,
      startColumn: startCol,
      endLineNumber: endLine,
      endColumn: endCol,
      message,
      severity: severityMap[severity] || monaco.MarkerSeverity.Error,
    },
  ]);
}

export function clearMarkers() {
  if (!editor) return;
  const model = editor.getModel();
  if (model) {
    monaco.editor.setModelMarkers(model, 'rust-learn', []);
  }
}

export function dispose() {
  if (editor) {
    editor.dispose();
    editor = null;
  }
}
