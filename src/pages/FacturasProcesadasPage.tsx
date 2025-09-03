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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Función para extraer información entre paréntesis
  const extraerInfoParentesis = (texto: string): string[] => {
    const matches = texto.match(/\(([^)]+)\)/g);
    return matches ? matches.map(match => match.replace(/[()]/g, '').trim()) : [];
  };

  // Función para normalizar errores tipográficos comunes
  const corregirErroresTipograficos = (texto: string): string => {
    if (!texto) return '';
    return texto
      .replace(/\btercer\b/gi, 'tercera')
      .replace(/\beztrella\b/gi, 'estrella')
      .replace(/\bmarangos\b/gi, 'marangos')
      .replace(/\bpedregalejo\b/gi, 'pedregalejo');
  };

  // Función para calcular similitud entre dos textos usando Levenshtein simplificado
  const calcularSimilitud = (texto1: string, texto2: string): number => {
    if (texto1 === texto2) return 100;
    
    const len1 = texto1.length;
    const len2 = texto2.length;
    
    if (len1 === 0) return len2 === 0 ? 100 : 0;
    if (len2 === 0) return 0;
    
    // Similitud por inclusión
    if (texto1.includes(texto2) || texto2.includes(texto1)) {
      return Math.max(texto2.length / texto1.length, texto1.length / texto2.length) * 85;
    }
    
    // Similitud por palabras comunes
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
    
    console.log('🔍 Buscando proveedor para:', nombreProveedor);
    console.log('📊 Total proveedores disponibles:', proveedores.length);
    
    // Extraer información entre paréntesis
    const infoParentesis = extraerInfoParentesis(nombreProveedor);
    console.log('📝 Info entre paréntesis proveedor:', infoParentesis);
    
    // Corregir errores tipográficos comunes
    const nombreCorregido = corregirErroresTipograficos(nombreProveedor);
    console.log('✏️ Nombre proveedor corregido:', nombreCorregido);
    
    const nombreLimpio = limpiarSufijosEmpresas(nombreCorregido);
    const nombreNormalizado = normalizarTexto(nombreLimpio);
    console.log('🔧 Nombre proveedor normalizado:', nombreNormalizado);
    
    // Dividir en palabras para búsqueda por partes
    const palabrasProveedor = nombreNormalizado.split(/\s+/).filter(p => p.length > 2);
    console.log('📝 Palabras del proveedor:', palabrasProveedor);
    
    let mejorCoincidencia = null;
    let mejorPuntuacion = 0;
    
    for (const proveedor of proveedores) {
      let puntuacionTotal = 0;
      console.log(`\n🏭 Evaluando proveedor:`, {
        codigo: proveedor.codigo,
        nombre: proveedor.nombre,
        cif: proveedor.cif
      });
      
      if (!proveedor.nombre) continue;
      
      const nombreProveedorCorregido = corregirErroresTipograficos(proveedor.nombre);
      const nombreProveedorLimpio = limpiarSufijosEmpresas(nombreProveedorCorregido);
      const nombreProveedorNormalizado = normalizarTexto(nombreProveedorLimpio);
      console.log(`  📋 Nombre proveedor DB normalizado: "${nombreProveedorNormalizado}"`);
      
      // Coincidencia exacta
      if (nombreProveedorNormalizado === nombreNormalizado) {
        console.log('  ✅ Coincidencia exacta con proveedor!');
        return { codigo: proveedor.codigo || '', cif: proveedor.cif || '' };
      }
      
      // Usar similitud avanzada
      const similitudNombre = calcularSimilitud(nombreNormalizado, nombreProveedorNormalizado);
      console.log(`  📊 Similitud nombre: ${similitudNombre}%`);
      if (similitudNombre >= 70) {
        puntuacionTotal += similitudNombre;
      }
      
      // Coincidencia parcial
      if (nombreProveedorNormalizado.includes(nombreNormalizado) || nombreNormalizado.includes(nombreProveedorNormalizado)) {
        puntuacionTotal += 80;
        console.log('  ✅ Coincidencia parcial con nombre (+80)');
      }
      
      // Buscar información entre paréntesis en el nombre del proveedor
      for (const info of infoParentesis) {
        const infoNormalizada = normalizarTexto(corregirErroresTipograficos(info));
        const similitudParentesis = calcularSimilitud(infoNormalizada, nombreProveedorNormalizado);
        console.log(`  📝 Similitud paréntesis "${info}": ${similitudParentesis}%`);
        if (similitudParentesis >= 60) {
          puntuacionTotal += similitudParentesis * 0.8;
        }
      }
      
      // Coincidencia por palabras
      const palabrasProveedorDB = nombreProveedorNormalizado.split(/\s+/).filter(p => p.length > 2);
      const coincidenciasPalabras = palabrasProveedor.filter(palabra => 
        palabrasProveedorDB.some(palabraDB => 
          palabraDB.includes(palabra) || palabra.includes(palabraDB)
        )
      );
      
      if (coincidenciasPalabras.length > 0) {
        const puntajePalabras = (coincidenciasPalabras.length / Math.max(palabrasProveedor.length, palabrasProveedorDB.length)) * 60;
        puntuacionTotal += puntajePalabras;
        console.log(`  📝 Coincidencias por palabras: ${coincidenciasPalabras.length} (+${puntajePalabras.toFixed(1)})`);
      }
      
      // Buscar partes del nombre separadas por guiones o espacios
      if (proveedor.nombre.includes('-') || proveedor.nombre.includes(' ')) {
        const partesNombre = proveedor.nombre.split(/[-\s]+/).map((parte: string) => normalizarTexto(limpiarSufijosEmpresas(parte)));
        for (const parte of partesNombre) {
          if (parte.length > 2) {
            const similitudParte = calcularSimilitud(nombreNormalizado, parte);
            console.log(`  🔍 Similitud con parte "${parte}": ${similitudParte}%`);
            if (similitudParte >= 70) {
              puntuacionTotal += similitudParte * 0.7;
            }
          }
        }
      }
      
      console.log(`  🎯 Puntuación total proveedor: ${puntuacionTotal}`);
      if (puntuacionTotal > mejorPuntuacion && puntuacionTotal >= 40) {
        mejorPuntuacion = puntuacionTotal;
        mejorCoincidencia = proveedor;
        console.log(`  🏆 Nueva mejor coincidencia proveedor: ${proveedor.codigo} (${mejorPuntuacion})`);
      }
    }
    
    console.log(`\n🎯 Resultado final proveedor: ${mejorCoincidencia?.codigo || 'No encontrado'} con puntuación ${mejorPuntuacion}`);
    
    return mejorCoincidencia ? {
      codigo: mejorCoincidencia.codigo || '',
      cif: mejorCoincidencia.cif || ''
    } : { codigo: '', cif: '' };
  };

  const buscarDelegacion = (nombreCliente: string): string => {
    if (!nombreCliente || loadingMaestros) return '';
    
    console.log('🔍 Buscando delegación para:', nombreCliente);
    console.log('📊 Total delegaciones disponibles:', delegaciones.length);
    
    // Extraer información entre paréntesis
    const infoParentesis = extraerInfoParentesis(nombreCliente);
    console.log('📝 Info entre paréntesis:', infoParentesis);
    
    // Corregir errores tipográficos comunes
    const nombreCorregido = corregirErroresTipograficos(nombreCliente);
    console.log('✏️ Nombre corregido:', nombreCorregido);
    
    // Normalizar el nombre del cliente
    const nombreConSufijosNormalizados = normalizarSufijosLegales(nombreCorregido);
    const nombreLimpio = limpiarSufijosEmpresas(nombreConSufijosNormalizados);
    const nombreNormalizado = normalizarTexto(nombreLimpio);
    console.log('🔧 Nombre normalizado:', nombreNormalizado);
    
    // Dividir el nombre del cliente en palabras para búsqueda por partes
    const palabrasCliente = nombreNormalizado.split(/\s+/).filter(p => p.length > 2);
    console.log('📝 Palabras del cliente:', palabrasCliente);
    
    let mejorCoincidencia = '';
    let mejorPuntuacion = 0;
    
    for (const delegacion of delegaciones) {
      let puntuacionTotal = 0;
      console.log(`\n🏢 Evaluando delegación:`, {
        delegacion: delegacion.delegacion || delegacion.codigo,
        razon_social: delegacion.razon_social,
        nombre_comercial: delegacion.nombre_comercial || delegacion.cliente
      });
      
      // Buscar en razón social
      if (delegacion.razon_social) {
        const razonSocialCorregida = corregirErroresTipograficos(delegacion.razon_social);
        const razonSocialNormalizada = normalizarTexto(normalizarSufijosLegales(razonSocialCorregida));
        console.log(`  📋 Razón social normalizada: "${razonSocialNormalizada}"`);
        
        // Coincidencia exacta con razón social
        if (razonSocialNormalizada === nombreNormalizado) {
          console.log('  ✅ Coincidencia exacta con razón social!');
          return delegacion.delegacion || delegacion.codigo || '';
        }
        
        // Usar similitud avanzada para razón social
        const similitudRazonSocial = calcularSimilitud(nombreNormalizado, razonSocialNormalizada);
        console.log(`  📊 Similitud razón social: ${similitudRazonSocial}%`);
        if (similitudRazonSocial >= 70) {
          puntuacionTotal += similitudRazonSocial;
        }
        
        // Coincidencia parcial con razón social
        if (razonSocialNormalizada.includes(nombreNormalizado) || nombreNormalizado.includes(razonSocialNormalizada)) {
          puntuacionTotal += 80;
          console.log('  ✅ Coincidencia parcial con razón social (+80)');
        }
        
        // Coincidencia por palabras en razón social
        const palabrasRazonSocial = razonSocialNormalizada.split(/\s+/).filter(p => p.length > 2);
        const coincidenciasRazonSocial = palabrasCliente.filter(palabra => 
          palabrasRazonSocial.some(palabraRazon => 
            palabraRazon.includes(palabra) || palabra.includes(palabraRazon)
          )
        );
        
        if (coincidenciasRazonSocial.length > 0) {
          const puntajePalabras = (coincidenciasRazonSocial.length / Math.max(palabrasCliente.length, palabrasRazonSocial.length)) * 60;
          puntuacionTotal += puntajePalabras;
          console.log(`  📝 Coincidencias por palabras razón social: ${coincidenciasRazonSocial.length} (+${puntajePalabras.toFixed(1)})`);
        }
      }
      
      // Buscar en nombre comercial (si existe)
      if (delegacion.nombre_comercial || delegacion.cliente) {
        const nombreComercial = delegacion.nombre_comercial || delegacion.cliente;
        const nombreComercialCorregido = corregirErroresTipograficos(nombreComercial);
        const nombreComercialNormalizado = normalizarTexto(nombreComercialCorregido);
        
        // Coincidencia exacta con nombre comercial
        if (nombreComercialNormalizado === nombreNormalizado) {
          return delegacion.delegacion || delegacion.codigo || '';
        }
        
        // Usar similitud avanzada para nombre comercial
        const similitudNombreComercial = calcularSimilitud(nombreNormalizado, nombreComercialNormalizado);
        if (similitudNombreComercial >= 70) {
          puntuacionTotal += similitudNombreComercial * 0.9; // Ligeramente menos peso que razón social
        }
        
        // Coincidencia parcial con nombre comercial
        if (nombreComercialNormalizado.includes(nombreNormalizado) || nombreNormalizado.includes(nombreComercialNormalizado)) {
          puntuacionTotal += 70;
        }
        
        // Buscar información entre paréntesis en el nombre comercial
        for (const info of infoParentesis) {
          const infoNormalizada = normalizarTexto(corregirErroresTipograficos(info));
          const similitudParentesis = calcularSimilitud(infoNormalizada, nombreComercialNormalizado);
          if (similitudParentesis >= 60) {
            puntuacionTotal += similitudParentesis * 0.8;
          }
        }
        
        // Coincidencia por palabras en nombre comercial
        const palabrasNombreComercial = nombreComercialNormalizado.split(/\s+/).filter(p => p.length > 2);
        const coincidenciasNombreComercial = palabrasCliente.filter(palabra => 
          palabrasNombreComercial.some(palabraComercial => 
            palabraComercial.includes(palabra) || palabra.includes(palabraComercial)
          )
        );
        
        if (coincidenciasNombreComercial.length > 0) {
          puntuacionTotal += (coincidenciasNombreComercial.length / Math.max(palabrasCliente.length, palabrasNombreComercial.length)) * 50;
        }
      }
      
      // Búsqueda combinada: nombre comercial + razón social
      if (delegacion.nombre_comercial && delegacion.razon_social) {
        const textoCompleto = `${delegacion.nombre_comercial} ${delegacion.razon_social}`;
        const textoCompletoNormalizado = normalizarTexto(normalizarSufijosLegales(textoCompleto));
        
        if (textoCompletoNormalizado.includes(nombreNormalizado) || nombreNormalizado.includes(textoCompletoNormalizado)) {
          puntuacionTotal += 90;
        }
        
        // Verificar si todas las palabras del cliente están en el texto completo
        const palabrasTextoCompleto = textoCompletoNormalizado.split(/\s+/).filter(p => p.length > 2);
        const todasLasPalabrasCoinciden = palabrasCliente.every(palabra => 
          palabrasTextoCompleto.some(palabraCompleta => 
            palabraCompleta.includes(palabra) || palabra.includes(palabraCompleta)
          )
        );
        
        if (todasLasPalabrasCoinciden && palabrasCliente.length > 1) {
          puntuacionTotal += 95;
        }
      }
      
      // Actualizar la mejor coincidencia
      console.log(`  🎯 Puntuación total: ${puntuacionTotal}`);
      if (puntuacionTotal > mejorPuntuacion && puntuacionTotal >= 40) { // Umbral mínimo del 40%
        mejorPuntuacion = puntuacionTotal;
        mejorCoincidencia = delegacion.delegacion || delegacion.codigo || '';
        console.log(`  🏆 Nueva mejor coincidencia: ${mejorCoincidencia} (${mejorPuntuacion})`);
      }
    }
    
    console.log(`\n🎯 Resultado final: "${mejorCoincidencia}" con puntuación ${mejorPuntuacion}`);
    return mejorCoincidencia;
  };

  const buscarDatosArticulo = (descripcion: string): {codigo: string, subfamilia: string, iva: number} => {
    if (!descripcion || loadingMaestros) return { codigo: '', subfamilia: '', iva: 0 };
    
    console.log('🔍 Buscando artículo para:', descripcion);
    console.log('📊 Total artículos disponibles:', articulos.length);
    
    // Corregir errores tipográficos comunes
    const descripcionCorregida = corregirErroresTipograficos(descripcion);
    console.log('✏️ Descripción corregida:', descripcionCorregida);
    
    const descripcionNormalizada = normalizarTexto(descripcionCorregida);
    console.log('🔧 Descripción normalizada:', descripcionNormalizada);
    
    // Dividir en palabras para búsqueda por partes
    const palabrasDescripcion = descripcionNormalizada.split(/\s+/).filter(p => p.length > 2);
    console.log('📝 Palabras de la descripción:', palabrasDescripcion);
    
    let mejorCoincidencia = null;
    let mejorPuntuacion = 0;
    
    for (const articulo of articulos) {
      let puntuacionTotal = 0;
      console.log(`\n📦 Evaluando artículo:`, {
        codigo: articulo.codigo,
        descripcion: articulo.descripcion,
        subfamilia: articulo.subfamilia,
        iva: articulo.iva
      });
      
      if (!articulo.descripcion) continue;
      
      const descripcionArtCorregida = corregirErroresTipograficos(articulo.descripcion);
      const descripcionArtNormalizada = normalizarTexto(descripcionArtCorregida);
      console.log(`  📋 Descripción artículo DB normalizada: "${descripcionArtNormalizada}"`);
      
      // Coincidencia exacta
      if (descripcionArtNormalizada === descripcionNormalizada) {
        console.log('  ✅ Coincidencia exacta con artículo!');
        return {
          codigo: articulo.codigo || '',
          subfamilia: articulo.subfamilia || '',
          iva: articulo.iva || 0
        };
      }
      
      // Usar similitud avanzada
      const similitudDescripcion = calcularSimilitud(descripcionNormalizada, descripcionArtNormalizada);
      console.log(`  📊 Similitud descripción: ${similitudDescripcion}%`);
      if (similitudDescripcion >= 70) {
        puntuacionTotal += similitudDescripcion;
      }
      
      // Coincidencia parcial
      if (descripcionArtNormalizada.includes(descripcionNormalizada) || descripcionNormalizada.includes(descripcionArtNormalizada)) {
        puntuacionTotal += 80;
        console.log('  ✅ Coincidencia parcial con descripción (+80)');
      }
      
      // Coincidencia por palabras clave (muy importante para artículos)
      const palabrasArticuloDB = descripcionArtNormalizada.split(/\s+/).filter(p => p.length > 2);
      const coincidenciasPalabras = palabrasDescripcion.filter(palabra => 
        palabrasArticuloDB.some(palabraDB => 
          palabraDB.includes(palabra) || palabra.includes(palabraDB) || palabra === palabraDB
        )
      );
      
      if (coincidenciasPalabras.length > 0) {
        const puntajePalabras = (coincidenciasPalabras.length / Math.max(palabrasDescripcion.length, palabrasArticuloDB.length)) * 70;
        puntuacionTotal += puntajePalabras;
        console.log(`  📝 Coincidencias por palabras: ${coincidenciasPalabras.length} palabras (${coincidenciasPalabras.join(', ')}) (+${puntajePalabras.toFixed(1)})`);
      }
      
      // Verificar si todas las palabras del artículo están en la descripción de la factura
      const todasPalabrasArticuloEnFactura = palabrasArticuloDB.every(palabraArt => 
        palabrasDescripcion.some(palabraFact => 
          palabraFact.includes(palabraArt) || palabraArt.includes(palabraFact)
        )
      );
      
      if (todasPalabrasArticuloEnFactura && palabrasArticuloDB.length > 1) {
        puntuacionTotal += 85;
        console.log('  ✅ Todas las palabras del artículo están en la factura (+85)');
      }
      
      // Verificar si la mayoría de palabras de la factura están en el artículo
      const palabrasFacturaEnArticulo = palabrasDescripcion.filter(palabraFact => 
        palabrasArticuloDB.some(palabraArt => 
          palabraArt.includes(palabraFact) || palabraFact.includes(palabraArt)
        )
      );
      
      if (palabrasFacturaEnArticulo.length >= Math.ceil(palabrasDescripcion.length * 0.7)) {
        const puntajeCobertura = (palabrasFacturaEnArticulo.length / palabrasDescripcion.length) * 60;
        puntuacionTotal += puntajeCobertura;
        console.log(`  ✅ ${palabrasFacturaEnArticulo.length}/${palabrasDescripcion.length} palabras de factura en artículo (+${puntajeCobertura.toFixed(1)})`);
      }
      
      console.log(`  🎯 Puntuación total artículo: ${puntuacionTotal}`);
      if (puntuacionTotal > mejorPuntuacion && puntuacionTotal >= 50) { // Umbral más alto para artículos
        mejorPuntuacion = puntuacionTotal;
        mejorCoincidencia = articulo;
        console.log(`  🏆 Nueva mejor coincidencia artículo: ${articulo.codigo} (${mejorPuntuacion})`);
      }
    }
    
    console.log(`\n🎯 Resultado final artículo: ${mejorCoincidencia?.codigo || 'No encontrado'} con puntuación ${mejorPuntuacion}`);
    
    return mejorCoincidencia ? {
      codigo: mejorCoincidencia.codigo || '',
      subfamilia: mejorCoincidencia.subfamilia || '',
      iva: mejorCoincidencia.iva || 0
    } : { codigo: '', subfamilia: '', iva: 0 };
  };

  const handleDownloadExcel = (invoice: ProcessedInvoice) => {
    // Formato específico requerido por el usuario
    const excelHeaders = [
      'Proveedor', 'CIF', 'Cód. Proveedor', 'Cliente', 'Delegación', 
      'Cód. Artículo', 'Subfamilia', 'Descripción', 'Unidades', 
      'Precio Ud.', '% Dto.', '% IVA', 'Neto', 'Importe'
    ];

    const excelRows = invoice.items.map(item => {
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
        (item.neto || 0) * (1 + (datosArticulo.iva || item.iva || 0) / 100) // Calcular importe
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

    // Aplicar estilos a los encabezados
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'CCCCCC' } }
      };
    }

    // Ajustar ancho de columnas
    worksheet['!cols'] = [
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

    const fetchMaestros = async () => {
      try {
        setLoadingMaestros(true);
        
        // Cargar proveedores
        const { data: proveedoresData } = await supabase
          .from('proveedores')
          .select('*');
        
        // Cargar artículos
        const { data: articulosData } = await supabase
          .from('articulos')
          .select('*');
        
        // Cargar delegaciones
        const { data: delegacionesData } = await supabase
          .from('delegaciones')
          .select('*');
        
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
