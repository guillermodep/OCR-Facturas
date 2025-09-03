import PDFDocument from 'pdfkit';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear un nuevo documento PDF muy simple
const doc = new PDFDocument({
  size: 'A4',
  compress: true,
});

// Crear el archivo de salida
const outputPath = './test-files/factura-mini.pdf';
doc.pipe(fs.createWriteStream(outputPath));

// Agregar contenido mínimo de factura
doc.fontSize(10)
   .text('FACTURA F-001', 10, 10)
   .text('2024-01-15', 10, 25)
   .text('Empresa ABC', 10, 40)
   .text('Cliente XYZ', 10, 55);

// Producto simple
doc.text('PRODUCTOS:', 10, 80);
doc.text('12345 PRODUCTO A', 10, 95);
doc.text('Cant: 2 Precio: 10€', 10, 110);

doc.text('67890 PRODUCTO B', 10, 125);
doc.text('Cant: 1 Precio: 15€', 10, 140);

// Total
doc.text('TOTAL: 35€', 10, 165);
doc.text('IVA: 7.35€', 10, 180);
doc.text('FINAL: 42.35€', 10, 195);

// Finalizar el documento
doc.end();

console.log(`PDF mini creado: ${outputPath}`);
