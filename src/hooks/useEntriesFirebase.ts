import { db, Entry } from '@/lib/db';
import { CryptoService } from '@/lib/crypto';
import { FirebaseSync } from '@/lib/firebaseSync';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';

export function useEntries(vaultId?: string) {
  // Use Dexie's liveQuery for reactive updates (no polling needed)
  const entries = useLiveQuery(
    () => db.entries.orderBy('updatedAt').reverse().toArray(),
    [],
    []
  );

  const loading = entries === undefined;

  // Get decrypted entry
  const getDecryptedEntry = async (id: string) => {
    const entry = await db.entries.get(id);
    if (!entry) throw new Error('Entry not found');

    return {
      ...entry,
      data: CryptoService.decrypt(entry.encryptedData)
    };
  };

  // Create entry
  const createEntry = async (
    category: Entry['category'],
    title: string,
    data: any
  ) => {
    const encryptedData = CryptoService.encrypt(data);

    const entry: Entry = {
      id: uuid(),
      vaultId: vaultId || 'default',
      category,
      title,
      encryptedData,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Save locally
    await db.entries.add(entry);

    // Sync to Firebase
    await FirebaseSync.uploadEntry(entry);

    return entry;
  };

  // Update entry
  const updateEntry = async (id: string, updates: Partial<Entry>, data?: any) => {
    const toUpdate: any = {
      ...updates,
      updatedAt: Date.now()
    };

    if (data) {
      toUpdate.encryptedData = CryptoService.encrypt(data);
    }

    // Update locally
    await db.entries.update(id, toUpdate);

    // Get updated entry and sync to Firebase
    const entry = await db.entries.get(id);
    if (entry) {
      await FirebaseSync.uploadEntry(entry);
    }
  };

  // Delete entry
  const deleteEntry = async (id: string) => {
    // Delete locally
    await db.entries.delete(id);

    // Delete from Firebase
    await FirebaseSync.deleteEntry(id);
  };

  return {
    entries: entries || [],
    loading,
    getDecryptedEntry,
    createEntry,
    updateEntry,
    deleteEntry
  };
}
