import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, UserPlus, Edit, Trash2, Shield } from 'lucide-react';

interface User {
  id: string;
  username: string;
  password: string;
}

interface UserFormData {
  username: string;
  password: string;
}

export function GestionUsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: ''
  });

  useEffect(() => {
    checkUserRole();
    fetchUsers();
  }, []);

  const checkUserRole = () => {
    const username = sessionStorage.getItem('username');
    if (username !== 'admin') {
      setError('Acceso denegado. Solo el administrador puede acceder a esta sección.');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setError(null);

      const { error: userError } = await supabase
        .from('users')
        .insert([
          {
            username: formData.username,
            password: formData.password,
          }
        ]);

      if (userError) throw userError;

      setIsCreateDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setError(null);

      const { error } = await supabase
        .from('users')
        .update({
          username: formData.username,
          password: formData.password,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    try {
      setError(null);

      if (username === 'admin') {
        setError('No se puede eliminar al usuario administrador del sistema.');
        return;
      }

      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: ''
    });
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: user.password
    });
  };

  const currentUsername = sessionStorage.getItem('username');
  const isAdmin = currentUsername === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Shield className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600">Solo el administrador puede acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando usuarios...</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Users className="mr-3 h-8 w-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white border border-gray-200 shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-gray-900 font-semibold">Crear Nuevo Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</p>}
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Crear Usuario</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      {user.username === 'admin' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <Shield className="mr-1 h-3 w-3" />
                          Administrador
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Eliminar usuario ${user.username}?`)) {
                          handleDeleteUser(user.id, user.username);
                        }
                      }}
                      className={`px-3 py-1 text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded-md text-sm flex items-center ${
                        user.username === 'admin' ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                      disabled={user.username === 'admin'}
                      title={user.username === 'admin' ? 'No se puede eliminar al administrador' : 'Eliminar usuario'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de edición */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="bg-white border border-gray-200 shadow-lg">
            <DialogHeader>
              <DialogTitle className="text-gray-900 font-semibold">Editar Usuario</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-200">{error}</p>}
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)} className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                  Cancelar
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Actualizar Usuario</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
