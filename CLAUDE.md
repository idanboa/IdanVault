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

## Encryption Key Derivation

The encryption key is derived via `CryptoService.deriveMasterKey(password, email, salt)` using PBKDF2 (100k iterations). The same key must be used for both encryption and decryption. Three inputs determine the key:

1. **Master password** (user input)
2. **Email** (user input)
3. **Salt** (stored in both local IndexedDB `user` table and Firestore `users` collection)

If any of these three differ from what was used to encrypt entries, decryption fails with `Malformed UTF-8 data`.

### Key derivation flows

| Flow | Key source | Files |
|------|-----------|-------|
| Password login | Derived from password + email + local salt | `authStoreFirebase.ts` `login()` |
| Password unlock | Derived from password + email + local salt | `authStoreFirebase.ts` `unlock()` |
| Setup (new) | Derived from password + email + new random salt | `authStoreFirebase.ts` `setup()` |
| Setup (existing) | Derived from password + email + Firestore salt | `authStoreFirebase.ts` `setup()` |
| Biometric login | Derived from stored credentials + local salt | `LoginPage.tsx` `handleBiometricLogin()` |
| Biometric unlock | Derived from stored credentials + local salt | `LockScreen.tsx` `handleBiometricUnlock()` |

### Critical rule: biometric must derive, never trust stored keys

The biometric flow stores email+password+raw encryption key in localStorage. **Never use the raw stored key directly for decryption.** Always re-derive the key from stored credentials + local salt. The raw key can become stale if the salt changes, but re-deriving from credentials + current salt always produces the correct key. See `LoginPage.tsx` and `LockScreen.tsx` biometric handlers.

After any successful password-based auth, call `BiometricAuth.updateStoredKey()` to keep the stored key in sync (defense in depth, not relied upon for correctness).

## Known Edge Cases & Gotchas

1. **Salt loss = data loss**: If Firestore `users` collection is deleted, the salt used for key derivation is gone. Re-setup generates a new salt, new key, old entries can't be decrypted. Never delete the `users` collection in production.
2. **Firebase Auth vs Firestore users**: Firebase Auth users (Console > Authentication) and Firestore `users` collection are separate. Both must exist for the app to work. Deleting one without the other causes errors.
3. **`auth/invalid-credential`**: Appears when Firebase Auth account exists but password doesn't match, OR when Auth user was deleted but email-already-in-use cache hasn't cleared.
4. **Encryption key is in-memory only**: Page refresh clears it. User must re-login after refresh (encryption key is re-derived from password or biometric stored credentials).
5. **`lock()` clears credentials**: Auto-lock stops sync and clears the encryption key + credentials. `unlock()` must re-store credentials for `ensureAuth()` to work.
6. **Biometric credentials in localStorage**: Face/Touch ID stores email+password in localStorage for Firebase re-auth and key derivation. This is a trade-off for UX. The raw encryption key is also stored but never used directly — key is always re-derived from credentials + salt.
7. **iOS Safari auto-zoom**: Inputs must be >= 16px font-size to prevent iOS zoom. See `src/index.css`.
8. **Cross-device sync relies on onSnapshot**: If the listener isn't active, no sync happens. `initAuth()` and `ensureSync()` are the safety nets.
9. **Import only writes to IndexedDB**: The import service doesn't upload to Firestore. Entries sync to Firestore via the onSnapshot listener's reverse flow (local changes trigger upload via `uploadEntry()`).
10. **Entry detail decryption failure = silent fail**: If decryption fails (wrong key), the detail panel shows nothing. The error only appears in console.
11. **Deploy/refresh + biometric = key must be re-derived**: Every deploy or page refresh clears the in-memory encryption key. If biometric is enabled, it auto-triggers on page load. The biometric handler must derive the key from stored credentials + local salt (not use the raw stored key) to ensure correct decryption.
12. **CryptoJS passphrase mode**: When a string key is passed to `CryptoJS.AES.encrypt/decrypt`, it uses OpenSSL EVP_BytesToKey internally. The explicit IV in the `iv_hex:ciphertext` format is ignored by CryptoJS in this mode — it generates/reads its own salt from the `Salted__` prefix. This is fine as long as the same passphrase string is used.

## Firestore Security Rules

- `entries` collection: users can only read/write their own entries (matched by `userId` field)
- `users` collection: users can only read/write their own document (matched by doc ID = auth UID)
