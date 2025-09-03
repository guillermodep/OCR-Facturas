import type { Handler } from "@netlify/functions";
import { AzureOpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

// Helper function to process a single image (base64) and return structured data
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
    
    console.log(`Procesando imagen con mimeType: ${mimeType}`);
    console.log(`Longitud del data URL: ${dataUrl.length} caracteres`);
    
    // Para PDFs, verificamos si Azure OpenAI puede procesarlos directamente
    if (mimeType === 'application/pdf') {
      console.log('Advertencia: Azure OpenAI puede tener limitaciones al procesar PDFs directamente');
      // Intentamos con un tipo MIME de imagen en su lugar
      dataUrl = dataUrl.replace('application/pdf', 'image/png');
      console.log('Cambiado mimeType a image/png para compatibilidad');
    }
    
    const response = await client.chat.completions.create({
    messages: [
      {
        role: "system",
        content:
          "Eres un experto en procesamiento de facturas. Extrae TODOS los datos de la factura y devuelve un JSON estructurado.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analiza esta factura y extrae todos los datos. Devuelve un JSON con la siguiente estructura:\n{
              "numeroFactura": "número de la factura",
              "fecha": "fecha de la factura",
              "proveedor": "nombre del proveedor",
              "cliente": "nombre del cliente",
              "items": [
                {
                  "codCentral": "código central del producto",
                  "codArticulo": "código de artículo",
                  "descripcion": "descripción del producto",
                  "unidades": cantidad numérica,
                  "precioUd": precio unitario numérico,
                  "dto": descuento numérico (0 si no hay),
                  "iva": porcentaje de IVA numérico,
                  "neto": importe neto numérico
                }
              ]
            }\nSé extremadamente preciso con los números y códigos. Extrae TODOS los productos de la factura.`,
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
    max_tokens: 4000,
    temperature: 0.1,
    model: "gpt-4.1",
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
  } catch (error) {
    console.error("Error en processImageWithAI:", error);
    throw error;
  }
};

// Función para procesar un PDF y dividirlo en páginas como imágenes base64
const processPdf = async (pdfBase64: string): Promise<string[]> => {
  // En un entorno serverless, no podemos usar herramientas externas como pdftoppm
  // Así que vamos a enviar directamente el PDF completo a la API de OpenAI
  // GPT-4 Vision puede procesar PDFs directamente, aunque con limitaciones
  
  // Para PDFs multi-página, vamos a simular que solo hay una página
  // En un entorno de producción, se recomendaría usar un servicio externo para la conversión
  return [pdfBase64];
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    if (!process.env.OPENAI_ENDPOINT || !process.env.OPENAI_KEY || !process.env.OPENAI_DEPLOYMENT || !process.env.OPENAI_API_VERSION) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing Azure OpenAI env configuration" }) };
    }

    const client = new AzureOpenAI({
      endpoint: process.env.OPENAI_ENDPOINT,
      apiKey: process.env.OPENAI_KEY,
      deployment: process.env.OPENAI_DEPLOYMENT,
      apiVersion: process.env.OPENAI_API_VERSION,
    });

    const body = event.body ? JSON.parse(event.body) : null;
    if (!body || !body.imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing imageBase64" }) };
    }

    const mimeType = body.mimeType || "image/jpeg";
    let allInvoicesData: any[] = [];

    try {
      console.log(`Recibido archivo con mimeType: ${mimeType}`);
      
      // Tanto para PDFs como para imágenes, usamos el mismo proceso
      // GPT-4 Vision puede manejar ambos formatos
      const invoiceData = await processImageWithAI(client, body.imageBase64, mimeType);
      console.log('Datos extraidos:', JSON.stringify(invoiceData).substring(0, 100) + '...');
      
      if (invoiceData && (invoiceData.numeroFactura || invoiceData.raw)) {
        allInvoicesData.push(invoiceData);
      } else {
        console.warn('No se pudieron extraer datos de la factura');
      }
    } catch (error) {
      console.error('Error al procesar la imagen/PDF:', error);
      throw error;
    }

    // Process and save all extracted invoices
    for (const invoiceData of allInvoicesData) {
      // Normalize product descriptions
      if (invoiceData.items && Array.isArray(invoiceData.items)) {
        invoiceData.items.forEach((item: any) => {
          if (item.descripcion) {
            item.descripcion = item.descripcion
              .toUpperCase()
              .replace(/\./g, '') // Remove all dots
              .trim();
          }
        });
      }

      // Save to Supabase
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        
        const { error: dbError } = await supabase
          .from('processed_invoices')
          .insert({
            numero_factura: invoiceData.numeroFactura,
            fecha_factura: invoiceData.fecha,
            proveedor: invoiceData.proveedor,
            cliente: invoiceData.cliente,
            items: invoiceData.items,
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
