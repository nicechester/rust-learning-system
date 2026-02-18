import Database from '@tauri-apps/plugin-sql';

let db = null;

export async function initProgress() {
  try {
    db = await Database.load('sqlite:rust-learn-progress.db');
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        lesson_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'not_started',
        current_micro INTEGER DEFAULT 0,
        last_viewed TEXT,
        completed_at TEXT
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS exercise_progress (
        exercise_id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'not_started',
        attempts INTEGER DEFAULT 0,
        last_code TEXT,
        completed_at TEXT
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    console.log('Progress database initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize progress database:', error);
    return false;
  }
}

export async function markLessonViewed(lessonId, microIndex = 0) {
  if (!db) return;
  
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO lesson_progress (lesson_id, status, current_micro, last_viewed)
     VALUES (?, 'in_progress', ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       current_micro = MAX(current_micro, ?),
       last_viewed = ?`,
    [lessonId, microIndex, now, microIndex, now]
  );
}

export async function markLessonCompleted(lessonId) {
  if (!db) return;
  
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO lesson_progress (lesson_id, status, completed_at, last_viewed)
     VALUES (?, 'completed', ?, ?)
     ON CONFLICT(lesson_id) DO UPDATE SET
       status = 'completed',
       completed_at = ?,
       last_viewed = ?`,
    [lessonId, now, now, now, now]
  );
}

export async function getLessonProgress(lessonId) {
  if (!db) return null;
  
  const result = await db.select(
    'SELECT * FROM lesson_progress WHERE lesson_id = ?',
    [lessonId]
  );
  return result.length > 0 ? result[0] : null;
}

export async function getAllLessonProgress() {
  if (!db) return [];
  
  return await db.select('SELECT * FROM lesson_progress');
}

export async function markExerciseAttempt(exerciseId, code) {
  if (!db) return;
  
  await db.execute(
    `INSERT INTO exercise_progress (exercise_id, status, attempts, last_code)
     VALUES (?, 'in_progress', 1, ?)
     ON CONFLICT(exercise_id) DO UPDATE SET
       attempts = attempts + 1,
       last_code = ?`,
    [exerciseId, code, code]
  );
}

export async function markExerciseCompleted(exerciseId, code) {
  if (!db) return;
  
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO exercise_progress (exercise_id, status, last_code, completed_at)
     VALUES (?, 'completed', ?, ?)
     ON CONFLICT(exercise_id) DO UPDATE SET
       status = 'completed',
       last_code = ?,
       completed_at = ?`,
    [exerciseId, code, now, code, now]
  );
}

export async function getExerciseProgress(exerciseId) {
  if (!db) return null;
  
  const result = await db.select(
    'SELECT * FROM exercise_progress WHERE exercise_id = ?',
    [exerciseId]
  );
  return result.length > 0 ? result[0] : null;
}

export async function getAllExerciseProgress() {
  if (!db) return [];
  
  return await db.select('SELECT * FROM exercise_progress');
}

export async function getOverallProgress() {
  if (!db) return { lessons: 0, exercises: 0 };
  
  const lessonResult = await db.select(
    "SELECT COUNT(*) as count FROM lesson_progress WHERE status = 'completed'"
  );
  const exerciseResult = await db.select(
    "SELECT COUNT(*) as count FROM exercise_progress WHERE status = 'completed'"
  );
  
  return {
    lessons: lessonResult[0]?.count || 0,
    exercises: exerciseResult[0]?.count || 0,
  };
}

export async function getSetting(key, defaultValue = null) {
  if (!db) return defaultValue;
  
  const result = await db.select(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  
  if (result.length > 0) {
    try {
      return JSON.parse(result[0].value);
    } catch {
      return result[0].value;
    }
  }
  return defaultValue;
}

export async function setSetting(key, value) {
  if (!db) return;
  
  const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
  await db.execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = ?`,
    [key, jsonValue, jsonValue]
  );
}

export async function getLastViewedLesson() {
  if (!db) return null;
  
  const result = await db.select(
    'SELECT lesson_id FROM lesson_progress ORDER BY last_viewed DESC LIMIT 1'
  );
  return result.length > 0 ? result[0].lesson_id : null;
}
