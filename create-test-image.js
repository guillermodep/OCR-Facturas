import { createCanvas } from 'canvas';
import fs from 'fs';

// Crear un canvas para generar una imagen de factura simple
const canvas = createCanvas(800, 600);
const ctx = canvas.getContext('2d');

// Fondo blanco
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 800, 600);

// Título
ctx.fillStyle = 'black';
ctx.font = 'bold 32px Arial';
ctx.fillText('FACTURA', 50, 60);

// Información básica
ctx.font = '16px Arial';
ctx.fillText('Número: F-001', 50, 100);
ctx.fillText('Fecha: 2024-01-15', 50, 130);
ctx.fillText('Proveedor: Empresa ABC S.L.', 50, 160);
ctx.fillText('Cliente: Cliente XYZ', 50, 190);

// Línea separadora
ctx.strokeStyle = 'black';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(50, 220);
ctx.lineTo(750, 220);
ctx.stroke();

// Encabezados de tabla
ctx.font = 'bold 14px Arial';
ctx.fillText('Código', 50, 250);
ctx.fillText('Descripción', 150, 250);
ctx.fillText('Cantidad', 400, 250);
ctx.fillText('Precio', 500, 250);
ctx.fillText('Total', 600, 250);

// Línea debajo de encabezados
ctx.beginPath();
ctx.moveTo(50, 260);
ctx.lineTo(750, 260);
ctx.stroke();

// Productos
ctx.font = '14px Arial';
ctx.fillText('12345', 50, 290);
ctx.fillText('PRODUCTO A', 150, 290);
ctx.fillText('2', 400, 290);
ctx.fillText('10.00€', 500, 290);
ctx.fillText('20.00€', 600, 290);

ctx.fillText('67890', 50, 320);
ctx.fillText('PRODUCTO B', 150, 320);
ctx.fillText('1', 400, 320);
ctx.fillText('15.00€', 500, 320);
ctx.fillText('15.00€', 600, 320);

// Línea separadora
ctx.beginPath();
ctx.moveTo(400, 340);
ctx.lineTo(750, 340);
ctx.stroke();

// Totales
ctx.font = 'bold 16px Arial';
ctx.fillText('Subtotal:', 500, 370);
ctx.fillText('35.00€', 600, 370);
ctx.fillText('IVA (21%):', 500, 400);
ctx.fillText('7.35€', 600, 400);
ctx.fillText('TOTAL:', 500, 430);
ctx.fillText('42.35€', 600, 430);

// Guardar como PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./test-files/factura-test.png', buffer);

console.log('Imagen de factura creada: ./test-files/factura-test.png');
