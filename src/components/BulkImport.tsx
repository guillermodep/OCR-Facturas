import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface BulkImportProps {
  tableName: string;
  fields: { key: string; label: string; required?: boolean; type?: 'number' }[];
  existingData: Record<string, any>[];
  duplicateKey: string; // Campo por el que detectar duplicados
  onImport: (data: Record<string, any>[]) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

export const BulkImport: React.FC<BulkImportProps> = ({
  tableName,
  fields,
  existingData,
  duplicateKey,
  onImport,
  isOpen,
  onClose
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<{ rowIndex: number; existingItem: Record<string, any> }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        validateAndPreviewData(jsonData);
      } catch (error) {
        setValidationErrors(['Error al procesar el archivo Excel']);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateAndPreviewData = (data: any[]) => {
    const errors: string[] = [];
    const validData: Record<string, any>[] = [];
    const foundDuplicates: { rowIndex: number; existingItem: Record<string, any> }[] = [];

    // Validar campos del archivo
    const requiredFields = fields.filter(f => f.required).map(f => f.key);
    const allFields = fields.map(f => f.key);

    // Crear mapa de valores existentes para comparación rápida
    const existingValues = new Set(
      existingData.map(item => String(item[duplicateKey]).toLowerCase().trim())
    );

    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      const processedRow: Record<string, any> = {};

      // Verificar campos requeridos
      requiredFields.forEach(field => {
        if (!row[field] && row[field] !== 0) {
          rowErrors.push(`Fila ${index + 2}: Campo "${field}" es obligatorio`);
        }
      });

      // Procesar campos
      allFields.forEach(field => {
        const fieldConfig = fields.find(f => f.key === field);
        if (row[field] !== undefined && row[field] !== null) {
          if (fieldConfig?.type === 'number') {
            const numValue = Number(row[field]);
            if (isNaN(numValue)) {
              rowErrors.push(`Fila ${index + 2}: Campo "${field}" debe ser numérico`);
            } else {
              processedRow[field] = numValue;
            }
          } else {
            processedRow[field] = String(row[field]).trim();
          }
        }
      });

      // Verificar duplicados
      const rowValue = String(row[duplicateKey] || '').toLowerCase().trim();
      if (rowValue && existingValues.has(rowValue)) {
        const existingItem = existingData.find(item => 
          String(item[duplicateKey]).toLowerCase().trim() === rowValue
        );
        if (existingItem) {
          foundDuplicates.push({ 
            rowIndex: index, 
            existingItem 
          });
        }
      }

      if (rowErrors.length === 0) {
        validData.push(processedRow);
      } else {
        errors.push(...rowErrors);
      }
    });

    setPreviewData(validData);
    setValidationErrors(errors);
    setDuplicates(foundDuplicates);
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setIsProcessing(true);
    try {
      await onImport(previewData);
      onClose();
      setFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      setDuplicates([]);
    } catch (error) {
      setValidationErrors(['Error al importar los datos']);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-900">
            Carga Masiva - {tableName}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Seleccionar archivo Excel o CSV (.xlsx, .xls, .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {/* Duplicates Warning */}
          {duplicates.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="text-yellow-400 mr-2 mt-0.5" size={16} />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">
                    Duplicados detectados ({duplicates.length})
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Las siguientes filas contienen datos que ya existen en la base de datos.
                    Si continúas con la importación, estos registros serán ignorados.
                  </p>
                  <div className="mt-2 space-y-1">
                    {duplicates.slice(0, 3).map((duplicate, index) => (
                      <div key={index} className="text-xs text-yellow-700">
                        Fila {duplicate.rowIndex + 2}: {duplicateKey} "{duplicate.existingItem[duplicateKey]}" ya existe
                      </div>
                    ))}
                    {duplicates.length > 3 && (
                      <div className="text-xs text-yellow-700">
                        ... y {duplicates.length - 3} duplicados más
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Data */}
          {previewData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">
                Vista previa ({previewData.length} registros válidos)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {fields.map(field => (
                        <th key={field.key} className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {previewData.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {fields.map(field => (
                          <td key={field.key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {row[field.key] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 5 && (
                  <p className="text-sm text-slate-500 mt-2">
                    ... y {previewData.length - 5} registros más
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Instrucciones:</h4>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>El archivo debe tener los siguientes campos: {fields.map(f => f.label).join(', ')}</li>
              <li>Formatos aceptados: Excel (.xlsx, .xls) o CSV (.csv)</li>
              <li>Los campos marcados como obligatorios deben tener valores</li>
              <li>Los campos numéricos deben contener números válidos</li>
              <li>La primera fila debe contener los nombres de las columnas</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50"
            disabled={isProcessing}
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isProcessing}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Importando...
              </>
            ) : (
              <>
                <Upload size={16} className="mr-2" />
                Importar {previewData.length} registros
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
