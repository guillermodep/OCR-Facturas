import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';
// import * as Dialog from '@radix-ui/react-dialog';
// import { ArticuloForm } from '../components/ArticuloForm';

interface Articulo {
  id: number;
  subfamilia: string | null;
  codigo: string;
  descripcion: string;
  iva: number;
}

interface Proveedor {
  id: number;
  nombre: string;
  codigo: string;
  cif: string;
}

interface Delegacion {
  id: number;
  delegacion: string;
  nombre_comercial: string;
  razon_social: string;
}

type Tab = 'articulos' | 'proveedores' | 'delegaciones';

export function MaestroDeDatosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [loading, setLoading] = useState({ articulos: true, proveedores: true, delegaciones: true });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('articulos');
  const [searchTerms, setSearchTerms] = useState({ articulos: '', proveedores: '', delegaciones: '' });


  // const [isFormOpen, setIsFormOpen] = useState(false);
  // const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchArticulos = async () => {
    try {
      const { data, error } = await supabase.from('articulos').select('*');
      if (error) throw error;
      if (data) setArticulos(data);
    } catch (err: any) {
      setError('Error al obtener los artículos: ' + err.message);
    } finally {
      setLoading(prev => ({ ...prev, articulos: false }));
    }
  };

  const fetchProveedores = async () => {
    try {
      const { data, error } = await supabase.from('proveedores').select('*');
      if (error) throw error;
      if (data) setProveedores(data);
    } catch (err: any) {
      setError('Error al obtener los proveedores: ' + err.message);
    } finally {
      setLoading(prev => ({ ...prev, proveedores: false }));
    }
  };

  const fetchDelegaciones = async () => {
    try {
      const { data, error } = await supabase.from('delegaciones').select('*');
      if (error) throw error;
      if (data) setDelegaciones(data);
    } catch (err: any) {
      setError('Error al obtener las delegaciones: ' + err.message);
    } finally {
      setLoading(prev => ({ ...prev, delegaciones: false }));
    }
  };

  useEffect(() => {
    fetchArticulos();
    fetchProveedores();
    fetchDelegaciones();
  }, []);

  // const handleAddArticle = async (nombre: string, codigo: string) => {
  //   setIsSubmitting(true);
  //   try {
  //     const { error } = await supabase.from('articulos').insert([{ nombre, codigo }]);
  //     if (error) throw error;
  //     await fetchArticulos();
  //     setIsFormOpen(false);
  //   } catch (err: any) {
  //     alert('Error al añadir el artículo: ' + err.message);
  //   } finally {
  //     setIsSubmitting(false);
  //   }
  // };

  const renderContent = () => {
    switch (activeTab) {
      case 'articulos':
        const filteredArticulos = articulos.filter(a =>
          (a.subfamilia && a.subfamilia.toLowerCase().includes(searchTerms.articulos.toLowerCase())) ||
          a.codigo.toLowerCase().includes(searchTerms.articulos.toLowerCase()) ||
          a.descripcion.toLowerCase().includes(searchTerms.articulos.toLowerCase())
        );
        return (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-slate-800">Maestro de Artículos</h1>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar por subfamilia, código o descripción..."
                className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerms.articulos}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, articulos: e.target.value }))}
              />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
              {loading.articulos ? (
                <div className="flex items-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span>Cargando artículos...</span></div>
              ) : error ? (
                <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-lg"><AlertTriangle className="mr-2 h-5 w-5" /><span>{error}</span></div>
              ) : (
                <div>
                  {filteredArticulos.length > 0 ? (
                    <table className="w-full text-sm text-left text-slate-700">
                      <thead className="text-xs text-slate-800 uppercase bg-slate-100">
                        <tr>
                          <th scope="col" className="px-6 py-3">Subfamilia</th>
                          <th scope="col" className="px-6 py-3">Código</th>
                          <th scope="col" className="px-6 py-3">Descripción</th>
                          <th scope="col" className="px-6 py-3">IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredArticulos.map(a => (
                          <tr key={a.id} className="bg-white border-b hover:bg-slate-50">
                            <td className="px-6 py-4">{a.subfamilia || 'N/A'}</td>
                            <td className="px-6 py-4 font-mono">{a.codigo}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{a.descripcion}</td>
                            <td className="px-6 py-4">{a.iva}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-slate-500 text-center py-8">No se encontraron artículos.</p>}
                </div>
              )}
            </div>
          </section>
        );
      case 'proveedores':
        const filteredProveedores = proveedores.filter(p =>
          p.codigo.toLowerCase().includes(searchTerms.proveedores.toLowerCase()) ||
          p.nombre.toLowerCase().includes(searchTerms.proveedores.toLowerCase()) ||
          p.cif.toLowerCase().includes(searchTerms.proveedores.toLowerCase())
        );
        return (
          <section>
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Maestro de Proveedores</h1>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar por código, nombre o CIF..."
                className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerms.proveedores}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, proveedores: e.target.value }))}
              />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
              {loading.proveedores ? (
                <div className="flex items-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span>Cargando proveedores...</span></div>
              ) : error ? (
                <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-lg"><AlertTriangle className="mr-2 h-5 w-5" /><span>{error}</span></div>
              ) : (
                 <div>
                  {filteredProveedores.length > 0 ? (
                    <table className="w-full text-sm text-left text-slate-700">
                      <thead className="text-xs text-slate-800 uppercase bg-slate-100">
                        <tr>
                          <th scope="col" className="px-6 py-3">Código</th>
                          <th scope="col" className="px-6 py-3">Nombre</th>
                          <th scope="col" className="px-6 py-3">CIF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProveedores.map(p => (
                          <tr key={p.id} className="bg-white border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-mono">{p.codigo}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{p.nombre}</td>
                            <td className="px-6 py-4 font-mono">{p.cif}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-slate-500 text-center py-8">No se encontraron proveedores.</p>}
                </div>
              )}
            </div>
          </section>
        );
      case 'delegaciones':
        const filteredDelegaciones = delegaciones.filter(d =>
          d.delegacion.toLowerCase().includes(searchTerms.delegaciones.toLowerCase()) ||
          d.nombre_comercial.toLowerCase().includes(searchTerms.delegaciones.toLowerCase()) ||
          d.razon_social.toLowerCase().includes(searchTerms.delegaciones.toLowerCase())
        );
        return (
          <section>
            <h1 className="text-3xl font-bold text-slate-800 mb-6">Maestro de Delegaciones</h1>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar por delegación, nombre o razón social..."
                className="w-full p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerms.delegaciones}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, delegaciones: e.target.value }))}
              />
            </div>
            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
              {loading.delegaciones ? (
                <div className="flex items-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /><span>Cargando delegaciones...</span></div>
              ) : error ? (
                <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-lg"><AlertTriangle className="mr-2 h-5 w-5" /><span>{error}</span></div>
              ) : (
                 <div>
                  {filteredDelegaciones.length > 0 ? (
                    <table className="w-full text-sm text-left text-slate-700">
                      <thead className="text-xs text-slate-800 uppercase bg-slate-100">
                        <tr>
                          <th scope="col" className="px-6 py-3">Delegación</th>
                          <th scope="col" className="px-6 py-3">Nombre Comercial</th>
                          <th scope="col" className="px-6 py-3">Razón Social</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDelegaciones.map(d => (
                          <tr key={d.id} className="bg-white border-b hover:bg-slate-50">
                            <td className="px-6 py-4 font-mono">{d.delegacion}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{d.nombre_comercial}</td>
                            <td className="px-6 py-4">{d.razon_social}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-slate-500 text-center py-8">No se encontraron delegaciones.</p>}
                </div>
              )}
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold text-slate-900 mb-8">Maestro de Datos</h1>
      <div className="mb-8 border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('articulos')}
            className={`${activeTab === 'articulos' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Artículos
          </button>
          <button
            onClick={() => setActiveTab('proveedores')}
            className={`${activeTab === 'proveedores' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Proveedores
          </button>
          <button
            onClick={() => setActiveTab('delegaciones')}
            className={`${activeTab === 'delegaciones' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Delegaciones
          </button>
        </nav>
      </div>
      {renderContent()}
    </div>
  );
}
