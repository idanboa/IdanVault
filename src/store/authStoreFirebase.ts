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
          // Start Firebase sync automatically on auth restore
          FirebaseSync.startSync(firebaseUser.uid);
          set({ firebaseUser, user: localUser, isAuthenticated: CryptoService.isAuthenticated(), isLoading: false });
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

    // Try to create Firebase user, or sign in if already exists
    let userCredential;
    let isExistingAccount = false;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, masterPassword);
    } catch (error: any) {
      // If email already in use, sign in instead
      if (error.code === 'auth/email-already-in-use') {
        userCredential = await signInWithEmailAndPassword(auth, email, masterPassword);
        isExistingAccount = true;
      } else {
        throw error;
      }
    }

    let salt: string;
    let hash: string;
    let encryptionKey: string;

    if (isExistingAccount) {
      // Existing account - fetch salt from Firestore
      const userData = await FirebaseSync.getUserData(userCredential.user.uid);
      if (!userData) {
        await signOut(auth);
        throw new Error('Account exists but no user data found in Firestore. Please contact support.');
      }

      // Derive key with existing salt from Firestore
      const derived = await CryptoService.deriveMasterKey(
        masterPassword,
        email,
        userData.salt
      );

      salt = userData.salt;
      hash = userData.masterPasswordHash;
      encryptionKey = derived.encryptionKey;

      // Verify password
      if (hash !== derived.hash) {
        await signOut(auth);
        throw new Error('Invalid password');
      }
    } else {
      // New account - generate new salt
      const derived = await CryptoService.deriveMasterKey(
        masterPassword,
        email
      );

      salt = derived.salt;
      hash = derived.hash;
      encryptionKey = derived.encryptionKey;
    }

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

    // Store encryption key and credentials in memory
    CryptoService.setEncryptionKey(encryptionKey);
    CryptoService.setCredentials(email, masterPassword);

    // Get user
    const user = await db.user.get(userId);

    // Save user data to Firestore (only if new account)
    if (!isExistingAccount) {
      await FirebaseSync.saveUserData(userCredential.user.uid, email, salt, hash);
    }

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
    let user = await db.user.where('email').equals(email).first();

    // If no local user, fetch from Firestore and create locally
    if (!user) {
      const userData = await FirebaseSync.getUserData(userCredential.user.uid);
      if (!userData) {
        await signOut(auth);
        return false;
      }

      // Derive key with Firestore salt
      const { encryptionKey, hash } = await CryptoService.deriveMasterKey(
        masterPassword,
        email,
        userData.salt
      );

      // Verify password
      if (hash !== userData.masterPasswordHash) {
        await signOut(auth);
        return false;
      }

      // Create local user with Firestore data
      const userId = uuid();
      await db.user.add({
        id: userId,
        email: userData.email,
        masterPasswordHash: userData.masterPasswordHash,
        salt: userData.salt,
        createdAt: Date.now()
      });

      // Create default vault if needed
      const vaults = await db.vaults.toArray();
      if (vaults.length === 0) {
        await db.vaults.add({
          id: uuid(),
          name: 'Personal',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }

      user = await db.user.get(userId);
      if (!user) {
        await signOut(auth);
        return false;
      }

      // Store encryption key in memory
      CryptoService.setEncryptionKey(encryptionKey);
    } else {
      // Local user exists, derive key with local salt
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
    }

    // Store credentials for re-authentication
    CryptoService.setCredentials(email, masterPassword);

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

    // Store encryption key and credentials in memory
    CryptoService.setEncryptionKey(encryptionKey);
    CryptoService.setCredentials(user.email, masterPassword);

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
