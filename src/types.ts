export type UserRole = 'student' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  student_id_code: string | null;
  department: string;
  semester: string;
  status: 'active' | 'suspended';
}

export interface BootstrapStatus {
  adminClaimed: boolean;
  passcodeConfigured: boolean;
}

export interface ExamItem {
  id: number;
  title: string;
  subject_code: string;
  department: string;
  description: string;
  duration_minutes: number;
  total_marks: number;
  pass_percentage: number;
  status: 'available' | 'upcoming' | 'archived';
  scheduled_date: string;
  question_count: number;
  active_attempt_id?: number | null;
  latest_result_id?: number | null;
}

export interface StudentResultSummary {
  id: number;
  exam_id: number;
  exam_title: string;
  subject_code: string;
  department: string;
  started_at: string;
  submitted_at: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  passed: number | boolean;
  auto_submitted: number | boolean;
}

export interface ExamQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  order_index: number;
}

export interface AttemptTakeData {
  completed: boolean;
  attemptId: number;
  autoSubmitted?: boolean;
  exam?: {
    id: number;
    title: string;
    subject_code: string;
    department: string;
    duration_minutes: number;
    total_marks: number;
    pass_percentage: number;
  };
  questions?: ExamQuestion[];
  answers?: Record<string, 'A' | 'B' | 'C' | 'D'>;
  currentQuestionIndex?: number;
  startedAt?: string;
  expiresAt?: string;
  remainingSeconds?: number;
}

export interface ResultDetail {
  id: number;
  exam_id: number;
  student_name: string;
  student_email: string;
  student_id_code: string | null;
  student_department: string;
  student_semester: string;
  exam_title: string;
  subject_code: string;
  exam_department: string;
  duration_minutes: number;
  pass_percentage: number;
  started_at: string;
  submitted_at: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  passed: boolean;
  auto_submitted: boolean;
}

export interface QuestionBreakdown {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  is_correct: boolean;
  marks: number;
}

export interface AdminOverview {
  stats: {
    totalExams: number;
    totalQuestions: number;
    totalStudents: number;
    totalSubmissions: number;
    passRate: number;
  };
  recentResults: {
    id: number;
    student_name: string;
    student_id_code: string | null;
    exam_title: string;
    subject_code: string;
    obtained_marks: number;
    total_marks: number;
    percentage: number;
    passed: number;
    submitted_at: string;
  }[];
}

export interface AdminExam extends ExamItem {
  question_marks_sum: number;
  submission_count: number;
  created_at: string;
}

export interface AdminQuestion extends ExamQuestion {
  exam_id: number;
  correct_option: 'A' | 'B' | 'C' | 'D';
}

export interface AdminStudent {
  id: number;
  name: string;
  email: string;
  student_id_code: string | null;
  department: string;
  semester: string;
  status: 'active' | 'suspended';
  created_at: string;
  exams_taken: number;
  average_score: number | null;
}

export interface AdminResultRow {
  id: number;
  exam_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  student_id_code: string | null;
  student_department: string;
  exam_title: string;
  subject_code: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  unanswered: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  passed: number;
  auto_submitted: number;
  submitted_at: string;
}
