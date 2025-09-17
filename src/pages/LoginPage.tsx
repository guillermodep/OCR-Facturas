import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, LogIn, Eye, EyeOff, Shield, User, Lock } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        throw new Error('Credenciales incorrectas');
      }

      onLoginSuccess(username);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-xl mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-800 mb-3">
            Sistema Inteligente de Identificación de Facturas y Remitos
          </h1>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <div className="flex items-center gap-3">
              <LogIn className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-semibold">Iniciar Sesión</h2>
                <p className="text-blue-100 text-sm">Accede a tu cuenta segura</p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form className="px-8 py-8 space-y-6" onSubmit={handleLogin}>
            {/* Username Field */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-500" />
                Usuario
              </label>
              <div className="relative group">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-4 pl-12 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 text-slate-800 font-medium placeholder-slate-400"
                  placeholder="Ingresa tu usuario"
                  required
                  disabled={loading}
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <User className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-500" />
                Contraseña
              </label>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-4 pl-12 pr-12 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 text-slate-800 font-medium placeholder-slate-400"
                  placeholder="Ingresa tu contraseña"
                  required
                  disabled={loading}
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-blue-500 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">⚠</span>
                  </div>
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-200 flex items-center justify-center gap-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </>
              )}
            </button>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Sistema seguro • IA OCR • Procesamiento Automático
              </p>
            </div>
          </form>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-white rounded-full shadow-md border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-blink-soft"></div>
              <span className="text-sm text-slate-600">Sistema Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-blink-soft" style={{ animationDelay: '0.3s' }}></div>
              <span className="text-sm text-slate-600">IA OCR Activo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-blink-soft" style={{ animationDelay: '0.6s' }}></div>
              <span className="text-sm text-slate-600">Base de Datos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
