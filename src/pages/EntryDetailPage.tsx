import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Entry } from '@/lib/db';
import { useAuthStore } from '@/store/authStoreFirebase';
import { useEntries } from '@/hooks/useEntriesFirebase';
import { useAutoLock } from '@/hooks/useAutoLock';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Lock, CreditCard, FileText, Server, User,
  Eye, EyeOff, Copy, Trash2, Star, Check, ExternalLink
} from 'lucide-react';

const CATEGORY_ICONS: Record<Entry['category'], any> = {
  LOGIN: Lock,
  SECURE_NOTE: FileText,
  CREDIT_CARD: CreditCard,
  SERVER: Server,
  IDENTITY: User
};

const CATEGORY_LABELS: Record<Entry['category'], string> = {
  LOGIN: 'Login',
  SECURE_NOTE: 'Secure Note',
  CREDIT_CARD: 'Credit Card',
  SERVER: 'Server',
  IDENTITY: 'Identity'
};

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLocked, isAuthenticated } = useAuthStore();
  const { entries, getDecryptedEntry, deleteEntry, updateEntry } = useEntries();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [decryptedData, setDecryptedData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useAutoLock(true);

  useEffect(() => {
    if (isLocked) navigate('/lock');
  }, [isLocked, navigate]);

  useEffect(() => {
    if (!isAuthenticated) navigate('/login');
  }, [isAuthenticated, navigate]);

  // Find entry from live entries list
  useEffect(() => {
    if (!id || !entries.length) return;
    const found = entries.find(e => e.id === id);
    if (found) {
      setEntry(found);
    }
  }, [id, entries]);

  // Decrypt when entry is found
  useEffect(() => {
    if (!entry) return;
    getDecryptedEntry(entry.id)
      .then(result => {
        setDecryptedData(result.data);
        setLoadError(false);
      })
      .catch(err => {
        console.error('Failed to decrypt entry:', err);
        setLoadError(true);
      });
  }, [entry?.id]);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (window.confirm(`Delete "${entry.title}"?`)) {
      await deleteEntry(entry.id);
      navigate('/vault');
    }
  };

  const handleToggleFavorite = async () => {
    if (!entry) return;
    await updateEntry(entry.id, { favorite: !entry.favorite });
  };

  if (!entry) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">
          {loadError ? 'Failed to load entry' : 'Loading...'}
        </p>
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[entry.category];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-2xl p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => navigate('/vault')}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleToggleFavorite}
              variant="ghost"
              size="icon"
              title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star
                className={`h-5 w-5 ${entry.favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
              />
            </Button>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-lg bg-blue-600/15 p-2.5">
              <Icon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{entry.title}</h1>
              <span className="text-sm text-muted-foreground">
                {CATEGORY_LABELS[entry.category]}
              </span>
            </div>
          </div>
        </div>

        {/* Fields */}
        {decryptedData && (
          <div className="space-y-1">
            {decryptedData.fields?.map((field: any) => {
              const isPassword = field.type === 'CONCEALED' && field.purpose === 'PASSWORD';
              const fieldValue = field.value || '';
              if (!fieldValue) return null;

              return (
                <div
                  key={field.id}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-card transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {field.label}
                    </p>
                    <p className="text-base text-foreground font-mono truncate">
                      {isPassword
                        ? (showPassword ? fieldValue : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
                        : fieldValue
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isPassword && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword
                          ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                          : <Eye className="h-4 w-4 text-muted-foreground" />
                        }
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopy(fieldValue, field.id)}
                      title="Copy"
                    >
                      {copiedField === field.id
                        ? <Check className="h-4 w-4 text-green-400" />
                        : <Copy className="h-4 w-4 text-muted-foreground" />
                      }
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* URLs */}
            {decryptedData.urls?.map((url: any, i: number) => (
              <div
                key={`url-${i}`}
                className="flex items-center justify-between p-4 rounded-lg hover:bg-card transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Website
                  </p>
                  <a
                    href={url.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-400 hover:text-blue-300 hover:underline truncate flex items-center gap-1.5"
                  >
                    {url.href}
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(url.href, `url-${i}`)}
                    title="Copy URL"
                  >
                    {copiedField === `url-${i}`
                      ? <Check className="h-4 w-4 text-green-400" />
                      : <Copy className="h-4 w-4 text-muted-foreground" />
                    }
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loadError && (
          <div className="text-center p-8 text-muted-foreground">
            Failed to decrypt entry data
          </div>
        )}

        {/* Delete */}
        <div className="mt-12 pt-6 border-t border-border">
          <Button
            onClick={handleDelete}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Entry
          </Button>
        </div>
      </div>
    </div>
  );
}
