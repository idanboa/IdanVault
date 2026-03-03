# IdanVault

## Project Overview

Self-hosted password manager replacing 1Password. React 18 + TypeScript + Vite SPA deployed to GitHub Pages. Firebase Auth + Firestore for cross-device sync. Client-side AES-256 encryption (zero-knowledge architecture).

## Architecture

- **Local storage**: IndexedDB via Dexie.js (source of truth for UI)
- **Remote sync**: Firestore `entries` collection (encrypted data only)
- **Auth**: Firebase Auth (email/password), salt stored in Firestore `users` collection
- **Encryption**: PBKDF2 (100k iterations) for key derivation, AES-256-CBC with random IV
- **State**: Zustand store (`authStoreFirebase.ts`)
- **Routing**: HashRouter (required for GitHub Pages)

## Key Files

- `src/lib/crypto.ts` - Encryption/decryption, key derivation, credential storage
- `src/lib/firebaseSync.ts` - Firestore real-time sync with `ensureAuth()` re-authentication
- `src/lib/biometric.ts` - WebAuthn Face/Touch ID support
- `src/lib/db.ts` - Dexie.js IndexedDB schema
- `src/lib/firebase.ts` - Firebase config (project: idanvaultproduction)
- `src/store/authStoreFirebase.ts` - Auth state, login/setup/lock/unlock flows
- `src/hooks/useEntriesFirebase.ts` - Entry CRUD with `useLiveQuery` for reactivity
- `src/hooks/useAutoLock.ts` - 15-minute inactivity auto-lock
- `firestore.rules` - Security rules for Firestore

## Build & Deploy

- `npm run dev` - Local dev server
- `npm run build` - TypeScript check + Vite build
- Push to `main` triggers GitHub Actions deploy to GitHub Pages
- Base path: `/IdanVault/`

## Critical Patterns & Conventions

- Entries are encrypted before storage; title and category are plaintext for search
- `useLiveQuery` from dexie-react-hooks for reactive UI (never poll IndexedDB)
- `FirebaseSync.ensureAuth()` re-authenticates before every Firestore operation
- `CryptoService.setCredentials()` must be called after login/setup/unlock for re-auth to work
- `initAuth()` in auth store auto-starts sync when Firebase auth is restored on page reload
- Batched IndexedDB writes via `db.transaction` + `bulkPut/bulkDelete` in onSnapshot handler

## Known Edge Cases & Gotchas

1. **Salt loss = data loss**: If Firestore `users` collection is deleted, the salt used for key derivation is gone. Re-setup generates a new salt, new key, old entries can't be decrypted. Never delete the `users` collection in production.
2. **Firebase Auth vs Firestore users**: Firebase Auth users (Console > Authentication) and Firestore `users` collection are separate. Both must exist for the app to work. Deleting one without the other causes errors.
3. **`auth/invalid-credential`**: Appears when Firebase Auth account exists but password doesn't match, OR when Auth user was deleted but email-already-in-use cache hasn't cleared.
4. **Encryption key is in-memory only**: Page refresh clears it. User must re-login after refresh (encryption key is re-derived from password).
5. **`lock()` clears credentials**: Auto-lock stops sync and clears the encryption key + credentials. `unlock()` must re-store credentials for `ensureAuth()` to work.
6. **Biometric credentials in localStorage**: Face/Touch ID stores email+password in localStorage for Firebase re-auth. This is a trade-off for UX.
7. **iOS Safari auto-zoom**: Inputs must be >= 16px font-size to prevent iOS zoom. See `src/index.css`.
8. **Cross-device sync relies on onSnapshot**: If the listener isn't active, no sync happens. `initAuth()` and `ensureSync()` are the safety nets.
9. **Import only writes to IndexedDB**: The import service doesn't upload to Firestore. Entries sync to Firestore via the onSnapshot listener's reverse flow (local changes trigger upload via `uploadEntry()`).
10. **Entry detail decryption failure = silent fail**: If decryption fails (wrong key), the detail panel shows nothing. The error only appears in console.

## Firestore Security Rules

- `entries` collection: users can only read/write their own entries (matched by `userId` field)
- `users` collection: users can only read/write their own document (matched by doc ID = auth UID)
