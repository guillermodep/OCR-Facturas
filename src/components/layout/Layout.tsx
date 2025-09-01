import { NavLink, Outlet } from 'react-router-dom';
import { Upload, Database } from 'lucide-react';

const navItems = [
  { name: 'Cargar Facturas', href: '/', icon: Upload },
  { name: 'Maestro de Datos', href: '/maestro-de-datos', icon: Database },
];

export function Layout() {
  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200">
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
                    `flex items-center px-4 py-3 my-1 rounded-lg transition-colors duration-200 ${
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
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
