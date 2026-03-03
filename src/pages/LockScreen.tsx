import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStoreFirebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

export function LockScreen() {
  const [masterPassword, setMasterPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { unlock, user } = useAuthStore();

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-slate-100 p-4">
              <Lock className="h-8 w-8 text-slate-600" />
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
            <div className="space-y-2">
              <Label htmlFor="password">Master Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
                autoFocus
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

            <p className="text-xs text-muted-foreground text-center">
              Your vault was locked due to inactivity
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
