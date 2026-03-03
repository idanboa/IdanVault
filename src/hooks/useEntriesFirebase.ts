import { useState, useEffect } from 'react';
import { db, Entry } from '@/lib/db';
import { CryptoService } from '@/lib/crypto';
import { FirebaseSync } from '@/lib/firebaseSync';
import { v4 as uuid } from 'uuid';

export function useEntries(vaultId?: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load entries
  const loadEntries = async () => {
    setLoading(true);
    try {
      const query = vaultId
        ? db.entries.where('vaultId').equals(vaultId)
        : db.entries.toCollection();

      const items = await query.reverse().sortBy('updatedAt');
      setEntries(items);
    } catch (error) {
      console.error('Failed to load entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();

    // Set up listener for IndexedDB changes (from Firebase sync)
    const interval = setInterval(loadEntries, 2000); // Reload every 2 seconds to catch synced changes

    return () => clearInterval(interval);
  }, [vaultId]);

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

    await loadEntries();
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

    await loadEntries();
  };

  // Delete entry
  const deleteEntry = async (id: string) => {
    // Delete locally
    await db.entries.delete(id);

    // Delete from Firebase
    await FirebaseSync.deleteEntry(id);

    await loadEntries();
  };

  return {
    entries,
    loading,
    loadEntries,
    getDecryptedEntry,
    createEntry,
    updateEntry,
    deleteEntry
  };
}
