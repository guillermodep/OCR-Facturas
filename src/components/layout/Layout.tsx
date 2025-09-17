import { NavLink, Outlet } from 'react-router-dom';
import { Upload, Database, LogOut, FileText, BarChart, Users } from 'lucide-react';

const navItems = [
  { name: 'Cargar Facturas', href: '/', icon: Upload },
  { name: 'Facturas Procesadas', href: '/facturas-procesadas', icon: FileText },
  { name: 'Analítica', href: '/analitica', icon: BarChart },
  { name: 'Maestro de Datos', href: '/maestro-de-datos', icon: Database },
];

interface LayoutProps {
  onLogout: () => void;
  username: string | null;
}

export function Layout({ onLogout, username }: LayoutProps) {
  // Verificar si el usuario es administrador (simplificado por ahora)
  const isAdmin = username === 'admin' || username?.includes('admin'); // Esto debería ser más robusto

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div>
          <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-800">OCR Facturas</h1>
          </div>
          <nav className="mt-6 px-4">
            <ul>
              {navItems.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center px-4 py-3 my-1 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    <span className="font-medium">{item.name}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-auto p-4 space-y-2">
          {isAdmin && (
            <NavLink
              to="/gestion-usuarios"
              className={({ isActive }) =>
                `flex items-center px-4 py-3 rounded-lg transition-all duration-200 transform hover:scale-105 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Users className="h-5 w-5 mr-3" />
              <span className="font-medium">Gestión de Usuarios</span>
            </NavLink>
          )}
          <button
            onClick={onLogout}
            className="flex items-center w-full px-4 py-3 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
            title={`Cerrar sesión como ${username}`}
          >
            <LogOut className="h-5 w-5 mr-3" />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
