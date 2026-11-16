import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { firebaseConfig } from '../../firebase';
import {
  addAdminUser,
  fetchAdmins,
  removeAdminUser,
} from '../../services/attendanceService';
import { AdminUser, BOOTSTRAPPED_ADMIN_EMAIL } from '../../types';

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
        && request.auth.token.email_verified == true
        && (
          request.auth.token.email == '${BOOTSTRAPPED_ADMIN_EMAIL}'
          || firestore.exists(/databases/${firebaseConfig.firestoreDatabaseId}/documents/admins/$(request.auth.uid))
        );
    }
  }
}`;

export function SetupGuideView({ currentUser }: SetupGuideViewProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const list = await fetchAdmins();
      setAdmins(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

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

    setAdding(true);
    try {
      await addAdminUser(newUid, newEmail, newName, currentUser.uid);
      setNewUid('');
      setNewEmail('');
      setNewName('');
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add administrator.');
    } finally {
      setAdding(false);
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
              1. Cloud Firestore &amp; Authentication (Active)
            </h3>
            <p className="text-xs text-slate-600">
              Firestore security rules are deployed so unauthenticated participants can view only Open events and submit attendance records, while private attendance lists, exports, edits, and deletions are restricted to authenticated administrators.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <h3 className="font-bold text-slate-900">
                2. Firebase Storage Rules (For Participant Photos)
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
              <span className="font-mono">{firebaseConfig.projectId}</span>, ensure Storage is enabled and publish the rules below so participants can upload check-in photos (&lt; 5 MB) while only verified admins can view or delete them:
            </p>
            <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
              {STORAGE_RULES_SNIPPET}
            </pre>
          </div>
        </div>
      </div>

      {/* Authorized Administrators */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-blue-700" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Authorized Administrators
            </h2>
            <p className="text-xs text-slate-500">
              Your signed-in UID:{' '}
              <span className="font-mono text-slate-700 select-all">
                {currentUser.uid}
              </span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-blue-950">
          Primary Owner Account:{' '}
          <span className="font-mono font-semibold">{BOOTSTRAPPED_ADMIN_EMAIL}</span>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleAddAdmin}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1"
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
            disabled={adding}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
          >
            {adding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Add Co-Admin</span>
          </button>
        </form>

        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {loadingAdmins ? (
            <p className="py-4 text-xs text-slate-500">Loading administrator list...</p>
          ) : admins.length === 0 ? (
            <p className="py-4 text-xs text-slate-500">
              No additional co-administrators added yet.
            </p>
          ) : (
            admins.map((admin) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
