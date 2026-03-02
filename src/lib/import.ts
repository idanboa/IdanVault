import { db } from './db';
import { CryptoService } from './crypto';
import { v4 as uuid } from 'uuid';
import { OnePasswordItem } from '@/types/entry.types';

export interface ImportResult {
  success: boolean;
  totalItems: number;
  imported: number;
  failed: number;
  errors: Array<{ item: string; error: string }>;
  summary: {
    LOGIN: number;
    SECURE_NOTE: number;
    CREDIT_CARD: number;
    SERVER: number;
    IDENTITY: number;
  };
}

export class ImportService {
  /**
   * Import 1Password JSON export
   */
  static async import1Password(
    jsonFile: File,
    vaultId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      totalItems: 0,
      imported: 0,
      failed: 0,
      errors: [],
      summary: { LOGIN: 0, SECURE_NOTE: 0, CREDIT_CARD: 0, SERVER: 0, IDENTITY: 0 }
    };

    try {
      // Read JSON file
      const text = await jsonFile.text();
      const data = JSON.parse(text);

      // Handle both all_items.json and items array
      const items: OnePasswordItem[] = Array.isArray(data) ? data : data.items || [];
      result.totalItems = items.length;

      // Import each item
      for (const item of items) {
        try {
          await this.importItem(item, vaultId);
          result.imported++;

          // Update summary
          const category = item.category as keyof typeof result.summary;
          if (category in result.summary) {
            result.summary[category]++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push({
            item: item.title,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      result.success = result.failed === 0;
    } catch (error) {
      result.success = false;
      result.errors.push({
        item: 'Import process',
        error: error instanceof Error ? error.message : 'Failed to parse JSON'
      });
    }

    return result;
  }

  /**
   * Import a single item
   */
  private static async importItem(item: OnePasswordItem, vaultId: string) {
    // Validate category
    const validCategories = ['LOGIN', 'SECURE_NOTE', 'CREDIT_CARD', 'SERVER', 'IDENTITY'];
    if (!validCategories.includes(item.category)) {
      throw new Error(`Invalid category: ${item.category}`);
    }

    // Prepare encrypted data
    const dataToEncrypt = {
      fields: item.fields,
      urls: item.urls,
      sections: item.sections,
      tags: item.tags
    };

    // Encrypt the data
    const encryptedData = CryptoService.encrypt(dataToEncrypt);

    // Create entry
    await db.entries.add({
      id: uuid(),
      vaultId,
      category: item.category as any,
      title: item.title,
      encryptedData,
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      originalCreatedAt: new Date(item.created_at).getTime()
    });

    // Process tags
    if (item.tags && item.tags.length > 0) {
      for (const tagName of item.tags) {
        // Find or create tag
        let tag = await db.tags.where('name').equals(tagName).first();
        if (!tag) {
          const tagId = uuid();
          await db.tags.add({ id: tagId, name: tagName });
          tag = { id: tagId, name: tagName };
        }

        // Link entry to tag
        await db.entryTags.add({
          id: uuid(),
          entryId: item.id,
          tagId: tag.id
        });
      }
    }
  }
}
