import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button.tsx';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface ExcelData {
  headers: string[];
  rows: any[][];
}

interface InvoiceItem {
  codArticulo?: string;
  descripcion?: string;
  unidades?: number;
  precioUd?: number;
  dto?: number;
  importeDescuento?: number;
  iva?: number;
  neto?: number;
  [key: string]: any;
}

interface ExcelViewerProps {
  processedData: any[];
}

interface Proveedor {
  id: number;
  nombre: string;
  codigo: string;
  cif: string;
}

interface Articulo {
  id: number;
  subfamilia: string | null;
  codigo: string;
  descripcion: string;
  iva: number;
}

interface Delegacion {
  id: number;
  nombre: string;
  cliente: string;
  codigo: string;
  nombre_comercial?: string;
  razon_social?: string;
  delegacion?: string;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({ processedData }) => {
  const [data, setData] = useState<ExcelData>({
    headers: [
      'Archivo',
      'Proveedor',
      'CIF',
      'Cód. Proveedor',
      'Cliente',
      'Delegación',
      'Cód. Artículo',
      'Subfamilia',
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
  
  // Estado para rastrear cuántas facturas hemos procesado
  const [processedCount, setProcessedCount] = useState(0);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [loadingArticulos, setLoadingArticulos] = useState(true);
  const [loadingDelegaciones, setLoadingDelegaciones] = useState(true);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cargar la lista de proveedores
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        const { data, error } = await supabase.from('proveedores').select('*');
        if (error) throw error;
        if (data) setProveedores(data);
      } catch (err: any) {
        console.error('Error al obtener los proveedores:', err.message);
      } finally {
        setLoadingProveedores(false);
      }
    };

    const fetchArticulos = async () => {
      try {
        const { data, error } = await supabase.from('articulos').select('*');
        if (error) throw error;
        if (data) setArticulos(data);
      } catch (err: any) {
        console.error('Error al obtener los artículos:', err.message);
      } finally {
        setLoadingArticulos(false);
      }
    };

    const fetchDelegaciones = async () => {
      try {
        const { data, error } = await supabase.from('delegaciones').select('*');
        if (error) throw error;
        if (data) setDelegaciones(data);
      } catch (err: any) {
        console.error('Error al obtener las delegaciones:', err.message);
      } finally {
        setLoadingDelegaciones(false);
      }
    };

    fetchProveedores();
    fetchArticulos();
    fetchDelegaciones();
  }, []);

  // Función para normalizar texto (eliminar acentos y caracteres especiales)
  const normalizarTexto = (texto: string): string => {
    if (!texto) return '';
    return texto
      .normalize('NFD')                     // Descomponer caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '')      // Eliminar diacríticos
      .toLowerCase()                        // Convertir a minúsculas
      .replace(/[^a-z0-9\s]/g, '');         // Eliminar caracteres especiales excepto espacios
  };
  
  // Función para normalizar descripciones de artículos
  const normalizarDescripcionArticulo = (descripcion: string): string => {
    if (!descripcion) return '';
    
    return descripcion
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')      // Eliminar acentos
      .replace(/\s+/g, ' ')                // Normalizar espacios
      .replace(/\([^)]*\)/g, '')           // Eliminar contenido entre paréntesis
      .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Eliminar puntuación
      .replace(/\b(gr|grs|g|gramos)\b/g, 'gr') // Normalizar unidades de peso
      .replace(/\b(ud|uds|unidad|unidades)\b/g, 'ud') // Normalizar unidades
      .replace(/\b(c\/)\b/g, '') // Eliminar c/ (común en cantidades)
      .replace(/\b(paq|paquete|paquetes)\b/g, 'paq') // Normalizar paquetes
      .replace(/\b(caja|cajas|box)\b/g, 'caja') // Normalizar cajas
      .replace(/\b(bolsa|bolsas|bag)\b/g, 'bolsa') // Normalizar bolsas
      .replace(/\b(barra|barras)\b/g, 'barra')  // Normalizar barras
      .trim();
  };
  
  // Función para buscar el código de artículo, subfamilia e IVA por descripción usando LIKE
  const buscarDatosArticulo = (descripcionArticulo: string): {codigo: string, subfamilia: string, iva: number} => {
    if (!descripcionArticulo || loadingArticulos) return { codigo: '', subfamilia: '', iva: 0 };
    
    // Normalizar la descripción del artículo para la búsqueda
    const descripcionNormalizada = normalizarDescripcionArticulo(descripcionArticulo);
    
    // Dividir en palabras clave para búsqueda
    const palabrasDescripcion = descripcionNormalizada.split(/\s+/).filter(p => p.length > 2);
    
    // Caso especial para GOUDA BARRA OLDENBURGER
    const esGouda = descripcionNormalizada.includes('gouda') && 
                   descripcionNormalizada.includes('barra') && 
                   descripcionNormalizada.includes('oldenburger');
    
    if (esGouda) {
      // Buscar específicamente por GOUDA BARRA OLDENBURGER
      const goudaArticulo = articulos.find(a => {
        if (!a.descripcion) return false;
        const descNormalizada = normalizarDescripcionArticulo(a.descripcion);
        return descNormalizada.includes('gouda') && 
               descNormalizada.includes('barra') && 
               descNormalizada.includes('oldenburger');
      });
      
      if (goudaArticulo) {
        console.log('Encontrado GOUDA BARRA OLDENBURGER:', goudaArticulo);
        return {
          codigo: goudaArticulo.codigo || '',
          subfamilia: goudaArticulo.subfamilia || '',
          iva: goudaArticulo.iva || 0
        };
      }
    }
    
    // Buscar coincidencia exacta primero
    let articuloEncontrado = articulos.find(a => {
      if (!a.descripcion) return false;
      return a.descripcion.toLowerCase() === descripcionArticulo.toLowerCase();
    });
    
    // Si no hay coincidencia exacta, usar búsqueda LIKE con palabras clave
    if (!articuloEncontrado) {
      // Ordenar artículos por relevancia para esta búsqueda
      const articulosConPuntuacion = articulos
        .filter(a => a.descripcion) // Filtrar artículos sin descripción
        .map(a => {
          const descNormalizada = normalizarDescripcionArticulo(a.descripcion);
          const palabrasArticulo = descNormalizada.split(/\s+/).filter(p => p.length > 2);
          
          // Contar palabras coincidentes
          const palabrasCoincidentes = palabrasDescripcion.filter(palabra => 
            palabrasArticulo.some(palabraArticulo => 
              palabraArticulo.includes(palabra) || palabra.includes(palabraArticulo)
            )
          );
          
          // Calcular puntuación de coincidencia
          const puntuacion = palabrasCoincidentes.length / Math.max(palabrasDescripcion.length, 1);
          
          return {
            articulo: a,
            puntuacion,
            palabrasCoincidentes: palabrasCoincidentes.length
          };
        })
        .filter(item => item.palabrasCoincidentes >= 2) // Al menos 2 palabras deben coincidir
        .sort((a, b) => b.puntuacion - a.puntuacion); // Ordenar por puntuación descendente
      
      // Tomar el artículo con mayor puntuación si supera el umbral (60%)
      if (articulosConPuntuacion.length > 0 && articulosConPuntuacion[0].puntuacion >= 0.6) {
        articuloEncontrado = articulosConPuntuacion[0].articulo;
      }
    }
    
    // Solo mostrar logging para casos específicos o problemáticos
    if (descripcionArticulo.toLowerCase().includes('gouda') || 
        descripcionArticulo.toLowerCase().includes('queso') ||
        descripcionArticulo.toLowerCase().includes('mascarpone')) {
      console.log('--------- Búsqueda de artículo ---------');
      console.log('Descripción original:', descripcionArticulo);
      console.log('Descripción normalizada:', descripcionNormalizada);
      
      if (articuloEncontrado) {
        console.log('Artículo encontrado:', articuloEncontrado.descripcion);
        console.log('Código en maestro:', articuloEncontrado.codigo);
        console.log('Subfamilia en maestro:', articuloEncontrado.subfamilia);
        console.log('IVA en maestro:', articuloEncontrado.iva);
      } else {
        console.log('No se encontró coincidencia en el maestro de artículos');
      }
      console.log('--------------------------------------');
    }
    
    return articuloEncontrado ? {
      codigo: articuloEncontrado.codigo || '',
      subfamilia: articuloEncontrado.subfamilia || '',
      iva: articuloEncontrado.iva || 0
    } : { codigo: '', subfamilia: '', iva: 0 };
  };
  
  // Función para normalizar sufijos legales (S.L., S.A., etc.)
  const normalizarSufijosLegales = (texto: string): string => {
    if (!texto) return '';
    
    // Convertir a minúsculas para comparación
    let textoNormalizado = texto.toLowerCase();
    
    // Normalizar sufijos con y sin puntos
    textoNormalizado = textoNormalizado
      // Sociedad Limitada
      .replace(/\bs\.?\s*l\.?\b/g, 'sl')
      .replace(/\bsociedad\s+limitada\b/g, 'sl')
      // Sociedad Anónima
      .replace(/\bs\.?\s*a\.?\b/g, 'sa')
      .replace(/\bsociedad\s+anonima\b/g, 'sa')
      // Sociedad Limitada Unipersonal
      .replace(/\bs\.?\s*l\.?\s*u\.?\b/g, 'slu')
      // Sociedad Anónima Unipersonal
      .replace(/\bs\.?\s*a\.?\s*u\.?\b/g, 'sau')
      // Sociedad de Responsabilidad Limitada
      .replace(/\bs\.?\s*r\.?\s*l\.?\b/g, 'srl')
      // Sociedad Limitada Nueva Empresa
      .replace(/\bs\.?\s*l\.?\s*n\.?\s*e\.?\b/g, 'slne')
      // Comunidad de Bienes
      .replace(/\bc\.?\s*b\.?\b/g, 'cb')
      // Sociedad Civil
      .replace(/\bs\.?\s*c\.?\b/g, 'sc')
      // Sociedad Civil Particular
      .replace(/\bs\.?\s*c\.?\s*p\.?\b/g, 'scp')
      // Sociedad Cooperativa
      .replace(/\bs\.?\s*coop\.?\b/g, 'scoop')
      // Agrupación de Interés Económico
      .replace(/\ba\.?\s*i\.?\s*e\.?\b/g, 'aie')
      // Unión Temporal de Empresas
      .replace(/\bu\.?\s*t\.?\s*e\.?\b/g, 'ute');
      
    return textoNormalizado;
  };
  
  // Función para limpiar sufijos comunes de empresas
  const limpiarSufijosEmpresas = (nombre: string): string => {
    if (!nombre) return '';
    
    let nombreLimpio = nombre.trim();
    const sufijosComunes = ['sl', 'sa', 'slu', 'sau', 'sociedad limitada', 'sociedad anonima', 'srl', 'slne', 'cb', 'sc', 'scp', 'scoop', 'aie', 'ute'];
    
    // Primero normalizar los sufijos legales
    nombreLimpio = normalizarSufijosLegales(nombreLimpio);
    
    // Luego eliminar los sufijos normalizados
    sufijosComunes.forEach(sufijo => {
      nombreLimpio = nombreLimpio
        .replace(new RegExp(`\\s+${sufijo}\\s*$`, 'i'), '')
        .replace(new RegExp(`\\s*,\\s*${sufijo}\\s*$`, 'i'), '')
        .replace(new RegExp(`\\s*\\(${sufijo}\\)\\s*$`, 'i'), '');
    });
    
    return nombreLimpio.trim();
  };

  // Función para buscar el código de delegación por nombre de cliente usando LIKE
  const buscarDelegacion = (nombreCliente: string): string => {
    if (!nombreCliente || loadingDelegaciones) return '';
    
    // Caso especial para VA EL TERCERO SL
    if (nombreCliente.toUpperCase().includes('VA EL TERCERO') || 
        nombreCliente.toLowerCase().includes('va el tercero')) {
      return '009';
    }
    
    // Normalizar el nombre del cliente para la búsqueda
    // 1. Normalizar sufijos legales (S.L. -> sl, etc.)
    const nombreConSufijosNormalizados = normalizarSufijosLegales(nombreCliente);
    // 2. Limpiar sufijos comunes
    const nombreLimpio = limpiarSufijosEmpresas(nombreConSufijosNormalizados);
    // 3. Normalizar texto (quitar acentos, minúsculas, etc.)
    const nombreNormalizado = normalizarTexto(nombreLimpio);
    
    // Buscar coincidencia directa en razon_social primero
    for (const delegacion of delegaciones) {
      if (!delegacion.razon_social) continue;
      
      // Normalizar razón social
      const razonSocialNormalizada = normalizarTexto(normalizarSufijosLegales(delegacion.razon_social));
      
      // Si hay coincidencia exacta o muy cercana en razón social, devolver inmediatamente
      if (razonSocialNormalizada === nombreNormalizado) {
        return delegacion.delegacion || delegacion.codigo || '';
      } else if (razonSocialNormalizada.includes(nombreNormalizado)) {
        return delegacion.delegacion || delegacion.codigo || '';
      } else if (nombreNormalizado.includes(razonSocialNormalizada)) {
        return delegacion.delegacion || delegacion.codigo || '';
      }
    }
    
    // Si no hay coincidencia directa, buscar por palabras
    const palabrasNombre = nombreNormalizado.split(/\s+/).filter(p => p.length > 2);
    if (palabrasNombre.length === 0) return '';
    
    // Buscar coincidencias con puntuación
    let mejorPuntuacion = 0;
    let codigoDelegacion = '';
    
    for (const delegacion of delegaciones) {
      // Intentar coincidir con razón social primero
      if (delegacion.razon_social) {
        const razonSocialNormalizada = normalizarTexto(normalizarSufijosLegales(delegacion.razon_social));
        const palabrasRazonSocial = razonSocialNormalizada.split(/\s+/).filter(p => p.length > 2);
        
        // Calcular puntuación de coincidencia
        let puntuacion = 0;
        
        // Coincidencia exacta (mayor puntuación)
        if (razonSocialNormalizada === nombreNormalizado) {
          puntuacion = 100;
        } else {
          // Contar palabras coincidentes
          const palabrasCoincidentes = palabrasNombre.filter(palabra => 
            palabrasRazonSocial.some(palabraRazon => 
              palabraRazon.includes(palabra) || palabra.includes(palabraRazon)
            )
          );
          
          // Calcular porcentaje de coincidencia
          if (palabrasCoincidentes.length > 0) {
            const porcentajeCoincidencia = palabrasCoincidentes.length / Math.max(palabrasNombre.length, palabrasRazonSocial.length);
            puntuacion = porcentajeCoincidencia * 80; // Máximo 80 puntos por coincidencia parcial
          }
          
          // Coincidencia por contención
          if (razonSocialNormalizada.includes(nombreNormalizado)) {
            const puntosContencion = 70;
            puntuacion = Math.max(puntuacion, puntosContencion);
          } else if (nombreNormalizado.includes(razonSocialNormalizada)) {
            const puntosContencion = 60;
            puntuacion = Math.max(puntuacion, puntosContencion);
          }
        }
        
        // Actualizar mejor coincidencia
        if (puntuacion > mejorPuntuacion) {
          mejorPuntuacion = puntuacion;
          codigoDelegacion = delegacion.delegacion || delegacion.codigo || '';
        }
      }
      
      // Si no hay razón social, intentar con cliente como respaldo
      else if (delegacion.cliente) {
        const clienteNormalizado = normalizarTexto(normalizarSufijosLegales(delegacion.cliente));
        
        // Calcular puntuación con cliente
        let puntuacion = 0;
        
        if (clienteNormalizado === nombreNormalizado) {
          puntuacion = 90; // Menor que coincidencia exacta con razón social
        } else if (clienteNormalizado.includes(nombreNormalizado) || nombreNormalizado.includes(clienteNormalizado)) {
          puntuacion = 50;
        }
        
        if (puntuacion > mejorPuntuacion) {
          mejorPuntuacion = puntuacion;
          codigoDelegacion = delegacion.delegacion || delegacion.codigo || '';
        }
      }
    }
    
    // Umbral mínimo de coincidencia (40%)
    return mejorPuntuacion >= 40 ? codigoDelegacion : '';
  };

  // Función para buscar el código y CIF del proveedor por nombre usando LIKE
  const buscarDatosProveedor = (nombreProveedor: string): {codigo: string, cif: string} => {
    if (!nombreProveedor || loadingProveedores) return { codigo: '', cif: '' };
    
    // Limpiar sufijos comunes y normalizar el nombre del proveedor
    const nombreLimpio = limpiarSufijosEmpresas(nombreProveedor);
    const nombreNormalizado = normalizarTexto(nombreLimpio);
    
    // Dividir el nombre en palabras para buscar coincidencias parciales
    const palabrasNombre = nombreNormalizado.split(/\s+/).filter(p => p.length > 2);
    
    // Buscar coincidencia bidireccional (el proveedor puede estar en la factura o viceversa)
    const proveedorEncontrado = proveedores.find(p => {
      if (!p.nombre) return false;
      
      // Limpiar sufijos y normalizar el nombre del proveedor en la base de datos
      const nombreProveedorLimpio = limpiarSufijosEmpresas(p.nombre);
      const nombreProveedorNormalizado = normalizarTexto(nombreProveedorLimpio);
      
      // Verificar si hay coincidencia exacta después de normalizar
      if (nombreProveedorNormalizado === nombreNormalizado) return true;
      
      // Verificar si el nombre del proveedor contiene el nombre de la factura
      if (nombreProveedorNormalizado.includes(nombreNormalizado)) return true;
      
      // Verificar si el nombre de la factura contiene el nombre del proveedor
      if (nombreNormalizado.includes(nombreProveedorNormalizado)) return true;
      
      // Verificar coincidencia por palabras clave (si hay al menos 50% de palabras coincidentes)
      const palabrasProveedor = nombreProveedorNormalizado.split(/\s+/).filter(p => p.length > 2);
      
      // Contar palabras coincidentes
      const palabrasCoincidentes = palabrasNombre.filter(palabra => 
        palabrasProveedor.some(palabraProveedor => 
          palabraProveedor.includes(palabra) || palabra.includes(palabraProveedor)
        )
      );
      
      // Si hay al menos una palabra significativa coincidente y representa al menos el 50% de las palabras
      const umbralCoincidencia = Math.min(palabrasNombre.length, palabrasProveedor.length) * 0.5;
      return palabrasCoincidentes.length > 0 && palabrasCoincidentes.length >= umbralCoincidencia;
    });
    
    return proveedorEncontrado ? {
      codigo: proveedorEncontrado.codigo || '',
      cif: proveedorEncontrado.cif || ''
    } : { codigo: '', cif: '' };
  };

  // La función calcularSumaCodProveedor ha sido eliminada

  useEffect(() => {
    console.log('🔍 ExcelViewer - useEffect ejecutado');
    console.log('📊 ExcelViewer recibió processedData:', processedData);
    console.log('🔢 processedData.length:', processedData?.length || 0);
    console.log('📈 processedCount actual:', processedCount);

    // Solo procesar las nuevas facturas que no hemos procesado aún
    if (processedData && processedData.length > processedCount) {
      console.log('✅ Condición cumplida: procesando nuevas facturas');
      const newInvoices = processedData.slice(processedCount);
      console.log('🔄 Procesando nuevas facturas:', newInvoices.length);

      const newRows = newInvoices.flatMap(invoice => {
        // Manejar diferentes estructuras de datos
        const invoiceData = invoice.data || invoice;
        const items = invoiceData.items || invoiceData.data?.items || [];

        // Obtener el nombre del archivo
        const fileName = invoice.fileName || invoiceData.fileName || invoiceData.data?.fileName || 'Sin nombre';

        if (Array.isArray(items) && items.length > 0) {
          return items.map((item: InvoiceItem) => {
            const proveedor = invoiceData.proveedor || invoiceData.data?.proveedor || '';
            const datosProveedor = buscarDatosProveedor(proveedor);
            const unidades = item.unidades ?? 0;
            const precioUd = item.precioUd ?? 0;
            const dto = item.dto ?? 0;

            // Buscar datos del artículo si hay descripción
            const datosArticulo = item.descripcion ? buscarDatosArticulo(item.descripcion) : { codigo: '', subfamilia: '', iva: 0 };

            // Usar el IVA del maestro de artículos si está disponible, de lo contrario usar el de la factura
            const iva = datosArticulo.iva || item.iva || 0; // priorizar IVA del maestro
            const netoCalc = item.neto ?? (unidades * precioUd * (1 - dto / 100));
            const importe = netoCalc * (1 + iva / 100);

            // Obtener cliente de los datos de la factura
            const cliente = invoiceData.cliente || invoiceData.data?.cliente || '';
            const delegacion = buscarDelegacion(cliente);

            return [
              fileName,
              proveedor,
              datosProveedor.cif,
              datosProveedor.codigo,
              cliente,
              delegacion,
              datosArticulo.codigo || item.codArticulo || '',
              datosArticulo.subfamilia || '',
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
        console.log('➕ Agregando nuevas filas al editor:', newRows.length);

        // Agregar las nuevas filas a las existentes
        setData(prevData => ({
          ...prevData,
          rows: [...prevData.rows, ...newRows]
        }));

        // Actualizar el contador de facturas procesadas
        setProcessedCount(processedData.length);
        console.log('🔄 processedCount actualizado a:', processedData.length);
      } else {
        console.log('⚠️ No hay nuevas filas para agregar');
      }
    } else {
      console.log('⏭️ Condición NO cumplida - no se procesan facturas');
      console.log('   processedData existe:', !!processedData);
      console.log('   processedData.length:', processedData?.length || 0);
      console.log('   processedCount:', processedCount);
    }
  }, [processedData, processedCount, loadingProveedores, loadingArticulos, loadingDelegaciones]);

  // Efecto separado para limpiar cuando processedData se resetea
  useEffect(() => {
    console.log('🧹 Efecto de limpieza ejecutado');
    console.log('📊 processedData.length en limpieza:', processedData.length);

    if (processedData.length === 0) {
      console.log('🧹 Limpiando editor - processedData vacío');
      setData(prevData => ({
        ...prevData,
        rows: []
      }));
      setProcessedCount(0);
      console.log('🔄 processedCount reseteado a 0');
    } else {
      console.log('✅ No se limpia - processedData tiene contenido');
    }
  }, [processedData.length]);

  const handleCellEdit = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...data.rows];
    // Actualizar valor editado
    newRows[rowIndex][colIndex] = value;

    // Si se edita el nombre del proveedor (columna 1), actualizar el CIF (columna 2) y código de proveedor (columna 3)
    if (colIndex === 1) {
      const { codigo, cif } = buscarDatosProveedor(value);
      newRows[rowIndex][2] = cif;
      newRows[rowIndex][3] = codigo;
    }
    
    // Si se edita el cliente (columna 4), actualizar la delegación (columna 5)
    if (colIndex === 4) {
      const delegacion = buscarDelegacion(value);
      newRows[rowIndex][5] = delegacion;
    }
    
    // Si se edita la descripción del artículo (columna 8), actualizar el código de artículo (columna 6) y subfamilia (columna 7)
    if (colIndex === 8) {
      const { codigo, subfamilia, iva } = buscarDatosArticulo(value);
      newRows[rowIndex][6] = codigo;
      newRows[rowIndex][7] = subfamilia;
      newRows[rowIndex][12] = iva.toString();
    }
    
    setData({
      ...data,
      rows: newRows
    });
  };


  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    setEditingCell({ row: rowIndex, col: colIndex });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const addRow = () => {
    const newRow = new Array(data.headers.length).fill('');
    const updatedRows = [...data.rows, newRow];
    setData({
      ...data,
      rows: updatedRows
    });
  };

  const deleteRow = (index: number) => {
    const newRows = data.rows.filter((_, i) => i !== index);
    setData({ ...data, rows: newRows });
    // Ya no es necesario recalcular la suma de códigos de proveedor
  };

  const exportToExcel = () => {
    // Formato específico requerido por el usuario
    const excelHeaders = [
      'Proveedor', 'CIF', 'Cód. Proveedor', 'Cliente', 'Delegación', 
      'Cód. Artículo', 'Subfamilia', 'Descripción', 'Unidades', 
      'Precio Ud.', '% Dto.', '% IVA', 'Neto', 'Importe'
    ];
    
    // Mapear los datos al formato específico
    const excelRows = data.rows.map(row => {
      // Crear un mapa de los datos de la fila
      const rowData: { [key: string]: any } = {};
      data.headers.forEach((header, index) => {
        rowData[header] = row[index] || '';
      });
      
      return [
        rowData['Proveedor'] || '',
        rowData['CIF'] || '',
        rowData['Cód. Proveedor'] || '',
        rowData['Cliente'] || '',
        rowData['Delegación'] || '',
        rowData['Cód. Artículo'] || '',
        rowData['Subfamilia'] || '',
        rowData['Descripción'] || '',
        rowData['Unidades'] || 0,
        rowData['Precio Ud.'] || 0,
        rowData['% Dto.'] || 0,
        rowData['% IVA'] || 0,
        rowData['Neto'] || 0,
        rowData['Importe'] || 0
      ];
    });
    
    const ws = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    
    // Aplicar estilos a los encabezados
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'CCCCCC' } }
      };
    }
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 20 }, // Proveedor
      { wch: 12 }, // CIF
      { wch: 12 }, // Cód. Proveedor
      { wch: 15 }, // Cliente
      { wch: 12 }, // Delegación
      { wch: 12 }, // Cód. Artículo
      { wch: 12 }, // Subfamilia
      { wch: 25 }, // Descripción
      { wch: 10 }, // Unidades
      { wch: 10 }, // Precio Ud.
      { wch: 8 },  // % Dto.
      { wch: 8 },  // % IVA
      { wch: 10 }, // Neto
      { wch: 10 }  // Importe
    ];
    
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

  // Función para guardar las facturas procesadas en la base de datos
  const saveProcessedInvoices = async () => {
    console.log('⚠️ saveProcessedInvoices LLAMADA - Esta función NO debería ejecutarse automáticamente');
    if (data.rows.length === 0) {
      alert('No hay facturas procesadas para guardar.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Obtener el usuario actual del sessionStorage
      const currentUsername = sessionStorage.getItem('username');
      console.log('🔍 saveProcessedInvoices - sessionStorage completo:', Object.keys(sessionStorage));
      console.log('👤 saveProcessedInvoices - currentUsername del sessionStorage:', currentUsername);
      console.log('🔐 saveProcessedInvoices - isAuthenticated del sessionStorage:', sessionStorage.getItem('isAuthenticated'));

      if (!currentUsername) {
        console.error('❌ saveProcessedInvoices - ERROR: No se pudo obtener el usuario actual');
        throw new Error('No se pudo obtener el usuario actual. Asegúrate de estar logueado.');
      }

      console.log('✅ saveProcessedInvoices - Usuario encontrado:', currentUsername);
      console.log('📊 saveProcessedInvoices - Cantidad de filas a guardar:', data.rows.length);

      // Preparar las facturas para guardar
      const invoicesToSave = data.rows.map((row, index) => {
        const invoiceData = {
          numero_factura: row[1] || '', // Proveedor
          fecha_factura: row[2] || '', // CIF
          proveedor: row[1] || '', // Proveedor
          cliente: row[5] || '', // Cliente
          usuario: currentUsername, // Usuario que procesó la factura
          items: [{
            descripcion: row[8] || '', // Descripción
            unidades: parseFloat(row[9]?.toString() || '0'),
            precioUd: parseFloat(row[10]?.toString() || '0'),
            dto: parseFloat(row[11]?.toString() || '0'),
            iva: parseFloat(row[12]?.toString() || '0'),
            neto: parseFloat(row[13]?.toString() || '0')
          }],
          created_at: new Date().toISOString()
        };

        console.log(`📄 saveProcessedInvoices - Factura ${index + 1} preparada:`, {
          numero_factura: invoiceData.numero_factura,
          usuario: invoiceData.usuario,
          cliente: invoiceData.cliente,
          items_count: invoiceData.items.length
        });

        return invoiceData;
      });

      console.log('📋 saveProcessedInvoices - Array completo de facturas a guardar:', invoicesToSave);

      // Guardar cada factura en la base de datos
      for (let i = 0; i < invoicesToSave.length; i++) {
        const invoice = invoicesToSave[i];
        console.log(`💾 saveProcessedInvoices - Guardando factura ${i + 1}/${invoicesToSave.length}:`, invoice);

        const { data: savedData, error } = await supabase
          .from('processed_invoices')
          .insert(invoice)
          .select();

        if (error) {
          console.error('❌ saveProcessedInvoices - Error guardando factura:', error);
          console.error('❌ saveProcessedInvoices - Detalles de la factura que falló:', invoice);
          throw new Error(`Error al guardar la factura ${invoice.numero_factura}: ${error.message}`);
        }

        console.log('✅ saveProcessedInvoices - Factura guardada exitosamente:', savedData);
      }

      setSaveSuccess(true);
      console.log(`🎉 saveProcessedInvoices - ${invoicesToSave.length} facturas guardadas exitosamente por usuario: ${currentUsername}`);

      // Mostrar mensaje de éxito
      setTimeout(() => {
        alert(`${invoicesToSave.length} facturas guardadas exitosamente en la base de datos.`);
      }, 500);

    } catch (error: any) {
      console.error('💥 saveProcessedInvoices - Error al guardar facturas:', error);
      alert(`Error al guardar las facturas: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
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
              <p className="text-xs text-gray-600">Las facturas se guardan automáticamente al procesarlas</p>
            </div>
          </div>
          
          <div className="flex gap-2">
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              <strong>Tip:</strong> Haz doble clic en cualquier celda para editarla
            </p>
            {/* Se eliminó el indicador de Suma Cód. Proveedor */}
          </div>
        </div>
      )}
    </div>
  );
};
