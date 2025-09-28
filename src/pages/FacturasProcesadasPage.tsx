import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { FileText, Calendar, User, Building, List, Trash2, FileDown, CheckSquare, Square, Check, X } from 'lucide-react';

interface InvoiceItem {
  codCentral: string;
  codArticulo: string;
  descripcion: string;
  unidades: number;
  pesoKg?: number;
  volumenL?: number;
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
  total?: number; // ✅ Campo opcional para el total de la factura
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

  // Sistema de cache para búsquedas
  const [searchCache, setSearchCache] = useState<Map<string, any>>(new Map());

  // Configuración dinámica para búsquedas
  const [configBusqueda, setConfigBusqueda] = useState({
    umbralSimilitudProveedores: 60,
    umbralSimilitudArticulos: 75,
    umbralSimilitudDelegaciones: 60,
    maxResultadosCache: 1000,
    usarCache: true,
    logLevel: 'info' as 'none' | 'info' | 'debug'
  });

  // Estado para verificar si el usuario actual es admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // Estado para edición de IVA
  const [editingIVA, setEditingIVA] = useState<{invoiceId: number, itemIndex: number} | null>(null);
  const [tempIVA, setTempIVA] = useState<number>(0);

  // Función genérica para búsquedas con cache
  const buscarConCache = useCallback((tipo: 'proveedor' | 'articulo' | 'delegacion', clave: string, funcionBusqueda: Function) => {
    const cacheKey = `${tipo}:${clave.toLowerCase().trim()}`;
    
    // Verificar si el cache está habilitado
    if (!configBusqueda.usarCache) {
      return funcionBusqueda(clave);
    }
    
    // Verificar si ya está en cache
    if (searchCache.has(cacheKey)) {
      if (configBusqueda.logLevel !== 'none') {
        console.log(`💾 [CACHE] Hit para ${tipo}: "${clave}"`);
      }
      return searchCache.get(cacheKey);
    }
    
    // Ejecutar búsqueda
    const resultado = funcionBusqueda(clave);
    
    // Guardar en cache (solo si no está vacío y no excede el límite)
    if (resultado && (resultado.codigo || resultado.subfamilia || resultado) && searchCache.size < configBusqueda.maxResultadosCache) {
      setSearchCache(prev => new Map(prev.set(cacheKey, resultado)));
      if (configBusqueda.logLevel !== 'none') {
        console.log(`💾 [CACHE] Saved para ${tipo}: "${clave}"`);
      }
    }
    
    return resultado;
  }, [searchCache, configBusqueda]);

  // Función para actualizar configuración dinámicamente
  const actualizarConfigBusqueda = useCallback((nuevaConfig: Partial<typeof configBusqueda>) => {
    setConfigBusqueda(prev => {
      const updated = { ...prev, ...nuevaConfig };
      console.log('🔧 [CONFIG] Configuración actualizada:', updated);
      return updated;
    });
  }, []);

  // Función para obtener estadísticas del cache
  const obtenerEstadisticasCache = useCallback(() => {
    return {
      tamanoCache: searchCache.size,
      limiteCache: configBusqueda.maxResultadosCache,
      cacheHabilitado: configBusqueda.usarCache,
      umbrales: {
        proveedores: configBusqueda.umbralSimilitudProveedores,
        articulos: configBusqueda.umbralSimilitudArticulos,
        delegaciones: configBusqueda.umbralSimilitudDelegaciones
      }
    };
  }, [searchCache.size, configBusqueda]);

  // Limpiar cache cuando cambian los datos maestros
  useEffect(() => {
    if (!loadingMaestros && (proveedores.length > 0 || articulos.length > 0 || delegaciones.length > 0)) {
      if (configBusqueda.logLevel !== 'none') {
        console.log('🧹 [CACHE] Limpiando cache por actualización de datos maestros');
      }
      setSearchCache(new Map());
    }
  }, [proveedores.length, articulos.length, delegaciones.length, loadingMaestros, configBusqueda.logLevel]);

  // Sistema de patrones avanzados para búsqueda mejorada
  const patronesAvanzados = {
    medidas: [
      /(\d+(?:[,.]\d+)?)\s*(kg|g|l|ml|uds?|cajas?|paquetes?|latas?|botellas?)/gi,
      /(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)\s*(kg|g|l|ml)/gi,
      /calibre\s*\d+\/\d+/gi,
      /talla\s*\d+/gi,
      /peso\s*\d+(?:[,.]\d+)?\s*(kg|g)/gi
    ],
    codigos: [
      /\b\d{6,8}\b/g,  // EAN códigos
      /\b[A-Z]{2,3}\d{4,6}\b/g,  // Códigos internos
      /\b\d{2,4}[A-Z]\d{2,4}\b/g,  // Códigos compuestos
      /\b\d{3,4}\/\d{2,4}\b/g  // Códigos con barras
    ],
    calidades: [
      /\b(premium|extra|primera|segunda|tercera|suprema|gran reserva)\b/gi,
      /\b(fresco|congelado|refrigerado|ultracongelado)\b/gi,
      /\b(ecologico|organico|bio)\b/gi,
      /\b(importado|nacional|local)\b/gi
    ],
    formatos: [
      /\b(filete|entero|medias|cuartos|entero)\b/gi,
      /\b(cabeza|cola|aleta|espina)\b/gi,
      /\b(pulpa|entero|sin piel|con piel)\b/gi
    ]
  };

  // Función para detectar patrones en texto
  const detectarPatrones = useCallback((texto: string) => {
    const resultados = {
      medidas: [] as string[],
      codigos: [] as string[],
      calidades: [] as string[],
      formatos: [] as string[]
    };

    Object.entries(patronesAvanzados).forEach(([categoria, patrones]) => {
      patrones.forEach(patron => {
        const matches = texto.match(patron);
        if (matches) {
          resultados[categoria as keyof typeof resultados].push(...matches);
        }
      });
    });

    return resultados;
  }, []);

  // Función para calcular el total de una factura
  const calcularTotalFactura = (invoice: ProcessedInvoice): number => {
    if (invoice.total !== undefined && invoice.total !== null) return invoice.total; // Si ya tiene total, devolverlo

    // Calcular total basado en los items
    let total = 0;
    if (invoice.items && Array.isArray(invoice.items)) {
      invoice.items.forEach(item => {
        if (item.neto && item.iva !== undefined) {
          const importeItem = item.neto * (1 + item.iva / 100);
          total += importeItem;
        }
      });
    }
    return Math.round(total * 100) / 100; // Redondear a 2 decimales
  };

  // Funciones para edición de IVA
  const startEditingIVA = (invoiceId: number, itemIndex: number, currentIVA: number) => {
    setEditingIVA({ invoiceId, itemIndex });
    setTempIVA(currentIVA);
  };

  const cancelEditingIVA = () => {
    setEditingIVA(null);
    setTempIVA(0);
  };

  const saveEditingIVA = async () => {
    if (!editingIVA) return;

    try {
      const invoice = invoices.find(inv => inv.id === editingIVA.invoiceId);
      if (!invoice || !invoice.items[editingIVA.itemIndex]) return;

      // Actualizar el item en la base de datos
      const updatedItems = [...invoice.items];
      updatedItems[editingIVA.itemIndex] = {
        ...updatedItems[editingIVA.itemIndex],
        iva: tempIVA
      };

      // Recalcular el total de la factura
      let newTotal = 0;
      updatedItems.forEach(item => {
        if (item.neto && item.iva !== undefined) {
          const importeItem = item.neto * (1 + item.iva / 100);
          newTotal += importeItem;
        }
      });
      newTotal = Math.round(newTotal * 100) / 100;

      const { error } = await supabase
        .from('processed_invoices')
        .update({ 
          items: updatedItems,
          total: newTotal
        })
        .eq('id', editingIVA.invoiceId);

      if (error) {
        console.error('Error updating IVA:', error);
        alert('Error al guardar el IVA');
        return;
      }

      // Actualizar el estado local
      setInvoices(prev => prev.map(inv =>
        inv.id === editingIVA.invoiceId
          ? { ...inv, items: updatedItems, total: newTotal }
          : inv
      ));

      setEditingIVA(null);
      setTempIVA(0);
    } catch (error) {
      console.error('Error saving IVA:', error);
      alert('Error al guardar el IVA');
    }
  };

  // Función para buscar el código de artículo, subfamilia e IVA por descripción usando LIKE
  const buscarPorPatrones = useCallback((descripcion: string, articulos: any[]) => {
    if (configBusqueda.logLevel === 'debug') {
      console.log(`🔍 [PATRONES] Analizando: "${descripcion}"`);
    }

    const patronesDetectados = detectarPatrones(descripcion);

    if (configBusqueda.logLevel === 'debug') {
      console.log('🎯 [PATRONES] Patrones detectados:', patronesDetectados);
    }

    // Buscar artículos que coincidan con los patrones
    let mejorCoincidencia = null;
    let mejorPuntuacion = 0;

    for (const articulo of articulos) {
      if (!articulo.descripcion) continue;

      let puntuacionTotal = 0;
      const patronesArticulo = detectarPatrones(articulo.descripcion);

      // Comparar medidas
      const medidasComunes = patronesDetectados.medidas.filter(medida =>
        patronesArticulo.medidas.some(ma => ma.toLowerCase().includes(medida.toLowerCase()))
      );
      puntuacionTotal += medidasComunes.length * 20;

      // Comparar códigos
      const codigosComunes = patronesDetectados.codigos.filter(codigo =>
        patronesArticulo.codigos.some(ca => ca === codigo)
      );
      puntuacionTotal += codigosComunes.length * 30;

      // Comparar calidades
      const calidadesComunes = patronesDetectados.calidades.filter(calidad =>
        patronesArticulo.calidades.some(ca => ca.toLowerCase() === calidad.toLowerCase())
      );
      puntuacionTotal += calidadesComunes.length * 15;

      // Comparar formatos
      const formatosComunes = patronesDetectados.formatos.filter(formato =>
        patronesArticulo.formatos.some(fa => fa.toLowerCase() === formato.toLowerCase())
      );
      puntuacionTotal += formatosComunes.length * 10;

      if (puntuacionTotal > mejorPuntuacion) {
        mejorPuntuacion = puntuacionTotal;
        mejorCoincidencia = articulo;
      }
    }

    if (configBusqueda.logLevel === 'debug') {
      console.log(`📊 [PATRONES] Mejor puntuación: ${mejorPuntuacion}`);
    }

    return { articulo: mejorCoincidencia, puntuacion: mejorPuntuacion };
  }, [configBusqueda.logLevel, detectarPatrones]);

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
    return buscarConCache('proveedor', nombreProveedor, (clave: string) => {
      const startTime = performance.now();
      console.log(`🔍 [PROVEEDOR] Buscando: "${clave}"`);

      if (!clave || loadingMaestros) {
        console.log(`⚠️ [PROVEEDOR] Búsqueda cancelada: ${!clave ? 'Nombre vacío' : 'Datos maestros cargando'}`);
        return { codigo: '', cif: '' };
      }

      // Regla específica para JOPIAD
      if (clave.toLowerCase().includes('jopiad')) {
        console.log(`🎯 [PROVEEDOR] Regla específica JOPIAD detectada`);
        const jopiadMaster = proveedores.find(p => p.nombre === 'JOSE PEDROSA - JOPIAD');
        if (jopiadMaster) {
          console.log(`✅ [PROVEEDOR] JOPIAD encontrado: ${jopiadMaster.nombre} (Código: ${jopiadMaster.codigo})`);
          return { codigo: jopiadMaster.codigo || '', cif: jopiadMaster.cif || '' };
        } else {
          console.log(`❌ [PROVEEDOR] JOPIAD no encontrado en maestro`);
        }
      }

      // Regla específica para DDI NEXIA S.L.U. -> NEXIA SL (VICTORIA NUEVO)
      if (clave.toLowerCase().includes('ddi nexia') || 
          clave.toLowerCase().includes('nexia slu') ||
          clave.toUpperCase().includes('DDI NEXIA S.L.U.')) {
        console.log(`🎯 [PROVEEDOR] Regla específica NEXIA detectada`);
        const nexiaMaster = proveedores.find(p => 
          p.nombre && p.nombre.toLowerCase().includes('nexia sl') && 
          p.nombre.toLowerCase().includes('victoria nuevo')
        );
        if (nexiaMaster) {
          console.log(`✅ [PROVEEDOR] NEXIA encontrado: ${nexiaMaster.nombre} (Código: ${nexiaMaster.codigo})`);
          return { codigo: nexiaMaster.codigo || '', cif: nexiaMaster.cif || '' };
        } else {
          console.log(`❌ [PROVEEDOR] NEXIA no encontrado en maestro`);
        }
      }

      const nombreSinParentesis = clave.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      const nombreCorregido = corregirErroresTipograficos(nombreSinParentesis);
      const nombreLimpio = limpiarSufijosEmpresas(nombreCorregido);
      const nombreNormalizado = normalizarTexto(nombreLimpio);

      console.log(`📝 [PROVEEDOR] Preprocesamiento:`);
      console.log(`   Original: "${clave}"`);
      console.log(`   Sin paréntesis: "${nombreSinParentesis}"`);
      console.log(`   Corregido: "${nombreCorregido}"`);
      console.log(`   Limpio: "${nombreLimpio}"`);
      console.log(`   Normalizado: "${nombreNormalizado}"`);

      // 1. Búsqueda por inclusión directa (la más fiable)
      console.log(`🔎 [PROVEEDOR] Buscando por inclusión directa...`);
      for (const proveedor of proveedores) {
        if (!proveedor.nombre) continue;
        const nombreProveedorNormalizado = normalizarTexto(limpiarSufijosEmpresas(corregirErroresTipograficos(proveedor.nombre)));
        if (nombreProveedorNormalizado.includes(nombreNormalizado)) {
          const endTime = performance.now();
          console.log(`✅ [PROVEEDOR] Encontrado por inclusión: "${proveedor.nombre}" (Código: ${proveedor.codigo}) - ${Math.round(endTime - startTime)}ms`);
          return { codigo: proveedor.codigo || '', cif: proveedor.cif || '' };
        }
      }

      // 2. Si falla, recurrir a similitud
      console.log(`🔄 [PROVEEDOR] Inclusión falló, probando similitud...`);
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

      const endTime = performance.now();
      if (mejorPuntuacion > configBusqueda.umbralSimilitudProveedores && mejorCoincidencia) {
        console.log(`✅ [PROVEEDOR] Encontrado por similitud: "${mejorCoincidencia.nombre}" (Puntuación: ${mejorPuntuacion}%) - ${Math.round(endTime - startTime)}ms`);
        return { codigo: mejorCoincidencia.codigo || '', cif: mejorCoincidencia.cif || '' };
      } else {
        console.log(`❌ [PROVEEDOR] No encontrado. Mejor similitud: ${mejorPuntuacion}% ${mejorCoincidencia ? `con "${mejorCoincidencia.nombre}"` : ''} - ${Math.round(endTime - startTime)}ms`);
        return { codigo: '', cif: '' };
      }
    });
  };

  const buscarDelegacion = (nombreCliente: string, nombreProveedor: string): string => {
    return buscarConCache('delegacion', nombreCliente, (clave: string) => {
      const startTime = performance.now();
      console.log(`🔍 [DELEGACIÓN] Buscando: "${clave}"`);

      if (!clave || loadingMaestros) {
        console.log(`⚠️ [DELEGACIÓN] Búsqueda cancelada: ${!clave ? 'Nombre vacío' : 'Datos maestros cargando'}`);
        return '';
      }

      // Regla específica para LA TERCERA ESTRELLA S.L. -> Los Marangos Pedregalejo
      if (clave.toLowerCase().includes('la tercera estrella')) {
        console.log(`🎯 [DELEGACIÓN] Regla específica LA TERCERA ESTRELLA detectada`);
        const targetDelegacion = delegaciones.find(d => 
          d.razon_social && d.razon_social.toLowerCase() === 'la tercera estrella sl'
        );
        if (targetDelegacion) {
          const endTime = performance.now();
          console.log(`✅ [DELEGACIÓN] Encontrado por regla específica: "${targetDelegacion.delegacion}" - ${Math.round(endTime - startTime)}ms`);
          return targetDelegacion.delegacion || '';
        }
      }

      const normalizarNombreCompleto = (nombre: string) => {
        if (!nombre) return '';
        const corregido = corregirErroresTipograficos(nombre);
        const conSufijos = normalizarSufijosLegales(corregido);
        const limpio = limpiarSufijosEmpresas(conSufijos);
        return normalizarTexto(limpio);
      };

      const nombreNormalizado = normalizarNombreCompleto(clave);
      let mejorCoincidencia = '';
      let mejorPuntuacion = 0;

      console.log(`📝 [DELEGACIÓN] Preprocesamiento:`);
      console.log(`   Original: "${clave}"`);
      console.log(`   Normalizado: "${nombreNormalizado}"`);

      console.log(`🔎 [DELEGACIÓN] Buscando por similitud...`);
      for (const delegacion of delegaciones) {
        let puntuacionTotal = 0;
        if (delegacion.razon_social) {
          const razonSocialNormalizada = normalizarNombreCompleto(delegacion.razon_social);
          if (razonSocialNormalizada === nombreNormalizado) {
            const endTime = performance.now();
            console.log(`✅ [DELEGACIÓN] Encontrado por coincidencia exacta: "${delegacion.razon_social}" → "${delegacion.delegacion || delegacion.codigo}" - ${Math.round(endTime - startTime)}ms`);
            return delegacion.delegacion || delegacion.codigo || '';
          }
          puntuacionTotal += calcularSimilitud(nombreNormalizado, razonSocialNormalizada);
        }
        if (delegacion.nombre_comercial || delegacion.cliente) {
          const nombreComercialNormalizado = normalizarNombreCompleto(delegacion.nombre_comercial || delegacion.cliente);
          if (nombreComercialNormalizado === nombreNormalizado) {
            const endTime = performance.now();
            console.log(`✅ [DELEGACIÓN] Encontrado por coincidencia exacta: "${delegacion.nombre_comercial || delegacion.cliente}" → "${delegacion.delegacion || delegacion.codigo}" - ${Math.round(endTime - startTime)}ms`);
            return delegacion.delegacion || delegacion.codigo || '';
          }
          puntuacionTotal += calcularSimilitud(nombreNormalizado, nombreComercialNormalizado) * 0.9;
        }
        if (puntuacionTotal > mejorPuntuacion) {
          mejorPuntuacion = puntuacionTotal;
          mejorCoincidencia = delegacion.delegacion || delegacion.codigo || '';
        }
      }

      const endTime = performance.now();
      if (mejorPuntuacion > configBusqueda.umbralSimilitudDelegaciones) {
        console.log(`✅ [DELEGACIÓN] Encontrado por similitud: "${mejorCoincidencia}" (Puntuación: ${mejorPuntuacion}%) - ${Math.round(endTime - startTime)}ms`);
        return mejorCoincidencia;
      } else {
        console.log(`❌ [DELEGACIÓN] No encontrado. Mejor similitud: ${mejorPuntuacion}% con "${mejorCoincidencia}" - ${Math.round(endTime - startTime)}ms`);
        return '';
      }
    });
  };

  const buscarDatosArticulo = (descripcion: string): {codigo: string, subfamilia: string, iva: number} => {
    return buscarConCache('articulo', descripcion, (clave: string) => {
      const startTime = performance.now();
      console.log(`🔍 [ARTÍCULO] Buscando: "${clave}"`);

      if (!clave || loadingMaestros) {
        console.log(`⚠️ [ARTÍCULO] Búsqueda cancelada: ${!clave ? 'Descripción vacía' : 'Datos maestros cargando'}`);
        return { codigo: '', subfamilia: '', iva: 0 };
      }

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
        'VICTORIA BARRIL 50L':'Barril 50L Victoria',
      };

      for (const key in articleMap) {
        if (clave.trim().startsWith(key)) {
          console.log(`🎯 [ARTÍCULO] Regla específica detectada: "${key}" → "${articleMap[key]}"`);
          const mappedDescription = articleMap[key];
          const targetArticle = articulos.find(a => a.descripcion === mappedDescription);
          if (targetArticle) {
            const endTime = performance.now();
            console.log(`✅ [ARTÍCULO] Mapeo exitoso: "${targetArticle.descripcion}" (Código: ${targetArticle.codigo}) - ${Math.round(endTime - startTime)}ms`);
            return { codigo: targetArticle.codigo || '', subfamilia: targetArticle.subfamilia || '', iva: targetArticle.iva || 0 };
          } else {
            console.log(`❌ [ARTÍCULO] Artículo mapeado no encontrado en maestro: "${mappedDescription}"`);
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

      const descFacturaNormalizada = normalizarDescripcionArticulo(clave);

      console.log(`📝 [ARTÍCULO] Preprocesamiento:`);
      console.log(`   Original: "${clave}"`);
      console.log(`   Normalizada: "${descFacturaNormalizada}"`);

      // Búsqueda por coincidencia exacta tras normalización agresiva
      console.log(`🔎 [ARTÍCULO] Buscando coincidencia exacta...`);
      for (const articulo of articulos) {
        if (!articulo.descripcion) continue;
        const descMaestroNormalizada = normalizarDescripcionArticulo(articulo.descripcion);
        if (descMaestroNormalizada === descFacturaNormalizada) {
          const endTime = performance.now();
          console.log(`✅ [ARTÍCULO] Encontrado por coincidencia exacta: "${articulo.descripcion}" (Código: ${articulo.codigo}) - ${Math.round(endTime - startTime)}ms`);
          return { codigo: articulo.codigo || '', subfamilia: articulo.subfamilia || '', iva: articulo.iva || 0 };
        }
      }

      // Fallback a la búsqueda por similitud con normalización estándar
      console.log(`🔄 [ARTÍCULO] Coincidencia exacta falló, probando similitud...`);
      const descripcionNormalizada = normalizarTexto(corregirErroresTipograficos(clave));
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

      const endTime = performance.now();
      if (mejorPuntuacion > configBusqueda.umbralSimilitudArticulos && mejorCoincidencia) {
        console.log(`✅ [ARTÍCULO] Encontrado por similitud: "${mejorCoincidencia.descripcion}" (Puntuación: ${mejorPuntuacion}%) - ${Math.round(endTime - startTime)}ms`);
        return { codigo: mejorCoincidencia.codigo || '', subfamilia: mejorCoincidencia.subfamilia || '', iva: mejorCoincidencia.iva || 0 };
      } else {
        console.log(`❌ [ARTÍCULO] No encontrado. Mejor similitud: ${mejorPuntuacion}% ${mejorCoincidencia ? `con "${mejorCoincidencia.descripcion}"` : ''} - ${Math.round(endTime - startTime)}ms`);
        return { codigo: '', subfamilia: '', iva: 0 };
      }
    });
  };

  const exportInvoicesToExcel = (invoicesToExport: ProcessedInvoice[]) => {
    if (invoicesToExport.length === 0) return;

    const excelHeaders = [
      'Fecha Factura', 'Proveedor', 'CIF', 'Cód. Proveedor', 'Cliente', 'Delegación',
      'Cód. Artículo', 'Subfamilia', 'Descripción', 'Unidades', 'Peso (Kg)', 'Volumen (L)',
      'Precio Ud.', '% Dto.', '% IVA', 'Neto', 'Importe', 'Total Factura'
    ];

    const allItems = invoicesToExport.flatMap(invoice =>
      invoice.items.map(item => {
        const datosProveedor = buscarDatosProveedor(invoice.proveedor);
        const delegacion = buscarDelegacion(invoice.cliente, invoice.proveedor);
        const datosArticulo = buscarDatosArticulo(item.descripcion);

        return [
          invoice.fecha_factura || '',
          invoice.proveedor || '',
          datosProveedor.cif || '',
          datosProveedor.codigo || '',
          invoice.cliente || '',
          delegacion || '',
          datosArticulo.codigo || item.codArticulo || '',
          datosArticulo.subfamilia || '',
          item.descripcion || '',
          item.unidades || 0,
          item.pesoKg || '',
          item.volumenL || '',
          item.precioUd || 0,
          item.dto || 0,
          datosArticulo.iva || item.iva || 0,
          item.neto || 0,
          (item.neto || 0) * (1 + (datosArticulo.iva || item.iva || 0) / 100),
          invoice.total || 0 // ✅ Total de la factura
        ];
      })
    );

    const worksheet = XLSX.utils.aoa_to_sheet([excelHeaders, ...allItems]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facturas');

    worksheet['!cols'] = [
      { wch: 12 }, // Fecha Factura
      { wch: 20 }, // Proveedor
      { wch: 12 }, // CIF
      { wch: 12 }, // Cód. Proveedor
      { wch: 15 }, // Cliente
      { wch: 12 }, // Delegación
      { wch: 12 }, // Cód. Artículo
      { wch: 12 }, // Subfamilia
      { wch: 25 }, // Descripción
      { wch: 10 }, // Unidades
      { wch: 10 }, // Peso (Kg)
      { wch: 10 }, // Volumen (L)
      { wch: 10 }, // Precio Ud.
      { wch: 8 },  // % Dto.
      { wch: 8 },  // % IVA
      { wch: 10 }, // Neto
      { wch: 10 }, // Importe
      { wch: 12 }  // Total Factura
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

  const fetchInvoices = async (userOverride?: string, adminOverride?: boolean) => {
    try {
      setLoading(true);

      // Usar overrides si se proporcionan, sino usar el estado actual
      const username = userOverride !== undefined ? userOverride : currentUsername;
      const isAdminUser = adminOverride !== undefined ? adminOverride : isAdmin;

      console.log('🔍 DEBUG fetchInvoices - username:', username, 'isAdminUser:', isAdminUser);

      let query = supabase.from('processed_invoices').select('*').order('created_at', { ascending: false });

      // Filtrar por usuario actual (cada usuario solo ve sus facturas, salvo admin que ve todas)
      if (!isAdminUser && username) {
        query = query.eq('usuario', username);
        console.log('🔍 Filtrando facturas para usuario:', username);
        console.log('📊 Mostrando solo facturas del usuario actual');
      } else if (isAdminUser) {
        console.log('👑 Usuario admin - mostrando todas las facturas de todos los usuarios');
      } else {
        console.log('⚠️ No hay usuario logueado - mostrando facturas vacías');
        setInvoices([]);
        return;
      }

      const { data, error } = await query;

      if (error) throw error;
      console.log('📊 Facturas obtenidas:', data?.length || 0);

      // Verificar específicamente el campo usuario para debugging
      if (data && data.length > 0) {
        console.log('🔍 Detalle de usuarios en las facturas:');
        const usuariosUnicos = [...new Set(data.map(invoice => invoice.usuario).filter(u => u))];
        console.log('👥 Usuarios únicos encontrados:', usuariosUnicos);
        console.log('📋 Primera factura - usuario:', data[0].usuario);
      }

      setInvoices(data || []);
    } catch (err: any) {
      console.error('Error al obtener facturas:', err);
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
  useEffect(() => {
    // Verificar permisos del usuario actual al cargar la página
    const username = sessionStorage.getItem('username');
    const isAdminUser = username === 'admin';

    setCurrentUsername(username || '');
    setIsAdmin(isAdminUser);

    console.log('🔐 Permisos inicializados:', {
      username,
      isAdmin: isAdminUser,
      filtrado: isAdminUser ? 'TODAS las facturas' : `Solo facturas de ${username}`
    });

    // Cargar facturas después de verificar permisos - PASAR VALORES DIRECTAMENTE
    fetchInvoices(username || '', isAdminUser);
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
        <div>
          <h1 className="text-3xl font-bold">Facturas Procesadas</h1>
          {/* Indicador de filtrado por usuario */}
          <div className="flex items-center gap-2 mt-2">
            {isAdmin ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                👑 Admin - Viendo todas las facturas
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                👤 Usuario: {currentUsername} - Solo sus facturas
              </div>
            )}
          </div>
        </div>
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
          {invoices.length > 0 && (
            <span className="text-xl font-bold bg-green-200 text-green-700 px-3 py-1 rounded-lg ml-4">
              💰 Total: €{invoices.reduce((sum, invoice) => sum + calcularTotalFactura(invoice), 0).toFixed(2)}
            </span>
          )}
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
                <div className="flex-grow">
                  {/* Primera fila: N° Factura, Fecha, Usuario */}
                  <div className="grid grid-cols-3 gap-6 mb-3">
                    <div className="flex items-center min-w-0"><FileText className="mr-2 h-4 w-4 flex-shrink-0" /> <span className="font-semibold text-gray-700 whitespace-nowrap">Nº Factura:</span> <span className="ml-1 text-gray-900 truncate">{invoice.numero_factura}</span></div>
                    <div className="flex items-center min-w-0"><Calendar className="mr-2 h-4 w-4 flex-shrink-0" /> <span className="font-semibold text-gray-700 whitespace-nowrap">Fecha:</span> <span className="ml-1 text-gray-900 truncate">{invoice.fecha_factura}</span></div>
                    <div className="flex items-center min-w-0"><span className="mr-2 h-4 w-4 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">👤</span> <span className="font-semibold text-gray-700 whitespace-nowrap">Usuario:</span> <span className="ml-1 text-gray-900 truncate">{(invoice as any).usuario || 'N/A'}</span></div>
                  </div>
                  {/* Segunda fila: Proveedor, Cliente, Total */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="flex items-center min-w-0"><User className="mr-2 h-4 w-4 flex-shrink-0" /> <span className="font-semibold text-gray-700 whitespace-nowrap">Proveedor:</span> <span className="ml-1 text-gray-900 truncate">{invoice.proveedor}</span></div>
                    <div className="flex items-center min-w-0"><Building className="mr-2 h-4 w-4 flex-shrink-0" /> <span className="font-semibold text-gray-700 whitespace-nowrap">Cliente:</span> <span className="ml-1 text-gray-900 truncate">{invoice.cliente}</span></div>
                    <div className="flex items-center min-w-0"><span className="mr-2 h-4 w-4 flex items-center justify-center text-sm font-bold text-green-600 flex-shrink-0">💰</span> <span className="font-semibold text-gray-700 whitespace-nowrap">Total:</span> <span className="ml-1 text-green-600 font-bold truncate">€{calcularTotalFactura(invoice).toFixed(2)}</span></div>
                  </div>
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
                    <th scope="col" className="px-3 py-3">Peso (Kg)</th>
                    <th scope="col" className="px-3 py-3">Volumen (L)</th>
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
                    const delegacion = buscarDelegacion(invoice.cliente, invoice.proveedor);
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
                        <td className="px-3 py-4">{item.pesoKg || '-'}</td>
                        <td className="px-3 py-4">{item.volumenL || '-'}</td>
                        <td className="px-3 py-4">{item.precioUd}</td>
                        <td className="px-3 py-4">{item.dto || 0}</td>
                        <td className="px-3 py-4">
                          {editingIVA && editingIVA.invoiceId === invoice.id && editingIVA.itemIndex === index ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                step="0.01"
                                value={tempIVA}
                                onChange={(e) => setTempIVA(parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 text-xs border rounded"
                                autoFocus
                              />
                              <button
                                onClick={saveEditingIVA}
                                className="text-green-600 hover:text-green-800 p-1"
                                title="Guardar"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={cancelEditingIVA}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded flex items-center justify-between"
                              onClick={() => startEditingIVA(invoice.id, index, datosArticulo.iva || item.iva || 0)}
                              title="Hacer clic para editar IVA"
                            >
                              <span>{datosArticulo.iva || item.iva || 0}</span>
                              <span className="text-gray-400 text-xs ml-1">✏️</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-4">{item.neto}</td>
                        <td className="px-3 py-4">
                          {(() => {
                            // Determinar qué IVA usar: temporal si se está editando este item, sino el normal
                            const ivaActual = editingIVA && editingIVA.invoiceId === invoice.id && editingIVA.itemIndex === index
                              ? tempIVA
                              : (datosArticulo.iva || item.iva || 0);
                            return ((item.neto || 0) * (1 + ivaActual / 100)).toFixed(2);
                          })()}
                        </td>
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
