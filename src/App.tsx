import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Lock, ShieldCheck } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminSignInView } from './components/AdminSignInView';
import { BrandMark } from './components/BrandMark';
import { RegistrationPage } from './components/RegistrationPage';
import { auth } from './firebase';
import { verifyUserIsAdmin } from './services/attendanceService';

type AppRoute = 'register' | 'admin';

function readEventParamFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const evt = params.get('event');
  return evt && evt.trim().length > 0 ? evt.trim() : null;
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>('register');
  const [requestedEventId, setRequestedEventId] = useState<string | null>(() =>
    readEventParamFromUrl()
  );

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setRequestedEventId(readEventParamFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const allowed = await verifyUserIsAdmin(user);
          setIsAuthorizedAdmin(allowed);
        } catch {
          setIsAuthorizedAdmin(false);
        }
      } else {
        setIsAuthorizedAdmin(false);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  const navigateToRegistration = (eventId?: string) => {
    const url = new URL(window.location.href);
    if (eventId) {
      url.searchParams.set('event', eventId);
      setRequestedEventId(eventId);
    } else if (eventId === undefined) {
      // Keep current event param if none explicitly cleared
    }
    window.history.pushState({}, '', url.toString());
    setRoute('register');
  };

  const handleClearRequestedEvent = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('event');
    window.history.pushState({}, '', url.toString());
    setRequestedEventId(null);
    setRoute('register');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateToRegistration()}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BrandMark className="w-8 h-8 shrink-0" />
            <span className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900">
              SGM Forum Attendance
            </span>
          </button>

          {/* Zone 2: Concise Navigation Links (Strictly isolated per role) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => navigateToRegistration()}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                route === 'register'
                  ? 'text-blue-700 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Participant Check-In
            </button>
            {isAuthorizedAdmin && (
              <button
                type="button"
                onClick={() => setRoute('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  route === 'admin'
                    ? 'text-blue-700 font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                Trainer Dashboard
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            {route === 'admin' && isAuthorizedAdmin ? (
              <button
                type="button"
                onClick={() => navigateToRegistration()}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Check-In Form
              </button>
            ) : isAuthorizedAdmin ? (
              <button
                type="button"
                onClick={() => setRoute('admin')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRoute('admin')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>Trainer Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1">
        {route === 'register' ? (
          <RegistrationPage
            requestedEventId={requestedEventId}
            onClearRequestedEvent={handleClearRequestedEvent}
          />
        ) : authChecked && currentUser && isAuthorizedAdmin ? (
          <AdminDashboard
            currentUser={currentUser}
            onOpenRegistrationForm={(eventId) => navigateToRegistration(eventId)}
          />
        ) : (
          <AdminSignInView
            currentUser={currentUser}
            authChecked={authChecked}
            isAuthorizedAdmin={isAuthorizedAdmin}
            onBackToRegistration={() => setRoute('register')}
          />
        )}
      </div>

      {/* Quiet Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 sm:px-6 lg:px-8 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Sekolah Global Mandiri · Forum Attendance System</span>
          <span>Cibubur · Jakarta · Palembang</span>
        </div>
      </footer>
    </div>
  );
}
