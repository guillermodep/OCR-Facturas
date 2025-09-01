import { useState } from 'react';

interface ArticuloFormProps {
  onSubmit: (nombre: string, codigo: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ArticuloForm({ onSubmit, onCancel, isSubmitting }: ArticuloFormProps) {
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(nombre, codigo);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="nombre" className="block text-sm font-medium text-slate-700">Nombre del Artículo</label>
        <input
          type="text"
          id="nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="codigo" className="block text-sm font-medium text-slate-700">Código</label>
        <input
          type="text"
          id="codigo"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div className="flex justify-end gap-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300 transition-colors"
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Artículo'}
        </button>
      </div>
    </form>
  );
}
