import Dexie, { Table } from 'dexie';

export interface User {
  id: string;
  email: string;
  masterPasswordHash: string;  // SHA-256 hash for verification
  salt: string;                // For PBKDF2
  createdAt: number;
}

export interface Vault {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Entry {
  id: string;
  vaultId: string;
  category: 'LOGIN' | 'SECURE_NOTE' | 'CREDIT_CARD' | 'SERVER' | 'IDENTITY';
  title: string;
  encryptedData: string;  // AES-encrypted JSON blob
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  originalCreatedAt?: number;  // From 1Password import
}

export interface Tag {
  id: string;
  name: string;
}

export interface EntryTag {
  id: string;
  entryId: string;
  tagId: string;
}

export interface Setting {
  key: string;
  value: string;
}

export class IdanVaultDB extends Dexie {
  user!: Table<User>;
  vaults!: Table<Vault>;
  entries!: Table<Entry>;
  tags!: Table<Tag>;
  entryTags!: Table<EntryTag>;
  settings!: Table<Setting>;

  constructor() {
    super('IdanVault');
    this.version(1).stores({
      user: 'id, email',
      vaults: 'id, name, createdAt',
      entries: 'id, vaultId, category, title, favorite, createdAt, updatedAt',
      tags: 'id, name',
      entryTags: 'id, entryId, tagId',
      settings: 'key'
    });
  }
}

export const db = new IdanVaultDB();
