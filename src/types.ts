import { Timestamp } from 'firebase/firestore';

export const SCHOOL_DISTRICTS = [
  'Sekolah Global Mandiri Cibubur',
  'Sekolah Global Mandiri Jakarta',
  'Sekolah Global Mandiri Palembang',
] as const;

export type SchoolDistrict = (typeof SCHOOL_DISTRICTS)[number];

export const DISTRICT_SHORT_LABELS: Record<SchoolDistrict, string> = {
  'Sekolah Global Mandiri Cibubur': 'Cibubur',
  'Sekolah Global Mandiri Jakarta': 'Jakarta',
  'Sekolah Global Mandiri Palembang': 'Palembang',
};

export const LEVEL_PRESETS = [
  'Early Years',
  'Primary',
  'Secondary',
  'Staff / Educator',
] as const;

export type EventStatus = 'Open' | 'Closed';

export interface ForumEvent {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  description: string;
  status: EventStatus;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ParticipantRegistration {
  id: string;
  eventId: string;
  participantNumber: string;
  fullName: string;
  className: string;
  level: string;
  schoolDistrict: SchoolDistrict;
  photoStoragePath: string;
  consentAccepted: boolean;
  registeredAt: Timestamp | null;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  addedBy: string;
  createdAt: Timestamp | null;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'rohantmr.lover@gmail.com';
