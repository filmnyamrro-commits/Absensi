import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { firebaseConfig } from '../../firebase';
import {
  addAdminEmailInvite,
  addAdminUser,
  fetchAdminEmailInvites,
  fetchAdmins,
  removeAdminEmailInvite,
  removeAdminUser,
} from '../../services/attendanceService';
import { AdminEmailInvite, AdminUser, BOOTSTRAPPED_ADMIN_EMAIL } from '../../types';

interface SetupGuideViewProps {
  currentUser: User;
}

const STORAGE_RULES_SNIPPET = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }

    match /events/{eventId}/registrations/{registrationId}/photo.jpg {
      allow create: if request.resource != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');

      allow read, delete: if request.auth != null
        && request.auth.token.email is string
        && request.auth.token.email_verified == true
        && (
          request.auth.token.email.lower() == '${BOOTSTRAPPED_ADMIN_EMAIL}'
          || firestore.exists(/databases/${firebaseConfig.firestoreDatabaseId}/documents/admins/$(request.auth.uid))
          || firestore.exists(/databases/${firebaseConfig.firestoreDatabaseId}/documents/adminEmails/$(request.auth.token.email.lower().replace('[^a-z0-9]', '_')))
        );
    }
  }
}`;

export function SetupGuideView({ currentUser }: SetupGuideViewProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [emailInvites, setEmailInvites] = useState<AdminEmailInvite[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitingEmail, setInvitingEmail] = useState(false);

  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [addingUid, setAddingUid] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const currentHostname =
    typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyCurrentDomain = async () => {
    if (!currentHostname) return;
    try {
      await navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const [uidList, emailList] = await Promise.all([
        fetchAdmins(),
        fetchAdminEmailInvites(),
      ]);
      setAdmins(uidList);
      setEmailInvites(emailList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleInviteEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Enter a valid Gmail or work email address.');
      return;
    }
    if (inviteName.trim().length < 2) {
      setError('Enter the trainer display name.');
      return;
    }
    setInvitingEmail(true);
    try {
      await addAdminEmailInvite(trimmed, inviteName, currentUser.uid);
      setInviteEmail('');
      setInviteName('');
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authorize email.');
    } finally {
      setInvitingEmail(false);
    }
  };

  const handleRemoveEmailInvite = async (id: string) => {
    try {
      await removeAdminEmailInvite(id);
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove email invite.');
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(newUid.trim())) {
      setError('Enter a valid Firebase Auth UID (alphanumeric characters).');
      return;
    }
    if (!newEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (newName.trim().length < 2) {
      setError('Enter the trainer display name.');
      return;
    }

    setAddingUid(true);
    try {
      await addAdminUser(newUid, newEmail, newName, currentUser.uid);
      setNewUid('');
      setNewEmail('');
      setNewName('');
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add administrator.');
    } finally {
      setAddingUid(false);
    }
  };

  const handleRemoveAdmin = async (uid: string) => {
    try {
      await removeAdminUser(uid);
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove administrator.');
    }
  };

  const handleCopyStorageRules = async () => {
    try {
      await navigator.clipboard.writeText(STORAGE_RULES_SNIPPET);
      setCopiedRules(true);
      setTimeout(() => setCopiedRules(false), 2500);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      {/* Authorize Trainers by Gmail or Work Email */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <Mail className="w-5 h-5 text-blue-700" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Authorized Gmail &amp; Work Emails
            </h2>
            <p className="text-xs text-slate-500">
              Invite trainers by their Gmail or school/work email address. Once they sign in and verify their email, they gain dashboard access automatically.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-950">
          Primary Owner Account:{' '}
          <span className="font-mono font-semibold">{BOOTSTRAPPED_ADMIN_EMAIL}</span>
          <span className="text-slate-500"> · Your UID: </span>
          <span className="font-mono select-all">{currentUser.uid}</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleInviteEmail}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <input
            type="email"
            required
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="trainer@school.sch.id or @gmail.com"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="text"
            required
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Trainer full name"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={invitingEmail}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            {invitingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Authorize Email</span>
          </button>
        </form>

        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {loadingAdmins ? (
            <p className="py-4 text-xs text-slate-500">Loading authorized trainers...</p>
          ) : emailInvites.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">
              No additional Gmail or work email addresses authorized yet.
            </p>
          ) : (
            emailInvites.map((invite) => (
              <div
                key={invite.id}
                className="py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">{invite.displayName}</p>
                  <p className="font-mono text-slate-500 mt-0.5">{invite.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveEmailInvite(invite.id)}
                  className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                  title="Revoke email access"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Authorized UIDs (Optional Direct UID Access) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-blue-700" />
          <h2 className="text-base font-bold text-slate-900">
            Authorized Administrators by Firebase UID
          </h2>
        </div>

        <form
          onSubmit={handleAddAdmin}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <input
            type="text"
            value={newUid}
            onChange={(e) => setNewUid(e.target.value)}
            placeholder="Co-admin Firebase UID"
            className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Trainer email"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Trainer full name"
            className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={addingUid}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            {addingUid ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Add by UID</span>
          </button>
        </form>

        {admins.length > 0 && (
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {admins.map((admin) => (
              <div
                key={admin.uid}
                className="py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {admin.displayName} ({admin.email})
                  </p>
                  <p className="font-mono text-slate-500 mt-0.5">{admin.uid}</p>
                </div>
                {admin.uid !== currentUser.uid && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(admin.uid)}
                    className="p-1.5 text-slate-400 hover:text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                    title="Revoke admin access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connected Firebase Environment */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <Database className="w-5 h-5 text-blue-700" />
          <h2 className="text-lg font-bold text-slate-900">
            Firebase Configuration &amp; Setup Guide
          </h2>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-6">
          <div>
            <dt className="text-slate-500 font-medium">Firebase Project ID</dt>
            <dd className="font-mono font-semibold text-slate-900 mt-1 break-all">
              {firebaseConfig.projectId}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 font-medium">Firestore Database ID</dt>
            <dd className="font-mono font-semibold text-slate-900 mt-1 break-all">
              {firebaseConfig.firestoreDatabaseId}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 font-medium">Storage Bucket</dt>
            <dd className="font-mono font-semibold text-slate-900 mt-1 break-all">
              {firebaseConfig.storageBucket}
            </dd>
          </div>
        </dl>

        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <div>
            <h3 className="font-bold text-slate-900 mb-1">
              1. Authorized Domains (For Shared Links &amp; Google Sign-In)
            </h3>
            <p className="text-xs text-slate-600 mb-2">
              If trainers open this app from a shared URL or custom domain and see{' '}
              <code className="font-mono text-slate-800">auth/unauthorized-domain</code>, add the domain below under{' '}
              <strong>Authentication → Settings → Authorized domains</strong> in Firebase Console:
            </p>
            {currentHostname && (
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <code className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] text-slate-800 select-all">
                  {currentHostname}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCurrentDomain}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  {copiedDomain ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Domain</span>
                    </>
                  )}
                </button>
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                >
                  <span>Firebase Authorized Domains</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-slate-900 mb-1">
              2. Enable Work Email &amp; Password Sign-In in Firebase Console
            </h3>
            <p className="text-xs text-slate-600">
              Google Sign-In (for Gmail and Google Workspace work emails) is active by default. To allow non-Google work emails via Email &amp; Password sign-in, open the Firebase Console for{' '}
              <span className="font-mono">{firebaseConfig.projectId}</span> →{' '}
              <strong>Authentication → Sign-in method → Add new provider → Email/Password</strong> and turn it on.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <h3 className="font-bold text-slate-900">
                3. Firebase Storage Rules (For Participant Photos)
              </h3>
              <button
                type="button"
                onClick={handleCopyStorageRules}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                {copiedRules ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Copied Rules</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy storage.rules</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-2">
              In the Firebase Console under <strong>Storage → Rules</strong> for project{' '}
              <span className="font-mono">{firebaseConfig.projectId}</span>, ensure Storage is enabled and publish the rules below:
            </p>
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
              {STORAGE_RULES_SNIPPET}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
