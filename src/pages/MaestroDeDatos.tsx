import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, AlertTriangle, Save } from 'lucide-react';
import { EditableRow } from '../components/EditableRow';
import { AddRowForm } from '../components/AddRowForm';

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
  const [saving, setSaving] = useState({ articulos: false, proveedores: false, delegaciones: false });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('articulos');
  const [searchTerms, setSearchTerms] = useState({ articulos: '', proveedores: '', delegaciones: '' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);


  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const fetchArticulos = async () => {
    try {
      const { data, error } = await supabase
        .from('articulos')
        .select('*')
        .range(0, 9999); // Obtener los primeros 10,000 artículos

      if (error) throw error;

      if (data) {
        setArticulos(data);
      }
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

  const handleUpdateArticulo = async (id: number, field: string, value: string) => {
    try {
      setSaving(prev => ({ ...prev, articulos: true }));
      const { error } = await supabase
        .from('articulos')
        .update({ [field]: field === 'iva' ? Number(value) : value })
        .eq('id', id);
      
      if (error) throw error;
      
      setArticulos(prev => 
        prev.map(item => 
          item.id === id ? { ...item, [field]: field === 'iva' ? Number(value) : value } : item
        )
      );
      showSuccessMessage('Artículo actualizado correctamente');
    } catch (err: any) {
      setError('Error al actualizar el artículo: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, articulos: false }));
    }
  };

  const handleDeleteArticulo = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar este artículo?')) return;
    
    try {
      setSaving(prev => ({ ...prev, articulos: true }));
      const { error } = await supabase
        .from('articulos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setArticulos(prev => prev.filter(item => item.id !== id));
      showSuccessMessage('Artículo eliminado correctamente');
    } catch (err: any) {
      setError('Error al eliminar el artículo: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, articulos: false }));
    }
  };

  const handleAddArticulo = async (newItem: Record<string, any>) => {
    try {
      setSaving(prev => ({ ...prev, articulos: true }));

      // Convertir IVA a número si existe
      if (newItem.iva) {
        newItem.iva = Number(newItem.iva);
      }

      // Asegurar que los campos de búsqueda sean strings válidos
      if (newItem.subfamilia) newItem.subfamilia = String(newItem.subfamilia).trim();
      if (newItem.codigo) newItem.codigo = String(newItem.codigo).trim();
      if (newItem.descripcion) newItem.descripcion = String(newItem.descripcion).trim();

      console.log('🔧 [MAESTRO] Agregando artículo:', newItem);

      const { data, error } = await supabase
        .from('articulos')
        .insert([newItem])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        setArticulos(prev => [...prev, data[0]]);
        showSuccessMessage('Artículo añadido correctamente');
      }
    } catch (err: any) {
      console.error('❌ [MAESTRO] Error al añadir artículo:', err);
      setError('Error al añadir el artículo: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, articulos: false }));
    }
  };

  const handleUpdateProveedor = async (id: number, field: string, value: string) => {
    try {
      setSaving(prev => ({ ...prev, proveedores: true }));
      const { error } = await supabase
        .from('proveedores')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      setProveedores(prev => 
        prev.map(item => 
          item.id === id ? { ...item, [field]: value } : item
        )
      );
      showSuccessMessage('Proveedor actualizado correctamente');
    } catch (err: any) {
      setError('Error al actualizar el proveedor: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, proveedores: false }));
    }
  };

  const handleDeleteProveedor = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar este proveedor?')) return;
    
    try {
      setSaving(prev => ({ ...prev, proveedores: true }));
      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setProveedores(prev => prev.filter(item => item.id !== id));
      showSuccessMessage('Proveedor eliminado correctamente');
    } catch (err: any) {
      setError('Error al eliminar el proveedor: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, proveedores: false }));
    }
  };

  const handleAddProveedor = async (newItem: Record<string, any>) => {
    try {
      setSaving(prev => ({ ...prev, proveedores: true }));
      const { data, error } = await supabase
        .from('proveedores')
        .insert([newItem])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        console.log('✅ [MAESTRO] Proveedor agregado:', data[0]);
        console.log('📊 [MAESTRO] Total proveedores ahora:', proveedores.length + 1);
        setProveedores(prev => [...prev, data[0]]);
        showSuccessMessage('Proveedor añadido correctamente');
      }
    } catch (err: any) {
      setError('Error al añadir el proveedor: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, proveedores: false }));
    }
  };

  const handleUpdateDelegacion = async (id: number, field: string, value: string) => {
    try {
      setSaving(prev => ({ ...prev, delegaciones: true }));
      const { error } = await supabase
        .from('delegaciones')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      setDelegaciones(prev => 
        prev.map(item => 
          item.id === id ? { ...item, [field]: value } : item
        )
      );
      showSuccessMessage('Delegación actualizada correctamente');
    } catch (err: any) {
      setError('Error al actualizar la delegación: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, delegaciones: false }));
    }
  };

  const handleDeleteDelegacion = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta delegación?')) return;
    
    try {
      setSaving(prev => ({ ...prev, delegaciones: true }));
      const { error } = await supabase
        .from('delegaciones')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setDelegaciones(prev => prev.filter(item => item.id !== id));
      showSuccessMessage('Delegación eliminada correctamente');
    } catch (err: any) {
      setError('Error al eliminar la delegación: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, delegaciones: false }));
    }
  };

  const handleAddDelegacion = async (newItem: Record<string, any>) => {
    try {
      setSaving(prev => ({ ...prev, delegaciones: true }));
      const { data, error } = await supabase
        .from('delegaciones')
        .insert([newItem])
        .select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setDelegaciones(prev => [...prev, data[0]]);
        showSuccessMessage('Delegación añadida correctamente');
      }
    } catch (err: any) {
      setError('Error al añadir la delegación: ' + err.message);
    } finally {
      setSaving(prev => ({ ...prev, delegaciones: false }));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'articulos':
        // Obtener subfamilias únicas existentes
        const subfamiliasUnicas = Array.from(
          new Set(
            articulos
              .map(a => a.subfamilia)
              .filter((s): s is string => s !== null && s !== undefined && s.trim() !== '')
              .sort()
          )
        );

        const filteredArticulos = articulos.filter(a => {
          if (!searchTerms.articulos.trim()) return true;

          const searchTerm = searchTerms.articulos.toLowerCase().trim();

          return (
            (a.subfamilia && String(a.subfamilia).toLowerCase().includes(searchTerm)) ||
            (a.codigo && String(a.codigo).toLowerCase().includes(searchTerm)) ||
            (a.descripcion && String(a.descripcion).toLowerCase().includes(searchTerm)) ||
            (a.id && String(a.id).includes(searchTerm))
          );
        });
        return (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-slate-800">Maestro de Artículos</h1>
              {saving.articulos && <div className="flex items-center text-indigo-600"><Save className="mr-2 h-5 w-5 animate-pulse" /><span>Guardando...</span></div>}
            </div>
            <AddRowForm 
              fields={[
                { 
                  key: 'subfamilia', 
                  label: 'Subfamilia',
                  type: 'select',
                  options: subfamiliasUnicas,
                  placeholder: 'Seleccionar subfamilia...'
                },
                { key: 'codigo', label: 'Código', required: true },
                { key: 'descripcion', label: 'Descripción', required: true },
                { key: 'iva', label: 'IVA', type: 'number', required: true }
              ]}
              onAdd={handleAddArticulo}
              tableName="artículo"
            />
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Buscar por subfamilia, código, descripción o ID..."
                className="flex-1 p-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                value={searchTerms.articulos}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, articulos: e.target.value }))}
              />
              <button
                onClick={fetchArticulos}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                title="Refrescar datos"
              >
                🔄
              </button>
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
                          <th scope="col" className="px-6 py-3">ID</th>
                          <th scope="col" className="px-6 py-3">Subfamilia</th>
                          <th scope="col" className="px-6 py-3">Código</th>
                          <th scope="col" className="px-6 py-3">Descripción</th>
                          <th scope="col" className="px-6 py-3">IVA</th>
                          <th scope="col" className="px-6 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredArticulos.map(a => (
                          <EditableRow
                            key={a.id}
                            item={a}
                            fields={[
                              { key: 'id', label: 'ID', type: 'number' },
                              { key: 'subfamilia', label: 'Subfamilia' },
                              { key: 'codigo', label: 'Código' },
                              { key: 'descripcion', label: 'Descripción' },
                              { key: 'iva', label: 'IVA', type: 'number', isPercentage: true }
                            ]}
                            onUpdate={handleUpdateArticulo}
                            onDelete={handleDeleteArticulo}
                          />
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
        const filteredProveedores = proveedores.filter(p => {
          const searchTerm = searchTerms.proveedores.toLowerCase();
          return (
            (p.codigo && p.codigo.toLowerCase().includes(searchTerm)) ||
            (p.nombre && p.nombre.toLowerCase().includes(searchTerm)) ||
            (p.cif && p.cif.toLowerCase().includes(searchTerm))
          );
        });
        return (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-slate-800">Maestro de Proveedores</h1>
              {saving.proveedores && <div className="flex items-center text-indigo-600"><Save className="mr-2 h-5 w-5 animate-pulse" /><span>Guardando...</span></div>}
            </div>
            <AddRowForm 
              fields={[
                { key: 'codigo', label: 'Código', required: true },
                { key: 'nombre', label: 'Nombre', required: true },
                { key: 'cif', label: 'CIF', required: true }
              ]}
              onAdd={handleAddProveedor}
              tableName="proveedor"
            />
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
                          <th scope="col" className="px-6 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProveedores.map(p => (
                          <EditableRow
                            key={p.id}
                            item={p}
                            fields={[
                              { key: 'codigo', label: 'Código' },
                              { key: 'nombre', label: 'Nombre' },
                              { key: 'cif', label: 'CIF' }
                            ]}
                            onUpdate={handleUpdateProveedor}
                            onDelete={handleDeleteProveedor}
                          />
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
        const filteredDelegaciones = delegaciones.filter(d => {
          const searchTerm = searchTerms.delegaciones.toLowerCase();
          return (
            (d.delegacion && d.delegacion.toLowerCase().includes(searchTerm)) ||
            (d.nombre_comercial && d.nombre_comercial.toLowerCase().includes(searchTerm)) ||
            (d.razon_social && d.razon_social.toLowerCase().includes(searchTerm))
          );
        });
        return (
          <section>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-slate-800">Maestro de Delegaciones</h1>
              {saving.delegaciones && <div className="flex items-center text-indigo-600"><Save className="mr-2 h-5 w-5 animate-pulse" /><span>Guardando...</span></div>}
            </div>
            <AddRowForm 
              fields={[
                { key: 'delegacion', label: 'Delegación', required: true },
                { key: 'nombre_comercial', label: 'Nombre Comercial', required: true },
                { key: 'razon_social', label: 'Razón Social', required: true }
              ]}
              onAdd={handleAddDelegacion}
              tableName="delegación"
            />
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
                          <th scope="col" className="px-6 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDelegaciones.map(d => (
                          <EditableRow
                            key={d.id}
                            item={d}
                            fields={[
                              { key: 'delegacion', label: 'Delegación' },
                              { key: 'nombre_comercial', label: 'Nombre Comercial' },
                              { key: 'razon_social', label: 'Razón Social' }
                            ]}
                            onUpdate={handleUpdateDelegacion}
                            onDelete={handleDeleteDelegacion}
                          />
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
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md border border-green-200">
          {successMessage}
        </div>
      )}
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
