import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { AzureOpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = {
  timeout: 30
};

// Función para normalizar fechas al formato DD/MM/AAAA
const normalizeDate = (dateString: string): string => {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }

  try {
    // Limpiar espacios y caracteres especiales
    const cleanedDate = dateString.trim();

    // Si ya está en formato DD/MM/AAAA, retornarlo tal cual
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanedDate)) {
      const [day, month, year] = cleanedDate.split('/');
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      // Validar que sea una fecha válida
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        return `${dayNum.toString().padStart(2, '0')}/${monthNum.toString().padStart(2, '0')}/${yearNum}`;
      }
    }

    // Intentar parsear diferentes formatos comunes
    let date: Date | null = null;

    // Formato DD.MM.AA o DD.MM.AAAA (ej: 31.01.25)
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(cleanedDate)) {
      const [day, month, year] = cleanedDate.split('.');
      const yearNum = parseInt(year, 10);
      const fullYear = yearNum < 100 ? (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum) : yearNum;
      date = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    }
    // Formato DD/MM/AA o DD/MM/AAAA
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanedDate)) {
      const [day, month, year] = cleanedDate.split('/');
      const yearNum = parseInt(year, 10);
      const fullYear = yearNum < 100 ? (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum) : yearNum;
      date = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    }
    // Formato DD-MM-AA o DD-MM-AAAA
    else if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleanedDate)) {
      const [day, month, year] = cleanedDate.split('-');
      const yearNum = parseInt(year, 10);
      const fullYear = yearNum < 100 ? (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum) : yearNum;
      date = new Date(fullYear, parseInt(month, 10) - 1, parseInt(day, 10));
    }
    // Formato de texto (ej: "18 de agosto de 2025", "18/08/2025")
    else {
      // Intentar parsear como fecha nativa de JavaScript
      date = new Date(cleanedDate);
    }

    // Verificar si la fecha es válida
    if (date && !isNaN(date.getTime())) {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear().toString();
      return `${day}/${month}/${year}`;
    }

    // Si no se pudo parsear, retornar la cadena original limpiada
    console.warn(`No se pudo normalizar la fecha: ${cleanedDate}`);
    return cleanedDate;
  } catch (error) {
    console.error(`Error al normalizar fecha "${dateString}":`, error);
    return dateString; // Retornar la cadena original si hay error
  }
};

// Helper function to process a single image (base64) or PDF and return structured data
const processImageWithAI = async (client: AzureOpenAI, imageBase64: string, mimeType: string) => {
  try {
    // Asegurarse de que el data URL tenga el formato correcto
    let dataUrl;
    if (imageBase64.startsWith('data:')) {
      dataUrl = imageBase64; // Ya es un data URL completo
      console.log('Usando data URL proporcionado');
    } else {
      dataUrl = `data:${mimeType};base64,${imageBase64}`;
      console.log('Creando data URL con el mimeType proporcionado');
    }
    
    console.log(`Procesando archivo con mimeType: ${mimeType}`);
    
    // Para PDFs, devolvemos un mensaje informativo ya que no podemos procesarlos directamente
    if (mimeType === 'application/pdf') {
      console.log('PDF detectado - requiere conversión a imagen en el frontend');
      
      return { 
        error: "PDF no soportado directamente",
        details: "Los PDFs deben convertirse a imágenes en el frontend antes de enviarlos al backend. Por favor, usa la funcionalidad de conversión de PDF a imagen en la interfaz de usuario.",
        suggestion: "Convierte el PDF a imagen(es) y envía cada página como imagen individual."
      };
    } 
    // Para imágenes, procesamos normalmente
    else {
      console.log(`Procesando imagen con mimeType: ${mimeType}`);
      
      const response = await client.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Eres un experto en procesamiento de facturas. Extrae TODOS los datos de la factura y devuelve un JSON estructurado.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analiza esta factura y extrae todos los datos. Devuelve un JSON con la siguiente estructura:
{
  "numeroFactura": "número de la factura",
  "fecha": "fecha de la factura",
  "proveedor": "nombre del proveedor",
  "cliente": "nombre del cliente",
  "items": [
    {
      "codCentral": "código central del producto",
      "codArticulo": "código de artículo",
      "descripcion": "descripción del producto",
      "unidades": cantidad numérica de unidades (paquetes, cajas, etc.),
      "pesoKg": peso en kilos (si está especificado, ej: 5.5, null si no aplica),
      "volumenL": volumen en litros (si está especificado, ej: 10.0, null si no aplica),
      "precioUd": precio unitario numérico,
      "dto": descuento numérico (0 si no hay),
      "iva": porcentaje de IVA numérico,
      "neto": importe neto numérico
    }
  ]
}
IMPORTANTE: Para cada producto, identifica y extrae:
- UNIDADES: cantidad de paquetes/cajas/unidades
- PESO_KG: si se menciona peso (kg, gramos, etc.), conviértelo a kilos
- VOLUMEN_L: si se menciona volumen (litros, ml, etc.), conviértelo a litros
Sé extremadamente preciso con los números y códigos. Extrae TODOS los productos de la factura.`,
              },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        max_tokens: 32768,
        temperature: 0.1,
        model: "gpt-4o",
      });
      
      const content = response.choices[0]?.message?.content || "{}";
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {
          console.error("Error parsing JSON from AI response:", e);
          return { raw: content };
        }
      } else {
        return { raw: content };
      }
    }
  } catch (error) {
    console.error("Error en processImageWithAI:", error);
    throw error;
  }
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    // Verificar configuración de Azure OpenAI
    if (!process.env.OPENAI_ENDPOINT || !process.env.OPENAI_KEY || !process.env.OPENAI_DEPLOYMENT || !process.env.OPENAI_API_VERSION) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing Azure OpenAI env configuration" }) };
    }

    // Inicializar cliente de Azure OpenAI
    const client = new AzureOpenAI({
      endpoint: process.env.OPENAI_ENDPOINT,
      apiKey: process.env.OPENAI_KEY,
      deployment: process.env.OPENAI_DEPLOYMENT,
      apiVersion: process.env.OPENAI_API_VERSION,
    });

    // Verificar cuerpo de la solicitud
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body || !body.imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing imageBase64" }) };
    }

    const mimeType = body.mimeType || "image/jpeg";
    const usuario = body.usuario || null; // ✅ Agregar usuario desde el frontend
    let allInvoicesData: any[] = [];

    try {
      console.log(`Recibido archivo con mimeType: ${mimeType}`);
      
      // Procesar la imagen o PDF
      const invoiceData = await processImageWithAI(client, body.imageBase64, mimeType);
      console.log('Datos extraídos:', JSON.stringify(invoiceData).substring(0, 100) + '...');
      
      if (invoiceData && (invoiceData.numeroFactura || invoiceData.raw)) {
        allInvoicesData.push(invoiceData);
      } else {
        console.warn('No se pudieron extraer datos de la factura');
      }
    } catch (error) {
      console.error('Error al procesar la imagen/PDF:', error);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: "Error processing image/PDF", 
          details: error instanceof Error ? error.message : String(error) 
        }) 
      };
    }

    // Procesar y guardar todas las facturas extraídas
    for (const invoiceData of allInvoicesData) {
      // Normalizar descripciones de productos
      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        invoiceData.items.forEach((item: any) => {
          if (item.descripcion) {
            item.descripcion = item.descripcion
              .toUpperCase()
              .replace(/\./g, '') // Eliminar todos los puntos
              .trim();
          }
        });
      }

      // Guardar en Supabase
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        
        const { error: dbError } = await supabase
          .from('processed_invoices')
          .insert({
            numero_factura: invoiceData.numeroFactura,
            fecha_factura: normalizeDate(invoiceData.fecha), // Normalizar fecha al formato DD/MM/AAAA
            proveedor: invoiceData.proveedor,
            cliente: invoiceData.cliente,
            items: invoiceData.items,
            usuario: usuario, // ✅ Agregar usuario a la inserción
          });

        if (dbError) {
          console.error('Error saving to Supabase:', dbError);
        }
      } else {
        console.warn('Supabase env vars (URL or Service Key) not configured. Skipping DB save.');
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, data: allInvoicesData }),
    };
  } catch (err: any) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Function error", details: err?.message || String(err) }),
    };
  }
};
