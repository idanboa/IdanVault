# IdanVault

A self-hosted password manager built with React, TypeScript, and client-side encryption. Replaces 1Password with a zero-knowledge architecture deployed to GitHub Pages.

## Features

- **Zero-knowledge encryption** - AES-256 with PBKDF2 key derivation (100k iterations). Passwords never leave your device unencrypted.
- **Cross-device sync** - Firebase Auth + Firestore keeps entries in sync across all your devices. Only encrypted data is stored remotely.
- **Biometric unlock** - Face ID / Touch ID via WebAuthn for quick unlock without re-typing your master password.
- **Auto-lock** - Locks after 15 minutes of inactivity.
- **1Password import** - Import existing passwords from 1Password CSV exports.
- **Mobile-friendly** - Responsive design that works on all devices, with iOS Safari optimizations.
- **Static hosting** - Deployed to GitHub Pages via GitHub Actions.

## Quick Start

1. Visit the deployed app at your GitHub Pages URL
2. Create your master password (this derives your encryption key)
3. Import your 1Password data (optional)
4. Start managing your passwords

## Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` triggers automatic deployment via GitHub Actions to GitHub Pages.

```bash
npm run build    # TypeScript check + Vite build
git push         # Triggers deploy workflow
```

## Firebase Setup

The app requires a Firebase project with:
- **Authentication**: Email/password sign-in enabled
- **Firestore**: Database with security rules from `firestore.rules`
- Firebase config is in `src/lib/firebase.ts`

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Firebase Auth + Firestore (cross-device sync)
- Dexie.js + dexie-react-hooks (IndexedDB, reactive queries)
- crypto-js (AES-256 encryption)
- Zustand (state management)
- Sonner (toast notifications)

## License

MIT
