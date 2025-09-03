import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { FileText, Calendar, User, Building, List, Trash2, FileDown } from 'lucide-react';

interface InvoiceItem {
  codCentral: string;
  codArticulo: string;
  descripcion: string;
  unidades: number;
  precioUd: number;
  dto: number;
  iva: number;
  neto: number;
}

interface ProcessedInvoice {
  id: number;
  created_at: string;
  numero_factura: string;
  fecha_factura: string;
  proveedor: string;
  cliente: string;
  items: InvoiceItem[];
}

export function FacturasProcesadasPage() {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadExcel = (invoice: ProcessedInvoice) => {
    const header = [
      ['Nº Factura', invoice.numero_factura],
      ['Fecha', invoice.fecha_factura],
      ['Proveedor', invoice.proveedor],
      ['Cliente', invoice.cliente],
      [], // Empty row for spacing
      ['Descripción', 'Unidades', 'Precio Unit.', 'Neto']
    ];

    const body = invoice.items.map(item => [
      item.descripcion,
      item.unidades,
      item.precioUd,
      item.neto
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([...header, ...body]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Factura');

    // Adjust column widths
    worksheet['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];

    XLSX.writeFile(workbook, `Factura-${invoice.numero_factura}.xlsx`);
  };

  const handleDelete = async (invoiceId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta factura?')) {
      const { error } = await supabase
        .from('processed_invoices')
        .delete()
        .match({ id: invoiceId });

      if (error) {
        setError(error.message);
      } else {
        setInvoices(invoices.filter((invoice) => invoice.id !== invoiceId));
      }
    }
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('processed_invoices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setInvoices(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando facturas...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Facturas Procesadas</h1>
        <span className="text-xl font-bold bg-gray-200 text-gray-700 px-3 py-1 rounded-lg">{invoices.length}</span>
      </div>
      <div className="space-y-6">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center"><FileText className="mr-2" /> <strong>Nº Factura:</strong> {invoice.numero_factura}</div>
                <div className="flex items-center"><Calendar className="mr-2" /> <strong>Fecha:</strong> {invoice.fecha_factura}</div>
                <div className="flex items-center"><User className="mr-2" /> <strong>Proveedor:</strong> {invoice.proveedor}</div>
                <div className="flex items-center"><Building className="mr-2" /> <strong>Cliente:</strong> {invoice.cliente}</div>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={() => handleDownloadExcel(invoice)}
                  className="text-green-600 hover:text-green-800 p-2 rounded-full hover:bg-green-100 transition-colors"
                  title="Descargar Excel"
                >
                  <FileDown />
                </button>
                <button 
                  onClick={() => handleDelete(invoice.id)}
                  className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors"
                  title="Eliminar factura"
                >
                  <Trash2 />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-2 flex items-center"><List className="mr-2" />Detalle</h3>
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Descripción</th>
                  <th scope="col" className="px-6 py-3">Unidades</th>
                  <th scope="col" className="px-6 py-3">Precio Unit.</th>
                  <th scope="col" className="px-6 py-3">Neto</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, index) => (
                  <tr key={index} className="bg-white border-b">
                    <td className="px-6 py-4">{item.descripcion}</td>
                    <td className="px-6 py-4">{item.unidades}</td>
                    <td className="px-6 py-4">{item.precioUd}</td>
                    <td className="px-6 py-4">{item.neto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
