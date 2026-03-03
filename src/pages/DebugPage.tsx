import { useState } from 'react';
import { useAuthStore } from '@/store/authStoreFirebase';
import { FirebaseSync } from '@/lib/firebaseSync';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DebugPage() {
  const [status, setStatus] = useState<string>('Ready. Click "Check Status" to begin.');
  const authStore = useAuthStore();

  const checkStatus = async () => {
    try {
      const entries = await db.entries.toArray();
      const users = await db.user.toArray();

      const info = `
Firebase User: ${authStore.firebaseUser ? authStore.firebaseUser.email : 'Not logged in'}
Local User: ${authStore.user ? authStore.user.email : 'None'}
Local Entries: ${entries.length}
Local DB Users: ${users.length}
      `;

      setStatus(info);
    } catch (err) {
      setStatus(`Error checking status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const manualSync = async () => {
    try {
      if (!authStore.firebaseUser) {
        setStatus('❌ Error: Not logged into Firebase.\n\nYou created your account before we added Firebase.\n\nSolution: Click "Clear Local Data" below, then reload and create a new account.');
        return;
      }

      if (!authStore.user) {
        setStatus('❌ Error: No local user found.');
        return;
      }

      setStatus('Syncing to Firebase...\n\n1. Saving user data (salt)...');

      // Save user data to Firestore (salt and hash)
      await FirebaseSync.saveUserData(
        authStore.firebaseUser.uid,
        authStore.user.email,
        authStore.user.salt,
        authStore.user.masterPasswordHash
      );

      setStatus('Syncing to Firebase...\n\n1. ✅ User data saved\n2. Uploading entries...');

      // Upload all entries (pass userId directly)
      await FirebaseSync.uploadAllEntries(authStore.firebaseUser.uid);

      setStatus('Syncing to Firebase...\n\n1. ✅ User data saved\n2. ✅ Entries uploaded\n3. Starting real-time sync...');

      // Start real-time sync listener
      await FirebaseSync.startSync(authStore.firebaseUser.uid);

      const entries = await db.entries.toArray();
      setStatus(`✅ Sync complete!\n\n- User data (salt) saved to Firestore\n- ${entries.length} entries uploaded to Firestore\n- Real-time sync activated\n\nYou can now log in from other devices!\n\nFirebase console:\nhttps://console.firebase.google.com/project/idanvaultproduction/firestore/databases/-default-/data`);
    } catch (err) {
      setStatus(`❌ Sync error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const clearLocalData = async () => {
    try {
      const confirmed = window.confirm('⚠️ This will delete ALL local data.\n\nYou will need to:\n1. Reload the page\n2. Create a new account\n3. Import your 1Password data again\n\nContinue?');

      if (!confirmed) return;

      await db.entries.clear();
      await db.vaults.clear();
      await db.user.clear();
      await db.tags.clear();
      await db.entryTags.clear();

      setStatus('✅ Local data cleared!\n\nNow:\n1. Reload the page (CMD+R or F5)\n2. Create a new account\n3. Import your data');
    } catch (err) {
      setStatus(`Error clearing data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>🔧 Debug & Sync Tools</CardTitle>
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

          <div className="bg-card border border-border p-4 rounded-md">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {status}
            </pre>
          </div>

          <div className="text-sm text-muted-foreground border-t pt-4">
            <p className="font-semibold mb-2">📖 How to Fix Firebase Sync:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Check Status</strong> - See if you're logged into Firebase</li>
              <li><strong>If "Firebase User: Not logged in":</strong>
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>This means you created your account BEFORE we added Firebase</li>
                  <li>Click "Clear Local Data" button</li>
                  <li>Reload the page</li>
                  <li>Create a NEW account (this time with Firebase!)</li>
                  <li>Import your 1Password data again</li>
                  <li>✅ Now it will sync across all devices!</li>
                </ul>
              </li>
              <li><strong>If "Firebase User: your@email.com":</strong>
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>You're already logged into Firebase! ✅</li>
                  <li>Click "Manual Sync to Firebase" to upload your data</li>
                </ul>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
