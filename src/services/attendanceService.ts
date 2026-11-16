import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getBlob, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import {
  AdminEmailInvite,
  AdminUser,
  BOOTSTRAPPED_ADMIN_EMAIL,
  EventStatus,
  ForumEvent,
  ParticipantRegistration,
  SchoolDistrict,
} from '../types';
import {
  generateDeterministicRegistrationId,
  generateParticipantNumber,
  triggerBlobDownload,
} from '../utils/imageUtils';

export interface EventInput {
  title: string;
  eventDate: string;
  location: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  description: string;
  status: EventStatus;
}

export interface RegistrationSubmitInput {
  eventId: string;
  fullName: string;
  className: string;
  level: string;
  schoolDistrict: SchoolDistrict;
  photoBlob: Blob;
  consentAccepted: boolean;
}

export interface RegistrationSubmitResult {
  registrationId: string;
  participantNumber: string;
}

export function emailToInviteKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export async function verifyUserIsAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified || !user.email) return false;
  if (user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  // Check UID allowlist
  try {
    const uidSnap = await getDoc(doc(db, 'admins', user.uid));
    if (uidSnap.exists()) return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('permission') && !message.includes('insufficient')) {
      handleFirestoreError(error, OperationType.GET, `admins/${user.uid}`);
    }
  }

  // Check Gmail / work email invite allowlist
  const emailKey = emailToInviteKey(user.email);
  try {
    const inviteSnap = await getDoc(doc(db, 'adminEmails', emailKey));
    return inviteSnap.exists();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('insufficient')) {
      return false;
    }
    handleFirestoreError(error, OperationType.GET, `adminEmails/${emailKey}`);
  }
}

export async function fetchOpenEvents(): Promise<ForumEvent[]> {
  const path = 'events';
  try {
    const q = query(collection(db, 'events'), where('status', '==', 'Open'));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data() as ForumEvent);
    return list.sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchEventById(eventId: string): Promise<ForumEvent | null> {
  const path = `events/${eventId}`;
  try {
    const snap = await getDoc(doc(db, 'events', eventId));
    return snap.exists() ? (snap.data() as ForumEvent) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeAllEvents(
  onData: (events: ForumEvent[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'events';
  const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ForumEvent));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchAllEvents(): Promise<ForumEvent[]> {
  const path = 'events';
  try {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ForumEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function buildOptionalLocationPayload(input: EventInput) {
  const extra: Record<string, unknown> = {};
  if (input.locationAddress && input.locationAddress.trim().length > 0) {
    extra.locationAddress = input.locationAddress.trim().slice(0, 300);
  }
  if (
    typeof input.locationLat === 'number' &&
    Number.isFinite(input.locationLat) &&
    typeof input.locationLng === 'number' &&
    Number.isFinite(input.locationLng)
  ) {
    extra.locationLat = input.locationLat;
    extra.locationLng = input.locationLng;
  }
  return extra;
}

export async function createForumEvent(input: EventInput, adminUid: string): Promise<string> {
  const cleanTitle = input.title.trim().slice(0, 160);
  const cleanLocation = input.location.trim().slice(0, 160);
  const cleanDesc = input.description.trim().slice(0, 1000);
  const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `events/${eventId}`;

  try {
    await setDoc(doc(db, 'events', eventId), {
      id: eventId,
      title: cleanTitle,
      eventDate: input.eventDate,
      location: cleanLocation,
      ...buildOptionalLocationPayload(input),
      description: cleanDesc,
      status: input.status,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return eventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateForumEvent(eventId: string, input: EventInput): Promise<void> {
  const path = `events/${eventId}`;
  try {
    await updateDoc(doc(db, 'events', eventId), {
      title: input.title.trim().slice(0, 160),
      eventDate: input.eventDate,
      location: input.location.trim().slice(0, 160),
      ...buildOptionalLocationPayload(input),
      description: input.description.trim().slice(0, 1000),
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteForumEvent(eventId: string): Promise<void> {
  const path = `events/${eventId}`;
  try {
    const regsSnap = await getDocs(collection(db, 'events', eventId, 'registrations'));
    for (const regDoc of regsSnap.docs) {
      const reg = regDoc.data() as ParticipantRegistration;
      if (reg.photoStoragePath) {
        try {
          await deleteObject(ref(storage, reg.photoStoragePath));
        } catch {
          // Continue cleanup even if photo object is already removed
        }
      }
      await deleteDoc(regDoc.ref);
    }
    await deleteDoc(doc(db, 'events', eventId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export class PhotoUploadError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PhotoUploadError';
    this.code = code;
  }
}

export class DuplicateRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRegistrationError';
  }
}

export async function submitParticipantRegistration(
  input: RegistrationSubmitInput
): Promise<RegistrationSubmitResult> {
  const fullName = input.fullName.trim().slice(0, 120);
  const className = input.className.trim().slice(0, 60);
  const level = input.level.trim().slice(0, 60);
  const eventId = input.eventId.trim();

  const registrationId = await generateDeterministicRegistrationId(
    eventId,
    fullName,
    className,
    input.schoolDistrict
  );

  const localKey = `sgm_attendance_${eventId}_${registrationId}`;
  try {
    if (localStorage.getItem(localKey)) {
      throw new DuplicateRegistrationError(
        'An attendance submission with these details has already been recorded for this event.'
      );
    }
  } catch (err) {
    if (err instanceof DuplicateRegistrationError) throw err;
  }

  const photoStoragePath = `events/${eventId}/registrations/${registrationId}/photo.jpg`;

  try {
    const photoRef = ref(storage, photoStoragePath);
    await uploadBytes(photoRef, input.photoBlob, {
      contentType: 'image/jpeg',
      customMetadata: {
        eventId,
        registrationId,
      },
    });
  } catch (storageError: unknown) {
    const errCode =
      typeof storageError === 'object' && storageError !== null && 'code' in storageError
        ? String((storageError as { code: unknown }).code)
        : 'storage/unknown';

    if (errCode === 'storage/unauthorized') {
      throw new PhotoUploadError(
        'Photo upload was blocked by Firebase Storage permissions. Please ask the event trainer to verify storage.rules in Firebase Console.',
        errCode
      );
    }
    if (errCode === 'storage/canceled') {
      throw new PhotoUploadError('Photo upload was canceled. Please try again.', errCode);
    }
    if (errCode === 'storage/retry-limit-exceeded') {
      throw new PhotoUploadError(
        'Network timeout while uploading your photo. Please check your connection and retry.',
        errCode
      );
    }
    throw new PhotoUploadError(
      `Could not upload your photo to Firebase Storage (${errCode}). Please retry or check Storage configuration.`,
      errCode
    );
  }

  const participantNumber = generateParticipantNumber();
  const docPath = `events/${eventId}/registrations/${registrationId}`;

  try {
    await setDoc(doc(db, 'events', eventId, 'registrations', registrationId), {
      id: registrationId,
      eventId,
      participantNumber,
      fullName,
      className,
      level,
      schoolDistrict: input.schoolDistrict,
      photoStoragePath,
      consentAccepted: input.consentAccepted === true,
      registeredAt: serverTimestamp(),
    });

    try {
      localStorage.setItem(localKey, participantNumber);
    } catch {
      // Ignore storage quota errors
    }

    return { registrationId, participantNumber };
  } catch (dbError: unknown) {
    const rawMessage = dbError instanceof Error ? dbError.message.toLowerCase() : '';
    if (rawMessage.includes('already') || rawMessage.includes('permission') || rawMessage.includes('insufficient')) {
      const latestEvent = await fetchEventById(eventId).catch(() => null);
      if (latestEvent && latestEvent.status === 'Closed') {
        throw new Error('Registration for this event has just been closed by the administrator.');
      }
      throw new DuplicateRegistrationError(
        'A registration with your name, class, and school district already exists for this event.'
      );
    }
    handleFirestoreError(dbError, OperationType.CREATE, docPath);
  }
}

export function subscribeEventRegistrations(
  eventId: string,
  onData: (registrations: ParticipantRegistration[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `events/${eventId}/registrations`;
  const q = query(
    collection(db, 'events', eventId, 'registrations'),
    orderBy('registeredAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ParticipantRegistration));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function fetchEventRegistrations(
  eventId: string
): Promise<ParticipantRegistration[]> {
  const path = `events/${eventId}/registrations`;
  try {
    const q = query(
      collection(db, 'events', eventId, 'registrations'),
      orderBy('registeredAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as ParticipantRegistration);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateParticipantRegistration(
  eventId: string,
  registrationId: string,
  updates: {
    fullName: string;
    className: string;
    level: string;
    schoolDistrict: SchoolDistrict;
  }
): Promise<void> {
  const path = `events/${eventId}/registrations/${registrationId}`;
  try {
    await updateDoc(doc(db, 'events', eventId, 'registrations', registrationId), {
      fullName: updates.fullName.trim().slice(0, 120),
      className: updates.className.trim().slice(0, 60),
      level: updates.level.trim().slice(0, 60),
      schoolDistrict: updates.schoolDistrict,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteParticipantRegistration(
  eventId: string,
  registrationId: string,
  photoStoragePath?: string
): Promise<void> {
  const path = `events/${eventId}/registrations/${registrationId}`;
  if (photoStoragePath) {
    try {
      await deleteObject(ref(storage, photoStoragePath));
    } catch {
      // Proceed with Firestore deletion even if Storage object wasn't found
    }
  }
  try {
    await deleteDoc(doc(db, 'events', eventId, 'registrations', registrationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getParticipantPhotoUrl(photoStoragePath: string): Promise<string> {
  const photoRef = ref(storage, photoStoragePath);
  return getDownloadURL(photoRef);
}

export async function downloadParticipantPhotoFile(
  reg: ParticipantRegistration
): Promise<void> {
  const safeName = reg.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${reg.participantNumber}-${safeName || 'participant'}.jpg`;

  try {
    const blob = await getBlob(ref(storage, reg.photoStoragePath));
    triggerBlobDownload(blob, filename);
  } catch {
    const url = await getDownloadURL(ref(storage, reg.photoStoragePath));
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Could not download participant photo.');
    }
    const blob = await response.blob();
    triggerBlobDownload(blob, filename);
  }
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => d.data() as AdminUser);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addAdminUser(
  uid: string,
  email: string,
  displayName: string,
  addedByUid: string
): Promise<void> {
  const cleanUid = uid.trim();
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      email: email.trim().slice(0, 200),
      displayName: displayName.trim().slice(0, 120),
      addedBy: addedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminUser(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAdminEmailInvites(): Promise<AdminEmailInvite[]> {
  const path = 'adminEmails';
  try {
    const snap = await getDocs(collection(db, 'adminEmails'));
    return snap.docs.map((d) => d.data() as AdminEmailInvite);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addAdminEmailInvite(
  email: string,
  displayName: string,
  addedByUid: string
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase().slice(0, 200);
  const id = emailToInviteKey(normalizedEmail);
  const path = `adminEmails/${id}`;
  try {
    await setDoc(doc(db, 'adminEmails', id), {
      id,
      email: normalizedEmail,
      displayName: displayName.trim().slice(0, 120),
      addedBy: addedByUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminEmailInvite(id: string): Promise<void> {
  const path = `adminEmails/${id}`;
  try {
    await deleteDoc(doc(db, 'adminEmails', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
