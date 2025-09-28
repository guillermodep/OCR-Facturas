require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { AzureOpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 5005;

// Configuración de Azure OpenAI
const openAIClient = new AzureOpenAI({
  endpoint: process.env.OPENAI_ENDPOINT,
  apiKey: process.env.OPENAI_KEY,
  deployment: process.env.OPENAI_DEPLOYMENT,
  apiVersion: process.env.OPENAI_API_VERSION
});

// Configuración de Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


// Endpoint para procesar facturas con GPT-4 Vision
app.post('/api/process-invoice', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'Falta la imagen en formato base64 o el tipo MIME' });
    }

    console.log('Procesando imagen con GPT-4 Vision...');

    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    // Llamar a GPT-4 Vision
    const response = await openAIClient.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres un experto en procesamiento de facturas. Extrae TODOS los datos de la factura y devuelve un JSON estructurado."
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
                    "unidades": cantidad numérica,
                    "precioUd": precio unitario numérico,
                    "dto": descuento numérico como porcentaje (ej: 10 para 10%, 0 si no hay),
                    "importeDescuento": importe de descuento absoluto (ej: -5.50 para descuento de 5.50€, puede ser negativo),
                    "iva": porcentaje de IVA numérico,
                    "neto": importe neto numérico
                  }
                ]
              }
              Sé extremadamente preciso con los números y códigos. Extrae TODOS los productos de la factura.
              
              IMPORTANTE: Para cada producto, identifica y extrae:
              - UNIDADES: cantidad de paquetes/cajas/unidades
              - PRECIO_UD: precio unitario por unidad (antes de descuentos e IVA)
              - DTO: porcentaje de descuento aplicado (0 si no hay descuento)
              - IMPORTE_DESCUENTO: si aparece un descuento como importe (ej: -5.50, -10.00), extráelo como valor negativo
              - IVA: porcentaje de IVA aplicado
              - NETO: importe neto = (precioUd × unidades) × (1 - dto/100) + importeDescuento

              INSTRUCCIONES ESPECÍFICAS PARA DESCUENTOS:
              - Busca columnas o filas que digan "DTO", "DESCUENTO", "DTO%", "DCTO", etc.
              - Si ves un número negativo (ej: "-5.50", "-10.00"), es un importe de descuento absoluto
              - Si ves un porcentaje (ej: "10%", "5"), es un porcentaje de descuento
              - Usa dto para porcentajes y importeDescuento para importes absolutos
              - Si no hay descuento, usa dto: 0 e importeDescuento: 0

              INSTRUCCIONES ESPECÍFICAS PARA PRECIOS:
              - Busca columnas o filas que digan "PRECIO", "P.U.", "UNITARIO", "€/UD", etc.
              - El precio unitario es el precio por cada unidad antes de descuentos
              - Si hay descuento, extráelo como porcentaje (ej: "10%" → 10)
              - El importe neto es el subtotal después de aplicar descuentos pero antes del IVA
              - Si no hay descuento explícito, usa dto: 0

              EJEMPLOS:
              - Producto: "MANZANA 2kg", Precio: "€2.50/kg", Cantidad: "3" → precioUd: 2.50, unidades: 3, neto: 7.50
              - Producto: "LECHE 1L", Precio: "€1.20", Cantidad: "6", Descuento: "5%" → precioUd: 1.20, unidades: 6, dto: 5, neto: 6.84
              - Producto: "PAN", Precio: "€3.00", Cantidad: "2", Descuento: "-1.50" → precioUd: 3.00, unidades: 2, importeDescuento: -1.50, neto: 4.50`
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
      model: "gpt-4.1"
    });

    const content = response.choices[0]?.message?.content || '{}';
    console.log('Respuesta GPT-4:', content);

    // Parsear la respuesta JSON
    let invoiceData;
    try {
      // Buscar JSON en la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        invoiceData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No se encontró JSON en la respuesta');
      }
    } catch (parseError) {
      console.error('Error parseando JSON:', parseError);
      // Usar datos de fallback
      invoiceData = {
        numeroFactura: 'N/A',
        fecha: new Date().toLocaleDateString(),
        items: []
      };
    }

    // Enriquecer los datos con los códigos de artículo del maestro
    if (invoiceData.items && invoiceData.items.length > 0) {
      const enrichedItems = await Promise.all(invoiceData.items.map(async (item) => {
        if (!item.descripcion) {
          return { ...item, codMaestro: 'N/A' };
        }

        // Buscar el artículo en Supabase por descripción normalizada
        const normalizedDescription = item.descripcion.trim();
        console.log(`Buscando artículo: '${normalizedDescription}'`);

        const { data: articuloData, error: articuloError } = await supabase
          .rpc('search_articles', { keyword: normalizedDescription });

        console.log(`Resultado para '${normalizedDescription}':`, articuloData);

        if (articuloError) {
          console.error('Error buscando artículo en Supabase:', articuloError);
          return { ...item, codMaestro: 'Error' };
        }

        return {
          ...item,
          codMaestro: articuloData && articuloData.length > 0 ? articuloData[0].codigo : 'No encontrado'
        };
      }));

      invoiceData.items = enrichedItems;
    }

    // Guardar la factura procesada en la base de datos
    try {
      const invoiceToSave = {
        numero_factura: invoiceData.numeroFactura,
        fecha_factura: invoiceData.fecha,
        proveedor: invoiceData.proveedor,
        cliente: invoiceData.cliente,
        items: invoiceData.items,
      };
      console.log('Intentando guardar en DB:', JSON.stringify(invoiceToSave, null, 2));

      const { error: insertError } = await supabase
        .from('processed_invoices')
        .insert([{
          numero_factura: invoiceData.numeroFactura,
          fecha_factura: invoiceData.fecha,
          proveedor: invoiceData.proveedor,
          cliente: invoiceData.cliente,
          items: invoiceData.items,
        }]);

      if (insertError) {
        throw insertError;
      }
      console.log('Factura guardada en la base de datos.');
    } catch (dbError) {
      console.error('Error guardando factura en Supabase:', dbError);
      // No bloqueamos la respuesta al cliente, solo registramos el error
    }

    res.json({
      success: true,
      data: invoiceData
    });

  } catch (error) {
    console.error('Error procesando factura:', error);
    res.status(500).json({ 
      error: 'Error procesando la imagen',
      details: error.message 
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Invoice OCR System' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`GPT-4 Vision endpoint configured`);
});
