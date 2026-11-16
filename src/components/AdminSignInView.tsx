import { useState } from 'react';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { AlertCircle, ArrowLeft, Loader2, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface AdminSignInViewProps {
  currentUser: User | null;
  authChecked: boolean;
  isAuthorizedAdmin: boolean;
  onBackToRegistration: () => void;
}

export function AdminSignInView({
  currentUser,
  authChecked,
  isAuthorizedAdmin,
  onBackToRegistration,
}: AdminSignInViewProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in window was closed before completing authentication.');
      } else if (code === 'auth/popup-blocked') {
        setError(
          'Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to sign in with Google. Please try again.'
        );
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
          <Lock className="w-5 h-5 text-blue-700" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Trainer &amp; Administrator Sign In
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Attendance dashboards, participant photos, exports, and event controls are restricted to authorized Sekolah Global Mandiri administrators.
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {authChecked && currentUser && !isAuthorizedAdmin ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-950">
              <p className="font-semibold mb-1">Access Not Authorized</p>
              <p className="text-xs text-amber-900 leading-relaxed">
                Signed in as <span className="font-mono font-medium">{currentUser.email}</span>, which is not listed as an administrator. Ask the primary administrator to grant access to your UID:
              </p>
              <p className="mt-2 px-2.5 py-1.5 bg-white border border-amber-200 rounded font-mono text-xs text-slate-800 break-all select-all">
                {currentUser.uid}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out &amp; Try Another Account
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={signingIn}
            onClick={handleGoogleSignIn}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 cursor-pointer"
          >
            {signingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Account...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In with Google</span>
              </>
            )}
          </button>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100">
          <button
            type="button"
            onClick={onBackToRegistration}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Participant Registration
          </button>
        </div>
      </div>
    </div>
  );
}
