import { useMemo, useState } from 'react';
import {
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Search,
  User,
  X,
} from 'lucide-react';
import { downloadParticipantPhotoFile } from '../../services/attendanceService';
import {
  DISTRICT_SHORT_LABELS,
  ForumEvent,
  ParticipantRegistration,
  SCHOOL_DISTRICTS,
} from '../../types';
import { formatRegistrationDate, formatRegistrationTime } from '../../utils/imageUtils';

interface PhotoGalleryViewProps {
  event: ForumEvent | null;
  registrations: ParticipantRegistration[];
  photoUrls: Record<string, string>;
  loading: boolean;
  onSelectParticipant: (participant: ParticipantRegistration) => void;
}

export function PhotoGalleryView({
  event,
  registrations,
  photoUrls,
  loading,
  onSelectParticipant,
}: PhotoGalleryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [enlargedParticipant, setEnlargedParticipant] =
    useState<ParticipantRegistration | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return registrations.filter((reg) => {
      if (q && !reg.fullName.toLowerCase().includes(q)) return false;
      if (districtFilter !== 'All' && reg.schoolDistrict !== districtFilter) {
        return false;
      }
      return true;
    });
  }, [registrations, searchQuery, districtFilter]);

  const handleDownload = async (reg: ParticipantRegistration) => {
    setDownloadingId(reg.id);
    try {
      await downloadParticipantPhotoFile(reg);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (!event) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <ImageIcon className="w-10 h-10 text-blue-700 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">No Event Selected</h2>
        <p className="text-sm text-slate-600">
          Select an event to inspect its private participant photo gallery.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Gallery Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter gallery by participant name..."
            className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setDistrictFilter('All')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                districtFilter === 'All'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({registrations.length})
            </button>
            {SCHOOL_DISTRICTS.map((d) => {
              const count = registrations.filter((r) => r.schoolDistrict === d).length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDistrictFilter(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    districtFilter === d
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {DISTRICT_SHORT_LABELS[d]} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="aspect-[4/3] bg-slate-100" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 bg-slate-200 rounded" />
                <div className="h-3 w-1/2 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No Photos to Display
          </h3>
          <p className="text-sm text-slate-500">
            {registrations.length === 0
              ? 'Participant photos submitted for this event will appear privately here.'
              : 'No participant photos match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((reg) => {
            const url = photoUrls[reg.id];
            return (
              <div
                key={reg.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden group">
                  {url ? (
                    <img
                      src={url}
                      alt={reg.fullName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <User className="w-9 h-9 mb-1" />
                      <span className="text-xs">Loading photo...</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setEnlargedParticipant(reg)}
                    className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-slate-900/75 text-white hover:bg-slate-900 transition-opacity cursor-pointer"
                    title="Enlarge photo"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {reg.fullName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {reg.schoolDistrict}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                      {reg.className} · {reg.level}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectParticipant(reg)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Full Details</span>
                    </button>
                    <button
                      type="button"
                      disabled={downloadingId === reg.id}
                      onClick={() => handleDownload(reg)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-50"
                      title="Download photo"
                    >
                      {downloadingId === reg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enlarged Photo Lightbox Modal */}
      {enlargedParticipant && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {enlargedParticipant.fullName}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {enlargedParticipant.schoolDistrict} · {enlargedParticipant.className} ·{' '}
                  {formatRegistrationDate(enlargedParticipant)}{' '}
                  {formatRegistrationTime(enlargedParticipant)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnlargedParticipant(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="Close enlarged photo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 flex items-center justify-center max-h-[65vh] overflow-hidden">
              {photoUrls[enlargedParticipant.id] ? (
                <img
                  src={photoUrls[enlargedParticipant.id]}
                  alt={enlargedParticipant.fullName}
                  className="max-h-[65vh] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="py-24 text-slate-400 text-sm">
                  Photo could not be loaded from Firebase Storage.
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = enlargedParticipant;
                  setEnlargedParticipant(null);
                  onSelectParticipant(target);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Registration Details</span>
              </button>

              <button
                type="button"
                disabled={downloadingId === enlargedParticipant.id}
                onClick={() => handleDownload(enlargedParticipant)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
              >
                {downloadingId === enlargedParticipant.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
