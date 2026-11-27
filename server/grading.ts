import { db } from './db.ts';

interface QuestionRow {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  marks: number;
  order_index: number;
}

interface ExamRow {
  id: number;
  title: string;
  subject_code: string;
  total_marks: number;
  pass_percentage: number;
}

interface AttemptRow {
  id: number;
  exam_id: number;
  student_id: number;
  status: 'in_progress' | 'submitted';
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  answers_json: string;
  current_question_index: number;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  passed: number;
  auto_submitted: number;
}

export function gradeAndFinalizeAttempt(attemptId: number, autoSubmitted: boolean): AttemptRow {
  const attempt = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as AttemptRow | undefined;
  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  if (attempt.status === 'submitted') {
    return attempt;
  }

  const exam = db
    .prepare('SELECT id, title, subject_code, total_marks, pass_percentage FROM exams WHERE id = ?')
    .get(attempt.exam_id) as ExamRow | undefined;

  if (!exam) {
    throw new Error('Associated examination not found');
  }

  const questions = db
    .prepare('SELECT * FROM questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC')
    .all(attempt.exam_id) as unknown as QuestionRow[];

  let answers: Record<string, string> = {};
  try {
    const parsed = JSON.parse(attempt.answers_json || '{}');
    if (parsed && typeof parsed === 'object') {
      answers = parsed as Record<string, string>;
    }
  } catch {
    answers = {};
  }

  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unanswered = 0;
  let rawTotalMarks = 0;
  let rawObtainedMarks = 0;

  for (const q of questions) {
    rawTotalMarks += q.marks;
    const chosen = answers[String(q.id)];
    if (!chosen || !['A', 'B', 'C', 'D'].includes(chosen)) {
      unanswered += 1;
    } else if (chosen === q.correct_option) {
      correctAnswers += 1;
      rawObtainedMarks += q.marks;
    } else {
      wrongAnswers += 1;
    }
  }

  const totalQuestions = questions.length;
  const configuredTotal = exam.total_marks > 0 ? exam.total_marks : rawTotalMarks;

  let obtainedMarks = rawObtainedMarks;
  if (rawTotalMarks > 0 && configuredTotal !== rawTotalMarks) {
    obtainedMarks = Math.round((rawObtainedMarks / rawTotalMarks) * configuredTotal);
  }

  const percentage =
    configuredTotal > 0 ? Number(((obtainedMarks / configuredTotal) * 100).toFixed(1)) : 0;
  const passed = percentage >= exam.pass_percentage ? 1 : 0;
  const submittedAt = new Date().toISOString();

  db.prepare(`
    UPDATE exam_attempts
    SET status = 'submitted',
        submitted_at = ?,
        total_questions = ?,
        correct_answers = ?,
        wrong_answers = ?,
        unanswered = ?,
        total_marks = ?,
        obtained_marks = ?,
        percentage = ?,
        passed = ?,
        auto_submitted = ?
    WHERE id = ?
  `).run(
    submittedAt,
    totalQuestions,
    correctAnswers,
    wrongAnswers,
    unanswered,
    configuredTotal,
    obtainedMarks,
    percentage,
    passed,
    autoSubmitted ? 1 : 0,
    attemptId
  );

  return db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(attemptId) as unknown as AttemptRow;
}
