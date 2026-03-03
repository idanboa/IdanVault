import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEntries } from '@/hooks/useEntriesFirebase';
import { useAutoLock } from '@/hooks/useAutoLock';
import { useAuthStore } from '@/store/authStoreFirebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';

export function NewEntryPage() {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { createEntry } = useEntries();
  const { isLocked, isAuthenticated } = useAuthStore();

  // Enable auto-lock
  useAutoLock(true);

  // Redirect to lock screen when locked
  useEffect(() => {
    if (isLocked) {
      navigate('/lock');
    }
  }, [isLocked, navigate]);

  // Redirect to login if not authenticated (no encryption key)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    try {
      // Create entry data structure matching 1Password format
      const data = {
        fields: [
          username && {
            id: 'username',
            label: 'username',
            type: 'STRING',
            purpose: 'USERNAME',
            value: username
          },
          password && {
            id: 'password',
            label: 'password',
            type: 'CONCEALED',
            purpose: 'PASSWORD',
            value: password
          },
          notes && {
            id: 'notes',
            label: 'notes',
            type: 'STRING',
            purpose: 'NOTES',
            value: notes
          }
        ].filter(Boolean), // Remove null/undefined fields
        urls: url ? [{ href: url, primary: true }] : []
      };

      await createEntry('LOGIN', title, data);
      navigate('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl">
        <Button
          onClick={() => navigate('/vault')}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Vault
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>New Login Entry</CardTitle>
            <CardDescription>
              Create a new password entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., GitHub, Gmail, etc."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  className="w-full min-h-[100px] px-3 py-2 text-sm border border-border bg-input text-foreground rounded-md placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/25 transition-all"
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {error && (
                <div className="text-sm text-red-300 bg-red-900/30 border border-red-800 p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Entry'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/vault')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
