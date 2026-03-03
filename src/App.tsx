import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStoreFirebase';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { LockScreen } from './pages/LockScreen';
import { ImportPage } from './pages/ImportPage';
import { VaultPage } from './pages/VaultPage';
import { NewEntryPage } from './pages/NewEntryPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { DebugPage } from './pages/DebugPage';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const { checkSetup, initAuth, isLoading, firebaseUser, user, isAuthenticated, isLocked } = useAuthStore();

  useEffect(() => {
    initAuth();
    checkSetup().then(setIsSetupComplete);
  }, []);

  if (isLoading || isSetupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">IdanVault</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Determine which page to show
  const getDefaultRoute = () => {
    // If locked, go to lock screen
    if (isLocked && user) {
      return <Navigate to="/lock" replace />;
    }

    // If authenticated (encryption key in memory), go to vault
    if (isAuthenticated && isSetupComplete) {
      return <Navigate to="/vault" replace />;
    }

    // If local user exists but not authenticated, need to login
    if (isSetupComplete && !isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    // If Firebase user exists but no local user, go to login
    if (firebaseUser && !user) {
      return <Navigate to="/login" replace />;
    }

    // Otherwise, go to setup
    return <Navigate to="/setup" replace />;
  };

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={getDefaultRoute()} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lock" element={<LockScreen />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/new" element={<NewEntryPage />} />
        <Route path="/entry/:id" element={<EntryDetailPage />} />
        <Route path="/debug" element={<DebugPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
