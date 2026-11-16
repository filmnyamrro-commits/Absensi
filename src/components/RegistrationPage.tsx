import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  SwitchCamera,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  DuplicateRegistrationError,
  fetchEventById,
  fetchOpenEvents,
  PhotoUploadError,
  submitParticipantRegistration,
} from '../services/attendanceService';
import {
  ForumEvent,
  LEVEL_PRESETS,
  SCHOOL_DISTRICTS,
  SchoolDistrict,
} from '../types';
import { captureVideoFrame, compressImageFile } from '../utils/imageUtils';

interface RegistrationPageProps {
  requestedEventId: string | null;
  onClearRequestedEvent: () => void;
}

interface ValidationErrors {
  fullName?: string;
  className?: string;
  level?: string;
  schoolDistrict?: string;
  photo?: string;
  consent?: string;
}

export function RegistrationPage({
  requestedEventId,
  onClearRequestedEvent,
}: RegistrationPageProps) {
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [openEvents, setOpenEvents] = useState<ForumEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ForumEvent | null>(null);
  const [notFoundEvent, setNotFoundEvent] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [levelPreset, setLevelPreset] = useState<string>('Primary');
  const [customLevel, setCustomLevel] = useState('');
  const [schoolDistrict, setSchoolDistrict] = useState<SchoolDistrict | ''>('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Photo state
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Submission state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState<string>('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    participantNumber: string;
    fullName: string;
    className: string;
    level: string;
    schoolDistrict: string;
    recordedAtText: string;
    eventTitle: string;
  } | null>(null);

  // Live clock for automatic timestamp visibility
  const [nowText, setNowText] = useState(() =>
    new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowText(
        new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadEvents = async () => {
    setEventsLoading(true);
    setEventsError(null);
    setNotFoundEvent(false);
    try {
      if (requestedEventId) {
        const evt = await fetchEventById(requestedEventId);
        if (!evt) {
          setSelectedEvent(null);
          setNotFoundEvent(true);
        } else {
          setSelectedEvent(evt);
        }
        const openList = await fetchOpenEvents().catch(() => []);
        setOpenEvents(openList);
      } else {
        const openList = await fetchOpenEvents();
        setOpenEvents(openList);
        if (openList.length > 0) {
          setSelectedEvent((prev) =>
            prev && openList.some((e) => e.id === prev.id) ? prev : openList[0]
          );
        } else {
          setSelectedEvent(null);
        }
      }
    } catch (err) {
      console.error(err);
      setEventsError(
        'Unable to load forum sessions right now. Please check your internet connection and try again.'
      );
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedEventId]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async (requestedFacing: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Live camera capture is not supported in this browser. Please use "Upload Photo" instead.'
      );
      return;
    }

    stopCamera();
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: requestedFacing,
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setFacingMode(requestedFacing);
      // Attach stream after video element renders
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        setCameraError(
          'Camera permission was denied. Please allow camera access in your browser settings or use "Upload Photo".'
        );
      } else {
        setCameraError(
          'No accessible camera was found on this device. You can upload a photo from your device instead.'
        );
      }
      setCameraActive(false);
    } finally {
      setCameraStarting(false);
    }
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    try {
      const blob = await captureVideoFrame(videoRef.current);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      const url = URL.createObjectURL(blob);
      setPhotoBlob(blob);
      setPhotoPreviewUrl(url);
      setValidationErrors((prev) => ({ ...prev, photo: undefined }));
      stopCamera();
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to capture photo.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError(null);
    setSubmitError(null);
    stopCamera();

    try {
      const compressed = await compressImageFile(file);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      const url = URL.createObjectURL(compressed);
      setPhotoBlob(compressed);
      setPhotoPreviewUrl(url);
      setValidationErrors((prev) => ({ ...prev, photo: undefined }));
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : 'Unable to process the selected photo.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearSelectedPhoto = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
    setSubmitError(null);
  };

  const effectiveLevel =
    levelPreset === 'Other' ? customLevel.trim() : levelPreset;

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (fullName.trim().length < 2) {
      errors.fullName = 'Please enter your full name (at least 2 characters).';
    }
    if (className.trim().length < 1) {
      errors.className = 'Please enter your class, homeroom, or department.';
    }
    if (effectiveLevel.length < 2) {
      errors.level =
        levelPreset === 'Other'
          ? 'Please specify your level.'
          : 'Please select your school level.';
    }
    if (!schoolDistrict) {
      errors.schoolDistrict = 'Please select your Sekolah Global Mandiri campus.';
    }
    if (!photoBlob) {
      errors.photo = 'Please take or upload a participant photo for attendance documentation.';
    }
    if (!consentAccepted) {
      errors.consent =
        'You must confirm consent to submit your information and photo.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedEvent || selectedEvent.status !== 'Open') {
      setSubmitError('Registration is currently closed for this event.');
      return;
    }

    if (!validateForm() || !photoBlob || !schoolDistrict) {
      return;
    }

    setSubmitting(true);
    setSubmitStage('Uploading photo and recording attendance...');

    try {
      const result = await submitParticipantRegistration({
        eventId: selectedEvent.id,
        fullName,
        className,
        level: effectiveLevel,
        schoolDistrict,
        photoBlob,
        consentAccepted,
      });

      setSubmittedReceipt({
        participantNumber: result.participantNumber,
        fullName: fullName.trim(),
        className: className.trim(),
        level: effectiveLevel,
        schoolDistrict,
        recordedAtText: new Date().toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        eventTitle: selectedEvent.title,
      });
    } catch (err) {
      if (err instanceof DuplicateRegistrationError) {
        setSubmitError(err.message);
      } else if (err instanceof PhotoUploadError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : 'Unable to record attendance right now. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
      setSubmitStage('');
    }
  };

  const handleResetForAnother = () => {
    setSubmittedReceipt(null);
    setFullName('');
    setClassName('');
    setLevelPreset('Primary');
    setCustomLevel('');
    setSchoolDistrict('');
    setConsentAccepted(false);
    clearSelectedPhoto();
    setValidationErrors({});
    setSubmitError(null);
  };

  // Loading state
  if (eventsLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-5 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded" />
          <div className="h-8 w-3/4 bg-slate-200 rounded" />
          <div className="h-4 w-1/2 bg-slate-200 rounded" />
          <div className="pt-4 space-y-4">
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
            <div className="h-12 bg-slate-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Error fetching events
  if (eventsError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Connection Problem
          </h1>
          <p className="text-sm text-slate-600 mb-6">{eventsError}</p>
          <button
            type="button"
            onClick={loadEvents}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Requested event not found
  if (notFoundEvent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Forum Session Not Found
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            The event link you opened does not exist or may have been removed by the coordinator.
          </p>
          {openEvents.length > 0 && (
            <button
              type="button"
              onClick={onClearRequestedEvent}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              View Open Forum Sessions
            </button>
          )}
        </div>
      </div>
    );
  }

  // No open events available
  if (!selectedEvent) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <Calendar className="w-10 h-10 text-blue-700 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-balance">
            No Open Forum Sessions
          </h1>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-6 leading-relaxed">
            There are currently no workshops or seminars open for registration. Please scan the QR code provided by your session trainer when check-in opens.
          </p>
          <button
            type="button"
            onClick={loadEvents}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Sessions
          </button>
        </div>
      </div>
    );
  }

  // Event found, but registration is Closed
  if (selectedEvent.status === 'Closed') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-3">
            <AlertCircle className="w-4 h-4" />
            <span>Registration Closed</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3 text-balance">
            {selectedEvent.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 mb-5">
            <span>{selectedEvent.eventDate}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedEvent.location}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Attendance check-in for this session has been closed by the trainer. If you need assistance, please speak directly with your forum coordinator.
          </p>
          {openEvents.length > 0 && (
            <button
              type="button"
              onClick={onClearRequestedEvent}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors cursor-pointer"
            >
              Switch to Open Session
            </button>
          )}
        </div>
      </div>
    );
  }

  // Successful registration receipt
  if (submittedReceipt) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-6 h-6 text-emerald-700" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-balance">
            Thank you! Your attendance has been successfully recorded.
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Your participation and photo have been saved for{' '}
            <span className="font-semibold text-slate-900">
              {submittedReceipt.eventTitle}
            </span>
            .
          </p>

          <dl className="divide-y divide-slate-100 border-t border-b border-slate-200 text-sm mb-6">
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-500">Participant Number</dt>
              <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                {submittedReceipt.participantNumber}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-500">Full Name</dt>
              <dd className="font-medium text-slate-900 text-right">
                {submittedReceipt.fullName}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-500">Class &amp; Level</dt>
              <dd className="text-slate-900 text-right">
                {submittedReceipt.className} · {submittedReceipt.level}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-500">School District</dt>
              <dd className="text-slate-900 text-right">
                {submittedReceipt.schoolDistrict}
              </dd>
            </div>
            <div className="py-3 flex justify-between gap-4">
              <dt className="text-slate-500">Recorded At</dt>
              <dd className="font-mono text-slate-900 tabular-nums text-right">
                {submittedReceipt.recordedAtText}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={handleResetForAnother}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Register Another Participant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      {/* Event Switcher (only when multiple open events exist and no specific link was opened) */}
      {!requestedEventId && openEvents.length > 1 && (
        <div className="mb-5">
          <label
            htmlFor="event-select"
            className="block text-xs font-semibold text-slate-600 mb-1.5"
          >
            Select Forum Session ({openEvents.length} open)
          </label>
          <select
            id="event-select"
            value={selectedEvent.id}
            onChange={(e) => {
              const found = openEvents.find((ev) => ev.id === e.target.value);
              if (found) setSelectedEvent(found);
            }}
            className="w-full min-h-[44px] px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          >
            {openEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.eventDate})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Event Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 mb-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-2">
          <UserCheck className="w-4 h-4" />
          <span>Participant Attendance Check-In</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-700">Registration Open</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3 text-balance">
          {selectedEvent.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="tabular-nums">{selectedEvent.eventDate}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>{selectedEvent.location}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="font-mono text-xs tabular-nums">{nowText}</span>
          </span>
        </div>
        {selectedEvent.description && (
          <p className="mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600 leading-relaxed">
            {selectedEvent.description}
          </p>
        )}
      </div>

      {/* Registration Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Submission Error</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* Full Name */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-semibold text-slate-800 mb-1.5"
          >
            Full Name <span className="text-red-600">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            required
            maxLength={120}
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (validationErrors.fullName) {
                setValidationErrors((prev) => ({ ...prev, fullName: undefined }));
              }
            }}
            placeholder="e.g. Nadia Kusuma"
            className={`w-full min-h-[48px] px-4 py-2.5 text-base bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
              validationErrors.fullName ? 'border-red-500' : 'border-slate-300'
            }`}
          />
          {validationErrors.fullName && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {validationErrors.fullName}
            </p>
          )}
        </div>

        {/* Class & Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="className"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Class / Unit <span className="text-red-600">*</span>
            </label>
            <input
              id="className"
              type="text"
              required
              maxLength={60}
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                if (validationErrors.className) {
                  setValidationErrors((prev) => ({ ...prev, className: undefined }));
                }
              }}
              placeholder="e.g. Primary 5A or Grade 10B"
              className={`w-full min-h-[48px] px-4 py-2.5 text-base bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                validationErrors.className ? 'border-red-500' : 'border-slate-300'
              }`}
            />
            {validationErrors.className && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {validationErrors.className}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="levelPreset"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Level <span className="text-red-600">*</span>
            </label>
            <select
              id="levelPreset"
              value={levelPreset}
              onChange={(e) => {
                setLevelPreset(e.target.value);
                if (validationErrors.level) {
                  setValidationErrors((prev) => ({ ...prev, level: undefined }));
                }
              }}
              className="w-full min-h-[48px] px-4 py-2.5 text-base bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {LEVEL_PRESETS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {levelPreset === 'Other' && (
          <div>
            <label
              htmlFor="customLevel"
              className="block text-sm font-semibold text-slate-800 mb-1.5"
            >
              Specify Level <span className="text-red-600">*</span>
            </label>
            <input
              id="customLevel"
              type="text"
              maxLength={60}
              value={customLevel}
              onChange={(e) => {
                setCustomLevel(e.target.value);
                if (validationErrors.level) {
                  setValidationErrors((prev) => ({ ...prev, level: undefined }));
                }
              }}
              placeholder="e.g. Parent / Guest / Leadership"
              className={`w-full min-h-[48px] px-4 py-2.5 text-base bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                validationErrors.level ? 'border-red-500' : 'border-slate-300'
              }`}
            />
            {validationErrors.level && (
              <p className="mt-1.5 text-xs font-medium text-red-600">
                {validationErrors.level}
              </p>
            )}
          </div>
        )}

        {/* School District */}
        <div>
          <span className="block text-sm font-semibold text-slate-800 mb-2">
            School District <span className="text-red-600">*</span>
          </span>
          <div className="space-y-2.5">
            {SCHOOL_DISTRICTS.map((district) => {
              const selected = schoolDistrict === district;
              return (
                <label
                  key={district}
                  className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                    selected
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="schoolDistrict"
                    value={district}
                    checked={selected}
                    onChange={() => {
                      setSchoolDistrict(district);
                      if (validationErrors.schoolDistrict) {
                        setValidationErrors((prev) => ({
                          ...prev,
                          schoolDistrict: undefined,
                        }));
                      }
                    }}
                    className="w-4 h-4 text-blue-700 focus:ring-blue-600"
                  />
                  <span className="text-sm sm:text-base font-medium">
                    {district}
                  </span>
                </label>
              );
            })}
          </div>
          {validationErrors.schoolDistrict && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {validationErrors.schoolDistrict}
            </p>
          )}
        </div>

        {/* Photo Capture & Upload */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between gap-4 mb-2">
            <span className="text-sm font-semibold text-slate-800">
              Participant Photo <span className="text-red-600">*</span>
            </span>
            <span className="text-xs text-slate-500">
              Used only for attendance verification
            </span>
          </div>

          {cameraError && (
            <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Photo Preview */}
          {photoPreviewUrl && !cameraActive && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={photoPreviewUrl}
                  alt="Participant preview"
                  className="w-36 h-36 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                />
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    Photo Ready for Submission
                  </p>
                  <p className="text-xs text-slate-600 mb-4">
                    Make sure your face is clearly visible before submitting.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera('user')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Retake with Camera
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedPhoto}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      Remove Photo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Camera View */}
          {cameraActive && (
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-900">
              <div className="relative aspect-[4/3] w-full bg-slate-950">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3 bg-slate-900 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startCamera(facingMode === 'user' ? 'environment' : 'user')
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 cursor-pointer"
                  >
                    <SwitchCamera className="w-4 h-4" />
                    Flip Camera
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-2 text-xs font-medium text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </button>
              </div>
            </div>
          )}

          {/* Camera / Upload Triggers */}
          {!photoPreviewUrl && !cameraActive && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={cameraStarting}
                onClick={() => startCamera('user')}
                className="min-h-[52px] flex items-center justify-center gap-2.5 px-4 py-3 border border-blue-200 bg-blue-50/70 text-blue-800 rounded-lg text-sm font-semibold hover:bg-blue-100/70 transition-colors cursor-pointer disabled:opacity-60"
              >
                {cameraStarting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>Take Photo with Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[52px] flex items-center justify-center gap-2.5 px-4 py-3 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Photo from Device</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {validationErrors.photo && (
            <p className="mt-2 text-xs font-medium text-red-600">
              {validationErrors.photo}
            </p>
          )}
        </div>

        {/* Consent Checkbox */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => {
                setConsentAccepted(e.target.checked);
                if (validationErrors.consent) {
                  setValidationErrors((prev) => ({ ...prev, consent: undefined }));
                }
              }}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            <span className="text-sm text-slate-700 leading-relaxed">
              I confirm that the details entered above are accurate, and I consent to submitting my information and photograph for Sekolah Global Mandiri workshop attendance documentation.
            </span>
          </label>
          {validationErrors.consent && (
            <p className="mt-1.5 text-xs font-medium text-red-600">
              {validationErrors.consent}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-700 text-white text-base font-semibold rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors disabled:opacity-70 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{submitStage || 'Submitting Attendance...'}</span>
              </>
            ) : (
              <span>Submit Attendance</span>
            )}
          </button>
          <p className="mt-2.5 text-center text-xs text-slate-500">
            Date and time are automatically recorded when you submit.
          </p>
        </div>
      </form>
    </div>
  );
}
