# Vault — Product Requirements Document (v0.2 / MVP)

## 1. Summary

Vault is a mobile-first Progressive Web App (PWA) — installed via "Add to Home Screen," works identically on iPhone and Android — for securely storing and organizing personal identity, legal, and family documents (photos/scans of licenses, property papers, Aadhaar, PAN, insurance, etc.) in a folder structure on the user's own Google Drive. The user owns the storage (their Drive quota, their account); the app is the organized, secure front door to it.

## 2. Problem Statement

People keep critical documents — ID cards, property papers, licenses, insurance, medical records — scattered across phone galleries, WhatsApp chats, email attachments, and physical folders. This makes them:
- Hard to find when needed urgently (hospital visit, KYC, travel, government office)
- Vulnerable to loss (phone lost/damaged/reset)
- Hard to share safely with family members who may need access
- Mixed in with unrelated photos, with no privacy separation

Google Drive already gives reliable, free/cheap cloud storage, but has no purpose-built structure or workflow for personal-document management.

## 3. Goals

1. Let a user capture or import a document and file it into the right folder in under 15 seconds.
2. Provide a consistent, predefined + customizable folder taxonomy (by document type and by family member).
3. Make any stored document retrievable in under 10 seconds via browse or search.
4. Keep documents private and secure, since these include high-sensitivity government IDs (Aadhaar, PAN).
5. Let the user manage documents for multiple family members from one account.

### Non-Goals (for MVP)
- Building custom cloud storage (we use the user's Google Drive, not our own backend storage).
- OCR-based auto data extraction / form-filling.
- Sharing documents with people outside the user's own family/account.
- Native app store distribution (App Store / Play Store) — see Platform decision below.
- Multi-cloud support (Dropbox, OneDrive, iCloud) — Drive only for v1.

## 4. Target Users

- Primary: A single account owner (head of household) in India (or similar geographies with Aadhaar/PAN-style national IDs) who manages documents for themselves and their entire family from their own Google account and Drive.
- Secondary (post-MVP): Family members with their own login and delegated/shared access (spouse, adult children) — not in MVP scope; see section 9.

## 5. Core Use Cases

1. **Capture a new document** — Open app → point camera at physical document (or pick from gallery/PDF) → app suggests a folder/category → confirm → uploaded to the right Drive folder.
2. **Browse by category** — "Show me all Property Documents" or "Show me Dad's documents."
3. **Search** — Type "Aadhar" or "insurance 2023" and get the matching file(s) regardless of which folder it's in.
4. **Retrieve in an emergency** — Offline/cached access to a starred set of critical documents even without signal.
5. **Add a family member** — Create a new person profile so documents can be tagged/filed under them.
6. **Renewal reminders** — Get notified before a license/passport/insurance policy expires (based on a date the user tags on upload).

## 6. Functional Requirements (MVP Scope)

### 6.1 Authentication & Storage
- Sign in with Google (OAuth 2.0), scoped to Drive access.
- Use the **Drive `drive.file` scope** (app-created-files-only) rather than full Drive access, for user trust and minimal footprint — the app creates and manages a single root folder (e.g. `Vault/`) and everything it writes lives there.
- On first launch, app creates the folder structure in the user's Drive if it doesn't exist.

### 6.2 Folder Taxonomy
- Default structure created on first run, e.g.:
  ```
  Vault/
    Identity/          (Aadhaar, PAN, Passport, Voter ID)
    Licenses/          (Driving License, Professional Licenses)
    Property/          (Deeds, Rental Agreements, Tax Receipts)
    Insurance/         (Health, Life, Vehicle)
    Financial/         (Bank, Loans, Investments)
    Medical/
    Family/
      <Person Name>/    (auto-created per family member; can hold their own Identity/Licenses/etc.)
    Other/
  ```
- Users can rename, add, or delete category folders. Structure maps 1:1 to real folders in Drive (so it's still browsable/normal from Drive's own app or web UI).
- Family member profiles (name, relationship, DOB optional) map to subfolders under `Family/`.

### 6.3 Document Capture & Import
- In-app camera capture with edge-detection cropping for document photos (like a scanner app).
- Multi-page capture → combine into a single PDF.
- Import existing photos/PDFs from device gallery/files.
- On capture, prompt user to:
  - Pick a category (with a smart suggested default based on recent activity or basic on-device image heuristics — no cloud ML for privacy in MVP).
  - Assign to a family member (optional).
  - Add optional metadata: title, expiry/renewal date, notes/tags.
- Upload directly to the corresponding Drive folder using the Drive API, named with a consistent convention (e.g. `Aadhaar_SunilGeorge_2024-09-21.pdf`).

### 6.4 Browsing & Search
- Home screen: category grid + family member switcher.
- List/grid view per folder showing thumbnails.
- Global search bar: filename, tag, category, family member, date.
- Sort by name/date/expiry.

### 6.5 Document Viewer
- In-app viewer for images and PDFs (no need to leave the app or download separately).
- Actions from viewer: share (system share sheet — export only, not built-in re-sharing to other Vault users in MVP), rename, move to another folder, delete, download/export.

### 6.6 Reminders
- Optional expiry date field per document.
- Local notification N days before expiry (default 30 days, configurable).

### 6.7 Offline / Emergency Access
- User can mark documents as "Favorites/Emergency" which are cached locally (encrypted at rest on-device) for offline access.

### 6.8 Security
- App-level lock: biometric (Face ID/Touch ID/fingerprint via **WebAuthn platform authenticator**) or PIN required to open the app, independent of phone lock.
- Locally cached/favorited files encrypted at rest on device using the **Web Crypto API**, with the key wrapped by the WebAuthn/platform authenticator where supported.
- No document content ever touches Vault's own servers — Drive API calls go directly device (browser) → Google (thin/no backend for document data in MVP).
- Auto-lock after configurable inactivity timeout.
- No analytics/telemetry on document content or filenames; only anonymous usage/product analytics (screen views, feature usage) with content excluded.

## 7. Non-Functional Requirements

- **Privacy-first**: minimum viable OAuth scope, no third-party ad/analytics SDKs reading file content, clear in-app explanation of what permission is requested and why.
- **Reliability**: uploads must be resumable (Drive resumable upload API) to survive flaky connections common with large scanned PDFs.
- **Performance**: category browse and search should feel instant (<500ms) using a locally cached index of file metadata (synced from Drive) rather than hitting the Drive API on every screen.
- **Platform**: **Progressive Web App (PWA)**, installed via "Add to Home Screen" on iOS and Android. One codebase covers both platforms (the user's iPhone plus any family Android phones) with no App Store/Play Store review cycle, and updates ship instantly on next load. Requires iOS 16.4+ for full PWA capability (installable icon, home-screen standalone mode, web push).
- **Accessibility**: minimum font scaling and screen-reader labels on primary flows (capture, browse, search).

## 8. Success Metrics (MVP)

- Time-to-first-document-filed after signup (target: < 2 minutes).
- % of users who add a 2nd family member within first week (proxy for "whole-family" adoption).
- Weekly retention at week 4.
- Median time to retrieve a document via search (target < 10s).
- Crash-free session rate > 99.5%.

## 9. Risks & Open Questions

| Risk / Question | Notes |
|---|---|
| Drive API quota limits | Free tier quotas should be fine for personal use volume; verify limits for resumable uploads and metadata listing calls per user/day. |
| `drive.file` scope means the app can only see files it created — what if a user already has documents in Drive they want to import? | Need a one-time "import & adopt" flow using Drive Picker API, which grants file-level access to user-selected existing files without full-Drive scope. |
| What happens if the user revokes Drive access or deletes the Vault folder from Drive directly? | App needs a reconciliation/recreate-structure flow and should not silently fail. |
| Aadhaar/PAN are extremely sensitive — any regulatory considerations (e.g., India's DPDP Act) for an app handling these? | Needs a privacy policy review; since we don't store data on our own servers, our compliance burden is lighter, but should still be explicit in-app and in store listing. |
| Family member documents — do family members get their own login, or is this single-owner-manages-all for MVP? | **Confirmed: Option A, single owner.** One Google account (the owner's) holds one Drive with all family members' documents as subfolders under `Family/<Person Name>/`. Family members do not sign in or need their own Google account for MVP. Multi-user, each-person-owns-their-own-Drive access is a possible v2 direction, not MVP. |
| Offline favorites encryption — what's the key management approach (device keystore vs. passphrase)? | Web Crypto API-generated key, wrapped/protected via WebAuthn platform authenticator (Face ID/Touch ID/fingerprint) where available; falls back to a PIN-derived key otherwise. |
| iOS Safari can evict IndexedDB/local storage after long periods of inactivity | Acceptable since Drive is the source of truth — local cache/favorites just get re-synced from Drive on next open; user is never silently locked out of their actual documents. |
| Web push notifications for expiry reminders require iOS 16.4+ and the user must have added the app to Home Screen (not just visited the site) | Onboarding must explicitly prompt "Add to Home Screen" and explain why (offline access + reminders), since a plain browser tab won't get reminders on iOS. |

## 10. Out of Scope for MVP (Future Considerations)

- Native app store distribution (a native wrapper via Capacitor/Cordova is possible later if App Store presence becomes valuable, but not needed for personal/family use)
- Sharing a document/folder with another Vault user (e.g., spouse also using the app)
- OCR / auto data extraction (e.g., auto-read Aadhaar number, auto-fill expiry date)
- Multi-cloud backend (Dropbox/OneDrive/iCloud)
- Desktop-optimized layout (MVP is mobile-first responsive; desktop browser will work but isn't a design target)
- Document version history / audit trail
- Government-integration features (e.g., DigiLocker import)

## 11. Suggested MVP Milestones

1. **M1 — PWA Shell + Auth + Folder Scaffolding**: Installable PWA (manifest, service worker, "Add to Home Screen" onboarding), Google Sign-In, Drive `drive.file` OAuth, auto-create default folder structure.
2. **M2 — Capture & Upload**: Camera capture via device camera (`getUserMedia`/`<input capture>`) with cropping, multi-page PDF, category picker, resumable upload to Drive.
3. **M3 — Browse & Viewer**: Category grid, family member switcher, in-app image/PDF viewer, local metadata cache (IndexedDB).
4. **M4 — Search & Security**: Global search, app lock (WebAuthn biometric/PIN), encrypted offline favorites.
5. **M5 — Reminders & Polish**: Web push expiry reminders, import-existing-files flow (Drive Picker), onboarding, empty states.

## 12. Open Decision for the User

Before implementation starts, please confirm:
- Frontend framework for the PWA — recommend **React + Vite** (fast dev loop, huge ecosystem for PWA tooling like `vite-plugin-pwa`) unless you have a preference (e.g., Svelte, plain web components).
