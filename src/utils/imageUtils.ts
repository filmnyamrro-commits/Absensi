import * as XLSX from 'xlsx';
import { DISTRICT_SHORT_LABELS, ParticipantRegistration } from '../types';

/**
 * Compresses an uploaded image File into a crisp JPEG Blob (max 960px dimension)
 * so mobile camera uploads are fast and stay well under Storage limits.
 */
export async function compressImageFile(file: File, maxDim = 960, quality = 0.84): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not initialize image canvas context.'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode compressed JPEG image.'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unsupported or corrupted image file. Please choose a valid JPG or PNG image.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Captures the current frame from a live HTMLVideoElement into a compressed JPEG Blob.
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  maxDim = 960,
  quality = 0.85
): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Camera feed is not ready yet. Please wait a moment and try again.');
  }

  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to capture photo from camera.');
  }
  ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to save captured photo.'));
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Generates a deterministic registration ID per event + normalized participant identity
 * so accidental duplicate submissions are blocked both locally and at the Firestore rule layer.
 */
export async function generateDeterministicRegistrationId(
  eventId: string,
  fullName: string,
  className: string,
  schoolDistrict: string
): Promise<string> {
  const normalized = [
    eventId.trim(),
    fullName.trim().toLowerCase().replace(/\s+/g, ' '),
    className.trim().toLowerCase().replace(/\s+/g, ' '),
    schoolDistrict.trim().toLowerCase(),
  ].join('|');

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `reg_${hashHex.slice(0, 28)}`;
  }

  // Deterministic fallback hash if subtle crypto is unavailable
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `reg_${part1}${part2}`;
}

export function generateParticipantNumber(): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SGM-${y}${m}${d}-${suffix}`;
}

export function formatRegistrationDate(reg: ParticipantRegistration): string {
  if (!reg.registeredAt) return 'Pending';
  const d = reg.registeredAt.toDate();
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRegistrationTime(reg: ParticipantRegistration): string {
  if (!reg.registeredAt) return '--:--';
  const d = reg.registeredAt.toDate();
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function buildExportRows(
  registrations: ParticipantRegistration[],
  eventTitle: string
) {
  return registrations.map((reg, index) => ({
    'No.': index + 1,
    'Participant Number': reg.participantNumber,
    'Event': eventTitle,
    'Full Name': reg.fullName,
    'Class': reg.className,
    'Level': reg.level,
    'School District': reg.schoolDistrict,
    'Campus': DISTRICT_SHORT_LABELS[reg.schoolDistrict] ?? reg.schoolDistrict,
    'Registration Date': formatRegistrationDate(reg),
    'Registration Time': formatRegistrationTime(reg),
    'Consent Confirmed': reg.consentAccepted ? 'Yes' : 'No',
    'Photo Storage Path': reg.photoStoragePath,
  }));
}

export function exportRegistrationsToCsv(
  registrations: ParticipantRegistration[],
  eventTitle: string
) {
  const rows = buildExportRows(registrations, eventTitle);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const escapeCell = (val: unknown) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h as keyof typeof row])).join(',')),
  ];

  // UTF-8 BOM ensures Excel opens Indonesian/international names cleanly
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const slug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'attendance';
  triggerBlobDownload(blob, `${slug}-attendance.csv`);
}

export function exportRegistrationsToExcel(
  registrations: ParticipantRegistration[],
  eventTitle: string
) {
  const rows = buildExportRows(registrations, eventTitle);
  if (rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    { wch: 32 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 44 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  const slug = eventTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'attendance';
  XLSX.writeFile(workbook, `${slug}-attendance.xlsx`);
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
