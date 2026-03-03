import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { firestore } from './firebase';
import { db, Entry } from './db';
import { CryptoService } from './crypto';

export class FirebaseSync {
  private static unsubscribe: (() => void) | null = null;
  private static userId: string | null = null;

  /**
   * Start syncing with Firebase
   */
  static async startSync(userId: string) {
    this.userId = userId;

    // Listen to Firestore changes
    const q = query(
      collection(firestore, 'entries'),
      where('userId', '==', userId)
    );

    this.unsubscribe = onSnapshot(q, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const data = change.doc.data();

        if (change.type === 'added' || change.type === 'modified') {
          // Check if entry exists locally
          const localEntry = await db.entries.get(change.doc.id);

          // Only update if Firestore version is newer
          if (!localEntry || data.updatedAt > localEntry.updatedAt) {
            await db.entries.put({
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
          await db.entries.delete(change.doc.id);
        }
      }
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
    this.userId = null;
  }

  /**
   * Upload entry to Firebase
   */
  static async uploadEntry(entry: Entry) {
    if (!this.userId) throw new Error('Not syncing');

    const entryRef = doc(firestore, 'entries', entry.id);
    await setDoc(entryRef, {
      userId: this.userId,
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
    if (!this.userId) throw new Error('Not syncing');

    const entryRef = doc(firestore, 'entries', entryId);
    await deleteDoc(entryRef);
  }

  /**
   * Upload all local entries to Firebase (initial sync)
   */
  static async uploadAllEntries() {
    if (!this.userId) throw new Error('Not syncing');

    const entries = await db.entries.toArray();

    for (const entry of entries) {
      await this.uploadEntry(entry);
    }
  }
}
