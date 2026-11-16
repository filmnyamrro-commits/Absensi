/// <reference types="google.maps" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Loader2, MapPin, Search, X } from 'lucide-react';

const MAPS_API_KEY: string =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_API_KEY) ||
  '';

export function hasGoogleMapsApiKey(): boolean {
  return MAPS_API_KEY.trim().length > 0;
}

const DEFAULT_CENTER = { lat: -6.2088, lng: 106.8456 };

function isQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : String(err ?? '');
  return (
    text.includes('RESOURCE_EXHAUSTED') ||
    text.includes('OVER_QUERY_LIMIT') ||
    text.includes('429')
  );
}

interface VenueSelection {
  locationName: string;
  locationAddress: string;
  lat: number;
  lng: number;
}

interface EventLocationPickerProps {
  locationValue: string;
  locationAddress?: string;
  lat?: number;
  lng?: number;
  onLocationTextChange: (value: string) => void;
  onVenueSelected: (selection: VenueSelection | null) => void;
}

function PlacesSearchInner({
  lat,
  lng,
  locationValue,
  locationAddress,
  onVenueSelected,
}: {
  lat?: number;
  lng?: number;
  locationValue: string;
  locationAddress?: string;
  onVenueSelected: (selection: VenueSelection | null) => void;
}) {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  const [queryText, setQueryText] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    if (!placesLib || queryText.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: queryText,
          sessionToken: sessionTokenRef.current ?? undefined,
          includedRegionCodes: ['id'],
        });
        if (!cancelled) {
          setSuggestions(res.suggestions ?? []);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setSuggestions([]);
          setSearchError('Unable to fetch place suggestions right now.');
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, queryText]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      setSearchError(null);
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });

        const loc = place.location;
        if (loc) {
          const nextLat = loc.lat();
          const nextLng = loc.lng();
          if (place.viewport && map) {
            map.fitBounds(place.viewport);
          } else if (map) {
            map.panTo({ lat: nextLat, lng: nextLng });
            map.setZoom(16);
          }
          onVenueSelected({
            locationName:
              place.displayName ||
              suggestion.placePrediction.text.text ||
              locationValue,
            locationAddress: place.formattedAddress || '',
            lat: nextLat,
            lng: nextLng,
          });
        }

        setQueryText('');
        setSuggestions([]);
        sessionTokenRef.current = null;
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSearchError('Could not load details for the selected venue.');
      }
    },
    [map, onVenueSelected, locationValue]
  );

  const hasPin = typeof lat === 'number' && typeof lng === 'number';
  const mapCenter = hasPin ? { lat: lat as number, lng: lng as number } : DEFAULT_CENTER;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search campus or venue on Google Maps..."
          className="w-full min-h-[38px] pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        {searching && (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
        )}

        {suggestions.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
            {suggestions.map((item, idx) => (
              <li key={idx}>
                <button
                  type="button"
                  onClick={() => void handleSelectSuggestion(item)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 text-slate-800 flex items-start gap-2 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
                  <span>{item.placePrediction?.text.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {searchError && (
        <p className="text-[11px] text-amber-700">{searchError}</p>
      )}

      <div className="h-48 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={mapCenter}
          center={hasPin ? mapCenter : undefined}
          defaultZoom={hasPin ? 16 : 10}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          onClick={(ev) => {
            const clicked = ev.detail.latLng;
            if (!clicked) return;
            onVenueSelected({
              locationName: locationValue || 'Selected Venue',
              locationAddress:
                locationAddress ||
                `${clicked.lat.toFixed(5)}, ${clicked.lng.toFixed(5)}`,
              lat: clicked.lat,
              lng: clicked.lng,
            });
          }}
        >
          {hasPin && (
            <AdvancedMarker position={{ lat: lat as number, lng: lng as number }}>
              <Pin
                background="#1D4ED8"
                borderColor="#1E3A8A"
                glyphColor="#FFFFFF"
              />
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>

      {hasPin ? (
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
          <span className="truncate">
            Pinned: {locationAddress || `${lat?.toFixed(5)}, ${lng?.toFixed(5)}`}
          </span>
          <button
            type="button"
            onClick={() => onVenueSelected(null)}
            className="inline-flex items-center gap-1 text-red-700 hover:underline shrink-0 cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Clear Pin</span>
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          Optional: Search above or click on the map to pin the event venue for participants.
        </p>
      )}
    </div>
  );
}

export function EventLocationPicker({
  locationValue,
  locationAddress,
  lat,
  lng,
  onLocationTextChange,
  onVenueSelected,
}: EventLocationPickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Event Location <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          required
          maxLength={160}
          value={locationValue}
          onChange={(e) => onLocationTextChange(e.target.value)}
          placeholder="e.g. Main Auditorium, Cibubur Campus"
          className="w-full min-h-[42px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {hasGoogleMapsApiKey() && (
        <APIProvider apiKey={MAPS_API_KEY} libraries={['places', 'marker']} language="en" region="ID">
          <PlacesSearchInner
            lat={lat}
            lng={lng}
            locationValue={locationValue}
            locationAddress={locationAddress}
            onVenueSelected={onVenueSelected}
          />
        </APIProvider>
      )}
    </div>
  );
}

function VenueMapDisplayInner({
  title,
  location,
  locationAddress,
  lat,
  lng,
}: {
  title: string;
  location: string;
  locationAddress?: string;
  lat: number;
  lng: number;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [markerRef, marker] = useAdvancedMarkerRef();
  const position = { lat, lng };

  return (
    <GoogleMap
      mapId="DEMO_MAP_ID"
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      defaultCenter={position}
      defaultZoom={16}
      gestureHandling="cooperative"
      disableDefaultUI={false}
    >
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={location}
        onClick={() => setInfoOpen((prev) => !prev)}
      >
        <Pin background="#1D4ED8" borderColor="#1E3A8A" glyphColor="#FFFFFF" />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={240}
          onCloseClick={() => setInfoOpen(false)}
        >
          <div className="text-xs text-slate-900 space-y-1 p-0.5">
            <p className="font-bold">{title}</p>
            <p className="text-slate-700">{location}</p>
            {locationAddress && (
              <p className="text-slate-500 text-[11px]">{locationAddress}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}

export function EventVenueMapCard({
  title,
  location,
  locationAddress,
  lat,
  lng,
}: {
  title: string;
  location: string;
  locationAddress?: string;
  lat: number;
  lng: number;
}) {
  if (!hasGoogleMapsApiKey()) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lat},${lng}`
  )}`;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700">
          Venue Map{locationAddress ? ` · ${locationAddress}` : ''}
        </span>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
        >
          <span>Open in Google Maps</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="h-52 w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
        <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="en" region="ID">
          <VenueMapDisplayInner
            title={title}
            location={location}
            locationAddress={locationAddress}
            lat={lat}
            lng={lng}
          />
        </APIProvider>
      </div>
    </div>
  );
}
