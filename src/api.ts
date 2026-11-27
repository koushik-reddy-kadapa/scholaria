import type {
  AdminExam,
  AdminOverview,
  AdminQuestion,
  AdminResultRow,
  AdminStudent,
  AttemptTakeData,
  BootstrapStatus,
  ExamItem,
  QuestionBreakdown,
  ResultDetail,
  StudentResultSummary,
  User,
} from './types';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export const api = {
  getBootstrapStatus: () => apiFetch<BootstrapStatus>('/api/auth/bootstrap-status'),

  setupAdmin: (payload: { name: string; email: string; password: string; department: string }) =>
    apiFetch<{ token: string; user: User }>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  registerStudent: (payload: {
    name: string;
    email: string;
    password: string;
    department: string;
    semester: string;
  }) =>
    apiFetch<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => apiFetch<{ user: User }>('/api/auth/me'),

  logout: () =>
    apiFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getPublicExams: () => apiFetch<{ exams: ExamItem[] }>('/api/public/exams'),

  getStudentDashboard: () =>
    apiFetch<{ student: User; exams: ExamItem[]; results: StudentResultSummary[] }>(
      '/api/student/dashboard'
    ),

  startExam: (examId: number) =>
    apiFetch<{ attemptId: number; resumed: boolean }>(`/api/exams/${examId}/start`, {
      method: 'POST',
    }),

  getAttemptTake: (attemptId: number) =>
    apiFetch<AttemptTakeData>(`/api/attempts/${attemptId}/take`),

  saveAnswer: (
    attemptId: number,
    payload: { questionId?: number; selectedOption?: string | null; currentQuestionIndex?: number }
  ) =>
    apiFetch<{
      ok?: boolean;
      completed?: boolean;
      attemptId?: number;
      autoSubmitted?: boolean;
      savedAt?: string;
    }>(`/api/attempts/${attemptId}/answer`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  submitAttempt: (
    attemptId: number,
    payload: { answers: Record<string, string>; autoSubmitted?: boolean }
  ) =>
    apiFetch<{ resultId: number }>(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAttemptResult: (attemptId: number) =>
    apiFetch<{ result: ResultDetail; breakdown: QuestionBreakdown[] }>(
      `/api/attempts/${attemptId}/result`
    ),

  // Admin APIs
  getAdminOverview: () => apiFetch<AdminOverview>('/api/admin/overview'),

  getAdminExams: () => apiFetch<{ exams: AdminExam[] }>('/api/admin/exams'),

  createExam: (payload: {
    title: string;
    subject_code: string;
    department: string;
    description: string;
    duration_minutes: number;
    total_marks: number;
    pass_percentage: number;
    status: 'available' | 'upcoming' | 'archived';
    scheduled_date: string;
  }) =>
    apiFetch<{ exam: AdminExam }>('/api/admin/exams', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateExam: (
    examId: number,
    payload: {
      title: string;
      subject_code: string;
      department: string;
      description: string;
      duration_minutes: number;
      total_marks: number;
      pass_percentage: number;
      status: 'available' | 'upcoming' | 'archived';
      scheduled_date: string;
    }
  ) =>
    apiFetch<{ exam: AdminExam }>(`/api/admin/exams/${examId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteExam: (examId: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/exams/${examId}`, {
      method: 'DELETE',
    }),

  getExamQuestions: (examId: number) =>
    apiFetch<{ exam: AdminExam; questions: AdminQuestion[] }>(
      `/api/admin/exams/${examId}/questions`
    ),

  addQuestion: (
    examId: number,
    payload: {
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: 'A' | 'B' | 'C' | 'D';
      marks: number;
    }
  ) =>
    apiFetch<{ question: AdminQuestion }>(`/api/admin/exams/${examId}/questions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateQuestion: (
    questionId: number,
    payload: {
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: 'A' | 'B' | 'C' | 'D';
      marks: number;
    }
  ) =>
    apiFetch<{ question: AdminQuestion }>(`/api/admin/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteQuestion: (questionId: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/questions/${questionId}`, {
      method: 'DELETE',
    }),

  getAdminStudents: () => apiFetch<{ students: AdminStudent[] }>('/api/admin/students'),

  updateStudent: (
    studentId: number,
    payload: {
      name: string;
      department: string;
      semester: string;
      status: 'active' | 'suspended';
    }
  ) =>
    apiFetch<{ student: AdminStudent }>(`/api/admin/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteStudent: (studentId: number) =>
    apiFetch<{ ok: boolean }>(`/api/admin/students/${studentId}`, {
      method: 'DELETE',
    }),

  getAdminResults: () => apiFetch<{ results: AdminResultRow[] }>('/api/admin/results'),
};
