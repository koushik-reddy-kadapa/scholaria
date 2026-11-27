import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { db, initDatabase } from './server/db.ts';
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from './server/auth.ts';
import type { AuthedRequest, AuthUser } from './server/auth.ts';
import { gradeAndFinalizeAttempt } from './server/grading.ts';

initDatabase();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateStudentCode(userId: number): string {
  return `STU-2026-${String(userId).padStart(3, '0')}`;
}

function getConfiguredAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Auth bootstrap status (does not expose secrets)
app.get('/api/auth/bootstrap-status', (_req: Request, res: Response) => {
  const adminRow = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get() as {
    count: number;
  };
  res.json({
    adminClaimed: adminRow.count > 0,
    passcodeConfigured: getConfiguredAdminPasscode().length > 0,
  });
});

// One-time Admin Account Claim / Setup
app.post('/api/auth/setup-admin', (req: Request, res: Response) => {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (existingAdmin) {
    res.status(409).json({ error: 'An administrator account has already been configured.' });
    return;
  }

  const { name, email, password, department } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
  };

  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = password || '';
  const cleanDept = (department || 'Academic Administration').trim();

  if (cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Please enter a valid full name (2-80 characters).' });
    return;
  }
  if (!isValidEmail(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (cleanPass.length < 6 || cleanPass.length > 128) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const emailTaken = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (emailTaken) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = hashPassword(cleanPass);
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, student_id_code, department, semester, status, created_at)
       VALUES (?, ?, ?, 'admin', NULL, ?, 'Faculty / Admin', 'active', ?)`
    )
    .run(cleanName, cleanEmail, passwordHash, cleanDept, now);

  const userId = Number(result.lastInsertRowid);
  const user = db
    .prepare(
      'SELECT id, name, email, role, student_id_code, department, semester, status FROM users WHERE id = ?'
    )
    .get(userId) as unknown as AuthUser;

  const token = createSessionToken(user.id, 'admin');
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user });
});

// Student Registration
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, department, semester } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
    semester?: string;
  };

  const cleanName = (name || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = password || '';
  const cleanDept = (department || 'Computer Science').trim();
  const cleanSem = (semester || 'Semester 4').trim();

  if (cleanName.length < 2 || cleanName.length > 80) {
    res.status(400).json({ error: 'Full name must be between 2 and 80 characters.' });
    return;
  }
  if (!isValidEmail(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (cleanPass.length < 6 || cleanPass.length > 128) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email is already registered.' });
    return;
  }

  const passwordHash = hashPassword(cleanPass);
  const now = new Date().toISOString();

  const insertResult = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, student_id_code, department, semester, status, created_at)
       VALUES (?, ?, ?, 'student', NULL, ?, ?, 'active', ?)`
    )
    .run(cleanName, cleanEmail, passwordHash, cleanDept, cleanSem, now);

  const userId = Number(insertResult.lastInsertRowid);
  const studentCode = generateStudentCode(userId);
  db.prepare('UPDATE users SET student_id_code = ? WHERE id = ?').run(studentCode, userId);

  const user = db
    .prepare(
      'SELECT id, name, email, role, student_id_code, department, semester, status FROM users WHERE id = ?'
    )
    .get(userId) as unknown as AuthUser;

  const token = createSessionToken(user.id, 'student');
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user });
});

// Login (Student or Admin)
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPass = password || '';

  if (!isValidEmail(cleanEmail) || !cleanPass) {
    res.status(400).json({ error: 'Please enter both email and password.' });
    return;
  }

  const row = db
    .prepare(
      'SELECT id, name, email, password_hash, role, student_id_code, department, semester, status FROM users WHERE email = ?'
    )
    .get(cleanEmail) as (AuthUser & { password_hash: string }) | undefined;

  const configuredPasscode = getConfiguredAdminPasscode();

  if (!row) {
    // Allow signing in with ADMIN_PASSCODE if configured and an admin exists or needs dynamic session
    if (configuredPasscode && constantTimeMatch(cleanPass, configuredPasscode)) {
      const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get() as
        | AuthUser
        | undefined;
      if (existingAdmin) {
        const token = createSessionToken(existingAdmin.id, 'admin');
        setSessionCookie(req, res, token);
        res.json({ token, user: existingAdmin });
        return;
      }
      const now = new Date().toISOString();
      const created = db
        .prepare(
          `INSERT INTO users (name, email, password_hash, role, student_id_code, department, semester, status, created_at)
           VALUES ('Portal Administrator', ?, ?, 'admin', NULL, 'Academic Administration', 'Faculty / Admin', 'active', ?)`
        )
        .run(cleanEmail, hashPassword(cleanPass), now);
      const adminId = Number(created.lastInsertRowid);
      const adminUser = db
        .prepare(
          'SELECT id, name, email, role, student_id_code, department, semester, status FROM users WHERE id = ?'
        )
        .get(adminId) as unknown as AuthUser;
      const token = createSessionToken(adminUser.id, 'admin');
      setSessionCookie(req, res, token);
      res.json({ token, user: adminUser });
      return;
    }

    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (row.status !== 'active') {
    res.status(403).json({ error: 'This account is suspended. Please contact an administrator.' });
    return;
  }

  const passwordValid =
    verifyPassword(cleanPass, row.password_hash) ||
    (row.role === 'admin' && configuredPasscode.length > 0 && constantTimeMatch(cleanPass, configuredPasscode));

  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    student_id_code: row.student_id_code,
    department: row.department,
    semester: row.semester,
    status: row.status,
  };

  const token = createSessionToken(user.id, user.role);
  setSessionCookie(req, res, token);
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

// Public catalog preview for landing page
app.get('/api/public/exams', (_req: Request, res: Response) => {
  const exams = db
    .prepare(
      `SELECT e.id, e.title, e.subject_code, e.department, e.description, e.duration_minutes,
              e.total_marks, e.pass_percentage, e.status, e.scheduled_date,
              COUNT(q.id) AS question_count
       FROM exams e
       LEFT JOIN questions q ON q.exam_id = e.id
       WHERE e.status IN ('available', 'upcoming')
       GROUP BY e.id
       ORDER BY CASE WHEN e.status = 'available' THEN 0 ELSE 1 END, e.scheduled_date ASC, e.id DESC`
    )
    .all();
  res.json({ exams });
});

// Student Dashboard Data
app.get('/api/student/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
  const studentId = req.user!.id;

  // Auto-finalize any expired in-progress attempts for this student
  const openAttempts = db
    .prepare("SELECT id, expires_at FROM exam_attempts WHERE student_id = ? AND status = 'in_progress'")
    .all(studentId) as { id: number; expires_at: string }[];

  const nowMs = Date.now();
  for (const att of openAttempts) {
    if (nowMs >= new Date(att.expires_at).getTime()) {
      gradeAndFinalizeAttempt(att.id, true);
    }
  }

  const exams = db
    .prepare(
      `SELECT e.id, e.title, e.subject_code, e.department, e.description, e.duration_minutes,
              e.total_marks, e.pass_percentage, e.status, e.scheduled_date,
              COUNT(q.id) AS question_count,
              (SELECT a.id FROM exam_attempts a
               WHERE a.exam_id = e.id AND a.student_id = ? AND a.status = 'in_progress'
               ORDER BY a.id DESC LIMIT 1) AS active_attempt_id,
              (SELECT a.id FROM exam_attempts a
               WHERE a.exam_id = e.id AND a.student_id = ? AND a.status = 'submitted'
               ORDER BY a.id DESC LIMIT 1) AS latest_result_id
       FROM exams e
       LEFT JOIN questions q ON q.exam_id = e.id
       WHERE e.status IN ('available', 'upcoming')
       GROUP BY e.id
       ORDER BY CASE WHEN e.status = 'available' THEN 0 ELSE 1 END, e.scheduled_date ASC, e.id DESC`
    )
    .all(studentId, studentId);

  const results = db
    .prepare(
      `SELECT a.id, a.exam_id, e.title AS exam_title, e.subject_code, e.department,
              a.started_at, a.submitted_at, a.total_questions, a.correct_answers,
              a.wrong_answers, a.unanswered, a.total_marks, a.obtained_marks,
              a.percentage, a.passed, a.auto_submitted
       FROM exam_attempts a
       JOIN exams e ON e.id = a.exam_id
       WHERE a.student_id = ? AND a.status = 'submitted'
       ORDER BY a.submitted_at DESC, a.id DESC`
    )
    .all(studentId);

  res.json({
    student: req.user,
    exams,
    results,
  });
});

// Start or Resume Examination
app.post('/api/exams/:id/start', requireAuth, (req: AuthedRequest, res: Response) => {
  const examId = Number(req.params.id);
  const studentId = req.user!.id;

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as
    | { id: number; status: string; duration_minutes: number; total_marks: number }
    | undefined;

  if (!exam) {
    res.status(404).json({ error: 'Examination not found.' });
    return;
  }
  if (exam.status !== 'available') {
    res.status(400).json({ error: 'This examination is not currently open for taking.' });
    return;
  }

  const questionCountRow = db
    .prepare('SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?')
    .get(examId) as { count: number };
  if (questionCountRow.count === 0) {
    res.status(400).json({ error: 'This examination has no questions configured yet.' });
    return;
  }

  const existingOpen = db
    .prepare(
      "SELECT id, expires_at FROM exam_attempts WHERE exam_id = ? AND student_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1"
    )
    .get(examId, studentId) as { id: number; expires_at: string } | undefined;

  if (existingOpen) {
    if (Date.now() < new Date(existingOpen.expires_at).getTime()) {
      res.json({ attemptId: existingOpen.id, resumed: true });
      return;
    }
    gradeAndFinalizeAttempt(existingOpen.id, true);
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + exam.duration_minutes * 60 * 1000);

  const insert = db
    .prepare(
      `INSERT INTO exam_attempts (exam_id, student_id, status, started_at, expires_at, answers_json, current_question_index, total_questions, total_marks)
       VALUES (?, ?, 'in_progress', ?, ?, '{}', 0, ?, ?)`
    )
    .run(examId, studentId, startedAt.toISOString(), expiresAt.toISOString(), questionCountRow.count, exam.total_marks);

  res.status(201).json({ attemptId: Number(insert.lastInsertRowid), resumed: false });
});

// Load Active Examination Questions (never returns correct_option!)
app.get('/api/attempts/:attemptId/take', requireAuth, (req: AuthedRequest, res: Response) => {
  const attemptId = Number(req.params.attemptId);
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as
    | {
        id: number;
        exam_id: number;
        student_id: number;
        status: string;
        started_at: string;
        expires_at: string;
        answers_json: string;
        current_question_index: number;
      }
    | undefined;

  if (!attempt) {
    res.status(404).json({ error: 'Exam attempt not found.' });
    return;
  }
  if (attempt.student_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'You do not have access to this exam attempt.' });
    return;
  }

  if (attempt.status === 'submitted') {
    res.json({ completed: true, attemptId: attempt.id });
    return;
  }

  const remainingMs = new Date(attempt.expires_at).getTime() - Date.now();
  if (remainingMs <= 0) {
    gradeAndFinalizeAttempt(attempt.id, true);
    res.json({ completed: true, attemptId: attempt.id, autoSubmitted: true });
    return;
  }

  const exam = db
    .prepare('SELECT id, title, subject_code, department, duration_minutes, total_marks, pass_percentage FROM exams WHERE id = ?')
    .get(attempt.exam_id);

  const questions = db
    .prepare(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, marks, order_index
       FROM questions
       WHERE exam_id = ?
       ORDER BY order_index ASC, id ASC`
    )
    .all(attempt.exam_id);

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(attempt.answers_json || '{}') as Record<string, string>;
  } catch {
    answers = {};
  }

  res.json({
    completed: false,
    attemptId: attempt.id,
    exam,
    questions,
    answers,
    currentQuestionIndex: attempt.current_question_index,
    startedAt: attempt.started_at,
    expiresAt: attempt.expires_at,
    remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
  });
});

// Auto-save answer progress
app.patch('/api/attempts/:attemptId/answer', requireAuth, (req: AuthedRequest, res: Response) => {
  const attemptId = Number(req.params.attemptId);
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as
    | {
        id: number;
        student_id: number;
        status: string;
        expires_at: string;
        answers_json: string;
        current_question_index: number;
      }
    | undefined;

  if (!attempt) {
    res.status(404).json({ error: 'Exam attempt not found.' });
    return;
  }
  if (attempt.student_id !== req.user!.id) {
    res.status(403).json({ error: 'Unauthorized attempt update.' });
    return;
  }
  if (attempt.status === 'submitted') {
    res.json({ completed: true, attemptId: attempt.id });
    return;
  }

  if (Date.now() >= new Date(attempt.expires_at).getTime()) {
    gradeAndFinalizeAttempt(attempt.id, true);
    res.json({ completed: true, attemptId: attempt.id, autoSubmitted: true });
    return;
  }

  const { questionId, selectedOption, currentQuestionIndex } = req.body as {
    questionId?: number;
    selectedOption?: string | null;
    currentQuestionIndex?: number;
  };

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(attempt.answers_json || '{}') as Record<string, string>;
  } catch {
    answers = {};
  }

  if (typeof questionId === 'number') {
    if (selectedOption === null || selectedOption === '') {
      delete answers[String(questionId)];
    } else if (typeof selectedOption === 'string' && ['A', 'B', 'C', 'D'].includes(selectedOption)) {
      answers[String(questionId)] = selectedOption;
    }
  }

  const nextIndex =
    typeof currentQuestionIndex === 'number' && currentQuestionIndex >= 0
      ? Math.floor(currentQuestionIndex)
      : attempt.current_question_index;

  db.prepare('UPDATE exam_attempts SET answers_json = ?, current_question_index = ? WHERE id = ?').run(
    JSON.stringify(answers),
    nextIndex,
    attempt.id
  );

  res.json({
    ok: true,
    savedAt: new Date().toISOString(),
    answersCount: Object.keys(answers).length,
  });
});

// Submit Examination (manual or auto-submit on timeout)
app.post('/api/attempts/:attemptId/submit', requireAuth, (req: AuthedRequest, res: Response) => {
  const attemptId = Number(req.params.attemptId);
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as
    | { id: number; student_id: number; status: string; answers_json: string }
    | undefined;

  if (!attempt) {
    res.status(404).json({ error: 'Exam attempt not found.' });
    return;
  }
  if (attempt.student_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Unauthorized submission.' });
    return;
  }

  const { answers, autoSubmitted } = req.body as {
    answers?: Record<string, string>;
    autoSubmitted?: boolean;
  };

  // Merge any final unsaved client answers before grading if still in progress
  if (attempt.status === 'in_progress' && answers && typeof answers === 'object') {
    const sanitized: Record<string, string> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (typeof v === 'string' && ['A', 'B', 'C', 'D'].includes(v)) {
        sanitized[k] = v;
      }
    }
    db.prepare('UPDATE exam_attempts SET answers_json = ? WHERE id = ?').run(
      JSON.stringify(sanitized),
      attemptId
    );
  }

  const finalized = gradeAndFinalizeAttempt(attemptId, Boolean(autoSubmitted));
  res.json({ resultId: finalized.id });
});

// Result Page Data (accessible to the student owner or admin)
app.get('/api/attempts/:attemptId/result', requireAuth, (req: AuthedRequest, res: Response) => {
  const attemptId = Number(req.params.attemptId);
  const row = db
    .prepare(
      `SELECT a.*, u.name AS student_name, u.email AS student_email, u.student_id_code,
              u.department AS student_department, u.semester AS student_semester,
              e.title AS exam_title, e.subject_code, e.department AS exam_department,
              e.pass_percentage, e.duration_minutes
       FROM exam_attempts a
       JOIN users u ON u.id = a.student_id
       JOIN exams e ON e.id = a.exam_id
       WHERE a.id = ?`
    )
    .get(attemptId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Examination result not found.' });
    return;
  }
  if (Number(row.student_id) !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'You do not have permission to view this result.' });
    return;
  }

  if (row.status !== 'submitted') {
    gradeAndFinalizeAttempt(attemptId, false);
    const refreshed = db
      .prepare(
        `SELECT a.*, u.name AS student_name, u.email AS student_email, u.student_id_code,
                u.department AS student_department, u.semester AS student_semester,
                e.title AS exam_title, e.subject_code, e.department AS exam_department,
                e.pass_percentage, e.duration_minutes
         FROM exam_attempts a
         JOIN users u ON u.id = a.student_id
         JOIN exams e ON e.id = a.exam_id
         WHERE a.id = ?`
      )
      .get(attemptId) as Record<string, unknown>;
    Object.assign(row, refreshed);
  }

  const questions = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(Number(row.exam_id)) as {
    id: number;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: 'A' | 'B' | 'C' | 'D';
    marks: number;
    order_index: number;
  }[];

  let answers: Record<string, string> = {};
  try {
    answers = JSON.parse(String(row.answers_json || '{}')) as Record<string, string>;
  } catch {
    answers = {};
  }

  const breakdown = questions.map((q) => {
    const selectedOption = answers[String(q.id)] || null;
    const isCorrect = selectedOption === q.correct_option;
    return {
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      selected_option: selectedOption,
      is_correct: isCorrect,
      marks: q.marks,
    };
  });

  res.json({
    result: {
      id: row.id,
      exam_id: row.exam_id,
      student_name: row.student_name,
      student_email: row.student_email,
      student_id_code: row.student_id_code,
      student_department: row.student_department,
      student_semester: row.student_semester,
      exam_title: row.exam_title,
      subject_code: row.subject_code,
      exam_department: row.exam_department,
      duration_minutes: row.duration_minutes,
      pass_percentage: row.pass_percentage,
      started_at: row.started_at,
      submitted_at: row.submitted_at,
      total_questions: row.total_questions,
      correct_answers: row.correct_answers,
      wrong_answers: row.wrong_answers,
      unanswered: row.unanswered,
      total_marks: row.total_marks,
      obtained_marks: row.obtained_marks,
      percentage: row.percentage,
      passed: Boolean(row.passed),
      auto_submitted: Boolean(row.auto_submitted),
    },
    breakdown,
  });
});

// ========================
// ADMIN ROUTES
// ========================

app.get('/api/admin/overview', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const totalExams = (db.prepare('SELECT COUNT(*) AS c FROM exams').get() as { c: number }).c;
  const totalQuestions = (db.prepare('SELECT COUNT(*) AS c FROM questions').get() as { c: number }).c;
  const totalStudents = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'student'").get() as { c: number }
  ).c;
  const totalSubmissions = (
    db.prepare("SELECT COUNT(*) AS c FROM exam_attempts WHERE status = 'submitted'").get() as { c: number }
  ).c;
  const passedSubmissions = (
    db
      .prepare("SELECT COUNT(*) AS c FROM exam_attempts WHERE status = 'submitted' AND passed = 1")
      .get() as { c: number }
  ).c;

  const passRate = totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0;

  const recentResults = db
    .prepare(
      `SELECT a.id, u.name AS student_name, u.student_id_code, e.title AS exam_title, e.subject_code,
              a.obtained_marks, a.total_marks, a.percentage, a.passed, a.submitted_at
       FROM exam_attempts a
       JOIN users u ON u.id = a.student_id
       JOIN exams e ON e.id = a.exam_id
       WHERE a.status = 'submitted'
       ORDER BY a.submitted_at DESC, a.id DESC
       LIMIT 8`
    )
    .all();

  res.json({
    stats: {
      totalExams,
      totalQuestions,
      totalStudents,
      totalSubmissions,
      passRate,
    },
    recentResults,
  });
});

app.get('/api/admin/exams', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const exams = db
    .prepare(
      `SELECT e.*,
              (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count,
              (SELECT COALESCE(SUM(q.marks), 0) FROM questions q WHERE q.exam_id = e.id) AS question_marks_sum,
              (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id = e.id AND a.status = 'submitted') AS submission_count
       FROM exams e
       ORDER BY e.id DESC`
    )
    .all();
  res.json({ exams });
});

app.post('/api/admin/exams', requireAdmin, (req: AuthedRequest, res: Response) => {
  const {
    title,
    subject_code,
    department,
    description,
    duration_minutes,
    total_marks,
    pass_percentage,
    status,
    scheduled_date,
  } = req.body as Record<string, unknown>;

  const cleanTitle = String(title || '').trim();
  const cleanCode = String(subject_code || '').trim().toUpperCase();
  const cleanDept = String(department || 'Computer Science').trim();
  const cleanDesc = String(description || '').trim();
  const duration = Number(duration_minutes);
  const totalMarks = Number(total_marks);
  const passPct = Number(pass_percentage ?? 40);
  const cleanStatus = ['available', 'upcoming', 'archived'].includes(String(status))
    ? String(status)
    : 'available';
  const cleanDate = String(scheduled_date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (cleanTitle.length < 3 || cleanCode.length < 2) {
    res.status(400).json({ error: 'Examination title and subject code are required.' });
    return;
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
    res.status(400).json({ error: 'Duration must be between 1 and 300 minutes.' });
    return;
  }
  if (!Number.isFinite(totalMarks) || totalMarks < 1 || totalMarks > 1000) {
    res.status(400).json({ error: 'Total marks must be between 1 and 1000.' });
    return;
  }
  if (!Number.isFinite(passPct) || passPct < 1 || passPct > 100) {
    res.status(400).json({ error: 'Pass percentage must be between 1 and 100.' });
    return;
  }

  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO exams (title, subject_code, department, description, duration_minutes, total_marks, pass_percentage, status, scheduled_date, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cleanTitle,
      cleanCode,
      cleanDept,
      cleanDesc || 'Online multiple-choice examination.',
      Math.round(duration),
      Math.round(totalMarks),
      Math.round(passPct),
      cleanStatus,
      cleanDate,
      req.user!.id,
      now
    );

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ exam });
});

app.put('/api/admin/exams/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const examId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!existing) {
    res.status(404).json({ error: 'Examination not found.' });
    return;
  }

  const {
    title,
    subject_code,
    department,
    description,
    duration_minutes,
    total_marks,
    pass_percentage,
    status,
    scheduled_date,
  } = req.body as Record<string, unknown>;

  const cleanTitle = String(title || '').trim();
  const cleanCode = String(subject_code || '').trim().toUpperCase();
  const cleanDept = String(department || 'Computer Science').trim();
  const cleanDesc = String(description || '').trim();
  const duration = Number(duration_minutes);
  const totalMarks = Number(total_marks);
  const passPct = Number(pass_percentage ?? 40);
  const cleanStatus = ['available', 'upcoming', 'archived'].includes(String(status))
    ? String(status)
    : 'available';
  const cleanDate = String(scheduled_date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (cleanTitle.length < 3 || cleanCode.length < 2) {
    res.status(400).json({ error: 'Examination title and subject code are required.' });
    return;
  }
  if (!Number.isFinite(duration) || duration < 1 || duration > 300) {
    res.status(400).json({ error: 'Duration must be between 1 and 300 minutes.' });
    return;
  }
  if (!Number.isFinite(totalMarks) || totalMarks < 1 || totalMarks > 1000) {
    res.status(400).json({ error: 'Total marks must be between 1 and 1000.' });
    return;
  }

  db.prepare(
    `UPDATE exams
     SET title = ?, subject_code = ?, department = ?, description = ?, duration_minutes = ?,
         total_marks = ?, pass_percentage = ?, status = ?, scheduled_date = ?
     WHERE id = ?`
  ).run(
    cleanTitle,
    cleanCode,
    cleanDept,
    cleanDesc,
    Math.round(duration),
    Math.round(totalMarks),
    Math.round(passPct),
    cleanStatus,
    cleanDate,
    examId
  );

  const updated = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  res.json({ exam: updated });
});

app.delete('/api/admin/exams/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const examId = Number(req.params.id);
  const info = db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Examination not found.' });
    return;
  }
  res.json({ ok: true });
});

// Admin Question Management
app.get('/api/admin/exams/:id/questions', requireAdmin, (req: AuthedRequest, res: Response) => {
  const examId = Number(req.params.id);
  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
  if (!exam) {
    res.status(404).json({ error: 'Examination not found.' });
    return;
  }
  const questions = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(examId);
  res.json({ exam, questions });
});

app.post('/api/admin/exams/:id/questions', requireAdmin, (req: AuthedRequest, res: Response) => {
  const examId = Number(req.params.id);
  const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(examId);
  if (!exam) {
    res.status(404).json({ error: 'Examination not found.' });
    return;
  }

  const { question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body as Record<
    string,
    unknown
  >;

  const qText = String(question_text || '').trim();
  const optA = String(option_a || '').trim();
  const optB = String(option_b || '').trim();
  const optC = String(option_c || '').trim();
  const optD = String(option_d || '').trim();
  const correct = String(correct_option || '').toUpperCase();
  const qMarks = Number(marks ?? 4);

  if (!qText || !optA || !optB || !optC || !optD) {
    res.status(400).json({ error: 'Question text and all four options are required.' });
    return;
  }
  if (!['A', 'B', 'C', 'D'].includes(correct)) {
    res.status(400).json({ error: 'Correct option must be A, B, C, or D.' });
    return;
  }
  if (!Number.isFinite(qMarks) || qMarks < 1 || qMarks > 100) {
    res.status(400).json({ error: 'Question marks must be between 1 and 100.' });
    return;
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(order_index), 0) AS max_idx FROM questions WHERE exam_id = ?')
    .get(examId) as { max_idx: number };

  const result = db
    .prepare(
      `INSERT INTO questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(examId, qText, optA, optB, optC, optD, correct, Math.round(qMarks), maxOrderRow.max_idx + 1);

  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ question });
});

app.put('/api/admin/questions/:questionId', requireAdmin, (req: AuthedRequest, res: Response) => {
  const questionId = Number(req.params.questionId);
  const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
  if (!existing) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }

  const { question_text, option_a, option_b, option_c, option_d, correct_option, marks } = req.body as Record<
    string,
    unknown
  >;

  const qText = String(question_text || '').trim();
  const optA = String(option_a || '').trim();
  const optB = String(option_b || '').trim();
  const optC = String(option_c || '').trim();
  const optD = String(option_d || '').trim();
  const correct = String(correct_option || '').toUpperCase();
  const qMarks = Number(marks ?? 4);

  if (!qText || !optA || !optB || !optC || !optD) {
    res.status(400).json({ error: 'Question text and all four options are required.' });
    return;
  }
  if (!['A', 'B', 'C', 'D'].includes(correct)) {
    res.status(400).json({ error: 'Correct option must be A, B, C, or D.' });
    return;
  }
  if (!Number.isFinite(qMarks) || qMarks < 1 || qMarks > 100) {
    res.status(400).json({ error: 'Question marks must be between 1 and 100.' });
    return;
  }

  db.prepare(
    `UPDATE questions
     SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ?
     WHERE id = ?`
  ).run(qText, optA, optB, optC, optD, correct, Math.round(qMarks), questionId);

  const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(questionId);
  res.json({ question: updated });
});

app.delete('/api/admin/questions/:questionId', requireAdmin, (req: AuthedRequest, res: Response) => {
  const questionId = Number(req.params.questionId);
  const info = db.prepare('DELETE FROM questions WHERE id = ?').run(questionId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Question not found.' });
    return;
  }
  res.json({ ok: true });
});

// Admin Student Management
app.get('/api/admin/students', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const students = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.student_id_code, u.department, u.semester, u.status, u.created_at,
              COUNT(CASE WHEN a.status = 'submitted' THEN 1 END) AS exams_taken,
              ROUND(AVG(CASE WHEN a.status = 'submitted' THEN a.percentage END), 1) AS average_score
       FROM users u
       LEFT JOIN exam_attempts a ON a.student_id = u.id
       WHERE u.role = 'student'
       GROUP BY u.id
       ORDER BY u.id DESC`
    )
    .all();
  res.json({ students });
});

app.put('/api/admin/students/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const studentId = Number(req.params.id);
  const existing = db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'student'")
    .get(studentId);
  if (!existing) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  const { name, department, semester, status } = req.body as Record<string, unknown>;
  const cleanName = String(name || '').trim();
  const cleanDept = String(department || '').trim();
  const cleanSem = String(semester || '').trim();
  const cleanStatus = status === 'suspended' ? 'suspended' : 'active';

  if (cleanName.length < 2) {
    res.status(400).json({ error: 'Student name must be at least 2 characters.' });
    return;
  }

  db.prepare(
    'UPDATE users SET name = ?, department = ?, semester = ?, status = ? WHERE id = ?'
  ).run(cleanName, cleanDept, cleanSem, cleanStatus, studentId);

  const updated = db
    .prepare(
      'SELECT id, name, email, role, student_id_code, department, semester, status, created_at FROM users WHERE id = ?'
    )
    .get(studentId);
  res.json({ student: updated });
});

app.delete('/api/admin/students/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const studentId = Number(req.params.id);
  const info = db.prepare("DELETE FROM users WHERE id = ? AND role = 'student'").run(studentId);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }
  res.json({ ok: true });
});

// Admin All Results
app.get('/api/admin/results', requireAdmin, (_req: AuthedRequest, res: Response) => {
  const results = db
    .prepare(
      `SELECT a.id, a.exam_id, a.student_id, u.name AS student_name, u.email AS student_email,
              u.student_id_code, u.department AS student_department,
              e.title AS exam_title, e.subject_code,
              a.total_questions, a.correct_answers, a.wrong_answers, a.unanswered,
              a.total_marks, a.obtained_marks, a.percentage, a.passed,
              a.auto_submitted, a.submitted_at
       FROM exam_attempts a
       JOIN users u ON u.id = a.student_id
       JOIN exams e ON e.id = a.exam_id
       WHERE a.status = 'submitted'
       ORDER BY a.submitted_at DESC, a.id DESC`
    )
    .all();
  res.json({ results });
});

async function startServer(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scholaria Online Examination Portal listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
