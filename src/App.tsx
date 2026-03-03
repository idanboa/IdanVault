import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStoreFirebase';
import { SetupPage } from './pages/SetupPage';
import { ImportPage } from './pages/ImportPage';
import { VaultPage } from './pages/VaultPage';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const { checkSetup, initAuth, isLoading } = useAuthStore();

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

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            isSetupComplete ? (
              <Navigate to="/vault" replace />
            ) : (
              <Navigate to="/setup" replace />
            )
          }
        />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/vault" element={<VaultPage />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
