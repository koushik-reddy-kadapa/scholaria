import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Send,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ExamQuestion } from '../types';

interface ExamWorkspaceProps {
  attemptId: number;
  onComplete: (resultId: number) => void;
  onExit: () => void;
}

function formatTimer(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function ExamWorkspace({ attemptId, onComplete, onExit }: ExamWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<{
    id: number;
    title: string;
    subject_code: string;
    department: string;
    duration_minutes: number;
    total_marks: number;
    pass_percentage: number;
  } | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const expiresAtMsRef = useRef<number>(0);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getAttemptTake(attemptId)
      .then((data) => {
        if (cancelled) return;
        if (data.completed) {
          onComplete(data.attemptId);
          return;
        }
        setExam(data.exam || null);
        setQuestions(data.questions || []);
        setAnswers(data.answers || {});
        const safeIdx = Math.min(
          Math.max(0, data.currentQuestionIndex || 0),
          Math.max(0, (data.questions?.length || 1) - 1)
        );
        setCurrentIdx(safeIdx);

        const expiryMs = data.expiresAt
          ? new Date(data.expiresAt).getTime()
          : Date.now() + (data.remainingSeconds || 0) * 1000;
        expiresAtMsRef.current = expiryMs;
        setRemainingSeconds(Math.max(0, Math.floor((expiryMs - Date.now()) / 1000)));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load examination');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId, onComplete]);

  const handleSubmit = useCallback(
    async (isAuto: boolean) => {
      if (submitting || autoSubmittedRef.current) return;
      if (isAuto) {
        autoSubmittedRef.current = true;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await api.submitAttempt(attemptId, {
          answers: answersRef.current,
          autoSubmitted: isAuto,
        });
        onComplete(res.resultId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit examination');
        setSubmitting(false);
        if (isAuto) {
          autoSubmittedRef.current = false;
        }
      }
    },
    [attemptId, onComplete, submitting]
  );

  // Accurate countdown timer synced against server expiresAt
  useEffect(() => {
    if (loading || !exam) return;

    const interval = window.setInterval(() => {
      const secsLeft = Math.max(0, Math.floor((expiresAtMsRef.current - Date.now()) / 1000));
      setRemainingSeconds(secsLeft);
      if (secsLeft <= 0 && !autoSubmittedRef.current) {
        window.clearInterval(interval);
        void handleSubmit(true);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [loading, exam, handleSubmit]);

  async function persistProgress(
    questionId: number | undefined,
    selectedOption: 'A' | 'B' | 'C' | 'D' | null | undefined,
    nextIdx: number
  ) {
    setSaveState('saving');
    try {
      const res = await api.saveAnswer(attemptId, {
        questionId,
        selectedOption,
        currentQuestionIndex: nextIdx,
      });
      if (res.completed && res.attemptId) {
        onComplete(res.attemptId);
        return;
      }
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }

  function handleSelectOption(questionId: number, option: 'A' | 'B' | 'C' | 'D') {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: option }));
    void persistProgress(questionId, option, currentIdx);
  }

  function handleClearOption(questionId: number) {
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[String(questionId)];
      return copy;
    });
    void persistProgress(questionId, null, currentIdx);
  }

  function handleNavigate(nextIdx: number) {
    if (nextIdx < 0 || nextIdx >= questions.length) return;
    setCurrentIdx(nextIdx);
    void persistProgress(undefined, undefined, nextIdx);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-8" />
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Unable to Open Examination
          </h2>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;
  const progressPct = Math.round(((currentIdx + 1) / questions.length) * 100);
  const selectedForCurrent = answers[String(currentQuestion.id)] || null;

  const isLowTime = remainingSeconds <= 60;
  const isWarnTime = remainingSeconds > 60 && remainingSeconds <= 300;

  const options: { key: 'A' | 'B' | 'C' | 'D'; text: string }[] = [
    { key: 'A', text: currentQuestion.option_a },
    { key: 'B', text: currentQuestion.option_b },
    { key: 'C', text: currentQuestion.option_c },
    { key: 'D', text: currentQuestion.option_d },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Compact Sticky Exam Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="font-mono font-semibold text-blue-700">{exam.subject_code}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline text-slate-500">
                {saveState === 'saving'
                  ? 'Saving...'
                  : saveState === 'error'
                    ? 'Save retry pending'
                    : 'Progress saved'}
              </span>
            </div>
            <h1 className="truncate font-display text-base font-bold text-slate-900 sm:text-lg">
              {exam.title}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              aria-live="polite"
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums ${
                isLowTime
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : isWarnTime
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-4 w-4" />
              Submit Exam
            </button>
          </div>
        </div>

        {/* Exam Progress Line */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 8 Columns: Active Question Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <span className="font-mono text-sm font-semibold text-blue-700 tabular-nums">
                Question {currentIdx + 1} / {questions.length}
              </span>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {currentQuestion.marks} {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
              </span>
            </div>

            <h2 className="mt-6 font-display text-lg font-semibold leading-relaxed text-slate-900 sm:text-xl">
              {currentQuestion.question_text}
            </h2>

            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Answer options">
              {options.map((opt) => {
                const isSelected = selectedForCurrent === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption(currentQuestion.id, opt.key)}
                    className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : opt.key}
                    </span>
                    <span className="pt-0.5 text-sm leading-relaxed sm:text-base">{opt.text}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => handleNavigate(currentIdx - 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                {selectedForCurrent && (
                  <button
                    type="button"
                    onClick={() => handleClearOption(currentQuestion.id)}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 whitespace-nowrap cursor-pointer"
                  >
                    Clear Selection
                  </button>
                )}
              </div>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => handleNavigate(currentIdx + 1)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap cursor-pointer"
                >
                  Review & Submit
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </section>

          {/* Right 4 Columns: Question Navigator */}
          <aside className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Question Navigator
              </h3>
              <p className="mt-1 text-xs text-slate-500 tabular-nums">
                {answeredCount} answered · {unansweredCount} remaining
              </p>

              <div className="mt-5 grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isAnswered = Boolean(answers[String(q.id)]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => handleNavigate(idx)}
                      aria-label={`Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}`}
                      className={`flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        isCurrent
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : isAnswered
                            ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border border-blue-600 bg-blue-600" />
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border border-blue-200 bg-blue-50" />
                  <span>Answered (Auto-Saved)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded border border-slate-200 bg-white" />
                  <span>Unanswered</span>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
              Answers are saved automatically as you navigate. The exam will auto-submit when the
              countdown reaches 00:00.
            </div>
          </aside>
        </div>
      </main>

      {/* Pre-Submission Confirmation Modal */}
      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="submit-confirm-title" className="font-display text-xl font-bold text-slate-900">
              Submit Examination?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              You have answered{' '}
              <span className="font-semibold tabular-nums text-slate-900">{answeredCount}</span> of{' '}
              <span className="font-semibold tabular-nums text-slate-900">{questions.length}</span>{' '}
              questions.
              {unansweredCount > 0
                ? ` ${unansweredCount} ${unansweredCount === 1 ? 'question remains' : 'questions remain'} unanswered.`
                : ' All questions have been answered.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Once submitted, you cannot change your answers and your score will be calculated
              immediately.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
              >
                Continue Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
