import { create } from 'zustand';
import { db, User } from '@/lib/db';
import { CryptoService } from '@/lib/crypto';
import { v4 as uuid } from 'uuid';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  setup: (email: string, masterPassword: string) => Promise<void>;
  login: (email: string, masterPassword: string) => Promise<boolean>;
  logout: () => void;
  lock: () => void;
  unlock: (masterPassword: string) => Promise<boolean>;
  checkSetup: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLocked: false,

  setup: async (email: string, masterPassword: string) => {
    // Check if user already exists
    const existingUser = await db.user.toArray();
    if (existingUser.length > 0) {
      throw new Error('Setup already completed');
    }

    // Derive encryption key and hash
    const { encryptionKey, salt, hash } = await CryptoService.deriveMasterKey(
      masterPassword,
      email
    );

    // Create user
    const userId = uuid();
    await db.user.add({
      id: userId,
      email,
      masterPasswordHash: hash,
      salt,
      createdAt: Date.now()
    });

    // Create default vault
    await db.vaults.add({
      id: uuid(),
      name: 'Personal',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Store encryption key in memory
    CryptoService.setEncryptionKey(encryptionKey);

    // Get user
    const user = await db.user.get(userId);
    set({ user: user || null, isAuthenticated: true, isLocked: false });
  },

  login: async (email: string, masterPassword: string) => {
    const user = await db.user.where('email').equals(email).first();
    if (!user) {
      return false;
    }

    // Derive key with user's salt
    const { encryptionKey, hash } = await CryptoService.deriveMasterKey(
      masterPassword,
      email,
      user.salt
    );

    // Verify password
    if (hash !== user.masterPasswordHash) {
      return false;
    }

    // Store encryption key in memory
    CryptoService.setEncryptionKey(encryptionKey);

    set({ user, isAuthenticated: true, isLocked: false });
    return true;
  },

  logout: () => {
    CryptoService.clearKey();
    set({ user: null, isAuthenticated: false, isLocked: false });
  },

  lock: () => {
    CryptoService.clearKey();
    set({ isLocked: true, isAuthenticated: false });
  },

  unlock: async (masterPassword: string) => {
    const { user } = get();
    if (!user) return false;

    // Derive key with user's salt
    const { encryptionKey, hash } = await CryptoService.deriveMasterKey(
      masterPassword,
      user.email,
      user.salt
    );

    // Verify password
    if (hash !== user.masterPasswordHash) {
      return false;
    }

    // Store encryption key in memory
    CryptoService.setEncryptionKey(encryptionKey);

    set({ isAuthenticated: true, isLocked: false });
    return true;
  },

  checkSetup: async () => {
    const users = await db.user.toArray();
    return users.length > 0;
  }
}));
