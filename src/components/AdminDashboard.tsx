import { useCallback, useEffect, useState } from 'react';
import { signOut, User } from 'firebase/auth';
import {
  AlertCircle,
  CalendarDays,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import { auth } from '../firebase';
import {
  fetchAllEvents,
  fetchEventRegistrations,
  getParticipantPhotoUrl,
  subscribeAllEvents,
  subscribeEventRegistrations,
} from '../services/attendanceService';
import { ForumEvent, ParticipantRegistration } from '../types';
import { EventManagementView } from './admin/EventManagementView';
import { OverviewView } from './admin/OverviewView';
import { ParticipantDetailModal } from './admin/ParticipantDetailModal';
import { ParticipantListView } from './admin/ParticipantListView';
import { PhotoGalleryView } from './admin/PhotoGalleryView';
import { SetupGuideView } from './admin/SetupGuideView';

type AdminTab = 'overview' | 'participants' | 'gallery' | 'events' | 'guide';

interface AdminDashboardProps {
  currentUser: User;
  onOpenRegistrationForm: (eventId?: string) => void;
}

export function AdminDashboard({
  currentUser,
  onOpenRegistrationForm,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [events, setEvents] = useState<ForumEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<ParticipantRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [detailParticipant, setDetailParticipant] =
    useState<ParticipantRegistration | null>(null);

  // Real-time events subscription
  useEffect(() => {
    setEventsLoading(true);
    const unsubscribe = subscribeAllEvents(
      (list) => {
        setEvents(list);
        setEventsLoading(false);
        setSelectedEventId((prev) => {
          if (prev && list.some((e) => e.id === prev)) return prev;
          return list.length > 0 ? list[0].id : null;
        });
      },
      (err) => {
        console.error(err);
        setDashboardError('Unable to sync events from Firestore.');
        setEventsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time registrations subscription for selected event ONLY
  useEffect(() => {
    if (!selectedEventId) {
      setRegistrations([]);
      setRegsLoading(false);
      return;
    }

    setRegsLoading(true);
    setDashboardError(null);
    const unsubscribe = subscribeEventRegistrations(
      selectedEventId,
      (list) => {
        setRegistrations(list);
        setRegsLoading(false);
      },
      (err) => {
        console.error(err);
        setDashboardError('Unable to load attendance records for the selected event.');
        setRegsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [selectedEventId]);

  // Securely resolve Storage download URLs for authenticated admin
  useEffect(() => {
    let cancelled = false;
    const loadMissingPhotos = async () => {
      const missing = registrations.filter(
        (reg) => reg.photoStoragePath && !photoUrls[reg.id]
      );
      if (missing.length === 0) return;

      const entries = await Promise.all(
        missing.map(async (reg) => {
          try {
            const url = await getParticipantPhotoUrl(reg.photoStoragePath);
            return [reg.id, url] as const;
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      const nextMap: Record<string, string> = {};
      for (const entry of entries) {
        if (entry) nextMap[entry[0]] = entry[1];
      }
      if (Object.keys(nextMap).length > 0) {
        setPhotoUrls((prev) => ({ ...prev, ...nextMap }));
      }
    };

    loadMissingPhotos();
    return () => {
      cancelled = true;
    };
  }, [registrations, photoUrls]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setDashboardError(null);
    try {
      const freshEvents = await fetchAllEvents();
      setEvents(freshEvents);
      if (selectedEventId) {
        const freshRegs = await fetchEventRegistrations(selectedEventId);
        setRegistrations(freshRegs);
        // Clear photo cache for current event registrations so fresh URLs resolve
        setPhotoUrls((prev) => {
          const updated = { ...prev };
          freshRegs.forEach((r) => delete updated[r.id]);
          return updated;
        });
      }
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : 'Failed to refresh dashboard data.'
      );
    } finally {
      setRefreshing(false);
    }
  }, [selectedEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const navItems: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'participants', label: 'Participant List', icon: Users },
    { id: 'gallery', label: 'Photo Gallery', icon: ImageIcon },
    { id: 'events', label: 'Event Management', icon: CalendarDays },
    { id: 'guide', label: 'Firebase & Access', icon: Settings },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Navigation (260px on desktop) */}
        <aside className="w-full lg:w-[256px] shrink-0 bg-white border border-slate-200 rounded-xl p-3 space-y-1">
          <div className="px-3 py-2.5 border-b border-slate-100 mb-2">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {currentUser.displayName || 'Trainer Admin'}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {currentUser.email}
            </p>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-2 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Workspace Content */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* Contextual Event Selector & Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                <span className="font-semibold text-slate-700">Active Event</span>
                {selectedEvent && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        selectedEvent.status === 'Open'
                          ? 'text-emerald-700 font-semibold'
                          : 'text-red-700 font-semibold'
                      }
                    >
                      {selectedEvent.status}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {registrations.length} registered
                    </span>
                  </>
                )}
              </div>

              {eventsLoading ? (
                <div className="h-10 w-64 bg-slate-100 rounded-lg animate-pulse" />
              ) : events.length === 0 ? (
                <p className="text-sm font-medium text-slate-600">
                  No events created yet — create one in Event Management.
                </p>
              ) : (
                <select
                  aria-label="Select forum event"
                  value={selectedEventId ?? ''}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full max-w-md min-h-[40px] px-3 py-1.5 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {events.map((evt) => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({evt.eventDate} · {evt.status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={refreshing}
                onClick={handleManualRefresh}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                />
                <span>Refresh</span>
              </button>

              {selectedEvent && (
                <button
                  type="button"
                  onClick={() => onOpenRegistrationForm(selectedEvent.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 whitespace-nowrap cursor-pointer"
                >
                  <span>Open Check-In Form</span>
                </button>
              )}
            </div>
          </div>

          {dashboardError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{dashboardError}</span>
            </div>
          )}

          {/* Active Tab View */}
          {activeTab === 'overview' && (
            <OverviewView
              event={selectedEvent}
              registrations={registrations}
              loading={regsLoading}
              onOpenParticipants={() => setActiveTab('participants')}
              onSelectParticipant={(p) => setDetailParticipant(p)}
            />
          )}

          {activeTab === 'participants' && (
            <ParticipantListView
              event={selectedEvent}
              registrations={registrations}
              photoUrls={photoUrls}
              loading={regsLoading}
              onSelectParticipant={(p) => setDetailParticipant(p)}
              onDeleted={handleManualRefresh}
            />
          )}

          {activeTab === 'gallery' && (
            <PhotoGalleryView
              event={selectedEvent}
              registrations={registrations}
              photoUrls={photoUrls}
              loading={regsLoading}
              onSelectParticipant={(p) => setDetailParticipant(p)}
            />
          )}

          {activeTab === 'events' && (
            <EventManagementView
              events={events}
              selectedEventId={selectedEventId}
              adminUid={currentUser.uid}
              onSelectEventForAttendance={(eventId) => {
                setSelectedEventId(eventId);
                setActiveTab('overview');
              }}
              onOpenRegistrationLink={(eventId) => onOpenRegistrationForm(eventId)}
            />
          )}

          {activeTab === 'guide' && <SetupGuideView currentUser={currentUser} />}
        </main>
      </div>

      {/* Participant Details Modal */}
      <ParticipantDetailModal
        participant={detailParticipant}
        photoUrl={detailParticipant ? photoUrls[detailParticipant.id] : undefined}
        onClose={() => setDetailParticipant(null)}
        onUpdated={handleManualRefresh}
      />
    </div>
  );
}
