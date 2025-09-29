import React, { useState } from 'react';
import { Plus } from 'lucide-react';

interface Field {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface AddRowFormProps {
  fields: Field[];
  onAdd: (newItem: Record<string, any>) => void;
  tableName: string;
}

export const AddRowForm: React.FC<AddRowFormProps> = ({ fields, onAdd, tableName }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customInputs, setCustomInputs] = useState<Record<string, boolean>>({});

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));

    // Handle custom input toggle for select fields
    if (value === '__nuevo__') {
      setCustomInputs(prev => ({ ...prev, [key]: true }));
      setFormData(prev => ({ ...prev, [key]: '' }));
    } else {
      setCustomInputs(prev => ({ ...prev, [key]: false }));
    }

    // Clear error when field is edited
    if (errors[key]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      if (field.required && (!formData[field.key] || formData[field.key].trim() === '')) {
        newErrors[field.key] = `${field.label} es obligatorio`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onAdd(formData);
      setFormData({});
      setIsFormOpen(false);
    }
  };

  return (
    <div className="mb-6">
      {!isFormOpen ? (
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} className="mr-2" />
          Añadir {tableName}
        </button>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
          <h3 className="text-lg font-medium text-slate-900 mb-4">Añadir nuevo {tableName}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {fields.map(field => (
                <div key={field.key} className="flex flex-col">
                  <label className="text-sm font-medium text-slate-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <div className="space-y-2">
                      <select
                        value={customInputs[field.key] ? '__nuevo__' : (formData[field.key] || '')}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className={`p-2 border rounded-md ${
                          errors[field.key] ? 'border-red-500' : 'border-slate-300'
                        } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                      >
                        <option value="">{field.placeholder || 'Seleccionar...'}</option>
                        {field.options?.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                        <option value="__nuevo__">➕ Nuevo...</option>
                      </select>
                      {customInputs[field.key] && (
                        <input
                          type="text"
                          placeholder={`Nueva ${field.label.toLowerCase()}...`}
                          value={formData[field.key] || ''}
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className={`p-2 border rounded-md ${
                            errors[field.key] ? 'border-red-500' : 'border-slate-300'
                          } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className={`p-2 border rounded-md ${
                        errors[field.key] ? 'border-red-500' : 'border-slate-300'
                      } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                    />
                  )}
                  {errors[field.key] && (
                    <p className="text-red-500 text-xs mt-1">{errors[field.key]}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setFormData({});
                  setErrors({});
                  setCustomInputs({});
                }}
                className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
