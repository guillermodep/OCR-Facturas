import type { Handler } from "@netlify/functions";
import { AzureOpenAI } from "openai";

// Netlify Function: /api/process-invoice
// Env vars must be configured in Netlify dashboard
// OPENAI_ENDPOINT, OPENAI_KEY, OPENAI_DEPLOYMENT, OPENAI_API_VERSION

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

    // Expecting JSON: { imageBase64: string, mimeType?: string }
    const body = event.body ? JSON.parse(event.body) : null;
    if (!body || !body.imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing imageBase64" }) };
    }

    const mimeType = body.mimeType || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${body.imageBase64}`;

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
            } as any,
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } } as any,
          ] as any,
        },
      ],
      max_tokens: 4000,
      temperature: 0.1,
      model: "gpt-4.1",
    });

    const content = response.choices[0]?.message?.content || "{}";
    // Try to extract JSON from the model response
    let invoiceData: any = {};
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        invoiceData = JSON.parse(match[0]);
      } catch (e) {
        invoiceData = { raw: content };
      }
    } else {
      invoiceData = { raw: content };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, data: invoiceData }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Function error", details: err?.message || String(err) }),
    };
  }
};
