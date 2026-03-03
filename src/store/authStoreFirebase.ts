import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { db, User } from '@/lib/db';
import { CryptoService } from '@/lib/crypto';
import { FirebaseSync } from '@/lib/firebaseSync';
import { v4 as uuid } from 'uuid';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  isLoading: boolean;
  setup: (email: string, masterPassword: string) => Promise<void>;
  login: (email: string, masterPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  lock: () => void;
  unlock: (masterPassword: string) => Promise<boolean>;
  checkSetup: () => Promise<boolean>;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isAuthenticated: false,
  isLocked: false,
  isLoading: true,

  initAuth: () => {
    // Listen to Firebase auth state changes
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get local user data
        const localUser = await db.user.where('email').equals(firebaseUser.email!).first();
        if (localUser) {
          set({ firebaseUser, user: localUser, isLoading: false });
        } else {
          set({ firebaseUser: null, user: null, isAuthenticated: false, isLoading: false });
        }
      } else {
        set({ firebaseUser: null, user: null, isAuthenticated: false, isLoading: false });
        FirebaseSync.stopSync();
      }
    });
  },

  setup: async (email: string, masterPassword: string) => {
    // Check if user already exists locally
    const existingUser = await db.user.toArray();
    if (existingUser.length > 0) {
      throw new Error('Setup already completed');
    }

    // Create Firebase user
    const userCredential = await createUserWithEmailAndPassword(auth, email, masterPassword);

    // Derive encryption key and hash
    const { encryptionKey, salt, hash } = await CryptoService.deriveMasterKey(
      masterPassword,
      email
    );

    // Create local user
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

    // Start Firebase sync
    FirebaseSync.startSync(userCredential.user.uid);

    set({
      user: user || null,
      firebaseUser: userCredential.user,
      isAuthenticated: true,
      isLocked: false
    });
  },

  login: async (email: string, masterPassword: string) => {
    // Sign in to Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, masterPassword);

    // Get local user
    const user = await db.user.where('email').equals(email).first();
    if (!user) {
      await signOut(auth);
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
      await signOut(auth);
      return false;
    }

    // Store encryption key in memory
    CryptoService.setEncryptionKey(encryptionKey);

    // Start Firebase sync
    FirebaseSync.startSync(userCredential.user.uid);

    set({
      user,
      firebaseUser: userCredential.user,
      isAuthenticated: true,
      isLocked: false
    });
    return true;
  },

  logout: async () => {
    CryptoService.clearKey();
    FirebaseSync.stopSync();
    await signOut(auth);
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      isLocked: false
    });
  },

  lock: () => {
    CryptoService.clearKey();
    FirebaseSync.stopSync();
    set({ isLocked: true, isAuthenticated: false });
  },

  unlock: async (masterPassword: string) => {
    const { user, firebaseUser } = get();
    if (!user || !firebaseUser) return false;

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

    // Restart Firebase sync
    FirebaseSync.startSync(firebaseUser.uid);

    set({ isAuthenticated: true, isLocked: false });
    return true;
  },

  checkSetup: async () => {
    const users = await db.user.toArray();
    return users.length > 0;
  }
}));
