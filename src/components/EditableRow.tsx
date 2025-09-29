import React from 'react';
import { EditableCell } from './EditableCell';
import { Trash2 } from 'lucide-react';

interface EditableRowProps {
  item: any;
  fields: {
    key: string;
    label: string;
    type?: 'text' | 'number';
    isPercentage?: boolean;
  }[];
  onUpdate: (id: number, field: string, value: string) => void;
  onDelete: (id: number) => void;
}

export const EditableRow: React.FC<EditableRowProps> = ({
  item,
  fields,
  onUpdate,
  onDelete
}) => {
  return (
    <>
      {fields.map((field) => (
        <td key={field.key} className="p-0">
          <EditableCell
            value={item[field.key] || ''}
            onSave={(newValue) => onUpdate(item.id, field.key, newValue)}
            type={field.type || 'text'}
            isPercentage={field.isPercentage}
            className={field.key === 'codigo' || field.key === 'cif' || field.key === 'delegacion' ? 'font-mono' : 
                      field.key === 'nombre' || field.key === 'descripcion' || field.key === 'nombre_comercial' ? 'font-semibold text-slate-900' : ''}
          />
        </td>
      ))}
      <td className="px-4 py-2">
        <button
          onClick={() => onDelete(item.id)}
          className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </>
  );
};
