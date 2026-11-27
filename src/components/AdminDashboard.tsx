import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FilePlus2,
  Plus,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type {
  AdminExam,
  AdminOverview,
  AdminQuestion,
  AdminResultRow,
  AdminStudent,
} from '../types';

export type AdminTab = 'overview' | 'exams' | 'students' | 'results';

interface AdminDashboardProps {
  activeTab: AdminTab;
  onChangeTab: (tab: AdminTab) => void;
  onViewResult: (resultId: number) => void;
}

const DEPARTMENTS = [
  'Computer Science',
  'Information Technology',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Mathematics & Computing',
  'Business Administration',
];

const SEMESTERS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8',
];

export function AdminDashboard({
  activeTab,
  onChangeTab,
  onViewResult,
}: AdminDashboardProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [exams, setExams] = useState<AdminExam[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [results, setResults] = useState<AdminResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Question editor sub-view
  const [selectedExamForQuestions, setSelectedExamForQuestions] = useState<AdminExam | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Search / filters
  const [studentSearch, setStudentSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [resultExamFilter, setResultExamFilter] = useState<string>('all');

  // Exam modal state
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<AdminExam | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    subject_code: '',
    department: DEPARTMENTS[0],
    description: '',
    duration_minutes: 20,
    total_marks: 40,
    pass_percentage: 40,
    status: 'available' as 'available' | 'upcoming' | 'archived',
    scheduled_date: new Date().toISOString().slice(0, 10),
  });

  // Question modal state
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AdminQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A' as 'A' | 'B' | 'C' | 'D',
    marks: 4,
  });

  // Student edit modal state
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    department: DEPARTMENTS[0],
    semester: SEMESTERS[3],
    status: 'active' as 'active' | 'suspended',
  });

  // Confirmation delete modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'exam' | 'question' | 'student';
    id: number;
    label: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [ov, ex, st, rs] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminExams(),
        api.getAdminStudents(),
        api.getAdminResults(),
      ]);
      setOverview(ov);
      setExams(ex.exams);
      setStudents(st.students);
      setResults(rs.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin workspace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function openQuestionManager(exam: AdminExam) {
    setSelectedExamForQuestions(exam);
    setLoadingQuestions(true);
    setError(null);
    try {
      const data = await api.getExamQuestions(exam.id);
      setQuestions(data.questions);
      setSelectedExamForQuestions({ ...exam, ...data.exam });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load exam questions');
    } finally {
      setLoadingQuestions(false);
    }
  }

  function openCreateExamModal() {
    setEditingExam(null);
    setExamForm({
      title: '',
      subject_code: '',
      department: DEPARTMENTS[0],
      description: '',
      duration_minutes: 20,
      total_marks: 40,
      pass_percentage: 40,
      status: 'available',
      scheduled_date: new Date().toISOString().slice(0, 10),
    });
    setExamModalOpen(true);
  }

  function openEditExamModal(exam: AdminExam) {
    setEditingExam(exam);
    setExamForm({
      title: exam.title,
      subject_code: exam.subject_code,
      department: exam.department,
      description: exam.description,
      duration_minutes: exam.duration_minutes,
      total_marks: exam.total_marks,
      pass_percentage: exam.pass_percentage,
      status: exam.status,
      scheduled_date: exam.scheduled_date,
    });
    setExamModalOpen(true);
  }

  async function handleSaveExam(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingExam) {
        await api.updateExam(editingExam.id, examForm);
      } else {
        await api.createExam(examForm);
      }
      setExamModalOpen(false);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save examination');
    } finally {
      setSaving(false);
    }
  }

  function openAddQuestionModal() {
    setEditingQuestion(null);
    setQuestionForm({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      marks: 4,
    });
    setQuestionModalOpen(true);
  }

  function openEditQuestionModal(q: AdminQuestion) {
    setEditingQuestion(q);
    setQuestionForm({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      marks: q.marks,
    });
    setQuestionModalOpen(true);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedExamForQuestions) return;
    setSaving(true);
    setError(null);
    try {
      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, questionForm);
      } else {
        await api.addQuestion(selectedExamForQuestions.id, questionForm);
      }
      setQuestionModalOpen(false);
      await openQuestionManager(selectedExamForQuestions);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save question');
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncExamMarksToSum() {
    if (!selectedExamForQuestions) return;
    const sum = questions.reduce((acc, q) => acc + q.marks, 0);
    if (sum <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateExam(selectedExamForQuestions.id, {
        title: selectedExamForQuestions.title,
        subject_code: selectedExamForQuestions.subject_code,
        department: selectedExamForQuestions.department,
        description: selectedExamForQuestions.description,
        duration_minutes: selectedExamForQuestions.duration_minutes,
        total_marks: sum,
        pass_percentage: selectedExamForQuestions.pass_percentage,
        status: selectedExamForQuestions.status,
        scheduled_date: selectedExamForQuestions.scheduled_date,
      });
      await openQuestionManager(selectedExamForQuestions);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update total marks');
    } finally {
      setSaving(false);
    }
  }

  function openEditStudentModal(student: AdminStudent) {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      department: student.department,
      semester: student.semester,
      status: student.status,
    });
  }

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateStudent(editingStudent.id, studentForm);
      setEditingStudent(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update student');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setError(null);
    try {
      if (deleteTarget.type === 'exam') {
        await api.deleteExam(deleteTarget.id);
        if (selectedExamForQuestions?.id === deleteTarget.id) {
          setSelectedExamForQuestions(null);
        }
      } else if (deleteTarget.type === 'question') {
        await api.deleteQuestion(deleteTarget.id);
        if (selectedExamForQuestions) {
          await openQuestionManager(selectedExamForQuestions);
        }
      } else if (deleteTarget.type === 'student') {
        await api.deleteStudent(deleteTarget.id);
      }
      setDeleteTarget(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete action failed');
    } finally {
      setSaving(false);
    }
  }

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.student_id_code || '').toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const filteredResults = useMemo(() => {
    const q = resultSearch.trim().toLowerCase();
    return results.filter((r) => {
      if (resultExamFilter !== 'all' && String(r.exam_id) !== resultExamFilter) return false;
      if (!q) return true;
      return (
        r.student_name.toLowerCase().includes(q) ||
        r.student_email.toLowerCase().includes(q) ||
        (r.student_id_code || '').toLowerCase().includes(q) ||
        r.exam_title.toLowerCase().includes(q) ||
        r.subject_code.toLowerCase().includes(q)
      );
    });
  }, [results, resultSearch, resultExamFilter]);

  const questionMarksSum = useMemo(
    () => questions.reduce((sum, q) => sum + q.marks, 0),
    [questions]
  );

  if (loading && !overview) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Admin Sub-Navigation Header */}
      <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold text-blue-700">Administrator Console</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
            Examination & Student Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'exams', label: 'Examinations' },
              { id: 'students', label: 'Students' },
              { id: 'results', label: 'All Results' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedExamForQuestions(null);
                onChangeTab(tab.id);
              }}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && overview && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Total Examinations</span>
                <BookOpen className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
                {overview.stats.totalExams}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Question Bank</span>
                <ClipboardList className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
                {overview.stats.totalQuestions}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Registered Students</span>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
                {overview.stats.totalStudents}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Submissions · Pass Rate</span>
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
                {overview.stats.totalSubmissions}{' '}
                <span className="text-base font-semibold text-emerald-700">
                  ({overview.stats.passRate}%)
                </span>
              </p>
            </div>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  Recent Examination Submissions
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Latest graded student attempts across all active assessments.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onChangeTab('exams');
                    openCreateExamModal();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  <FilePlus2 className="h-4 w-4" />
                  Create Exam
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTab('results')}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                >
                  View All Results
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {overview.recentResults.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                No student examination submissions recorded yet.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-3 pr-4">Student</th>
                      <th className="px-4 py-3">Examination</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3 text-right">Percentage</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="py-3 pl-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {overview.recentResults.map((row) => {
                      const isPassed = Boolean(row.passed);
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="py-3 pr-4">
                            <div className="font-semibold text-slate-900">{row.student_name}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {row.student_id_code || 'Student'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">{row.exam_title}</div>
                            <div className="text-xs text-slate-500">{row.subject_code}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                            {row.obtained_marks} / {row.total_marks}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {row.percentage}%
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                isPassed ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {isPassed ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              {isPassed ? 'Passed' : 'Failed'}
                            </span>
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <button
                              type="button"
                              onClick={() => onViewResult(row.id)}
                              className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                            >
                              Scorecard
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </motion.div>
      )}

      {/* EXAMINATIONS & QUESTION BANK TAB */}
      {activeTab === 'exams' && !selectedExamForQuestions && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Examinations</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Create examinations, configure duration and total marks, and manage MCQ question
                banks.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateExamModal}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Examination
            </button>
          </div>

          {exams.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">No examinations created yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-blue-700">
                        {exam.subject_code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{exam.department}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{exam.duration_minutes} mins</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{exam.total_marks} Marks</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{exam.question_count} Questions</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{exam.submission_count} Submissions</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold capitalize ${
                          exam.status === 'available'
                            ? 'text-emerald-700'
                            : exam.status === 'upcoming'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {exam.status}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
                      {exam.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{exam.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openQuestionManager(exam)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap cursor-pointer"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Manage Questions ({exam.question_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditExamModal(exam)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ type: 'exam', id: exam.id, label: exam.title })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* QUESTION BANK SUB-VIEW FOR SELECTED EXAM */}
      {activeTab === 'exams' && selectedExamForQuestions && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
            <div>
              <button
                type="button"
                onClick={() => setSelectedExamForQuestions(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to All Examinations
              </button>
              <h2 className="mt-2 font-display text-xl font-bold text-slate-900">
                {selectedExamForQuestions.title} — Questions
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-blue-700">
                  {selectedExamForQuestions.subject_code}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {selectedExamForQuestions.duration_minutes} mins
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Configured Total Marks: {selectedExamForQuestions.total_marks}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Question Marks Sum: {questionMarksSum}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {questionMarksSum > 0 &&
                questionMarksSum !== selectedExamForQuestions.total_marks && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSyncExamMarksToSum}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 whitespace-nowrap cursor-pointer"
                  >
                    Set Exam Total to {questionMarksSum} Marks
                  </button>
                )}
              <button
                type="button"
                onClick={openAddQuestionModal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </button>
            </div>
          </div>

          {loadingQuestions ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                No questions added to this examination yet.
              </p>
              <button
                type="button"
                onClick={openAddQuestionModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add First Question
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {questions.map((q, idx) => (
                <div key={q.id} className="py-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-blue-700 tabular-nums">
                          Q{idx + 1}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{q.marks} Marks</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-700">
                          Correct Answer: Option {q.correct_option}
                        </span>
                      </div>
                      <p className="mt-1.5 font-display text-base font-semibold text-slate-900">
                        {q.question_text}
                      </p>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        {(
                          [
                            ['A', q.option_a],
                            ['B', q.option_b],
                            ['C', q.option_c],
                            ['D', q.option_d],
                          ] as const
                        ).map(([key, text]) => (
                          <div
                            key={key}
                            className={`rounded-lg border px-3 py-2 ${
                              q.correct_option === key
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-medium'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                          >
                            <span className="font-mono font-semibold mr-2">{key}.</span>
                            {text}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditQuestionModal(q)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'question',
                            id: q.id,
                            label: `Question ${idx + 1}`,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 whitespace-nowrap cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'students' && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Student Directory</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Manage registered student profiles, departments, and account access.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-64"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No registered students found.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Student</th>
                    <th className="px-4 py-3">Department & Semester</th>
                    <th className="px-4 py-3 text-right">Exams</th>
                    <th className="px-4 py-3 text-right">Avg Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="py-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStudents.map((stu) => (
                    <tr key={stu.id} className="hover:bg-slate-50/80">
                      <td className="py-3.5 pr-4">
                        <div className="font-semibold text-slate-900">{stu.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono text-blue-700">
                            {stu.student_id_code || 'STU'}
                          </span>{' '}
                          · {stu.email}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        <div>{stu.department}</div>
                        <div className="text-xs text-slate-500">{stu.semester}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        {stu.exams_taken}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {stu.average_score !== null ? `${stu.average_score}%` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            stu.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {stu.status}
                        </span>
                      </td>
                      <td className="py-3.5 pl-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditStudentModal(stu)}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ type: 'student', id: stu.id, label: stu.name })
                            }
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ALL RESULTS TAB */}
      {activeTab === 'results' && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                All Student Examination Results
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Complete graded ledger across every student and examination.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={resultSearch}
                  onChange={(e) => setResultSearch(e.target.value)}
                  placeholder="Search student or exam..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-56"
                />
              </div>

              <select
                value={resultExamFilter}
                onChange={(e) => setResultExamFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Examinations</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={String(ex.id)}>
                    {ex.subject_code} — {ex.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredResults.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">
              No examination results match your filters.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Student</th>
                    <th className="px-4 py-3">Examination</th>
                    <th className="px-4 py-3 text-right">Correct / Wrong</th>
                    <th className="px-4 py-3 text-right">Marks</th>
                    <th className="px-4 py-3 text-right">Percentage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="py-3 pl-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredResults.map((res) => {
                    const isPassed = Boolean(res.passed);
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4">
                          <div className="font-semibold text-slate-900">{res.student_name}</div>
                          <div className="text-xs text-slate-500">
                            {res.student_id_code || 'STU'} · {res.student_department}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-slate-900">{res.exam_title}</div>
                          <div className="text-xs text-slate-500">
                            {res.subject_code} · {new Date(res.submitted_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                          <span className="text-emerald-700">{res.correct_answers}</span> /{' '}
                          <span className="text-red-700">{res.wrong_answers}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-900">
                          {res.obtained_marks} / {res.total_marks}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {res.percentage}%
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              isPassed ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isPassed ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            {isPassed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <button
                            type="button"
                            onClick={() => onViewResult(res.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
                          >
                            Scorecard
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* CREATE / EDIT EXAM MODAL */}
      {examModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingExam ? 'Edit Examination' : 'Create New Examination'}
              </h2>
              <button
                type="button"
                onClick={() => setExamModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Examination title
                </label>
                <input
                  type="text"
                  required
                  value={examForm.title}
                  onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Computer Networks Final Assessment"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Subject code</label>
                  <input
                    type="text"
                    required
                    value={examForm.subject_code}
                    onChange={(e) => setExamForm((f) => ({ ...f, subject_code: e.target.value }))}
                    placeholder="e.g. CS-405"
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Department</label>
                  <select
                    value={examForm.department}
                    onChange={(e) => setExamForm((f) => ({ ...f, department: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={examForm.description}
                  onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Topics covered and brief assessment instructions"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    required
                    value={examForm.duration_minutes}
                    onChange={(e) =>
                      setExamForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Total marks</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={examForm.total_marks}
                    onChange={(e) =>
                      setExamForm((f) => ({ ...f, total_marks: Number(e.target.value) }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Pass %</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={examForm.pass_percentage}
                    onChange={(e) =>
                      setExamForm((f) => ({ ...f, pass_percentage: Number(e.target.value) }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={examForm.status}
                    onChange={(e) =>
                      setExamForm((f) => ({
                        ...f,
                        status: e.target.value as 'available' | 'upcoming' | 'archived',
                      }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="available">Available (Open to Students)</option>
                    <option value="upcoming">Upcoming (Scheduled)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Scheduled date</label>
                  <input
                    type="date"
                    required
                    value={examForm.scheduled_date}
                    onChange={(e) =>
                      setExamForm((f) => ({ ...f, scheduled_date: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingExam ? 'Save Changes' : 'Create Examination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT QUESTION MODAL */}
      {questionModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingQuestion ? 'Edit Question' : 'Add MCQ Question'}
              </h2>
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Question text</label>
                <textarea
                  rows={3}
                  required
                  value={questionForm.question_text}
                  onChange={(e) =>
                    setQuestionForm((f) => ({ ...f, question_text: e.target.value }))
                  }
                  placeholder="Enter the multiple-choice question prompt..."
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Option A</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_a}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, option_a: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Option B</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_b}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, option_b: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Option C</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_c}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, option_c: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Option D</label>
                  <input
                    type="text"
                    required
                    value={questionForm.option_d}
                    onChange={(e) => setQuestionForm((f) => ({ ...f, option_d: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Correct option
                  </label>
                  <select
                    value={questionForm.correct_option}
                    onChange={(e) =>
                      setQuestionForm((f) => ({
                        ...f,
                        correct_option: e.target.value as 'A' | 'B' | 'C' | 'D',
                      }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Marks</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={questionForm.marks}
                    onChange={(e) =>
                      setQuestionForm((f) => ({ ...f, marks: Number(e.target.value) }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingQuestion ? 'Save Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Edit Student Details
              </h2>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Full name</label>
                <input
                  type="text"
                  required
                  value={studentForm.name}
                  onChange={(e) => setStudentForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Department</label>
                <select
                  value={studentForm.department}
                  onChange={(e) => setStudentForm((f) => ({ ...f, department: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Semester</label>
                  <select
                    value={studentForm.semester}
                    onChange={(e) => setStudentForm((f) => ({ ...f, semester: e.target.value }))}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {SEMESTERS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Account status</label>
                  <select
                    value={studentForm.status}
                    onChange={(e) =>
                      setStudentForm((f) => ({
                        ...f,
                        status: e.target.value as 'active' | 'suspended',
                      }))
                    }
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-slate-900">Confirm Deletion</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to permanently remove{' '}
              <span className="font-semibold text-slate-900">{deleteTarget.label}</span>? This
              action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
