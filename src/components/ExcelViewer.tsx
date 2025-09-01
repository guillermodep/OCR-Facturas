import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from './ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

interface ExcelData {
  headers: string[];
  rows: any[][];
}

interface InvoiceItem {
  codCentral?: string;
  codArticulo?: string;
  descripcion?: string;
  unidades?: number;
  precioUd?: number;
  dto?: number;
  iva?: number;
  neto?: number;
  [key: string]: any;
}

interface ExcelViewerProps {
  processedData: any[];
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ processedData }) => {
  const [data, setData] = useState<ExcelData>({
    headers: [
      'Proveedor',
      'Cód. Central',
      'Cód. Artículo',
      'Código Maestro',
      'Descripción',
      'Unidades',
      'Precio Ud.',
      '% Dto.',
      '% IVA',
      'Neto',
      'Importe'
    ],
    rows: []
  });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (processedData && processedData.length > 0) {
      const newRows = processedData.flatMap(invoice => {
        // Manejar diferentes estructuras de datos
        const invoiceData = invoice.data || invoice;
        const items = invoiceData.items || invoiceData.data?.items || [];
        
        if (Array.isArray(items) && items.length > 0) {
          return items.map((item: InvoiceItem) => {
            const proveedor = invoiceData.proveedor || invoiceData.data?.proveedor || '';
            const unidades = item.unidades ?? 0;
            const precioUd = item.precioUd ?? 0;
            const dto = item.dto ?? 0;
            const iva = item.iva ?? 0; // por defecto 0 si no hay IVA detectado
            const netoCalc = item.neto ?? (unidades * precioUd * (1 - dto / 100));
            const importe = netoCalc * (1 + iva / 100);

            return [
              proveedor,
              item.codCentral || '',
              item.codArticulo || '',
              item.codMaestro || '',
              item.descripcion || '',
              unidades,
              precioUd,
              dto,
              iva,
              netoCalc,
              importe,
            ];
          });
        }
        return [];
      });
      
      if (newRows.length > 0) {
        setData(prev => ({
          ...prev,
          rows: [...prev.rows, ...newRows]
        }));
      }
    }
  }, [processedData]);

  const handleCellEdit = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...data.rows];
    // Actualizar valor editado
    newRows[rowIndex][colIndex] = value;

    // Recalcular Importe si cambian % IVA (8) o Neto (9)
    if (colIndex === 8 || colIndex === 9) {
      const iva = parseFloat(newRows[rowIndex][8] || 0);
      const neto = parseFloat(newRows[rowIndex][9] || 0);
      const importe = neto * (1 + (isNaN(iva) ? 0 : iva) / 100);
      newRows[rowIndex][10] = isNaN(importe) ? 0 : importe;
    }

    setData({ ...data, rows: newRows });
  };

  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    setEditingCell({ row: rowIndex, col: colIndex });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const addRow = () => {
    const newRow = new Array(data.headers.length).fill('');
    setData({
      ...data,
      rows: [...data.rows, newRow]
    });
  };

  const deleteRow = (index: number) => {
    const newRows = data.rows.filter((_, i) => i !== index);
    setData({ ...data, rows: newRows });
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    
    // Aplicar estilos básicos
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'CCCCCC' } }
      };
    }
    
    XLSX.writeFile(wb, `facturas_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `facturas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Totals computation removed since the totals row is no longer displayed

  return (
    <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 hover:shadow-2xl transition-all duration-300">
      <div className="p-5 border-b border-gray-200/50 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Editor de Excel Inteligente</h3>
              <p className="text-xs text-gray-600">Edita y exporta tus datos procesados</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={addRow}
              className="bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transition-all duration-300"
              size="sm"
            >
              + Nueva Fila
            </Button>
            <Button
              onClick={exportToExcel}
              className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              onClick={exportToCSV}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
              size="sm"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3 font-medium text-gray-700 text-sm">Acciones</th>
              {data.headers.map((header, index) => (
                <th key={index} className="text-left p-3 font-medium text-gray-700 text-sm whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.headers.length + 1} className="text-center p-8 text-gray-500">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No hay datos para mostrar</p>
                  <p className="text-sm mt-1">Carga imágenes de facturas para empezar</p>
                </td>
              </tr>
            ) : (
              <>
                {data.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <button
                        onClick={() => deleteRow(rowIndex)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="p-2 border-r last:border-r-0"
                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                      >
                        {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                          <input
                            type={colIndex >= 5 ? 'number' : 'text'}
                            value={cell}
                            onChange={(e) => handleCellEdit(rowIndex, colIndex, e.target.value)}
                            onBlur={handleCellBlur}
                            className="w-full px-2 py-1 border rounded"
                            autoFocus
                          />
                        ) : (
                          <div className="px-2 py-1 min-h-[28px]">
                            {colIndex >= 5 ? 
                              (typeof cell === 'number' ? cell.toFixed(2) : cell) : 
                              cell
                            }
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                
              </>
            )}
          </tbody>
        </table>
      </div>
      
      {data.rows.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <p className="text-sm text-gray-600">
            <strong>Tip:</strong> Haz doble clic en cualquier celda para editarla
          </p>
        </div>
      )}
    </div>
  );
};
