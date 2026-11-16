import {
  BarChart3,
  Building2,
  GraduationCap,
  Users,
} from 'lucide-react';
import {
  DISTRICT_SHORT_LABELS,
  ForumEvent,
  ParticipantRegistration,
  SCHOOL_DISTRICTS,
} from '../../types';
import { formatRegistrationDate, formatRegistrationTime } from '../../utils/imageUtils';

interface OverviewViewProps {
  event: ForumEvent | null;
  registrations: ParticipantRegistration[];
  loading: boolean;
  onOpenParticipants: () => void;
  onSelectParticipant: (participant: ParticipantRegistration) => void;
}

export function OverviewView({
  event,
  registrations,
  loading,
  onOpenParticipants,
  onSelectParticipant,
}: OverviewViewProps) {
  if (!event) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <Users className="w-10 h-10 text-blue-700 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900 mb-1">No Event Selected</h2>
        <p className="text-sm text-slate-600">
          Create or select a forum event to inspect attendance statistics.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-xl p-6" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl p-6" />
        </div>
      </div>
    );
  }

  const total = registrations.length;
  const districtCounts = SCHOOL_DISTRICTS.map((district) => {
    const count = registrations.filter((r) => r.schoolDistrict === district).length;
    return {
      district,
      shortName: DISTRICT_SHORT_LABELS[district],
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });

  // Group by level dynamically
  const levelMap = new Map<string, number>();
  for (const reg of registrations) {
    const lvl = reg.level.trim() || 'Unspecified';
    levelMap.set(lvl, (levelMap.get(lvl) ?? 0) + 1);
  }
  const levelStats = Array.from(levelMap.entries())
    .map(([level, count]) => ({
      level,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const maxLevelCount = levelStats.reduce((max, item) => Math.max(max, item.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
            <span>Total Participants</span>
            <Users className="w-4 h-4 text-blue-700" />
          </div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{total}</p>
          <p className="mt-1 text-xs text-slate-500 truncate">
            {event.title}
          </p>
        </div>

        {districtCounts.map((item) => (
          <div key={item.district} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-3">
              <span>{item.shortName} Campus</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2.5">
              <p className="text-3xl font-bold text-slate-900 tabular-nums">
                {item.count}
              </p>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {item.percent}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 truncate">{item.district}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School District Breakdown Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Participants by School District
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution across Sekolah Global Mandiri campuses
              </p>
            </div>
            <BarChart3 className="w-4 h-4 text-blue-700" />
          </div>

          {total === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No attendance records yet for this event.
            </div>
          ) : (
            <div className="space-y-4">
              {districtCounts.map((item, idx) => {
                const barColors = ['bg-blue-700', 'bg-blue-500', 'bg-sky-500'];
                return (
                  <div key={item.district}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800">
                        {item.district}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        {item.count} ({item.percent}%)
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          barColors[idx % barColors.length]
                        }`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Level Breakdown Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Participants by Level
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown across Early Years, Primary, Secondary, and Staff
              </p>
            </div>
            <GraduationCap className="w-4 h-4 text-blue-700" />
          </div>

          {levelStats.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No level breakdown available until participants check in.
            </div>
          ) : (
            <div className="space-y-4">
              {levelStats.map((item) => {
                const barWidth = Math.max(4, Math.round((item.count / maxLevelCount) * 100));
                return (
                  <div key={item.level}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-800">{item.level}</span>
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        {item.count} ({item.percent}%)
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Registrations Preview */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Latest Registrations
            </h3>
            <p className="text-xs text-slate-500">
              Most recent participants recorded for {event.title}
            </p>
          </div>
          {registrations.length > 0 && (
            <button
              type="button"
              onClick={onOpenParticipants}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap cursor-pointer"
            >
              View All ({registrations.length})
            </button>
          )}
        </div>

        {registrations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Share the event link or QR code with participants to begin collecting attendance.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {registrations.slice(0, 5).map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => onSelectParticipant(reg)}
                className="w-full px-6 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {reg.fullName}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {reg.className} · {reg.level} · {DISTRICT_SHORT_LABELS[reg.schoolDistrict]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs font-medium text-slate-700 tabular-nums">
                    {formatRegistrationTime(reg)}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {formatRegistrationDate(reg)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
