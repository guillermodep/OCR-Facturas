import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Función para leer un archivo de imagen y convertirlo a base64
async function readImageAsBase64(filePath) {
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

// Función principal para enviar la imagen a la función de Netlify
async function testImageUpload(imagePath) {
  try {
    console.log(`Leyendo archivo de imagen: ${imagePath}`);
    const imageBase64 = await readImageAsBase64(imagePath);
    
    // Determinar el tipo MIME basado en la extensión
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.gif') mimeType = 'image/gif';
    if (ext === '.webp') mimeType = 'image/webp';
    
    // Convertir a formato data URL completo
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    
    console.log('Enviando imagen a la función de Netlify...');
    const response = await axios.post('http://localhost:8888/.netlify/functions/process-invoice-new', {
      imageBase64: dataUrl,
      mimeType: mimeType
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutos
    });
    
    console.log('Respuesta recibida:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error al procesar la imagen:', error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
    throw error;
  }
}

// Verificar si se proporcionó una ruta de archivo
const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Por favor proporciona la ruta a un archivo de imagen como argumento.');
  console.error('Ejemplo: node test-image-upload.js ./ruta/a/imagen.jpg');
  process.exit(1);
}

// Ejecutar la prueba
testImageUpload(imagePath)
  .then(() => console.log('Prueba completada con éxito'))
  .catch(() => console.log('La prueba falló'));
