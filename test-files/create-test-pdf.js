import PDFDocument from 'pdfkit';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crear un nuevo documento PDF - usar opciones para reducir el tamaño
const doc = new PDFDocument({
  size: 'A4',
  compress: true,
  info: {
    Title: 'Factura de Prueba',
    Author: 'Sistema OCR',
  }
});
const outputPath = join(dirname(__dirname), 'test-files', 'factura-simple.pdf');

// Pipe el PDF a un archivo
doc.pipe(fs.createWriteStream(outputPath));

// Añadir contenido al PDF - Versión simplificada
// Página 1
doc.fontSize(24).text('FACTURA', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text('Número de Factura: F2023-001', { align: 'left' });
doc.text('Fecha: 15/09/2023', { align: 'left' });
doc.text('Proveedor: Suministros Técnicos S.L.', { align: 'left' });
doc.text('Cliente: Empresa Ejemplo S.A.', { align: 'left' });
doc.moveDown();

// Productos simplificados
doc.fontSize(14).text('Productos:', { align: 'left' });
doc.moveDown();

// Producto 1
doc.fontSize(10);
doc.text('Código: ART001', { align: 'left' });
doc.text('Descripción: Monitor LED 24 pulgadas', { align: 'left' });
doc.text('Unidades: 2 x 120.50€ = 241.00€ (21% IVA)', { align: 'left' });
doc.moveDown();

// Producto 2
doc.text('Código: ART002', { align: 'left' });
doc.text('Descripción: Teclado inalámbrico', { align: 'left' });
doc.text('Unidades: 5 x 25.99€ = 123.45€ (21% IVA)', { align: 'left' });
doc.moveDown(2);

// Total
doc.fontSize(12).text('Total: 364.45€', { align: 'right' });
doc.text('IVA: 76.53€', { align: 'right' });
doc.fontSize(14).text('TOTAL: 440.98€', { align: 'right' });

// Página 2
doc.addPage();
doc.fontSize(24).text('FACTURA (Página 2)', { align: 'center' });
doc.moveDown();
doc.fontSize(12).text('Número de Factura: F2023-001', { align: 'left' });
doc.moveDown();

// Productos adicionales simplificados
doc.fontSize(14).text('Productos adicionales:', { align: 'left' });
doc.moveDown();

// Producto 3
doc.fontSize(10);
doc.text('Código: ART003', { align: 'left' });
doc.text('Descripción: Disco duro SSD 500GB', { align: 'left' });
doc.text('Unidades: 1 x 89.99€ = 89.99€ (21% IVA)', { align: 'left' });
doc.moveDown();

// Producto 4
doc.text('Código: ART004', { align: 'left' });
doc.text('Descripción: Memoria RAM 16GB', { align: 'left' });
doc.text('Unidades: 2 x 75.50€ = 151.00€ (21% IVA)', { align: 'left' });

// Finalizar el PDF
doc.end();

console.log(`PDF de prueba creado en: ${outputPath}`);
