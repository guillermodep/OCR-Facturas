import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { CargarFacturasPage } from './pages/CargarFacturasPage';
import { MaestroDeDatosPage } from './pages/MaestroDeDatos';
import { FacturasProcesadasPage } from './pages/FacturasProcesadasPage';
import { AnaliticaPage } from './pages/AnaliticaPage';
import { LoginPage } from './pages/LoginPage';
import { GestionUsuariosPage } from './pages/GestionUsuariosPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const loggedIn = sessionStorage.getItem('isAuthenticated') === 'true';
    const storedUsername = sessionStorage.getItem('username');
    if (loggedIn && storedUsername) {
      setIsAuthenticated(true);
      setUsername(storedUsername);
    }
  }, []);

  const handleLoginSuccess = (loggedInUsername: string) => {
    sessionStorage.setItem('isAuthenticated', 'true');
    sessionStorage.setItem('username', loggedInUsername);
    setIsAuthenticated(true);
    setUsername(loggedInUsername);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('username');
    setIsAuthenticated(false);
    setUsername(null);
  };

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout onLogout={handleLogout} username={username} />}>
          <Route index element={<CargarFacturasPage />} />
          <Route path="maestro-de-datos" element={<MaestroDeDatosPage />} />
          <Route path="facturas-procesadas" element={<FacturasProcesadasPage />} />
          <Route path="analitica" element={<AnaliticaPage />} />
          <Route path="gestion-usuarios" element={<GestionUsuariosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
