import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { DollarSign, FileText, Truck, Package, Filter, TrendingUp, TrendingDown } from 'lucide-react';

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
  usuario?: string; 
}

export const AnaliticaPage: React.FC = () => {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para filtros
  const [filters, setFilters] = useState({
    dateRange: 'all', 
    startDate: '',
    endDate: '',
    selectedUser: 'all', 
    selectedProveedor: 'all', 
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

  // Función para calcular indicadores de cambio
  const getChangeIndicators = () => {
    const filteredInvoices = getFilteredInvoices();
    const allInvoices = invoices;

    // Calcular métricas del período actual
    const currentGasto = filteredInvoices.reduce((acc, invoice) => acc + (invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0), 0);
    const currentFacturas = filteredInvoices.length;

    // Calcular métricas del período anterior (último mes/anterior período)
    const { start: currentStart } = getDateRange();
    let previousStart: Date | null = null;
    let previousEnd: Date | null = null;

    if (currentStart) {
      if (filters.dateRange === 'month') {
        previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
        previousEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
      } else if (filters.dateRange === 'quarter') {
        const currentQuarter = Math.floor(currentStart.getMonth() / 3);
        const prevQuarterStart = new Date(currentStart.getFullYear(), (currentQuarter - 1) * 3, 1);
        const prevQuarterEnd = new Date(currentStart.getFullYear(), currentQuarter * 3, 0);
        previousStart = prevQuarterStart;
        previousEnd = prevQuarterEnd;
      } else if (filters.dateRange === 'year') {
        previousStart = new Date(currentStart.getFullYear() - 1, 0, 1);
        previousEnd = new Date(currentStart.getFullYear() - 1, 11, 31);
      }
    }

    // Calcular métricas del período anterior
    let previousGasto = 0;
    let previousFacturas = 0;

    if (previousStart && previousEnd) {
      const previousInvoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.fecha_factura);
        return invoiceDate >= previousStart! && invoiceDate <= previousEnd!;
      });

      previousGasto = previousInvoices.reduce((acc, invoice) => acc + (invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0), 0);
      previousFacturas = previousInvoices.length;
    }

    // Calcular porcentajes de cambio
    const gastoChange = previousGasto > 0 ? ((currentGasto - previousGasto) / previousGasto) * 100 : 0;
    const facturasChange = previousFacturas > 0 ? ((currentFacturas - previousFacturas) / previousFacturas) * 100 : 0;

    return {
      gastoChange,
      facturasChange,
      currentGasto,
      currentFacturas,
      previousGasto,
      previousFacturas
    };
  };

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

  const analyticsData = useMemo(() => {
    if (loading || error || invoices.length === 0) return null;

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
  }, [loading, error, invoices, filters]);

  const changeIndicators = getChangeIndicators();

  const generateTrendData = () => {
    const now = new Date();
    const trendData = [];
    const allInvoices = invoices;

    // Generar datos para los últimos 12 meses
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      // Filtrar facturas del mes actual
      const monthInvoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.fecha_factura);
        return invoiceDate >= targetDate && invoiceDate < nextMonth;
      });

      // Calcular métricas del mes
      const gastoTotal = monthInvoices.reduce((acc, invoice) => acc + (invoice.items?.reduce((itemAcc, item) => itemAcc + item.neto, 0) || 0), 0);
      const facturasCount = monthInvoices.length;

      trendData.push({
        mes: targetDate.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        gasto: Math.round(gastoTotal * 100) / 100,
        facturas: facturasCount,
        fechaCompleta: targetDate.toISOString().split('T')[0]
      });
    }

    return trendData;
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

      {/* Filtros Modernos */}
      <div className="bg-gradient-to-br from-white via-blue-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-blue-100 mb-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg">
            <Filter className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Filtros Avanzados</h2>
            <p className="text-gray-600">Personaliza tu vista de datos con precisión</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Período */}
          <div className="group">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-md group-hover:bg-blue-200 transition-colors duration-200">
                <span className="text-blue-600 text-xs">📅</span>
              </div>
              Período Temporal
            </label>
            <div className="relative">
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                className="w-full p-4 pr-12 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
              >
                <option value="all" className="p-2">🌟 Todo el tiempo</option>
                <option value="month" className="p-2">📅 Este mes</option>
                <option value="quarter" className="p-2">📊 Este trimestre</option>
                <option value="year" className="p-2">🎯 Este año</option>
                <option value="custom" className="p-2">🎨 Personalizado</option>
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Usuario */}
          <div className="group">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors duration-200">
                <span className="text-green-600 text-xs">👤</span>
              </div>
              Usuario
            </label>
            <div className="relative">
              <select
                value={filters.selectedUser}
                onChange={(e) => setFilters({...filters, selectedUser: e.target.value})}
                className="w-full p-4 pr-12 bg-white border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
              >
                <option value="all" className="p-2">👥 Todos los usuarios</option>
                {getUniqueUsers().map(user => (
                  <option key={user} value={user} className="p-2">👤 {user}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Proveedor */}
          <div className="group">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-md group-hover:bg-purple-200 transition-colors duration-200">
                <span className="text-purple-600 text-xs">🏢</span>
              </div>
              Proveedor
            </label>
            <div className="relative">
              <select
                value={filters.selectedProveedor}
                onChange={(e) => setFilters({...filters, selectedProveedor: e.target.value})}
                className="w-full p-4 pr-12 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all duration-200 text-gray-700 font-medium shadow-sm hover:shadow-md appearance-none cursor-pointer"
              >
                <option value="all" className="p-2">🏢 Todos los proveedores</option>
                {getUniqueProveedores().map(proveedor => (
                  <option key={proveedor} value={proveedor} className="p-2">🏢 {proveedor}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Estado de Filtros */}
          <div className="group">
            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <div className="p-1.5 bg-orange-100 rounded-md group-hover:bg-orange-200 transition-colors duration-200">
                <span className="text-orange-600 text-xs">📊</span>
              </div>
              Estado de Filtros
            </label>
            <div className="bg-white p-4 rounded-xl border-2 border-orange-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${filters.dateRange !== 'all' || filters.selectedUser !== 'all' || filters.selectedProveedor !== 'all' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {filters.dateRange !== 'all' || filters.selectedUser !== 'all' || filters.selectedProveedor !== 'all' ? 'Filtros Activos' : 'Sin Filtros'}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {(filters.dateRange !== 'all' ? 1 : 0) + (filters.selectedUser !== 'all' ? 1 : 0) + (filters.selectedProveedor !== 'all' ? 1 : 0)} filtros aplicados
              </div>
            </div>
          </div>
        </div>

        {/* Filtros de Fecha Personalizados */}
        {filters.dateRange === 'custom' && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-blue-600">📅</span>
              Rango de Fechas Personalizado
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Inicio</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  className="w-full p-3 bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-700 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de Fin</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  className="w-full p-3 bg-white border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 text-gray-700 font-medium"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <DollarSign className="h-10 w-10 text-green-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
            <p className="text-2xl font-bold text-slate-800">{analyticsData.totalGasto?.toFixed(2) ?? '0.00'} €</p>
            <div className="flex items-center gap-2 mt-1">
              {changeIndicators.gastoChange !== 0 && (
                <>
                  {changeIndicators.gastoChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${changeIndicators.gastoChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {changeIndicators.gastoChange > 0 ? '+' : ''}{changeIndicators.gastoChange.toFixed(1)}%
                  </span>
                </>
              )}
              <p className="text-xs text-gray-500">vs período anterior</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md flex items-center space-x-4">
          <FileText className="h-10 w-10 text-blue-500" />
          <div>
            <p className="text-slate-500 text-sm font-medium">Facturas Totales</p>
            <p className="text-2xl font-bold text-slate-800">{analyticsData.filteredInvoicesCount}</p>
            <div className="flex items-center gap-2 mt-1">
              {changeIndicators.facturasChange !== 0 && (
                <>
                  {changeIndicators.facturasChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${changeIndicators.facturasChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {changeIndicators.facturasChange > 0 ? '+' : ''}{changeIndicators.facturasChange.toFixed(1)}%
                  </span>
                </>
              )}
              <p className="text-xs text-gray-500">De {invoices.length} total</p>
            </div>
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

      {/* Insights Automáticos - Movidos arriba de los gráficos */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl shadow-md mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">💡</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Insights Inteligentes</h2>
            <p className="text-slate-600 text-sm">Análisis automático basado en tus datos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsData && (
            <>
              {/* Top Proveedor */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🏆</span>
                  <span className="font-semibold text-gray-700">Top Proveedor</span>
                </div>
                <p className="text-sm text-gray-600">
                  {analyticsData.gastoPorProveedor[0]?.name || 'Sin datos'} representa el {analyticsData.totalGasto > 0 ? ((analyticsData.gastoPorProveedor[0]?.Gasto / analyticsData.totalGasto) * 100).toFixed(1) : 0}% del gasto total
                </p>
              </div>

              {/* Artículo más caro */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💰</span>
                  <span className="font-semibold text-gray-700">Artículo Premium</span>
                </div>
                <p className="text-sm text-gray-600">
                  {analyticsData.topMasCaros[0]?.descripcion || 'Sin datos'} cuesta {analyticsData.topMasCaros[0]?.precioUd?.toFixed(2) || '0'}€/ud
                </p>
              </div>

              {/* Tendencia mensual */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📈</span>
                  <span className="font-semibold text-gray-700">Tendencia</span>
                </div>
                <p className="text-sm text-gray-600">
                  {changeIndicators.gastoChange > 0 ? 'Aumento' : changeIndicators.gastoChange < 0 ? 'Disminución' : 'Estable'} del {Math.abs(changeIndicators.gastoChange).toFixed(1)}% en gastos
                </p>
              </div>

              {/* Eficiencia IVA */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📊</span>
                  <span className="font-semibold text-gray-700">IVA Promedio</span>
                </div>
                <p className="text-sm text-gray-600">
                  IVA promedio: {analyticsData.topMayorIva.length > 0 ? (analyticsData.topMayorIva.reduce((acc: any, item: any) => acc + item.iva, 0) / analyticsData.topMayorIva.length).toFixed(1) : 0}%
                </p>
              </div>

              {/* Cobertura de proveedores */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🎯</span>
                  <span className="font-semibold text-gray-700">Cobertura Proveedores</span>
                </div>
                <p className="text-sm text-gray-600">
                  {analyticsData.proveedoresActivosCount} de {proveedores.length} proveedores activos ({proveedores.length > 0 ? ((analyticsData.proveedoresActivosCount / proveedores.length) * 100).toFixed(1) : 0}%)
                </p>
              </div>

              {/* Patrón de compras */}
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔄</span>
                  <span className="font-semibold text-gray-700">Patrón de Compras</span>
                </div>
                <p className="text-sm text-gray-600">
                  {analyticsData.filteredInvoicesCount > 0 ? (analyticsData.totalGasto / analyticsData.filteredInvoicesCount).toFixed(2) : '0'}€ promedio por factura
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gráficos de Comparación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Gasto por Proveedor</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.gastoPorProveedor.slice(0, 7)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            <BarChart data={analyticsData.gastoPorCliente.slice(0, 7)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos por Gasto</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Artículo</th>
                <th scope="col" className="px-6 py-3">Gasto</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topArticulos.map((item: any) => (
                <tr key={item.name} className="bg-white border-b">
                  <td className="px-6 py-4">{item.name}</td>
                  <td className="px-6 py-4">{item.Gasto.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos más Caros</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Artículo</th>
                <th scope="col" className="px-6 py-3">Precio Unitario</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topMasCaros.map((item: any) => (
                <tr key={item.descripcion} className="bg-white border-b">
                  <td className="px-6 py-4">{item.descripcion}</td>
                  <td className="px-6 py-4">{item.precioUd.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Top 10 Artículos por IVA</h2>
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">Artículo</th>
                <th scope="col" className="px-6 py-3">% IVA</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topMayorIva.map((item: any) => (
                <tr key={item.descripcion} className="bg-white border-b">
                  <td className="px-6 py-4">{item.descripcion}</td>
                  <td className="px-6 py-4">{item.iva} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};