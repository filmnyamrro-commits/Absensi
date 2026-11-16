import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  deleteParticipantRegistration,
  downloadParticipantPhotoFile,
  updateParticipantRegistration,
} from '../../services/attendanceService';
import {
  LEVEL_PRESETS,
  ParticipantRegistration,
  SCHOOL_DISTRICTS,
  SchoolDistrict,
} from '../../types';
import { formatRegistrationDate, formatRegistrationTime } from '../../utils/imageUtils';

interface ParticipantDetailModalProps {
  participant: ParticipantRegistration | null;
  photoUrl: string | undefined;
  onClose: () => void;
  onUpdated: () => void;
}

export function ParticipantDetailModal({
  participant,
  photoUrl,
  onClose,
  onUpdated,
}: ParticipantDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [level, setLevel] = useState('');
  const [schoolDistrict, setSchoolDistrict] = useState<SchoolDistrict>(
    'Sekolah Global Mandiri Cibubur'
  );
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (participant) {
      setFullName(participant.fullName);
      setClassName(participant.className);
      setLevel(participant.level);
      setSchoolDistrict(participant.schoolDistrict);
      setEditing(false);
      setConfirmDelete(false);
      setError(null);
    }
  }, [participant]);

  if (!participant) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2 || className.trim().length < 1 || level.trim().length < 2) {
      setError('Please complete all required participant fields.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateParticipantRegistration(participant.eventId, participant.id, {
        fullName,
        className,
        level,
        schoolDistrict,
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update participant.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadParticipantPhotoFile(participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download photo.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteParticipantRegistration(
        participant.eventId,
        participant.id,
        participant.photoStoragePath
      );
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record.');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="participant-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden my-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-slate-500 tabular-nums">
              {participant.participantNumber}
            </p>
            <h2
              id="participant-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Participant Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
            {/* Photo */}
            <div className="sm:col-span-2 space-y-3">
              <div className="aspect-square rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={participant.fullName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <User className="w-10 h-10 mx-auto mb-1" />
                    <span className="text-xs">Photo unavailable</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={downloading}
                onClick={handleDownload}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Photo</span>
              </button>
            </div>

            {/* Metadata / Edit Form */}
            <div className="sm:col-span-3">
              {editing ? (
                <form onSubmit={handleSaveEdit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      maxLength={120}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Class
                      </label>
                      <input
                        type="text"
                        value={className}
                        maxLength={60}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Level
                      </label>
                      <input
                        type="text"
                        list="level-presets-list"
                        value={level}
                        maxLength={60}
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <datalist id="level-presets-list">
                        {LEVEL_PRESETS.map((l) => (
                          <option key={l} value={l} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      School District
                    </label>
                    <select
                      value={schoolDistrict}
                      onChange={(e) => setSchoolDistrict(e.target.value as SchoolDistrict)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {SCHOOL_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                    >
                      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="divide-y divide-slate-100 text-sm">
                  <div className="pb-3">
                    <dt className="text-xs text-slate-500">Full Name</dt>
                    <dd className="text-base font-bold text-slate-900 mt-0.5">
                      {participant.fullName}
                    </dd>
                  </div>
                  <div className="py-3 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs text-slate-500">Class</dt>
                      <dd className="font-medium text-slate-900 mt-0.5">
                        {participant.className}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Level</dt>
                      <dd className="font-medium text-slate-900 mt-0.5">
                        {participant.level}
                      </dd>
                    </div>
                  </div>
                  <div className="py-3">
                    <dt className="text-xs text-slate-500">School District</dt>
                    <dd className="font-medium text-slate-900 mt-0.5">
                      {participant.schoolDistrict}
                    </dd>
                  </div>
                  <div className="py-3 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs text-slate-500">Registration Date</dt>
                      <dd className="font-mono text-xs text-slate-800 tabular-nums mt-0.5">
                        {formatRegistrationDate(participant)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Registration Time</dt>
                      <dd className="font-mono text-xs text-slate-800 tabular-nums mt-0.5">
                        {formatRegistrationTime(participant)}
                      </dd>
                    </div>
                  </div>
                  <div className="pt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attendance documentation consent verified</span>
                  </div>
                </dl>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          {!editing && (
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2.5 w-full justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-medium text-red-900">
                    Permanently delete this attendance record and photo?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                    >
                      {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Record</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
