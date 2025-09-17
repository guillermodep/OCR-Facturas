import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, User, Building, List, Trash2, FileDown, CheckSquare, Square } from 'lucide-react';

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
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);
  
  // Estados para datos maestros
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [articulos, setArticulos] = useState<any[]>([]);
  const [delegaciones, setDelegaciones] = useState<any[]>([]);
  const [loadingMaestros, setLoadingMaestros] = useState(true);

  // Funciones de normalización y búsqueda
  const normalizarTexto = (texto: string): string => {
    if (!texto) return '';
    return texto
      .toLowerCase()
      .replace(/\s+y\s+|\s*&\s*/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };


  const corregirErroresTipograficos = (texto: string): string => {
    if (!texto) return '';
    return texto
      .replace(/\btercer\b/gi, 'tercera')
      .replace(/\beztrella\b/gi, 'estrella')
      .replace(/\bmarangos\b/gi, 'marangos')
      .replace(/\bpedregalejo\b/gi, 'pedregalejo')
      .replace(/\bagliano\b/gi, 'aglianon')
      .replace(/\bua\b/gi, 'va')
      .replace(/\brf\b/gi, 'iqf')
      .replace(/\bbqd\b/gi, 'bdo')
      .replace(/\bprem\b/gi, 'prems');
  };

  const calcularSimilitud = (texto1: string, texto2: string): number => {
    if (texto1 === texto2) return 100;
    const len1 = texto1.length;
    const len2 = texto2.length;
    if (len1 === 0) return len2 === 0 ? 100 : 0;
    if (len2 === 0) return 0;
    if (texto1.includes(texto2) || texto2.includes(texto1)) {
      return Math.max(texto2.length / texto1.length, texto1.length / texto2.length) * 85;
    }
    const palabras1 = texto1.split(/\s+/);
    const palabras2 = texto2.split(/\s+/);
    const palabrasComunes = palabras1.filter(p1 => 
      palabras2.some(p2 => p1.includes(p2) || p2.includes(p1) || p1 === p2)
    );
    if (palabrasComunes.length > 0) {
      return (palabrasComunes.length / Math.max(palabras1.length, palabras2.length)) * 70;
    }
    return 0;
  };

  const normalizarSufijosLegales = (texto: string): string => {
    if (!texto) return '';
    let textoNormalizado = texto.toLowerCase();
    textoNormalizado = textoNormalizado
      .replace(/\bs\.?\s*l\.?\b/g, 'sl')
      .replace(/\bs\.?\s*a\.?\b/g, 'sa')
      .replace(/\bs\.?\s*l\.?\s*u\.?\b/g, 'slu');
    return textoNormalizado;
  };

  const limpiarSufijosEmpresas = (nombre: string): string => {
    if (!nombre) return '';
    return nombre
      .replace(/\b(sl|sa|slu|srl|cb|sc|scp|scoop|aie|ute)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const buscarDatosProveedor = (nombreProveedor: string): {codigo: string, cif: string} => {
    if (!nombreProveedor || loadingMaestros) return { codigo: '', cif: '' };

    // Regla específica para JOPIAD
    if (nombreProveedor.toLowerCase().includes('jopiad')) {
      const jopiadMaster = proveedores.find(p => p.nombre === 'JOSE PEDROSA - JOPIAD');
      if (jopiadMaster) {
        return { codigo: jopiadMaster.codigo || '', cif: jopiadMaster.cif || '' };
      }
    }

    const nombreSinParentesis = nombreProveedor.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    const nombreCorregido = corregirErroresTipograficos(nombreSinParentesis);
    const nombreLimpio = limpiarSufijosEmpresas(nombreCorregido);
    const nombreNormalizado = normalizarTexto(nombreLimpio);

    // 1. Búsqueda por inclusión directa (la más fiable)
    for (const proveedor of proveedores) {
      if (!proveedor.nombre) continue;
      const nombreProveedorNormalizado = normalizarTexto(limpiarSufijosEmpresas(corregirErroresTipograficos(proveedor.nombre)));
      if (nombreProveedorNormalizado.includes(nombreNormalizado)) {
        return { codigo: proveedor.codigo || '', cif: proveedor.cif || '' };
      }
    }

    // 2. Si falla, recurrir a similitud
    let mejorCoincidencia = null;
    let mejorPuntuacion = 0;
    for (const proveedor of proveedores) {
      if (!proveedor.nombre) continue;
      const nombreProveedorNormalizado = normalizarTexto(limpiarSufijosEmpresas(corregirErroresTipograficos(proveedor.nombre)));
      const similitud = calcularSimilitud(nombreNormalizado, nombreProveedorNormalizado);
      if (similitud > mejorPuntuacion) {
        mejorPuntuacion = similitud;
        mejorCoincidencia = proveedor;
      }
    }

    return mejorPuntuacion > 60 && mejorCoincidencia 
      ? { codigo: mejorCoincidencia.codigo || '', cif: mejorCoincidencia.cif || '' } 
      : { codigo: '', cif: '' };
  };

  const buscarDelegacion = (nombreCliente: string): string => {
    if (!nombreCliente || loadingMaestros) return '';

    const normalizarNombreCompleto = (nombre: string) => {
      if (!nombre) return '';
      const corregido = corregirErroresTipograficos(nombre);
      const conSufijos = normalizarSufijosLegales(corregido);
      const limpio = limpiarSufijosEmpresas(conSufijos);
      return normalizarTexto(limpio);
    };

    const nombreNormalizado = normalizarNombreCompleto(nombreCliente);
    let mejorCoincidencia = '';
    let mejorPuntuacion = 0;

    for (const delegacion of delegaciones) {
      let puntuacionTotal = 0;
      if (delegacion.razon_social) {
        const razonSocialNormalizada = normalizarNombreCompleto(delegacion.razon_social);
        if (razonSocialNormalizada === nombreNormalizado) return delegacion.delegacion || delegacion.codigo || '';
        puntuacionTotal += calcularSimilitud(nombreNormalizado, razonSocialNormalizada);
      }
      if (delegacion.nombre_comercial || delegacion.cliente) {
        const nombreComercialNormalizado = normalizarNombreCompleto(delegacion.nombre_comercial || delegacion.cliente);
        if (nombreComercialNormalizado === nombreNormalizado) return delegacion.delegacion || delegacion.codigo || '';
        puntuacionTotal += calcularSimilitud(nombreNormalizado, nombreComercialNormalizado) * 0.9;
      }
      if (puntuacionTotal > mejorPuntuacion) {
        mejorPuntuacion = puntuacionTotal;
        mejorCoincidencia = delegacion.delegacion || delegacion.codigo || '';
      }
    }
    return mejorPuntuacion > 60 ? mejorCoincidencia : '';
  };

  const buscarDatosArticulo = (descripcion: string): {codigo: string, subfamilia: string, iva: number} => {
    if (!descripcion || loadingMaestros) return { codigo: '', subfamilia: '', iva: 0 };

    // Reglas específicas para artículos complejos (basadas en prefijos)
    const articleMap: { [key: string]: string } = {
      'GAMBON 1': 'Gambon 1 10/20 iqf arg bdo 6x(2kg)',
      'GAMBON 1 100/120 FR ARG BDQ 6X(2KG)': 'Gambon 1 10/20 iqf arg bdo 6x(2kg)',
      'LANGOSTINO COLA 31/35 PREM S/BLQ ECU 10X(2KG)': 'Langostino colas 31/35prems/blq ecu10x2k',
      'CALAMAR PAT 4 10/13 BLQ ARG LLN (1X5KG/AP)': 'Calamar pat 4 10/13 blq arg llin (1x5kg)',
      'CALAMAR DEL CABO EXTRA M 18/25 ENV SUD (1X4KG)': 'Calamar del cabo extra M 18/25 (Limpio)',
      'CALAMAR PAT 4': 'Calamar pat 4 10/13 blq arg llin (1x5kg)',
      'BOQUERON VINAGRE': 'Boqueron vinagre bdja 9X(500gr)',
      'GUISANTES CN 4X(2,5KG)':'Guisantes C.nav 4x(2,5kg)',
      'AAFR SALMON 5/6':'AAFR salmon 5/6 1x6kg ap',
      'CACAHUETES':'Cacahuetes Garrapiñados',
      'HAMBURGUE TERNERA':'Hamburguesa ternera',
      'ENSALADA MEZCLUM FLORETTE':'Ensalada mezclum 500 gr. Florette',
      'BURGER POTATO ROLLS 100G':'Burger potato rolls 100gr (c/18u)',
      'MANTEQUILLA 82%MG CAMPINA 10K+':'Mantequilla 82 10Kgs',
      'MASCARPONE 500 GR':'Mascarpone 500Gr',
      'CREMETTE':'Cremette 30 cubo 3,5kg',
    };

    for (const key in articleMap) {
      if (descripcion.trim().startsWith(key)) {
        const mappedDescription = articleMap[key];
        const targetArticle = articulos.find(a => a.descripcion === mappedDescription);
        if (targetArticle) {
          return { codigo: targetArticle.codigo || '', subfamilia: targetArticle.subfamilia || '', iva: targetArticle.iva || 0 };
        }
        break; // Se encontró una regla, no seguir buscando
      }
    }

    const normalizarDescripcionArticulo = (texto: string) => {
      if (!texto) return '';
      return corregirErroresTipograficos(texto)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''); // Elimina todo lo que no sea letra o número
    };

    const descFacturaNormalizada = normalizarDescripcionArticulo(descripcion);

    // Búsqueda por coincidencia exacta tras normalización agresiva
    for (const articulo of articulos) {
      if (!articulo.descripcion) continue;
      const descMaestroNormalizada = normalizarDescripcionArticulo(articulo.descripcion);
      if (descMaestroNormalizada === descFacturaNormalizada) {
        return { codigo: articulo.codigo || '', subfamilia: articulo.subfamilia || '', iva: articulo.iva || 0 };
      }
    }
    
    // Fallback a la búsqueda por similitud con normalización estándar
    const descripcionNormalizada = normalizarTexto(corregirErroresTipograficos(descripcion));
    let mejorCoincidencia = null;
    let mejorPuntuacion = 0;
    for (const articulo of articulos) {
      if (!articulo.descripcion) continue;
      const descripcionArtNormalizada = normalizarTexto(corregirErroresTipograficos(articulo.descripcion));
      const similitud = calcularSimilitud(descripcionNormalizada, descripcionArtNormalizada);
      if (similitud > mejorPuntuacion) {
        mejorPuntuacion = similitud;
        mejorCoincidencia = articulo;
      }
    }
    return mejorPuntuacion > 75 && mejorCoincidencia ? { codigo: mejorCoincidencia.codigo || '', subfamilia: mejorCoincidencia.subfamilia || '', iva: mejorCoincidencia.iva || 0 } : { codigo: '', subfamilia: '', iva: 0 };
  };

  const exportInvoicesToExcel = (invoicesToExport: ProcessedInvoice[]) => {
    if (invoicesToExport.length === 0) return;

    const excelHeaders = [
      'Proveedor', 'CIF', 'Cód. Proveedor', 'Cliente', 'Delegación',
      'Cód. Artículo', 'Subfamilia', 'Descripción', 'Unidades',
      'Precio Ud.', '% Dto.', '% IVA', 'Neto', 'Importe'
    ];

    const allItems = invoicesToExport.flatMap(invoice =>
      invoice.items.map(item => {
        const datosProveedor = buscarDatosProveedor(invoice.proveedor);
        const delegacion = buscarDelegacion(invoice.cliente);
        const datosArticulo = buscarDatosArticulo(item.descripcion);

        return [
          invoice.proveedor || '',
          datosProveedor.cif || '',
          datosProveedor.codigo || '',
          invoice.cliente || '',
          delegacion || '',
          datosArticulo.codigo || item.codArticulo || '',
          datosArticulo.subfamilia || '',
          item.descripcion || '',
          item.unidades || 0,
          item.precioUd || 0,
          item.dto || 0,
          datosArticulo.iva || item.iva || 0,
          item.neto || 0,
          (item.neto || 0) * (1 + (datosArticulo.iva || item.iva || 0) / 100)
        ];
      })
    );

    const worksheet = XLSX.utils.aoa_to_sheet([excelHeaders, ...allItems]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

    worksheet['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }
    ];

    const fileName = invoicesToExport.length > 1 
      ? `Facturas-Seleccionadas-${new Date().toISOString().split('T')[0]}.xlsx`
      : `Factura-${invoicesToExport[0].numero_factura}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  };

  const handleSelectionChange = (invoiceId: number) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      // Si todas están seleccionadas, deseleccionar todas
      setSelectedInvoices([]);
    } else {
      // Si no todas están seleccionadas, seleccionar todas
      setSelectedInvoices(invoices.map(invoice => invoice.id));
    }
  };

  const isAllSelected = selectedInvoices.length === invoices.length && invoices.length > 0;

  const handleDeleteSelected = async () => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar ${selectedInvoices.length} factura(s) seleccionada(s)?`)) {
      const { error } = await supabase
        .from('processed_invoices')
        .delete()
        .in('id', selectedInvoices);

      if (error) {
        setError(error.message);
      } else {
        setInvoices(prev => prev.filter(invoice => !selectedInvoices.includes(invoice.id)));
        setSelectedInvoices([]);
      }
    }
  };

  const handleExportSelected = () => {
    const invoicesToExport = invoices.filter(invoice => selectedInvoices.includes(invoice.id));
    exportInvoicesToExcel(invoicesToExport);
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

    const fetchMaestros = async () => {
      try {
        setLoadingMaestros(true);
        
        const { data: proveedoresData } = await supabase.from('proveedores').select('*');
        const { data: articulosData } = await supabase.from('articulos').select('*');
        const { data: delegacionesData } = await supabase.from('delegaciones').select('*');
        
        setProveedores(proveedoresData || []);
        setArticulos(articulosData || []);
        setDelegaciones(delegacionesData || []);
      } catch (err: any) {
        console.error('Error cargando datos maestros:', err);
      } finally {
        setLoadingMaestros(false);
      }
    };

    fetchInvoices();
    fetchMaestros();
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
        <div className="flex items-center gap-4">
          {invoices.length > 0 && (
            <Button onClick={handleSelectAll} variant="outline" size="sm">
              {isAllSelected ? (
                <>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Deseleccionar todas ({invoices.length})
                </>
              ) : (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Seleccionar todas ({invoices.length})
                </>
              )}
            </Button>
          )}
          {selectedInvoices.length > 0 && (
            <div className="flex items-center gap-2">
              <Button onClick={handleDeleteSelected} variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Borrar ({selectedInvoices.length})
              </Button>
              <Button onClick={handleExportSelected} variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Exportar ({selectedInvoices.length})
              </Button>
            </div>
          )}
          <span className="text-xl font-bold bg-gray-200 text-gray-700 px-3 py-1 rounded-lg">{invoices.length}</span>
        </div>
      </div>
      <div className="space-y-6">
        {invoices.map((invoice) => (
          <div key={invoice.id} className={`bg-white p-6 rounded-lg shadow-md border-2 transition-colors ${selectedInvoices.includes(invoice.id) ? 'border-indigo-500' : 'border-transparent'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-4 flex-grow">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  checked={selectedInvoices.includes(invoice.id)}
                  onChange={() => handleSelectionChange(invoice.id)}
                />
                <div className="grid grid-cols-2 gap-4 flex-grow">
                  <div className="flex items-center"><FileText className="mr-2" /> <strong>Nº Factura:</strong> {invoice.numero_factura}</div>
                  <div className="flex items-center"><Calendar className="mr-2" /> <strong>Fecha:</strong> {invoice.fecha_factura}</div>
                  <div className="flex items-center"><User className="mr-2" /> <strong>Proveedor:</strong> {invoice.proveedor}</div>
                  <div className="flex items-center"><Building className="mr-2" /> <strong>Cliente:</strong> {invoice.cliente}</div>
                </div>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={() => exportInvoicesToExcel([invoice])}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3">Proveedor</th>
                    <th scope="col" className="px-3 py-3">CIF</th>
                    <th scope="col" className="px-3 py-3">Cód. Proveedor</th>
                    <th scope="col" className="px-3 py-3">Cliente</th>
                    <th scope="col" className="px-3 py-3">Delegación</th>
                    <th scope="col" className="px-3 py-3">Cód. Artículo</th>
                    <th scope="col" className="px-3 py-3">Subfamilia</th>
                    <th scope="col" className="px-3 py-3">Descripción</th>
                    <th scope="col" className="px-3 py-3">Unidades</th>
                    <th scope="col" className="px-3 py-3">Precio Ud.</th>
                    <th scope="col" className="px-3 py-3">% Dto.</th>
                    <th scope="col" className="px-3 py-3">% IVA</th>
                    <th scope="col" className="px-3 py-3">Neto</th>
                    <th scope="col" className="px-3 py-3">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items?.map((item, index) => {
                    const datosProveedor = buscarDatosProveedor(invoice.proveedor);
                    const delegacion = buscarDelegacion(invoice.cliente);
                    const datosArticulo = buscarDatosArticulo(item.descripcion);
                    
                    return (
                      <tr key={index} className="bg-white border-b">
                        <td className="px-3 py-4">{invoice.proveedor}</td>
                        <td className="px-3 py-4">{datosProveedor.cif || '-'}</td>
                        <td className="px-3 py-4">{datosProveedor.codigo || '-'}</td>
                        <td className="px-3 py-4">{invoice.cliente}</td>
                        <td className="px-3 py-4">{delegacion || '-'}</td>
                        <td className="px-3 py-4">{datosArticulo.codigo || item.codArticulo || '-'}</td>
                        <td className="px-3 py-4">{datosArticulo.subfamilia || '-'}</td>
                        <td className="px-3 py-4">{item.descripcion}</td>
                        <td className="px-3 py-4">{item.unidades}</td>
                        <td className="px-3 py-4">{item.precioUd}</td>
                        <td className="px-3 py-4">{item.dto || 0}</td>
                        <td className="px-3 py-4">{datosArticulo.iva || item.iva || 0}</td>
                        <td className="px-3 py-4">{item.neto}</td>
                        <td className="px-3 py-4">{((item.neto || 0) * (1 + (datosArticulo.iva || item.iva || 0) / 100)).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
