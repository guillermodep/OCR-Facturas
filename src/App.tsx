import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { CargarFacturasPage } from './pages/CargarFacturasPage';
import { MaestroDeDatosPage } from './pages/MaestroDeDatos';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<CargarFacturasPage />} />
          <Route path="maestro-de-datos" element={<MaestroDeDatosPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
