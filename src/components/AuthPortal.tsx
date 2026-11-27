import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { api, setAuthToken } from '../api';
import type { BootstrapStatus, ExamItem, User } from '../types';

type AuthMode = 'login' | 'register' | 'admin-setup';

interface AuthPortalProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  activeSection: string;
  onAuthenticated: (user: User) => void;
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

export function AuthPortal({
  mode,
  onChangeMode,
  activeSection,
  onAuthenticated,
}: AuthPortalProps) {
  const [bootstrap, setBootstrap] = useState<BootstrapStatus>({
    adminClaimed: true,
    passcodeConfigured: false,
  });
  const [publicExams, setPublicExams] = useState<ExamItem[]>([]);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState(DEPARTMENTS[0]);
  const [regSemester, setRegSemester] = useState(SEMESTERS[3]);

  // Admin setup form state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminDepartment, setAdminDepartment] = useState('Academic Administration');
  const [adminPassword, setAdminPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getBootstrapStatus()
      .then((status) => {
        setBootstrap(status);
        if (status.adminClaimed && mode === 'admin-setup') {
          onChangeMode('login');
        }
      })
      .catch(() => {});

    api
      .getPublicExams()
      .then((res) => setPublicExams(res.exams))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSection === 'schedule') {
      document.getElementById('exam-schedule')?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeSection === 'guidelines') {
      document.getElementById('exam-guidelines')?.scrollIntoView({ behavior: 'smooth' });
    } else if (activeSection === 'portal') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeSection]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.login({ email: loginEmail, password: loginPassword });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.registerStudent({
        name: regName,
        email: regEmail,
        password: regPassword,
        department: regDepartment,
        semester: regSemester,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.setupAdmin({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        department: adminDepartment,
      });
      setAuthToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initialize administrator account');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      {/* Split Hero: Editorial Overview + Auth Workspace */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
        {/* Left Column: Academic Hero & Photography */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-7"
        >
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-700">
              University Assessment Infrastructure
            </p>
            <h1 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[40px] lg:leading-[1.15] [text-wrap:balance]">
              Conduct timed examinations with precision and instant grading.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Scholaria provides students with a distraction-free MCQ testing environment featuring
              live countdown timers, automatic answer saving, and immediate scorecards while giving
              administrators full control over examinations and student records.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {!heroImgFailed ? (
              <img
                src="/src/assets/images/portal_hero_study_1795791981250.jpg"
                alt="Students completing digital assessments inside a sunlit university study hall"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgFailed(true)}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[16/10] w-full flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-slate-100 p-8 text-center">
                <BookOpen className="h-12 w-12 text-blue-600" />
                <p className="mt-3 font-display text-base font-semibold text-slate-800">
                  Digital Examination Hall
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Timed multiple-choice testing with real-time progress persistence
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column: Interactive Login / Registration / Admin Setup */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 sm:p-8 lg:col-span-5"
        >
          <div>
            {/* Segmented Control for Auth Views */}
            <div
              role="tablist"
              aria-label="Account Access Mode"
              className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setError(null);
                  onChangeMode('login');
                }}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setError(null);
                  onChangeMode('register');
                }}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Student Register
              </button>
              {!bootstrap.adminClaimed && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'admin-setup'}
                  onClick={() => {
                    setError(null);
                    onChangeMode('admin-setup');
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    mode === 'admin-setup'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Admin Setup
                </button>
              )}
            </div>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Sign in to your account
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Enter your registered email and password to open your Student or Admin dashboard.
                  </p>
                </div>

                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-slate-700">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? 'Signing in...' : 'Sign In to Portal'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="mt-6 space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Student Registration
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create your student profile to access available examinations and view results.
                  </p>
                </div>

                <div>
                  <label htmlFor="reg-name" className="block text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-sm font-medium text-slate-700">
                    Academic email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="aarav.sharma@college.edu"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reg-dept"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Department
                    </label>
                    <select
                      id="reg-dept"
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-sem"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Semester
                    </label>
                    <select
                      id="reg-sem"
                      value={regSemester}
                      onChange={(e) => setRegSemester(e.target.value)}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                    >
                      {SEMESTERS.map((sem) => (
                        <option key={sem} value={sem}>
                          {sem}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-pass" className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    id="reg-pass"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="h-4 w-4" />
                  {submitting ? 'Creating account...' : 'Register Student Account'}
                </button>
              </form>
            )}

            {mode === 'admin-setup' && !bootstrap.adminClaimed && (
              <form onSubmit={handleAdminSetup} className="mt-6 space-y-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Initialize Administrator
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    First-run setup: claim the primary administrator account to manage exams,
                    questions, and student records.
                  </p>
                </div>

                <div>
                  <label htmlFor="adm-name" className="block text-sm font-medium text-slate-700">
                    Administrator name
                  </label>
                  <input
                    id="adm-name"
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Dr. Kavita Nair"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label htmlFor="adm-email" className="block text-sm font-medium text-slate-700">
                    Administrator email
                  </label>
                  <input
                    id="adm-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@college.edu"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label htmlFor="adm-dept" className="block text-sm font-medium text-slate-700">
                    Department / Office
                  </label>
                  <input
                    id="adm-dept"
                    type="text"
                    required
                    value={adminDepartment}
                    onChange={(e) => setAdminDepartment(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <div>
                  <label htmlFor="adm-pass" className="block text-sm font-medium text-slate-700">
                    Administrator password
                  </label>
                  <input
                    id="adm-pass"
                    type="password"
                    required
                    minLength={6}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {submitting ? 'Claiming Admin Access...' : 'Claim Administrator Account'}
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
            {mode === 'login' && !bootstrap.adminClaimed ? (
              <div className="flex items-center justify-between gap-2">
                <span>Need to configure the faculty admin account?</span>
                <button
                  type="button"
                  onClick={() => onChangeMode('admin-setup')}
                  className="font-semibold text-blue-700 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Open Admin Setup
                </button>
              </div>
            ) : (
              <span>
                All examination sessions use server-verified timers and automatic progress saving.
              </span>
            )}
          </div>
        </motion.div>
      </section>

      {/* 4-Column Institutional Capabilities Strip */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Clock className="h-5 w-5 text-blue-600" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Synchronized Countdown
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Server-tracked exam timers submit completed responses automatically when time expires.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <CheckCircle2 className="h-5 w-5 text-blue-600" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Continuous Auto-Save
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Every selected MCQ option persists immediately so students never lose progress.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Instant Scorecards
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Automatic calculation of marks, percentages, pass/fail status, and answer review.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h3 className="mt-3 font-display text-base font-semibold text-slate-900">
            Administration Suite
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Create exams, manage question banks, oversee students, and inspect all results.
          </p>
        </div>
      </section>

      {/* Live Public Examination Schedule Preview */}
      <section id="exam-schedule" className="mt-12 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900">
              Current Examination Schedule
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Register or sign in to attempt available assessments or review upcoming exam dates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onChangeMode('register');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Register to Attempt
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {publicExams.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No examinations are currently published.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {publicExams.map((exam) => (
              <div
                key={exam.id}
                className="flex flex-col justify-between gap-4 py-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
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
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
                    {exam.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{exam.description}</p>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <span
                    className={`text-xs font-semibold ${
                      exam.status === 'available' ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {exam.status === 'available'
                      ? 'Open Now'
                      : `Scheduled ${exam.scheduled_date}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeMode('login');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Examination Guidelines */}
      <section
        id="exam-guidelines"
        className="mt-8 rounded-xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <h2 className="font-display text-xl font-bold text-slate-900">
          Candidate Examination Guidelines
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-6 text-sm leading-relaxed text-slate-600 md:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-900">01. Timed Sessions</p>
            <p className="mt-1">
              Each examination displays a live countdown timer. When the timer reaches zero, your
              latest saved responses are submitted automatically for evaluation.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">02. Navigation & Review</p>
            <p className="mt-1">
              Move freely between questions using Previous, Next, or the numbered question navigator
              grid, and modify any selected answer prior to final submission.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">03. Instant Grading</p>
            <p className="mt-1">
              Upon submission, scores, percentages, pass/fail standing, and question-level answer
              keys are generated immediately on your Result Page.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
