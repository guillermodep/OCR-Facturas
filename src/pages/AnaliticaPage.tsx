import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { DollarSign, FileText, Truck, Package, Filter, Calendar, User, TrendingUp, TrendingDown } from 'lucide-react';

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
  usuario?: string; // Agregar campo usuario
}

export const AnaliticaPage: React.FC = () => {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para filtros
  const [filters, setFilters] = useState({
    dateRange: 'all', // 'all', 'month', 'quarter', 'year', 'custom'
    startDate: '',
    endDate: '',
    selectedUser: 'all', // 'all' o username específico
    selectedProveedor: 'all', // 'all' o proveedor específico
  });

  // Función para obtener fechas según el filtro
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (filters.dateRange) {
      case 'month':
        return {
          start: new Date(currentYear, currentMonth, 1),
          end: new Date(currentYear, currentMonth + 1, 0)
        };
      case 'quarter':
        const quarterStart = new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1);
        const quarterEnd = new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0);
        return { start: quarterStart, end: quarterEnd };
      case 'year':
        return {
          start: new Date(currentYear, 0, 1),
          end: new Date(currentYear, 11, 31)
        };
      case 'custom':
        return {
          start: filters.startDate ? new Date(filters.startDate) : null,
          end: filters.endDate ? new Date(filters.endDate) : null
        };
      default:
        return { start: null, end: null };
    }
  };

  // Función para filtrar facturas según los criterios
  const getFilteredInvoices = () => {
    const { start, end } = getDateRange();

    return invoices.filter(invoice => {
      // Filtro por fecha
      if (start && end) {
        const invoiceDate = new Date(invoice.fecha_factura);
        if (invoiceDate < start || invoiceDate > end) return false;
      }

      // Filtro por usuario
      if (filters.selectedUser !== 'all' && invoice.usuario !== filters.selectedUser) {
        return false;
      }

      // Filtro por proveedor
      if (filters.selectedProveedor !== 'all' && invoice.proveedor !== filters.selectedProveedor) {
        return false;
      }

      return true;
    });
  };

  // Función para obtener lista de usuarios únicos
  const getUniqueUsers = () => {
    const users = new Set(invoices.map(inv => inv.usuario).filter(u => u));
    return Array.from(users).sort();
  };

  // Función para obtener lista de proveedores únicos
  const getUniqueProveedores = () => {
    const proveedoresList = new Set(invoices.map(inv => inv.proveedor));
    return Array.from(proveedoresList).sort();
  };

  const analyticsData = useMemo(() => {
    if (loading || error || invoices.length === 0) return null;

    // Usar facturas filtradas en lugar de todas las facturas
    const filteredInvoices = getFilteredInvoices();

    const totalGasto = filteredInvoices.reduce((acc, invoice) => acc + (invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0), 0);
    const gastoPorProveedor = filteredInvoices.reduce((acc, invoice) => {
      const gastoFactura = invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0;
      acc[invoice.proveedor] = (acc[invoice.proveedor] || 0) + gastoFactura;
      return acc;
    }, {} as { [key: string]: number });

    const gastoPorCliente = filteredInvoices.reduce((acc, invoice) => {
      const gastoFactura = invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0;
      acc[invoice.cliente] = (acc[invoice.cliente] || 0) + gastoFactura;
      return acc;
    }, {} as { [key: string]: number });

    const topArticulos = filteredInvoices.flatMap(inv => inv.items || []).reduce((acc, item) => {
      acc[item.descripcion] = (acc[item.descripcion] || 0) + item.neto;
      return acc;
    }, {} as { [key: string]: number });

    const allItems = filteredInvoices.flatMap(inv => inv.items || []);
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.descripcion, item])).values());

    const topMasCaros = [...uniqueItems].sort((a, b) => b.precioUd - a.precioUd).slice(0, 10);
    const topMayorIva = [...uniqueItems].sort((a, b) => b.iva - a.iva).slice(0, 10);

    const proveedoresActivos = new Set(filteredInvoices.map(inv => inv.proveedor));
    const articulosComprados = new Set(allItems.map(item => item.descripcion));

    return {
      totalGasto,
      proveedoresActivosCount: proveedoresActivos.size,
      articulosCompradosCount: articulosComprados.size,
      gastoPorProveedor: Object.entries(gastoPorProveedor).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto),
      gastoPorCliente: Object.entries(gastoPorCliente).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto),
      topArticulos: Object.entries(topArticulos).map(([name, value]) => ({ name, Gasto: value })).sort((a, b) => b.Gasto - a.Gasto).slice(0, 10),
      topMasCaros,
      topMayorIva,
      filteredInvoicesCount: filteredInvoices.length,
    };
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

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando datos de analítica...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">Error: {error}</div>;
  }

  // Si no hay datos de analítica, mostrar mensaje
  if (!analyticsData) {
    return <div className="flex justify-center items-center h-screen text-gray-500">No hay datos disponibles</div>;
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <h1 className="text-4xl font-bold text-slate-800 mb-8">Analítica de Facturas</h1>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-xl shadow-md mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-700">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todo el tiempo</option>
              <option value="month">Este mes</option>
              <option value="quarter">Este trimestre</option>
              <option value="year">Este año</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <select
              value={filters.selectedUser}
              onChange={(e) => setFilters({...filters, selectedUser: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos los usuarios</option>
              {getUniqueUsers().map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
            <select
              value={filters.selectedProveedor}
              onChange={(e) => setFilters({...filters, selectedProveedor: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos los proveedores</option>
              {getUniqueProveedores().map(proveedor => (
                <option key={proveedor} value={proveedor}>{proveedor}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <DollarSign className="h-10 w-10 text-green-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
            <p className="text-2xl font-bold text-slate-800">{analyticsData.totalGasto?.toFixed(2) ?? '0.00'} €</p>
            <p className="text-xs text-gray-500">Facturas filtradas: {analyticsData.filteredInvoicesCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <FileText className="h-10 w-10 text-blue-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Facturas Totales</p>
            <p className="text-2xl font-bold text-slate-800">{analyticsData.filteredInvoicesCount}</p>
            <p className="text-xs text-gray-500">De {invoices.length} total</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <Truck className="h-10 w-10 text-purple-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Proveedores Activos</p>
            <p className="text-2xl font-bold text-slate-800">
              {analyticsData.proveedoresActivosCount}
              <span className="text-lg font-normal text-slate-400"> / {proveedores.length}</span>
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <Package className="h-10 w-10 text-orange-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Artículos Comprados</p>
            <p className="text-2xl font-bold text-slate-800">
              {analyticsData.articulosCompradosCount}
              <span className="text-lg font-normal text-slate-400"> / {articulos.length}</span>
            </p>
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
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Gasto por Cliente</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData?.gastoPorCliente.slice(0, 7)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
              <Legend />
              <Bar dataKey="Gasto" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tablas de Top 10 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos por Gasto</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" className="px-6 py-3">Artículo</th><th scope="col" className="px-6 py-3">Gasto</th></tr></thead>
            <tbody>
              {analyticsData?.topArticulos.map((item) => (
                <tr key={item.name} className="bg-white border-b"><td className="px-6 py-4">{item.name}</td><td className="px-6 py-4">{item.Gasto.toFixed(2)} €</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos más Caros</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" className="px-6 py-3">Artículo</th><th scope="col" className="px-6 py-3">Precio Unitario</th></tr></thead>
            <tbody>
              {analyticsData?.topMasCaros.map((item) => (
                <tr key={item.descripcion} className="bg-white border-b"><td className="px-6 py-4">{item.descripcion}</td><td className="px-6 py-4">{item.precioUd.toFixed(2)} €</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos por IVA</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th scope="col" className="px-6 py-3">Artículo</th><th scope="col" className="px-6 py-3">% IVA</th></tr></thead>
            <tbody>
              {analyticsData?.topMayorIva.map((item) => (
                <tr key={item.descripcion} className="bg-white border-b"><td className="px-6 py-4">{item.descripcion}</td><td className="px-6 py-4">{item.iva} %</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
