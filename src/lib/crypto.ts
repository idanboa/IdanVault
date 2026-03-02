import CryptoJS from 'crypto-js';

export class CryptoService {
  private static encryptionKey: string | null = null;

  /**
   * Derive encryption key from master password
   */
  static async deriveMasterKey(
    masterPassword: string,
    email: string,
    salt?: string
  ): Promise<{ encryptionKey: string; salt: string; hash: string }> {
    // Generate salt if not provided
    const userSalt = salt || CryptoJS.lib.WordArray.random(128/8).toString();

    // Derive key using PBKDF2 (100k iterations)
    const derived = CryptoJS.PBKDF2(
      masterPassword + email,
      userSalt,
      { keySize: 256/32, iterations: 100000 }
    );

    const encryptionKey = derived.toString();

    // Create hash for verification (SHA-256)
    const hash = CryptoJS.SHA256(encryptionKey).toString();

    return { encryptionKey, salt: userSalt, hash };
  }

  /**
   * Store encryption key in memory
   */
  static setEncryptionKey(key: string) {
    this.encryptionKey = key;
  }

  /**
   * Get encryption key from memory
   */
  static getEncryptionKey(): string {
    if (!this.encryptionKey) {
      throw new Error('Not authenticated - encryption key not available');
    }
    return this.encryptionKey;
  }

  /**
   * Encrypt data using AES-256
   */
  static encrypt(data: any): string {
    const key = this.getEncryptionKey();
    const json = JSON.stringify(data);

    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(128/8);

    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(json, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    // Return IV:ciphertext
    return iv.toString() + ':' + encrypted.toString();
  }

  /**
   * Decrypt data
   */
  static decrypt<T = any>(ciphertext: string): T {
    const key = this.getEncryptionKey();

    // Split IV and ciphertext
    const [ivHex, encryptedData] = ciphertext.split(':');
    const iv = CryptoJS.enc.Hex.parse(ivHex);

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    const json = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(json);
  }

  /**
   * Clear encryption key from memory
   */
  static clearKey() {
    this.encryptionKey = null;
  }

  /**
   * Check if authenticated
   */
  static isAuthenticated(): boolean {
    return this.encryptionKey !== null;
  }
}
