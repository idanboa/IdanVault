import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Entry } from '@/lib/db';
import { useAuthStore } from '@/store/authStoreFirebase';
import { useEntries } from '@/hooks/useEntriesFirebase';
import { useAutoLock } from '@/hooks/useAutoLock';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, CreditCard, FileText, Server, User, LogOut, Search, Plus, Download, Star } from 'lucide-react';

const CATEGORY_ICONS: Record<Entry['category'], any> = {
  LOGIN: Lock,
  SECURE_NOTE: FileText,
  CREDIT_CARD: CreditCard,
  SERVER: Server,
  IDENTITY: User
};

export function VaultPage() {
  const [filteredEntries, setFilteredEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const navigate = useNavigate();
  const { logout, isLocked, isAuthenticated } = useAuthStore();
  const { entries, loading, syncError } = useEntries();

  // Enable auto-lock after 15 minutes of inactivity
  useAutoLock(true);

  useEffect(() => {
    const filtered = entries.filter(entry =>
      entry.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredEntries(filtered);
  }, [searchQuery, entries]);

  // Redirect to lock screen when locked
  useEffect(() => {
    if (isLocked) {
      navigate('/lock');
    }
  }, [isLocked, navigate]);

  // Redirect to login if not authenticated (no encryption key)
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate('/login');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/setup');
  };

  const handleExport = () => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      entries: entries,
      entryCount: entries.length
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idanvault-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl p-4">
        {/* Sync error banner */}
        {syncError && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm p-3 rounded-md mb-4">
            {syncError}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">IdanVault</h1>
            <p className="text-sm text-muted-foreground">{entries.length} items</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/new')} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Entry List */}
        <div className="space-y-2">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : filteredEntries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'No entries found' : 'No entries yet. Import your 1Password data!'}
              </CardContent>
            </Card>
          ) : (
            filteredEntries.map(entry => {
              const Icon = CATEGORY_ICONS[entry.category];
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-4 rounded-lg border border-transparent hover:bg-card hover:border-border cursor-pointer transition-all active:scale-[0.99]"
                  onClick={() => navigate(`/entry/${entry.id}`)}
                >
                  <div className="rounded-lg bg-blue-600/15 p-2">
                    <Icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground truncate">{entry.title}</h3>
                      {entry.favorite && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{entry.category}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
