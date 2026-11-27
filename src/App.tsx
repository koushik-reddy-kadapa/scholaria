import { useEffect, useState } from 'react';
import { api, setAuthToken } from './api';
import { AdminDashboard, type AdminTab } from './components/AdminDashboard';
import { AuthPortal } from './components/AuthPortal';
import { ExamWorkspace } from './components/ExamWorkspace';
import { ResultPage } from './components/ResultPage';
import { StudentDashboard } from './components/StudentDashboard';
import { TopNav, type NavItem } from './components/TopNav';
import type { User } from './types';

type AppView =
  | { name: 'auth' }
  | { name: 'student'; tab: 'overview' | 'exams' | 'results' }
  | { name: 'admin'; tab: AdminTab }
  | { name: 'exam'; attemptId: number }
  | { name: 'result'; attemptId: number; returnTo: 'student' | 'admin' };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'admin-setup'>('login');
  const [publicSection, setPublicSection] = useState('portal');
  const [view, setView] = useState<AppView>({ name: 'auth' });

  useEffect(() => {
    api
      .getMe()
      .then((res) => {
        setUser(res.user);
        setView(
          res.user.role === 'admin'
            ? { name: 'admin', tab: 'overview' }
            : { name: 'student', tab: 'overview' }
        );
      })
      .catch(() => {
        setUser(null);
        setView({ name: 'auth' });
      })
      .finally(() => {
        setInitializing(false);
      });
  }, []);

  function handleAuthenticated(authedUser: User) {
    setUser(authedUser);
    setView(
      authedUser.role === 'admin'
        ? { name: 'admin', tab: 'overview' }
        : { name: 'student', tab: 'overview' }
    );
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setAuthMode('login');
    setView({ name: 'auth' });
  }

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">Loading Scholaria Portal...</p>
        </div>
      </div>
    );
  }

  // Distraction-free exam mode hides the global top bar
  if (view.name === 'exam') {
    return (
      <ExamWorkspace
        attemptId={view.attemptId}
        onComplete={(resultId) =>
          setView({
            name: 'result',
            attemptId: resultId,
            returnTo: user?.role === 'admin' ? 'admin' : 'student',
          })
        }
        onExit={() =>
          setView(
            user?.role === 'admin'
              ? { name: 'admin', tab: 'overview' }
              : { name: 'student', tab: 'overview' }
          )
        }
      />
    );
  }

  let navItems: NavItem[] = [];
  let activeNav = '';
  let primaryActionLabel = 'Register';
  let onPrimaryAction = () => {};
  let onSelectNav = (_id: string) => {};

  if (!user) {
    navItems = [
      { id: 'portal', label: 'Portal' },
      { id: 'schedule', label: 'Schedule' },
      { id: 'guidelines', label: 'Guidelines' },
      { id: 'signin', label: 'Sign In' },
    ];
    activeNav = publicSection;
    primaryActionLabel = 'Register';
    onPrimaryAction = () => {
      setAuthMode('register');
      setPublicSection('portal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    onSelectNav = (id: string) => {
      if (id === 'signin') {
        setAuthMode('login');
        setPublicSection('portal');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setPublicSection(id);
      }
    };
  } else if (user.role === 'admin') {
    navItems = [
      { id: 'overview', label: 'Overview' },
      { id: 'exams', label: 'Examinations' },
      { id: 'students', label: 'Students' },
      { id: 'results', label: 'Results' },
    ];
    activeNav = view.name === 'admin' ? view.tab : 'results';
    primaryActionLabel = 'Logout';
    onPrimaryAction = handleLogout;
    onSelectNav = (id: string) => {
      setView({ name: 'admin', tab: id as AdminTab });
    };
  } else {
    navItems = [
      { id: 'overview', label: 'Overview' },
      { id: 'exams', label: 'Examinations' },
      { id: 'results', label: 'Results' },
    ];
    activeNav = view.name === 'student' ? view.tab : 'results';
    primaryActionLabel = 'Logout';
    onPrimaryAction = handleLogout;
    onSelectNav = (id: string) => {
      setView({ name: 'student', tab: id as 'overview' | 'exams' | 'results' });
    };
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <TopNav
        user={user}
        navItems={navItems}
        activeNav={activeNav}
        onSelectNav={onSelectNav}
        primaryActionLabel={primaryActionLabel}
        onPrimaryAction={onPrimaryAction}
      />

      <div className="flex-1">
        {view.name === 'auth' && (
          <AuthPortal
            mode={authMode}
            onChangeMode={setAuthMode}
            activeSection={publicSection}
            onAuthenticated={handleAuthenticated}
          />
        )}

        {view.name === 'student' && (
          <StudentDashboard
            activeTab={view.tab}
            onChangeTab={(tab) =>
              setView({ name: 'student', tab: tab as 'overview' | 'exams' | 'results' })
            }
            onStartAttempt={(attemptId) => setView({ name: 'exam', attemptId })}
            onViewResult={(attemptId) =>
              setView({ name: 'result', attemptId, returnTo: 'student' })
            }
          />
        )}

        {view.name === 'admin' && (
          <AdminDashboard
            activeTab={view.tab}
            onChangeTab={(tab) => setView({ name: 'admin', tab })}
            onViewResult={(attemptId) =>
              setView({ name: 'result', attemptId, returnTo: 'admin' })
            }
          />
        )}

        {view.name === 'result' && (
          <ResultPage
            attemptId={view.attemptId}
            backLabel={
              view.returnTo === 'admin' ? 'Back to Admin Console' : 'Back to Student Dashboard'
            }
            onBack={() =>
              setView(
                view.returnTo === 'admin'
                  ? { name: 'admin', tab: 'results' }
                  : { name: 'student', tab: 'results' }
              )
            }
          />
        )}
      </div>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <span>Scholaria Online Examination Portal · Academic Assessment System</span>
          <span>Timed Assessments · Automatic Grading · Verified Scorecards</span>
        </div>
      </footer>
    </div>
  );
}
