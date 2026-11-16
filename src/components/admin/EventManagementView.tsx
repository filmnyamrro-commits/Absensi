import React, { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize2,
  Pencil,
  Plus,
  QrCode,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createForumEvent,
  deleteForumEvent,
  updateForumEvent,
} from '../../services/attendanceService';
import { EventStatus, ForumEvent } from '../../types';
import { EventLocationPicker } from '../maps/EventVenueMap';

interface EventManagementViewProps {
  events: ForumEvent[];
  selectedEventId: string | null;
  adminUid: string;
  onSelectEventForAttendance: (eventId: string) => void;
  onOpenRegistrationLink: (eventId: string) => void;
}

export function EventManagementView({
  events,
  selectedEventId,
  adminUid,
  onSelectEventForAttendance,
  onOpenRegistrationLink,
}: EventManagementViewProps) {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ForumEvent | null>(null);
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [location, setLocation] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLat, setLocationLat] = useState<number | undefined>(undefined);
  const [locationLng, setLocationLng] = useState<number | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EventStatus>('Open');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [qrEvent, setQrEvent] = useState<ForumEvent | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const qrCanvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const getShareUrl = (eventId: string) => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?event=${encodeURIComponent(eventId)}`;
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setTitle('');
    setEventDate(new Date().toISOString().slice(0, 10));
    setLocation('');
    setLocationAddress('');
    setLocationLat(undefined);
    setLocationLng(undefined);
    setDescription('');
    setStatus('Open');
    setFormError(null);
    setShowFormModal(true);
  };

  const openEditModal = (evt: ForumEvent) => {
    setEditingEvent(evt);
    setTitle(evt.title);
    setEventDate(evt.eventDate);
    setLocation(evt.location);
    setLocationAddress(evt.locationAddress || '');
    setLocationLat(evt.locationLat);
    setLocationLng(evt.locationLng);
    setDescription(evt.description);
    setStatus(evt.status);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (title.trim().length < 2) {
      setFormError('Event title must be at least 2 characters.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      setFormError('Please select a valid event date.');
      return;
    }
    if (location.trim().length < 2) {
      setFormError('Event location must be at least 2 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editingEvent) {
        await updateForumEvent(editingEvent.id, {
          title,
          eventDate,
          location,
          locationAddress,
          locationLat,
          locationLng,
          description,
          status,
        });
      } else {
        const newId = await createForumEvent(
          {
            title,
            eventDate,
            location,
            locationAddress,
            locationLat,
            locationLng,
            description,
            status,
          },
          adminUid
        );
        onSelectEventForAttendance(newId);
      }
      setShowFormModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (evt: ForumEvent) => {
    setTogglingId(evt.id);
    try {
      const nextStatus: EventStatus = evt.status === 'Open' ? 'Closed' : 'Open';
      await updateForumEvent(evt.id, {
        title: evt.title,
        eventDate: evt.eventDate,
        location: evt.location,
        locationAddress: evt.locationAddress,
        locationLat: evt.locationLat,
        locationLng: evt.locationLng,
        description: evt.description,
        status: nextStatus,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setDeletingId(eventId);
    try {
      await deleteForumEvent(eventId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = async (eventId: string) => {
    const url = getShareUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(eventId);
      setTimeout(() => setCopiedId((prev) => (prev === eventId ? null : prev)), 2500);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleDownloadQrPng = () => {
    if (!qrEvent || !qrCanvasWrapperRef.current) return;
    const canvas = qrCanvasWrapperRef.current.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    const slug =
      qrEvent.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'event';
    a.download = `${slug}-qr-code.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Forum &amp; Workshop Events
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Each event stores its own isolated participant list, photos, and shareable registration QR code.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* Events List */}
      {events.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Calendar className="w-10 h-10 text-blue-700 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            No Events Created Yet
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
            Create your first seminar, workshop, or training session to generate a participant registration link and QR code.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Event</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {events.map((evt) => {
            const isSelected = evt.id === selectedEventId;
            const isOpen = evt.status === 'Open';
            const isConfirmingDelete = confirmDeleteId === evt.id;

            return (
              <div
                key={evt.id}
                className={`bg-white border rounded-xl p-5 sm:p-6 transition-colors ${
                  isSelected ? 'border-blue-600' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Inline Scannable QR Code for Immediate Mobile Sharing */}
                  <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setQrEvent(evt)}
                      className="group relative shrink-0 p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-600 transition-colors cursor-pointer"
                      title="Click to enlarge or download QR code"
                    >
                      <QRCodeSVG
                        value={getShareUrl(evt.id)}
                        size={88}
                        level="M"
                        includeMargin={false}
                      />
                      <span className="sr-only">Enlarge QR code for {evt.title}</span>
                    </button>

                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold">
                        <span
                          className={
                            isOpen ? 'text-emerald-700' : 'text-red-700'
                          }
                        >
                          {isOpen ? 'Open for Registration' : 'Registration Closed'}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {evt.eventDate}
                        </span>
                        {isSelected && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="text-blue-700">Selected in Dashboard</span>
                          </>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {evt.title}
                      </h3>

                      <div className="flex items-start gap-1.5 text-xs text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {evt.location}
                          {evt.locationAddress ? ` — ${evt.locationAddress}` : ''}
                        </span>
                      </div>

                      {evt.description && (
                        <p className="text-sm text-slate-600 leading-relaxed pt-0.5">
                          {evt.description}
                        </p>
                      )}

                      {/* Direct Unique Registration URL Bar */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        <code className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md font-mono text-[11px] text-slate-600 truncate max-w-full sm:max-w-md select-all">
                          {getShareUrl(evt.id)}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyLink(evt.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-md whitespace-nowrap cursor-pointer"
                        >
                          {copiedId === evt.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span className="text-emerald-700">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrEvent(evt)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Enlarge QR</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectEventForAttendance(evt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5 text-blue-700" />
                      <span>View Attendance</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrEvent(evt)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 whitespace-nowrap cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Share QR</span>
                    </button>

                    <button
                      type="button"
                      disabled={togglingId === evt.id}
                      onClick={() => handleToggleStatus(evt)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      {togglingId === evt.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      <span>{isOpen ? 'Close Reg.' : 'Reopen Reg.'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(evt)}
                      className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg cursor-pointer"
                      title="Edit event"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteId(isConfirmingDelete ? null : evt.id)
                      }
                      className="p-2 border border-slate-200 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {isConfirmingDelete && (
                  <div className="mt-4 pt-3 border-t border-red-100 flex flex-wrap items-center justify-between gap-3 bg-red-50 px-4 py-2.5 rounded-lg">
                    <span className="text-xs font-medium text-red-900">
                      Delete "{evt.title}" and all of its attendance records and photos?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === evt.id}
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 cursor-pointer"
                      >
                        {deletingId === evt.id && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        <span>Delete Event</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Edit Event' : 'Create Forum Event'}
              </h3>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Event Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. SGM Annual Curriculum Innovation Workshop"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Event Date <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Registration Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as EventStatus)}
                    className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <EventLocationPicker
                locationValue={location}
                locationAddress={locationAddress}
                lat={locationLat}
                lng={locationLng}
                onLocationTextChange={setLocation}
                onVenueSelected={(selection) => {
                  if (!selection) {
                    setLocationAddress('');
                    setLocationLat(undefined);
                    setLocationLng(undefined);
                    return;
                  }
                  if (!location.trim()) {
                    setLocation(selection.locationName);
                  }
                  setLocationAddress(selection.locationAddress);
                  setLocationLat(selection.lat);
                  setLocationLng(selection.lng);
                }}
              />

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Event Description
                </label>
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief agenda, speaker details, or participant instructions..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingEvent ? 'Save Changes' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code & Registration Link Modal */}
      {qrEvent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  Participant Check-In QR &amp; Link
                </h3>
                <p className="text-xs text-slate-500 truncate">{qrEvent.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setQrEvent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              <div className="inline-block p-4 bg-white border border-slate-200 rounded-xl">
                <QRCodeSVG
                  value={getShareUrl(qrEvent.id)}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Hidden high-res canvas for crisp PNG download */}
              <div ref={qrCanvasWrapperRef} className="hidden">
                <QRCodeCanvas
                  value={getShareUrl(qrEvent.id)}
                  size={600}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="text-left">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Direct Registration Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl(qrEvent.id)}
                    className="flex-1 px-3 py-2 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(qrEvent.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 shrink-0 cursor-pointer"
                  >
                    {copiedId === qrEvent.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const id = qrEvent.id;
                    setQrEvent(null);
                    onOpenRegistrationLink(id);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Form</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
