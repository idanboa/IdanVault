import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStoreFirebase';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';
import { ImportPage } from './pages/ImportPage';
import { VaultPage } from './pages/VaultPage';
import { DebugPage } from './pages/DebugPage';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const { checkSetup, initAuth, isLoading, firebaseUser, user } = useAuthStore();

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
    // If local user exists, go to vault
    if (isSetupComplete) {
      return <Navigate to="/vault" replace />;
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
        <Route path="/import" element={<ImportPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/debug" element={<DebugPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
