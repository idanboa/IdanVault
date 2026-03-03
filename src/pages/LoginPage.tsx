import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStoreFirebase';
import { BiometricAuth } from '@/lib/biometric';
import { CryptoService } from '@/lib/crypto';
import { FirebaseSync } from '@/lib/firebaseSync';
import { db } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Fingerprint } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showEnrollPrompt, setShowEnrollPrompt] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    setBiometricAvailable(BiometricAuth.isAvailable());
    setBiometricEnabled(BiometricAuth.isEnabled());

    // Auto-trigger biometric if enabled
    if (BiometricAuth.isEnabled()) {
      handleBiometricLogin();
    }
  }, []);

  const handleBiometricLogin = async () => {
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

          // Sign in to Firebase
          if (!auth.currentUser) {
            try {
              const { signInWithEmailAndPassword } = await import('firebase/auth');
              await signInWithEmailAndPassword(auth, storedCreds.email, storedCreds.password);
            } catch (err) {
              console.error('Firebase re-auth failed:', err);
            }
          }
        }

        // Get local user
        const users = await db.user.toArray();
        const user = users[0];

        if (user) {
          const { useAuthStore } = await import('@/store/authStoreFirebase');

          // Start Firebase sync
          if (auth.currentUser) {
            FirebaseSync.startSync(auth.currentUser.uid);
          }

          // Set authenticated state
          useAuthStore.setState({
            user,
            firebaseUser: auth.currentUser,
            isAuthenticated: true,
            isLocked: false
          });

          navigate('/vault');
        } else {
          setError('No local user found. Please login with your password.');
        }
      }
    } catch (err) {
      console.error('Biometric login failed:', err);
      // Don't show error - user may have cancelled, just let them use password
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      const success = await login(email, masterPassword);
      if (success) {
        // After successful login, offer biometric enrollment if available
        if (biometricAvailable && !biometricEnabled) {
          setShowEnrollPrompt(true);
        } else {
          navigate('/vault');
        }
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollBiometric = async () => {
    setLoading(true);
    try {
      const encryptionKey = CryptoService.getEncryptionKey();
      const users = await db.user.toArray();
      const success = await BiometricAuth.register(encryptionKey, users[0]?.id || 'default', email, masterPassword);

      if (success) {
        setBiometricEnabled(true);
      }
    } catch (err) {
      console.error('Biometric enrollment failed:', err);
    } finally {
      setLoading(false);
      navigate('/vault');
    }
  };

  const handleSkipBiometric = () => {
    navigate('/vault');
  };

  // Show biometric enrollment prompt
  if (showEnrollPrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-slate-100 p-4">
                <Fingerprint className="h-8 w-8 text-slate-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Enable Biometric Unlock?</CardTitle>
            <CardDescription>
              Use Face ID or Touch ID to unlock your vault next time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleEnrollBiometric} className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Enable Face / Touch ID'}
            </Button>
            <Button onClick={handleSkipBiometric} variant="outline" className="w-full">
              Skip for now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Enter your master password to unlock your vault
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {biometricEnabled && (
              <Button
                type="button"
                onClick={handleBiometricLogin}
                variant="outline"
                className="w-full h-16 text-lg"
                disabled={loading}
              >
                <Fingerprint className="mr-3 h-6 w-6" />
                Unlock with Face / Touch ID
              </Button>
            )}

            {biometricEnabled && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">or use password</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Unlocking...' : 'Unlock Vault'}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              This will sync your vault from the cloud to this device.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
