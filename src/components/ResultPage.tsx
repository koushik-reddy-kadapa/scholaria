import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Printer,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { QuestionBreakdown, ResultDetail } from '../types';

interface ResultPageProps {
  attemptId: number;
  onBack: () => void;
  backLabel?: string;
}

export function ResultPage({
  attemptId,
  onBack,
  backLabel = 'Back to Dashboard',
}: ResultPageProps) {
  const [result, setResult] = useState<ResultDetail | null>(null);
  const [breakdown, setBreakdown] = useState<QuestionBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sealFailed, setSealFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getAttemptResult(attemptId)
      .then((data) => {
        if (cancelled) return;
        setResult(data.result);
        setBreakdown(data.breakdown);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load examination result');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </main>
    );
  }

  if (error || !result) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-white p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
            Result Unavailable
          </h2>
          <p className="mt-1 text-sm text-slate-600">{error || 'Result record not found.'}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
          >
            {backLabel}
          </button>
        </div>
      </main>
    );
  }

  const getOptionText = (q: QuestionBreakdown, key: 'A' | 'B' | 'C' | 'D') => {
    if (key === 'A') return q.option_a;
    if (key === 'B') return q.option_b;
    if (key === 'C') return q.option_c;
    return q.option_d;
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Action Header */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          Print Scorecard
        </button>
      </div>

      {/* Formal Academic Scorecard */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <div className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
              {!sealFailed ? (
                <img
                  src="/src/assets/images/academic_crest_seal_1795791981659.jpg"
                  alt="Scholaria Academic Seal"
                  referrerPolicy="no-referrer"
                  onError={() => setSealFailed(true)}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-50">
                  <Award className="h-7 w-7 text-blue-700" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-700">Official Examination Scorecard</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
                {result.exam_title}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {result.subject_code} · {result.exam_department} · Submitted{' '}
                {new Date(result.submitted_at).toLocaleString()}
                {result.auto_submitted ? ' · Auto-submitted on time expiry' : ''}
              </p>
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold shrink-0 ${
              result.passed
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {result.passed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            ) : (
              <XCircle className="h-5 w-5 text-red-700" />
            )}
            <span>{result.passed ? 'Status: PASSED' : 'Status: FAILED'}</span>
          </div>
        </div>

        {/* All 9 Required Result Fields */}
        <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Student Name</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900">
              {result.student_name}
            </p>
            {result.student_id_code && (
              <p className="mt-0.5 font-mono text-xs text-slate-500">{result.student_id_code}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Examination Name</p>
            <p className="mt-1 font-display text-base font-semibold text-slate-900">
              {result.exam_title}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pass Threshold: {result.pass_percentage}%
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Pass or Fail Status</p>
            <p
              className={`mt-1 inline-flex items-center gap-1.5 font-display text-base font-bold ${
                result.passed ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {result.passed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {result.passed ? 'Pass' : 'Fail'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-200 pt-6 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Questions</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {result.total_questions}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Correct Answers</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-emerald-700">
              {result.correct_answers}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Wrong Answers</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-red-700">
              {result.wrong_answers}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Total Marks</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {result.total_marks}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Obtained Marks</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-blue-700">
              {result.obtained_marks}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Percentage</p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900">
              {result.percentage}%
            </p>
          </div>
        </div>
      </motion.section>

      {/* Detailed Answer Key Review */}
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="font-display text-xl font-bold text-slate-900">Question Review</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Compare your selected responses against the verified examination key.
          </p>
        </div>

        <div className="divide-y divide-slate-200">
          {breakdown.map((item, idx) => (
            <div key={item.id} className="py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                  Question {idx + 1} · {item.marks} Marks
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    item.is_correct
                      ? 'text-emerald-700'
                      : item.selected_option
                        ? 'text-red-700'
                        : 'text-slate-500'
                  }`}
                >
                  {item.is_correct ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Correct
                    </>
                  ) : item.selected_option ? (
                    <>
                      <XCircle className="h-3.5 w-3.5" />
                      Incorrect
                    </>
                  ) : (
                    'Unanswered'
                  )}
                </span>
              </div>

              <p className="mt-2 font-display text-base font-semibold text-slate-900">
                {item.question_text}
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-xs font-medium text-slate-500">Your Answer: </span>
                  <span
                    className={`font-medium ${
                      item.is_correct
                        ? 'text-emerald-700'
                        : item.selected_option
                          ? 'text-red-700'
                          : 'text-slate-500'
                    }`}
                  >
                    {item.selected_option
                      ? `${item.selected_option}. ${getOptionText(item, item.selected_option)}`
                      : 'No option selected'}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-medium text-slate-500">Correct Answer: </span>
                  <span className="font-semibold text-emerald-700">
                    {item.correct_option}. {getOptionText(item, item.correct_option)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
