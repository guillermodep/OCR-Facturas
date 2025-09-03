import { useState } from 'react';
import { ImageUploader } from '../components/ImageUploader';
import { ExcelViewer } from '../components/ExcelViewer';
import { FileSpreadsheet, Sparkles, Activity, Zap } from 'lucide-react';

export function CargarFacturasPage() {
  const [processedData, setProcessedData] = useState<any[]>([]);

  const handleImagesProcessed = (data: any[]) => {
    console.log('Datos recibidos en CargarFacturasPage:', data);
    setProcessedData(prev => {
      const newData = [...prev, ...data];
      console.log('processedData actualizado:', newData);
      return newData;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 -m-8 p-8">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur-lg opacity-70 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 p-3 rounded-xl shadow-xl">
                  <FileSpreadsheet className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Sistema OCR de Facturas
                </h1>
                <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Procesamiento inteligente con IA avanzada
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full shadow-lg">
                <Activity className="h-4 w-4 text-white animate-pulse" />
                <span className="text-white font-medium text-sm">Sistema Activo</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl shadow-2xl p-8 mb-8">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10 text-white text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 animate-float" />
            <h2 className="text-2xl font-bold mb-2">Transforma tus facturas en datos estructurados</h2>
            <p className="text-white/90">Arrastra tus documentos y obtén resultados instantáneos con precisión de IA</p>
          </div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Upload Section */}
          <section className="animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                PASO 1
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Carga de Documentos
              </h2>
            </div>
            <ImageUploader onImagesProcessed={handleImagesProcessed} />
          </section>

          {/* Excel Viewer Section */}
          <section className="animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                PASO 2
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Editor de Datos Inteligente
              </h2>
            </div>
            <ExcelViewer processedData={processedData} />
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white mt-16">
        <div className="bg-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center">
              <p className="text-sm font-medium">
                Sistema OCR de Facturas © 2025
              </p>
              <p className="text-xs text-white/80 mt-1">
                Procesamiento inteligente de documentos con tecnología de vanguardia
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
