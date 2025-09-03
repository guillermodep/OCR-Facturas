import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Función para leer un archivo PDF y convertirlo a base64
async function readPdfAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(data.toString('base64'));
    });
  });
}

// Función principal para enviar el PDF a la función de Netlify
async function testPdfUpload(pdfPath) {
  try {
    console.log(`Leyendo archivo PDF: ${pdfPath}`);
    const pdfBase64 = await readPdfAsBase64(pdfPath);
    
    // Convertir a formato data URL completo
    const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
    
    console.log('Enviando PDF a la función de Netlify...');
    const response = await axios.post('http://localhost:8888/.netlify/functions/process-invoice-new', {
      imageBase64: dataUrl,
      mimeType: 'application/pdf'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      // Aumentar el timeout para PDFs grandes
      timeout: 120000 // 2 minutos
    });
    
    console.log('Respuesta recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error al procesar el PDF:', error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    throw error;
  }
}

// Verificar si se proporcionó una ruta de archivo
const pdfPath = process.argv[2] || path.join(__dirname, 'test-files', 'factura-muy-simple.pdf');

// Si no se proporciona una ruta, usar el PDF de prueba por defecto
if (!pdfPath) {
  console.error('Por favor proporciona la ruta a un archivo PDF como argumento.');
  console.error('Ejemplo: node test-pdf-upload.js ./ruta/a/factura.pdf');
  console.error('Usando el PDF de prueba por defecto...');
}

// Ejecutar la prueba
testPdfUpload(pdfPath)
  .then(() => console.log('Prueba completada con éxito'))
  .catch(() => console.log('La prueba falló'));
