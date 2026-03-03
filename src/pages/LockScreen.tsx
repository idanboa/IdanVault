import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStoreFirebase';
import { BiometricAuth } from '@/lib/biometric';
import { CryptoService } from '@/lib/crypto';
import { FirebaseSync } from '@/lib/firebaseSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, Fingerprint } from 'lucide-react';

export function LockScreen() {
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const navigate = useNavigate();
  const { unlock, user, firebaseUser } = useAuthStore();

  useEffect(() => {
    setBiometricEnabled(BiometricAuth.isEnabled());

    // Auto-trigger biometric if enabled
    if (BiometricAuth.isEnabled()) {
      handleBiometricUnlock();
    }
  }, []);

  const handleBiometricUnlock = async () => {
    setLoading(true);
    setError('');
    try {
      const encryptionKey = await BiometricAuth.authenticate();
      if (encryptionKey) {
        // Set encryption key directly
        CryptoService.setEncryptionKey(encryptionKey);

        // Restore stored credentials for Firebase re-authentication
        const storedCreds = BiometricAuth.getStoredCredentials();
        const { auth } = await import('@/lib/firebase');

        if (storedCreds) {
          CryptoService.setCredentials(storedCreds.email, storedCreds.password);

          // Re-authenticate with Firebase if needed
          if (!auth.currentUser) {
            try {
              const { signInWithEmailAndPassword } = await import('firebase/auth');
              await signInWithEmailAndPassword(auth, storedCreds.email, storedCreds.password);
            } catch (err) {
              console.error('Firebase re-auth failed:', err);
            }
          }
        }

        // Restart Firebase sync
        if (auth.currentUser) {
          FirebaseSync.startSync(auth.currentUser.uid);
        } else if (firebaseUser) {
          FirebaseSync.startSync(firebaseUser.uid);
        }

        // Set authenticated state
        useAuthStore.setState({
          firebaseUser: auth.currentUser,
          isAuthenticated: true,
          isLocked: false
        });

        navigate('/vault');
      }
    } catch (err) {
      console.error('Biometric unlock failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const success = await unlock(masterPassword);
      if (success) {
        navigate('/vault');
      } else {
        setError('Invalid password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-600/15 p-4">
              <Lock className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Vault Locked</CardTitle>
          <CardDescription>
            {user?.email && <span className="block mb-1">{user.email}</span>}
            Enter your master password to unlock
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {biometricEnabled && (
              <>
                <Button
                  type="button"
                  onClick={handleBiometricUnlock}
                  variant="outline"
                  className="w-full h-16 text-lg"
                  disabled={loading}
                >
                  <Fingerprint className="mr-3 h-6 w-6" />
                  Unlock with Face / Touch ID
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or use password</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
                autoFocus={!biometricEnabled}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-900/30 border border-red-800 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Unlocking...' : 'Unlock Vault'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Your vault was locked due to inactivity
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
