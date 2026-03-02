# IdanVault 🔐

A self-hosted password manager built with React, TypeScript, and client-side encryption.

## Features

- 🔒 **Zero-knowledge encryption** - Your passwords never leave your device unencrypted
- 🔑 **AES-256 encryption** with PBKDF2 key derivation (100,000 iterations)
- 📱 **Mobile-friendly** - Works on all devices
- 💾 **IndexedDB storage** - All data stored locally in your browser
- 📦 **1Password import** - Import your existing passwords from 1Password
- 🚀 **Static hosting** - Deploy to GitHub Pages for free

## Security

- Master password never stored
- Client-side encryption only
- Encryption key kept in memory only
- Auto-lock on inactivity (15 minutes)
- Zero-knowledge architecture

## Quick Start

1. Visit the deployed app (see GitHub Pages URL above)
2. Create your master password
3. Import your 1Password data (optional)
4. Start managing your passwords securely!

## Development

```bash
npm install
npm run dev
```

## Technologies

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Dexie.js (IndexedDB)
- crypto-js (AES-256 encryption)
- Zustand (state management)

## License

MIT
