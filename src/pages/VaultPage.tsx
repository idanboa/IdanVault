import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Entry } from '@/lib/db';
import { useAuthStore } from '@/store/authStoreFirebase';
import { useEntries } from '@/hooks/useEntriesFirebase';
import { useAutoLock } from '@/hooks/useAutoLock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, CreditCard, FileText, Server, User, LogOut, Search, Eye, EyeOff, Copy, Plus, Trash2, Download, Star } from 'lucide-react';

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
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [decryptedData, setDecryptedData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { logout, isLocked, isAuthenticated } = useAuthStore();
  const { entries, loading, syncError, getDecryptedEntry, deleteEntry, updateEntry } = useEntries();

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

  const handleSelectEntry = async (entry: Entry) => {
    setSelectedEntry(entry);
    try {
      const decrypted = await getDecryptedEntry(entry.id);
      setDecryptedData(decrypted.data);
    } catch (err) {
      console.error('Failed to decrypt entry:', err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/setup');
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;

    if (window.confirm(`Delete "${selectedEntry.title}"?`)) {
      await deleteEntry(selectedEntry.id);
      setSelectedEntry(null);
      setDecryptedData(null);
    }
  };

  const handleExport = () => {
    // Export all entries as encrypted JSON backup
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

  const handleToggleFavorite = async () => {
    if (!selectedEntry) return;

    await updateEntry(selectedEntry.id, { favorite: !selectedEntry.favorite });

    // Update local state
    setSelectedEntry({ ...selectedEntry, favorite: !selectedEntry.favorite });
  };

  const getFieldValue = (field: any) => {
    if (field.type === 'CONCEALED' && field.purpose === 'PASSWORD') {
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono">{showPassword ? field.value : '••••••••'}</span>
          <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button onClick={() => handleCopy(field.value)} className="text-muted-foreground hover:text-foreground">
            <Copy className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return field.value || '-';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto p-4">
        {/* Sync error banner */}
        {syncError && (
          <div className="bg-red-100 border border-red-300 text-red-800 text-sm p-3 rounded-md mb-4">
            {syncError}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">IdanVault</h1>
            <p className="text-sm text-muted-foreground">{entries.length} items</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/new')} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              New
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entry List */}
          <div className="md:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              {loading ? (
                <p className="text-center text-muted-foreground">Loading...</p>
              ) : filteredEntries.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    {searchQuery ? 'No entries found' : 'No entries yet. Import your 1Password data!'}
                  </CardContent>
                </Card>
              ) : (
                filteredEntries.map(entry => {
                  const Icon = CATEGORY_ICONS[entry.category];
                  return (
                    <Card
                      key={entry.id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${selectedEntry?.id === entry.id ? 'bg-accent' : ''}`}
                      onClick={() => handleSelectEntry(entry)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{entry.title}</h3>
                              {entry.favorite && (
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{entry.category}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Entry Detail */}
          <div className="md:col-span-2">
            {selectedEntry && decryptedData ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedEntry.title}</CardTitle>
                      <CardDescription>{selectedEntry.category}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleToggleFavorite}
                        variant="outline"
                        size="sm"
                      >
                        <Star
                          className={`h-4 w-4 ${selectedEntry.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
                        />
                      </Button>
                      <Button onClick={handleDelete} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {decryptedData.fields?.map((field: any) => (
                    <div key={field.id} className="space-y-1">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {field.label}
                      </Label>
                      <div className="text-sm">
                        {getFieldValue(field)}
                      </div>
                    </div>
                  ))}

                  {decryptedData.urls && decryptedData.urls.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-muted-foreground">URLs</Label>
                      {decryptedData.urls.map((url: any, i: number) => (
                        <div key={i}>
                          <a
                            href={url.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {url.href}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  Select an entry to view details
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Missing Label component - adding here
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
