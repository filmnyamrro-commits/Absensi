# Security Specification: SGM Forum Attendance

## 1. Data Invariants
1. **Event Isolation**: Every participant registration lives under `/events/{eventId}/registrations/{registrationId}` and must match `data.eventId == eventId` and `data.id == registrationId`.
2. **Open Registration Gate (Master Gate)**: A participant can only create a registration when the parent event `/events/{eventId}` exists and has `status == 'Open'`.
3. **Private PII & Photo Isolation**: Unauthenticated users and non-admin users can NEVER `get`, `list`, `update`, or `delete` participant registrations. Only verified administrators (`isAdmin()`) can access participant lists, photos, or exports.
4. **No Self-Assigned Admin Privileges**: Users cannot write to `/admins/{adminId}` unless they are already a verified administrator (`isAdmin()`).
5. **Server Timestamp Integrity**: `createdAt`, `updatedAt`, and `registeredAt` must equal `request.time` on creation/update and remain immutable afterward.
6. **Consent Mandate**: Every participant registration must explicitly have `consentAccepted == true`.
7. **Duplicate Prevention**: Registration document IDs are deterministically derived per event from normalized participant identity, and `allow update` is forbidden for non-admins—blocking duplicate creates at the database layer.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Closed Event Registration**: Participant attempts `create` on `/events/closed_evt/registrations/reg_1` where `events/closed_evt.status == 'Closed'`.
2. **Orphaned Event Registration**: Participant attempts `create` on `/events/nonexistent_evt/registrations/reg_1`.
3. **PII Scraping (List)**: Unauthenticated or non-admin signed-in user attempts `list` on `/events/open_evt/registrations`.
4. **PII Scraping (Get)**: Unauthenticated or non-admin signed-in user attempts `get` on `/events/open_evt/registrations/reg_1`.
5. **Self-Admin Escalation**: Non-admin signed-in user attempts `create` on `/admins/{ownUid}`.
6. **Ghost Field Injection**: Participant sends extra field `isVerified: true` on registration `create`.
7. **Invalid School District**: Participant sends `schoolDistrict: "External School"` not in the allowed SGM enum.
8. **Missing Consent**: Participant sends `consentAccepted: false` on registration `create`.
9. **Client-Spoofed Timestamp**: Participant sends a backdated `Timestamp` instead of `request.time` for `registeredAt`.
10. **Resource Exhaustion / ID Poisoning**: Attacker attempts `create` with a 1,500-character document ID or a 5,000-character `fullName`.
11. **Non-Admin Event Creation**: Non-admin signed-in user attempts `create` on `/events/rogue_evt`.
12. **Closed Event Listing Leak**: Unauthenticated user attempts `list` on `/events` without filtering `where('status', '==', 'Open')`.
