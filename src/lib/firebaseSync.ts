import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc
} from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firestore, auth } from './firebase';
import { CryptoService } from './crypto';
import { db, Entry } from './db';

export class FirebaseSync {
  private static unsubscribe: (() => void) | null = null;
  private static syncingUserId: string | null = null;

  /**
   * Get the current Firebase user ID, re-authenticating if needed
   */
  private static async ensureAuth(): Promise<string> {
    // If already authenticated, return uid
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }

    // Try to re-authenticate with stored credentials
    const credentials = CryptoService.getCredentials();
    if (credentials) {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        credentials.email,
        credentials.password
      );
      return userCredential.user.uid;
    }

    throw new Error('Not authenticated with Firebase');
  }

  /**
   * Start syncing with Firebase (idempotent - safe to call multiple times)
   */
  static async startSync(userId: string) {
    // Don't restart if already syncing for same user
    if (this.syncingUserId === userId && this.unsubscribe) return;

    // Stop any existing sync first
    this.stopSync();
    this.syncingUserId = userId;

    // Listen to Firestore changes
    const q = query(
      collection(firestore, 'entries'),
      where('userId', '==', userId)
    );

    this.unsubscribe = onSnapshot(q, async (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;

      // Batch all IndexedDB writes in a single transaction so liveQuery only fires once
      await db.transaction('rw', db.entries, async () => {
        const entriesToPut: Entry[] = [];
        const idsToDelete: string[] = [];

        for (const change of changes) {
          const data = change.doc.data();

          if (change.type === 'added' || change.type === 'modified') {
            const localEntry = await db.entries.get(change.doc.id);

            if (!localEntry || data.updatedAt > localEntry.updatedAt) {
              entriesToPut.push({
                id: change.doc.id,
                vaultId: data.vaultId,
                category: data.category,
                title: data.title,
                encryptedData: data.encryptedData,
                favorite: data.favorite || false,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                originalCreatedAt: data.originalCreatedAt
              });
            }
          } else if (change.type === 'removed') {
            idsToDelete.push(change.doc.id);
          }
        }

        if (entriesToPut.length > 0) {
          await db.entries.bulkPut(entriesToPut);
        }

        if (idsToDelete.length > 0) {
          await db.entries.bulkDelete(idsToDelete);
        }
      });
    });
  }

  /**
   * Stop syncing
   */
  static stopSync() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.syncingUserId = null;
  }

  /**
   * Upload entry to Firebase
   */
  static async uploadEntry(entry: Entry) {
    const uid = await this.ensureAuth();

    const entryRef = doc(firestore, 'entries', entry.id);
    await setDoc(entryRef, {
      userId: uid,
      vaultId: entry.vaultId,
      category: entry.category,
      title: entry.title,
      encryptedData: entry.encryptedData,
      favorite: entry.favorite,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      originalCreatedAt: entry.originalCreatedAt || null
    });
  }

  /**
   * Delete entry from Firebase
   */
  static async deleteEntry(entryId: string) {
    await this.ensureAuth();

    const entryRef = doc(firestore, 'entries', entryId);
    await deleteDoc(entryRef);
  }

  /**
   * Upload all local entries to Firebase
   */
  static async uploadAllEntries(userId?: string) {
    const uid = userId || await this.ensureAuth();

    // Temporarily use the provided uid for getUid calls
    const entries = await db.entries.toArray();

    for (const entry of entries) {
      const entryRef = doc(firestore, 'entries', entry.id);
      await setDoc(entryRef, {
        userId: uid,
        vaultId: entry.vaultId,
        category: entry.category,
        title: entry.title,
        encryptedData: entry.encryptedData,
        favorite: entry.favorite,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        originalCreatedAt: entry.originalCreatedAt || null
      });
    }
  }

  /**
   * Save user data (salt and hash) to Firestore
   */
  static async saveUserData(userId: string, email: string, salt: string, masterPasswordHash: string) {
    const userRef = doc(firestore, 'users', userId);
    await setDoc(userRef, {
      email,
      salt,
      masterPasswordHash,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  /**
   * Get user data from Firestore by Firebase UID
   */
  static async getUserData(userId: string): Promise<{ email: string; salt: string; masterPasswordHash: string } | null> {
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        email: data.email,
        salt: data.salt,
        masterPasswordHash: data.masterPasswordHash
      };
    }

    return null;
  }
}
