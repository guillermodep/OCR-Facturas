const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { AzureOpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5005;

// Configuración de Azure OpenAI
const openAIClient = new AzureOpenAI({
  endpoint: process.env.OPENAI_ENDPOINT,
  apiKey: process.env.OPENAI_KEY,
  deployment: process.env.OPENAI_DEPLOYMENT,
  apiVersion: process.env.OPENAI_API_VERSION
});

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de multer para manejar archivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB límite
});

// Endpoint para procesar facturas con GPT-4 Vision
app.post('/api/process-invoice', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    console.log('Procesando imagen con GPT-4 Vision:', req.file.originalname);

    // Convertir imagen a base64
    const base64Image = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

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
                    "dto": descuento numérico (0 si no hay),
                    "iva": porcentaje de IVA numérico,
                    "neto": importe neto numérico
                  }
                ]
              }
              Sé extremadamente preciso con los números y códigos. Extrae TODOS los productos de la factura.`
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
