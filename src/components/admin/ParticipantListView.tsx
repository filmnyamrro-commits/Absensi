import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Search,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import {
  deleteParticipantRegistration,
  downloadParticipantPhotoFile,
} from '../../services/attendanceService';
import {
  DISTRICT_SHORT_LABELS,
  ForumEvent,
  ParticipantRegistration,
  SCHOOL_DISTRICTS,
} from '../../types';
import {
  exportRegistrationsToCsv,
  exportRegistrationsToExcel,
  formatRegistrationDate,
  formatRegistrationTime,
} from '../../utils/imageUtils';

interface ParticipantListViewProps {
  event: ForumEvent | null;
  registrations: ParticipantRegistration[];
  photoUrls: Record<string, string>;
  loading: boolean;
  onSelectParticipant: (participant: ParticipantRegistration) => void;
  onDeleted: () => void;
}

export function ParticipantListView({
  event,
  registrations,
  photoUrls,
  loading,
  onSelectParticipant,
  onDeleted,
}: ParticipantListViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');
  const [classFilter, setClassFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const uniqueLevels = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      if (r.level.trim()) set.add(r.level.trim());
    });
    return Array.from(set).sort();
  }, [registrations]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    registrations.forEach((r) => {
      if (r.className.trim()) set.add(r.className.trim());
    });
    return Array.from(set).sort();
  }, [registrations]);

  const filteredRegistrations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = registrations.filter((reg) => {
      if (
        q &&
        !reg.fullName.toLowerCase().includes(q) &&
        !reg.participantNumber.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (districtFilter !== 'All' && reg.schoolDistrict !== districtFilter) {
        return false;
      }
      if (levelFilter !== 'All' && reg.level.trim() !== levelFilter) {
        return false;
      }
      if (classFilter !== 'All' && reg.className.trim() !== classFilter) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      const ta = a.registeredAt?.toMillis() ?? 0;
      const tb = b.registeredAt?.toMillis() ?? 0;
      return sortOrder === 'newest' ? tb - ta : ta - tb;
    });
  }, [registrations, searchQuery, districtFilter, levelFilter, classFilter, sortOrder]);

  const handleDownloadPhoto = async (reg: ParticipantRegistration) => {
    setDownloadingId(reg.id);
    try {
      await downloadParticipantPhotoFile(reg);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleConfirmDelete = async (reg: ParticipantRegistration) => {
    setDeletingId(reg.id);
    try {
      await deleteParticipantRegistration(reg.eventId, reg.id, reg.photoStoragePath);
      setConfirmDeleteId(null);
      onDeleted();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDistrictFilter('All');
    setLevelFilter('All');
    setClassFilter('All');
  };

  if (!event) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <Users className="w-10 h-10 text-blue-700 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">No Event Selected</h2>
        <p className="text-sm text-slate-600">
          Select an event from the header to view its participant list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: Search, Filters & Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by participant name or number..."
              className="w-full min-h-[40px] pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-medium text-slate-600 mr-1 tabular-nums">
              Showing {filteredRegistrations.length} of {registrations.length}
            </span>

            <button
              type="button"
              disabled={filteredRegistrations.length === 0}
              onClick={() => exportRegistrationsToCsv(filteredRegistrations, event.title)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              disabled={filteredRegistrations.length === 0}
              onClick={() => exportRegistrationsToExcel(filteredRegistrations, event.title)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              School District
            </label>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Campuses</option>
              {SCHOOL_DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {DISTRICT_SHORT_LABELS[d]} ({d})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Level
            </label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Levels</option>
              {uniqueLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Class / Unit
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full min-h-[38px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="All">All Classes</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Sort Order
            </label>
            <button
              type="button"
              onClick={() =>
                setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))
              }
              className="w-full min-h-[38px] inline-flex items-center justify-between px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <span>
                {sortOrder === 'newest'
                  ? 'Registration Time (Newest)'
                  : 'Registration Time (Oldest)'}
              </span>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-9 h-9 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {registrations.length === 0
                ? 'No Participants Registered Yet'
                : 'No Matching Participants'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {registrations.length === 0
                ? 'Attendance records for this event will appear here automatically as participants submit.'
                : 'Try adjusting your search term or campus/level/class filters.'}
            </p>
            {registrations.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">Participant No.</th>
                  <th className="py-3 px-4 whitespace-nowrap">Photo</th>
                  <th className="py-3 px-4 whitespace-nowrap">Full Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Class</th>
                  <th className="py-3 px-4 whitespace-nowrap">Level</th>
                  <th className="py-3 px-4 whitespace-nowrap">School District</th>
                  <th className="py-3 px-4 whitespace-nowrap">Reg. Date</th>
                  <th className="py-3 px-4 whitespace-nowrap">Reg. Time</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRegistrations.map((reg, index) => {
                  const thumbUrl = photoUrls[reg.id];
                  const isConfirmingDelete = confirmDeleteId === reg.id;
                  return (
                    <tr
                      key={reg.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                          #{String(index + 1).padStart(3, '0')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {reg.participantNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectParticipant(reg)}
                          className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-blue-600 cursor-pointer"
                          title="Inspect participant details"
                        >
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={reg.fullName}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px] truncate">
                        {reg.fullName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {reg.className}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {reg.level}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-[240px] truncate">
                        {reg.schoolDistrict}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatRegistrationDate(reg)}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {formatRegistrationTime(reg)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={deletingId === reg.id}
                              onClick={() => handleConfirmDelete(reg)}
                              className="px-2.5 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 cursor-pointer"
                            >
                              {deletingId === reg.id ? '...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectParticipant(reg)}
                              className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="View participant details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={downloadingId === reg.id}
                              onClick={() => handleDownloadPhoto(reg)}
                              className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer disabled:opacity-50"
                              title="Download participant photo"
                            >
                              {downloadingId === reg.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(reg.id)}
                              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
