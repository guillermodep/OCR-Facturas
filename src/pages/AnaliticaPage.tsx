import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, FileText, Truck, Package } from 'lucide-react';

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

export const AnaliticaPage: React.FC = () => {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('processed_invoices')
          .select('*');
        if (invoicesError) throw invoicesError;

        const { data: proveedoresData, error: proveedoresError } = await supabase.from('proveedores').select('*');
        if (proveedoresError) throw proveedoresError;

        const { data: articulosData, error: articulosError } = await supabase.from('articulos').select('*');
        if (articulosError) throw articulosError;

        setInvoices(invoicesData || []);
        setProveedores(proveedoresData || []);
        setArticulos(articulosData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const analyticsData = useMemo(() => {
    if (loading || error || invoices.length === 0) return null;

    const totalGasto = invoices.reduce((acc, invoice) => acc + (invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0), 0);
    const gastoPorProveedor = invoices.reduce((acc, invoice) => {
      const gastoFactura = invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0;
      acc[invoice.proveedor] = (acc[invoice.proveedor] || 0) + gastoFactura;
      return acc;
    }, {} as { [key: string]: number });

    const gastoPorCategoria = invoices.flatMap(inv => inv.items || []).reduce((acc, item) => {
      const articulo = articulos.find(a => a.descripcion === item.descripcion);
      const categoria = articulo?.subfamilia || 'Sin Categoría';
      acc[categoria] = (acc[categoria] || 0) + item.neto;
      return acc;
    }, {} as { [key: string]: number });

    const topArticulos = invoices.flatMap(inv => inv.items || []).reduce((acc, item) => {
      acc[item.descripcion] = (acc[item.descripcion] || 0) + item.neto;
      return acc;
    }, {} as { [key: string]: number });

    return {
      totalGasto,
      gastoPorProveedor: Object.entries(gastoPorProveedor).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto),
      gastoPorCategoria: Object.entries(gastoPorCategoria).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto),
      topArticulos: Object.entries(topArticulos).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto).slice(0, 10),
    };
  }, [loading, error, invoices, articulos]);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de analítica...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">Error: {error}</div>;
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4560', '#775DD0'];

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-4xl font-bold text-slate-800 mb-8">Analítica de Facturas</h1>
      
      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <DollarSign className="h-10 w-10 text-green-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
            <p className="text-2xl font-bold text-slate-800">{analyticsData?.totalGasto?.toFixed(2) ?? '0.00'} €</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <FileText className="h-10 w-10 text-blue-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Facturas Totales</p>
            <p className="text-2xl font-bold text-slate-800">{invoices.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <Truck className="h-10 w-10 text-purple-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Proveedores</p>
            <p className="text-2xl font-bold text-slate-800">{proveedores.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <Package className="h-10 w-10 text-orange-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Artículos Únicos</p>
            <p className="text-2xl font-bold text-slate-800">{articulos.length}</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Gasto por Proveedor</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.gastoPorProveedor.slice(0, 7)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Legend />
              <Bar dataKey="Gasto" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Gasto por Categoría</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={analyticsData?.gastoPorCategoria} dataKey="Gasto" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                {analyticsData?.gastoPorCategoria.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 10 Artículos */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos por Gasto</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">#</th>
                <th scope="col" className="px-6 py-3">Artículo</th>
                <th scope="col" className="px-6 py-3">Gasto Total</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData?.topArticulos.map((item, index) => (
                <tr key={index} className="bg-white border-b">
                  <td className="px-6 py-4 font-medium text-gray-900">{index + 1}</td>
                  <td className="px-6 py-4">{item.name}</td>
                  <td className="px-6 py-4">{item.Gasto.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
