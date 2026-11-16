import React, { useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { auth, firebaseConfig, googleProvider } from '../firebase';

interface AdminSignInViewProps {
  currentUser: User | null;
  authChecked: boolean;
  isAuthorizedAdmin: boolean;
  onAuthRefresh: () => Promise<void>;
  onBackToRegistration: () => void;
}

type EmailMode = 'signin' | 'signup' | 'reset';

export function AdminSignInView({
  currentUser,
  authChecked,
  isAuthorizedAdmin,
  onAuthRefresh,
  onBackToRegistration,
}: AdminSignInViewProps) {
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);
  const alertRef = useRef<HTMLDivElement | null>(null);

  const revealAlert = () => {
    requestAnimationFrame(() => {
      alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const mapFirebaseAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code === 'auth/unauthorized-domain') {
      setUnauthorizedDomainHost(window.location.hostname);
      return `The domain "${window.location.hostname}" is not yet listed in Firebase Authentication Authorized domains.`;
    }
    setUnauthorizedDomainHost(null);
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Sign-in window was closed before completing authentication.';
      case 'auth/popup-blocked':
        return 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method. Try Email Sign In or Google Sign-In.';
      case 'auth/operation-not-allowed':
        return 'This sign-in provider is not yet enabled in Firebase Console. Go to Authentication → Sign-in method and enable Google and Email/Password.';
      case 'auth/invalid-email':
        return 'Please enter a valid Gmail or work email address.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email address or password. You can reset your password or sign in with Google.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email. Switch to Sign In or use Sign In with Google.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/too-many-requests':
        return 'Too many sign-in attempts. Please wait a moment and try again.';
      default:
        return err instanceof Error
          ? err.message
          : 'Authentication failed. Please try again.';
    }
  };

  const handleCopyHostname = async () => {
    if (!unauthorizedDomainHost) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomainHost);
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setUnauthorizedDomainHost(null);
    setSigningInGoogle(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapFirebaseAuthError(err));
      revealAlert();
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setUnauthorizedDomainHost(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid Gmail or work email address.');
      revealAlert();
      return;
    }

    setSubmittingEmail(true);
    try {
      if (emailMode === 'reset') {
        await sendPasswordResetEmail(auth, trimmedEmail);
        setInfoMessage(
          `Password reset link sent to ${trimmedEmail}. Please check your inbox.`
        );
        setEmailMode('signin');
        revealAlert();
      } else if (emailMode === 'signup') {
        if (fullName.trim().length < 2) {
          setError('Please enter your full name (at least 2 characters).');
          setSubmittingEmail(false);
          revealAlert();
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setSubmittingEmail(false);
          revealAlert();
          return;
        }
        const credential = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        try {
          await updateProfile(credential.user, { displayName: fullName.trim() });
        } catch {
          // Non-fatal if display name update fails
        }
        try {
          await sendEmailVerification(credential.user);
          setInfoMessage(
            `Verification email sent to ${trimmedEmail}. Please verify your email before accessing the dashboard.`
          );
        } catch (verifyErr) {
          setInfoMessage(
            `Account created for ${trimmedEmail}. Use "Resend Verification Email" below if you did not receive the verification link.`
          );
          console.warn('Initial verification email failed:', verifyErr);
        }
        revealAlert();
      } else {
        if (!password) {
          setError('Please enter your password.');
          setSubmittingEmail(false);
          revealAlert();
          return;
        }
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
      revealAlert();
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentUser) return;
    setError(null);
    setInfoMessage(null);
    setResendingVerification(true);
    try {
      await sendEmailVerification(currentUser);
      setInfoMessage(
        `A new verification email was sent to ${currentUser.email}. Check your inbox or spam folder.`
      );
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setResendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    setError(null);
    setRefreshingStatus(true);
    try {
      await onAuthRefresh();
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    setInfoMessage(null);
    await signOut(auth);
  };

  const needsEmailVerification =
    authChecked && currentUser && !currentUser.emailVerified;

  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="w-11 h-11 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-5">
          <Lock className="w-5 h-5 text-blue-700" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Trainer &amp; Administrator Sign In
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Both <strong>Gmail</strong> and <strong>work email addresses</strong> are supported. Dashboard access is restricted to authorized Sekolah Global Mandiri trainers.
        </p>

        {error && (
          <div
            ref={alertRef}
            role="alert"
            className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 space-y-2.5"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            {unauthorizedDomainHost && (
              <div className="pt-2 border-t border-red-200/80 space-y-2 text-red-900">
                <p className="leading-relaxed">
                  Add this domain in Firebase Console under{' '}
                  <strong>Authentication → Settings → Authorized domains</strong> for{' '}
                  <span className="font-mono font-semibold">{firebaseConfig.projectId}</span>:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-2.5 py-1.5 bg-white border border-red-200 rounded font-mono text-[11px] text-slate-800 truncate select-all">
                    {unauthorizedDomainHost}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 rounded text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
                  >
                    {copiedHost ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                >
                  <span>Open Firebase Authorized Domains</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}

        {infoMessage && (
          <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {needsEmailVerification ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-950">
              <p className="font-semibold mb-1">Verify Your Email Address</p>
              <p className="text-xs text-blue-900 leading-relaxed">
                Signed in as <span className="font-mono font-medium">{currentUser.email}</span>. Please click the verification link sent to your inbox, then refresh your status below.
              </p>
            </div>

            <button
              type="button"
              disabled={refreshingStatus}
              onClick={handleRefreshVerification}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {refreshingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>I&apos;ve Verified — Refresh Status</span>
            </button>

            <button
              type="button"
              disabled={resendingVerification}
              onClick={handleResendVerification}
              className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              {resendingVerification && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Resend Verification Email</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 text-slate-600 text-xs font-medium hover:text-slate-900 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : authChecked && currentUser && !isAuthorizedAdmin ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-950">
              <p className="font-semibold mb-1">Access Not Authorized</p>
              <p className="text-xs text-amber-900 leading-relaxed">
                Signed in as <span className="font-mono font-medium">{currentUser.email}</span>, which has not been added to the authorized trainers list yet. Ask the primary administrator to authorize your email address or UID:
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
          <div className="space-y-6">
            {/* Google Sign-In (Gmail & Google Workspace work email) */}
            <div>
              <button
                type="button"
                disabled={signingInGoogle || submittingEmail}
                onClick={handleGoogleSignIn}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2.5 px-5 py-3 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-70 cursor-pointer"
              >
                {signingInGoogle ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Continue with Google (Gmail / Workspace)</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative flex items-center">
              <div className="flex-1 border-t border-slate-200" />
              <span className="px-3 text-xs font-medium text-slate-400">
                or use email &amp; password
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Email & Password Form */}
            <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signin');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    emailMode === 'signin'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Email Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode('signup');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    emailMode === 'signup'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {emailMode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ibu Ratna Sari"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gmail or Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.sch.id or name@gmail.com"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {emailMode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    {emailMode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('reset');
                          setError(null);
                        }}
                        className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingEmail || signingInGoogle}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {submittingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>
                  {emailMode === 'reset'
                    ? 'Send Password Reset Link'
                    : emailMode === 'signup'
                    ? 'Create Account with Email'
                    : 'Sign In with Email'}
                </span>
              </button>

              {emailMode === 'signup' && (
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Works with both Gmail and work email addresses. A verification link will be sent to your inbox.
                </p>
              )}

              {emailMode === 'reset' && (
                <button
                  type="button"
                  onClick={() => setEmailMode('signin')}
                  className="w-full text-center text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Back to Email Sign In
                </button>
              )}
            </form>
          </div>
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
