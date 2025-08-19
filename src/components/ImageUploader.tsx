import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileImage, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: any;
}

interface ImageUploaderProps {
  onImagesProcessed: (data: any[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesProcessed }) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [currentProcessingImage, setCurrentProcessingImage] = useState<string>('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const,
    }));
    setImages(prev => [...prev, ...newImages]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const processImages = async () => {
    setIsProcessing(true);
    setProcessProgress(0);
    const processedData = [];
    
    // Calcular imágenes pendientes
    const pendingImages = images.filter(img => img.status !== 'completed');
    const totalImages = pendingImages.length;
    let processedCount = 0;

    for (const image of pendingImages) {
      setCurrentProcessingImage(image.file.name);
      setProcessProgress((processedCount / totalImages) * 100);
      
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, status: 'processing' } : img
      ));

      try {
        // Convertir archivo a base64 y enviar a Netlify Function
        const base64 = await fileToBase64(image.file);

        const response = await fetch('/api/process-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: image.file.type }),
        });

        if (!response.ok) {
          throw new Error('Error processing image');
        }

        const result = await response.json();
        const invoiceData = result.data;
        
        console.log('Datos extraídos:', invoiceData);

        processedData.push({ 
          data: invoiceData,
          success: true 
        });

        setImages(prev => prev.map(img => 
          img.id === image.id 
            ? { ...img, status: 'completed', extractedData: invoiceData } 
            : img
        ));
        
        processedCount++;
        setProcessProgress((processedCount / totalImages) * 100);
      } catch (error) {
        console.error('Error processing image:', error);
        setImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, status: 'error' } : img
        ));
        processedCount++;
      }
    }

    if (processedData.length > 0) {
      onImagesProcessed(processedData);
    }

    // Resetear estados
    setTimeout(() => {
      setIsProcessing(false);
      setProcessProgress(0);
      setCurrentProcessingImage('');
    }, 500);
  };

  // Helper: archivo a base64 (sin prefijo data:)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const b64 = result.split(',')[1] || result; // manejar dataURL o binario
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };


  return (
    <div className="w-full">
      {/* Upload Section */}
      <div className="p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 backdrop-blur-xl">
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-500 overflow-hidden group
            ${isDragActive 
              ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 scale-[1.01] shadow-xl' 
              : 'border-slate-300 hover:border-indigo-400 hover:bg-gradient-to-br hover:from-indigo-50/30 hover:via-purple-50/30 hover:to-blue-50/30 hover:shadow-lg'}`}
        >
          <input {...getInputProps()} />
          
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, indigo 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}></div>
          </div>
          
          {/* Floating Orbs */}
          {!isDragActive && (
            <>
              <div className="absolute top-10 left-10 w-24 h-24 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-full blur-3xl opacity-20 animate-pulse"></div>
              <div className="absolute bottom-10 right-10 w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
            </>
          )}
          
          <div className="relative z-10">
            <div className={`mx-auto w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-4 shadow-xl ${isDragActive ? 'animate-bounce' : 'group-hover:scale-110 transition-transform'}`}>
              <Upload className="w-full h-full text-white" />
            </div>
            
            {isDragActive ? (
              <div className="animate-fadeIn">
                <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                  ¡Perfecto! Suelta aquí
                </p>
                <p className="text-sm text-slate-600 mt-3 font-medium">Procesaremos tus documentos con IA</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-slate-800 mb-3">
                  Carga tus Facturas
                </p>
                <p className="text-sm text-slate-600 mb-6 font-medium">Arrastra o selecciona archivos para comenzar</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-2 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">JPG</span>
                  <span className="px-4 py-2 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">PNG</span>
                  <span className="px-4 py-2 bg-gradient-to-r from-pink-100 to-pink-200 text-pink-700 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">PDF</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Images Section */}
      {images.length > 0 && (
        <div className="mt-8 p-8 bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-3xl shadow-2xl border border-slate-200/50 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full">
                <span className="text-white font-bold text-sm">
                  {images.filter(img => img.status === 'pending').length}
                </span>
              </div>
              <p className="text-slate-700 font-semibold">
                Facturas pendientes de procesar
              </p>
            </div>
            <Button 
              onClick={processImages}
              disabled={isProcessing || images.every(img => img.status === 'completed')}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-6 py-3 rounded-full shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Procesando con IA...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Procesar Facturas
                </>
              )}
            </Button>
          </div>

          {/* Progress Bar - Professional Style */}
          {isProcessing && (
            <div className="mb-8 p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl shadow-lg border border-indigo-100">
              <div className="flex justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-slate-700">
                    Analizando: {currentProcessingImage}
                  </span>
                </div>
                <span className="text-sm font-bold text-indigo-600">
                  {Math.round(processProgress)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden shadow-inner">
                <div 
                  className="h-4 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
                  style={{ 
                    width: `${processProgress}%`,
                    background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)'
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-3 text-center font-medium">
                ✨ Procesando con GPT-4 Vision de alta precisión
              </p>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800">Documentos Cargados</h3>
            <p className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
              Toca el ✕ para eliminar
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map(image => (
              <div key={image.id} className="relative group transform transition-all duration-300 hover:scale-105">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 hover:shadow-2xl transition-all">
                  <div className="aspect-square relative bg-gradient-to-br from-slate-50 to-slate-100">
                    {image.file.type === 'application/pdf' ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl">
                          <FileImage className="h-16 w-16 text-indigo-600" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={image.preview}
                        alt={image.file.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Status Overlays */}
                    {image.status === 'processing' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/80 to-purple-600/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <Loader2 className="h-10 w-10 text-white animate-spin mb-2" />
                        <span className="text-white text-xs font-medium">Analizando...</span>
                      </div>
                    )}
                    
                    {image.status === 'completed' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-full p-3 shadow-2xl">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                    
                    {image.status === 'error' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center backdrop-blur-[2px]">
                        <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-full p-3 shadow-2xl">
                          <X className="h-8 w-8" />
                        </div>
                      </div>
                    )}
                    
                    {/* Delete Button */}
                    <button
                      onClick={() => removeImage(image.id)}
                      className="absolute -top-2 -right-2 bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-full p-2 shadow-xl transition-all transform hover:scale-110 hover:rotate-12 z-10"
                      title="Eliminar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* File Info */}
                  <div className="p-3 bg-white">
                    <p className="text-xs font-medium text-slate-700 truncate">{image.file.name}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] text-slate-500">
                        {(image.file.size / 1024).toFixed(1)} KB
                      </span>
                      {image.status === 'pending' && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Pendiente
                        </span>
                      )}
                      {image.status === 'completed' && (
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          Completado
                        </span>
                      )}
                      {image.status === 'processing' && (
                        <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          Procesando
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
