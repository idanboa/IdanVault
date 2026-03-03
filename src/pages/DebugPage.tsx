import { useState } from 'react';
import { useAuthStore } from '@/store/authStoreFirebase';
import { FirebaseSync } from '@/lib/firebaseSync';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DebugPage() {
  const [status, setStatus] = useState<string>('');
  const { firebaseUser, user } = useAuthStore();

  const checkStatus = async () => {
    const entries = await db.entries.toArray();

    const info = `
Firebase User: ${firebaseUser ? firebaseUser.email : 'Not logged in'}
Local User: ${user ? user.email : 'None'}
Local Entries: ${entries.length}
    `;

    setStatus(info);
  };

  const manualSync = async () => {
    try {
      if (!firebaseUser) {
        setStatus('Error: Not logged into Firebase. Please logout and login again.');
        return;
      }

      setStatus('Syncing to Firebase...');
      await FirebaseSync.uploadAllEntries();
      setStatus('✅ Sync complete! Check Firebase console.');
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const clearLocalData = async () => {
    if (!confirm('This will delete ALL local data. Continue?')) return;

    await db.entries.clear();
    await db.vaults.clear();
    await db.user.clear();
    await db.tags.clear();
    await db.entryTags.clear();

    setStatus('✅ Local data cleared. Reload the page.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Debug & Sync Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button onClick={checkStatus} className="w-full">
              Check Status
            </Button>

            <Button onClick={manualSync} variant="outline" className="w-full">
              Manual Sync to Firebase
            </Button>

            <Button onClick={clearLocalData} variant="destructive" className="w-full">
              Clear Local Data (Fresh Start)
            </Button>
          </div>

          {status && (
            <pre className="bg-slate-100 p-4 rounded-md text-sm whitespace-pre-wrap">
              {status}
            </pre>
          )}

          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-2">Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Click "Check Status" to see if you're logged into Firebase</li>
              <li>If Firebase User shows "Not logged in":
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>Click "Clear Local Data"</li>
                  <li>Reload the page</li>
                  <li>Create a NEW account with Firebase</li>
                  <li>Import your 1Password data again</li>
                </ul>
              </li>
              <li>If Firebase User shows your email, click "Manual Sync to Firebase"</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
