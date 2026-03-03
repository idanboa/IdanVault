import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportService, ImportResult } from '@/lib/import';
import { db } from '@/lib/db';
import { FirebaseSync } from '@/lib/firebaseSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/json') {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      // Get default vault
      const vault = await db.vaults.toArray();
      const vaultId = vault[0]?.id || 'default';

      // Import data
      const importResult = await ImportService.import1Password(file, vaultId);
      setResult(importResult);

      if (importResult.success) {
        // Upload all entries to Firebase
        await FirebaseSync.uploadAllEntries();

        // Navigate to vault after a delay
        setTimeout(() => {
          navigate('/vault');
        }, 2000);
      }
    } catch (err) {
      console.error('Import error:', err);
      setResult({
        success: false,
        totalItems: 0,
        imported: 0,
        failed: 0,
        errors: [{ item: 'Import', error: err instanceof Error ? err.message : 'Unknown error' }],
        summary: { LOGIN: 0, SECURE_NOTE: 0, CREDIT_CARD: 0, SERVER: 0, IDENTITY: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/vault');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Import from 1Password</CardTitle>
          <CardDescription>
            Upload your 1Password export file (all_items.json) to import your passwords
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="file">1Password Export File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="file"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  {file && (
                    <span className="text-sm text-muted-foreground">
                      {file.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="flex-1"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {loading ? 'Importing...' : 'Import'}
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="outline"
                >
                  Skip
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Your data will be encrypted with your master password before storage
              </p>
            </>
          ) : (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
                <h3 className="font-semibold mb-2">
                  {result.success ? 'Import Successful!' : 'Import Completed with Errors'}
                </h3>
                <div className="text-sm space-y-1">
                  <p>Total items: {result.totalItems}</p>
                  <p>Imported: {result.imported}</p>
                  {result.failed > 0 && <p>Failed: {result.failed}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-100 p-3 rounded-md">
                  <div className="font-medium">Logins</div>
                  <div className="text-2xl font-bold">{result.summary.LOGIN}</div>
                </div>
                <div className="bg-slate-100 p-3 rounded-md">
                  <div className="font-medium">Secure Notes</div>
                  <div className="text-2xl font-bold">{result.summary.SECURE_NOTE}</div>
                </div>
                <div className="bg-slate-100 p-3 rounded-md">
                  <div className="font-medium">Credit Cards</div>
                  <div className="text-2xl font-bold">{result.summary.CREDIT_CARD}</div>
                </div>
                <div className="bg-slate-100 p-3 rounded-md">
                  <div className="font-medium">Other</div>
                  <div className="text-2xl font-bold">
                    {result.summary.SERVER + result.summary.IDENTITY}
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 p-3 rounded-md">
                  <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err.item}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.success && (
                <p className="text-center text-sm text-muted-foreground">
                  Redirecting to your vault...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
