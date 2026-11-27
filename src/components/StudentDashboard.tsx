import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  Play,
  Search,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { ExamItem, StudentResultSummary, User } from '../types';

interface StudentDashboardProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  onStartAttempt: (attemptId: number) => void;
  onViewResult: (resultId: number) => void;
}

export function StudentDashboard({
  activeTab,
  onChangeTab,
  onStartAttempt,
  onViewResult,
}: StudentDashboardProps) {
  const [student, setStudent] = useState<User | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingExamId, setStartingExamId] = useState<number | null>(null);

  const [examFilter, setExamFilter] = useState<'all' | 'available' | 'upcoming' | 'completed'>(
    'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStudentDashboard();
      setStudent(data.student);
      setExams(data.exams);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleStartExam(examId: number) {
    setStartingExamId(examId);
    setError(null);
    try {
      const res = await api.startExam(examId);
      onStartAttempt(res.attemptId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start examination');
      setStartingExamId(null);
    }
  }

  const stats = useMemo(() => {
    const availableCount = exams.filter((e) => e.status === 'available').length;
    const upcomingCount = exams.filter((e) => e.status === 'upcoming').length;
    const completedCount = results.length;
    const avgScore =
      results.length > 0
        ? (results.reduce((sum, r) => sum + Number(r.percentage), 0) / results.length).toFixed(1)
        : '0.0';
    return { availableCount, upcomingCount, completedCount, avgScore };
  }, [exams, results]);

  const completedExamIds = useMemo(() => new Set(results.map((r) => r.exam_id)), [results]);

  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exams.filter((exam) => {
      if (examFilter === 'available' && exam.status !== 'available') return false;
      if (examFilter === 'upcoming' && exam.status !== 'upcoming') return false;
      if (examFilter === 'completed' && !completedExamIds.has(exam.id)) return false;
      if (!q) return true;
      return (
        exam.title.toLowerCase().includes(q) ||
        exam.subject_code.toLowerCase().includes(q) ||
        exam.department.toLowerCase().includes(q)
      );
    });
  }, [exams, examFilter, searchQuery, completedExamIds]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
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

      {/* Student Profile Header */}
      {student && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-display text-xl font-bold text-white">
              {student.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Welcome, {student.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {student.student_id_code && (
                  <>
                    <span className="font-mono font-medium text-blue-700">
                      {student.student_id_code}
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{student.department}</span>
                <span aria-hidden="true">·</span>
                <span>{student.semester}</span>
                <span aria-hidden="true">·</span>
                <span>{student.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeTab('exams')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'exams' || activeTab === 'overview'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Examinations
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('results')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              My Results ({results.length})
            </button>
          </div>
        </motion.section>
      )}

      {/* 4-Column KPI Summary */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Available Exams</span>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
            {stats.availableCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Upcoming Exams</span>
            <Calendar className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
            {stats.upcomingCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Completed Attempts</span>
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
            {stats.completedCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Average Percentage</span>
            <Award className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums text-slate-900">
            {stats.avgScore}%
          </p>
        </div>
      </section>

      {/* Examinations Section */}
      {(activeTab === 'overview' || activeTab === 'exams') && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Examinations</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Select an available examination to begin or resume your timed session.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search exams or codes..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none sm:w-56"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(['all', 'available', 'upcoming', 'completed'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setExamFilter(filterKey)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      examFilter === filterKey
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredExams.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                No examinations match the selected filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredExams.map((exam) => {
                const isAvailable = exam.status === 'available';
                const hasResume = Boolean(exam.active_attempt_id);
                const hasCompleted = Boolean(exam.latest_result_id);
                const isStarting = startingExamId === exam.id;

                return (
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
                        <span
                          className={`font-semibold ${
                            isAvailable ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isAvailable ? 'Available' : `Upcoming (${exam.scheduled_date})`}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
                        {exam.title}
                      </h3>
                      <p className="mt-1 max-w-3xl text-sm text-slate-600">{exam.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      {hasCompleted && exam.latest_result_id && (
                        <button
                          type="button"
                          onClick={() => onViewResult(exam.latest_result_id!)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          View Last Result
                        </button>
                      )}

                      {isAvailable ? (
                        <button
                          type="button"
                          disabled={isStarting || exam.question_count === 0}
                          onClick={() => handleStartExam(exam.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="h-4 w-4" />
                          {isStarting
                            ? 'Preparing...'
                            : hasResume
                              ? 'Resume Exam'
                              : hasCompleted
                                ? 'Retake Exam'
                                : 'Start Exam'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
                          <Clock className="h-3.5 w-3.5" />
                          Opens {exam.scheduled_date}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Previous Examination Results Section */}
      {(activeTab === 'overview' || activeTab === 'results') && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Previous Examination Results
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Completed submissions are graded automatically with full scorecards and answer keys.
            </p>
          </div>

          {results.length === 0 ? (
            <div className="py-12 text-center">
              <Award className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                You have not completed any examinations yet.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Start an available examination above to see your evaluated results here.
              </p>
            </div>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Examination</th>
                    <th className="px-4 py-3 text-right">Questions</th>
                    <th className="px-4 py-3 text-right">Marks</th>
                    <th className="px-4 py-3 text-right">Percentage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="py-3 pl-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {results.map((res) => {
                    const isPassed = Boolean(res.passed);
                    return (
                      <tr key={res.id} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pr-4">
                          <div className="font-semibold text-slate-900">{res.exam_title}</div>
                          <div className="text-xs text-slate-500">
                            {res.subject_code} · {res.department}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                          {res.correct_answers}/{res.total_questions} correct
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-slate-900">
                          {res.obtained_marks} / {res.total_marks}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {res.percentage}%
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              isPassed ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {isPassed ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            {isPassed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          {new Date(res.submitted_at).toLocaleDateString()}
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
    </main>
  );
}
