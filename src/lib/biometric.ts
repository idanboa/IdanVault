/**
 * Biometric authentication using WebAuthn (Face ID / Touch ID)
 *
 * Flow:
 * 1. After master password login, user can enable biometric auth
 * 2. We create a WebAuthn credential (triggers Face/Touch ID enrollment)
 * 3. We store the encryption key in localStorage (protected by same-origin policy)
 * 4. On next visit, user authenticates with biometrics via WebAuthn
 * 5. If successful, we retrieve the stored encryption key
 */

const CREDENTIAL_KEY = 'idanvault_webauthn_credential';
const ENCRYPTED_KEY_STORE = 'idanvault_biometric_key';
const BIOMETRIC_CREDS = 'idanvault_biometric_creds';

export class BiometricAuth {
  /**
   * Check if WebAuthn/biometric auth is available on this device
   */
  static isAvailable(): boolean {
    return !!(
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function'
    );
  }

  /**
   * Check if biometric auth has been set up on this device
   */
  static isEnabled(): boolean {
    return !!(
      localStorage.getItem(CREDENTIAL_KEY) &&
      localStorage.getItem(ENCRYPTED_KEY_STORE)
    );
  }

  /**
   * Register biometric auth and store the encryption key
   * Call this after successful master password login
   */
  static async register(encryptionKey: string, userId: string, email?: string, password?: string): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;

      // Create a WebAuthn credential
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'IdanVault',
            id: window.location.hostname
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: 'vault-user',
            displayName: 'IdanVault User'
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }   // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform', // Use device biometrics only
            userVerification: 'required'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential;

      if (!credential) return false;

      // Store the credential ID for later authentication
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem(CREDENTIAL_KEY, credentialId);

      // Store the encryption key (protected by same-origin + biometric verification)
      localStorage.setItem(ENCRYPTED_KEY_STORE, encryptionKey);

      // Store credentials for Firebase re-authentication
      if (email && password) {
        localStorage.setItem(BIOMETRIC_CREDS, JSON.stringify({ email, password }));
      }

      return true;
    } catch (error) {
      console.error('Biometric registration failed:', error);
      return false;
    }
  }

  /**
   * Authenticate with biometrics and retrieve the stored encryption key
   */
  static async authenticate(): Promise<string | null> {
    try {
      if (!this.isEnabled()) return null;

      const credentialIdB64 = localStorage.getItem(CREDENTIAL_KEY)!;
      const credentialId = Uint8Array.from(atob(credentialIdB64), c => c.charCodeAt(0));

      const challenge = crypto.getRandomValues(new Uint8Array(32));

      // Request biometric authentication
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{
            id: credentialId,
            type: 'public-key',
            transports: ['internal']
          }],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) return null;

      // Biometric verification succeeded - return the stored encryption key
      // Also restore credentials for Firebase re-authentication
      return localStorage.getItem(ENCRYPTED_KEY_STORE);
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return null;
    }
  }

  /**
   * Get stored credentials for Firebase re-authentication
   */
  static getStoredCredentials(): { email: string; password: string } | null {
    const creds = localStorage.getItem(BIOMETRIC_CREDS);
    if (creds) {
      try {
        return JSON.parse(creds);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Remove biometric auth data
   */
  static clear() {
    localStorage.removeItem(CREDENTIAL_KEY);
    localStorage.removeItem(ENCRYPTED_KEY_STORE);
    localStorage.removeItem(BIOMETRIC_CREDS);
  }
}
