import React, { useEffect } from 'react';
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay
} from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  fileName
}) => {
  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  // Si no está abierto, no renderizar nada
  if (!isOpen) return null;
  
  // Asegurarnos de que el portal se renderice correctamente en SSR
  const ModalContent = () => (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal forceMount>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in-0" />
        <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-white flex flex-col fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] rounded-lg animate-in fade-in-0 zoom-in-95">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {fileName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative overflow-auto max-h-[calc(90vh-80px)] flex items-center justify-center">
            <img 
              src={imageUrl} 
              alt={fileName} 
              className="max-w-full max-h-[calc(90vh-120px)] object-contain mx-auto my-auto"
            />
          </div>
          
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full p-2 shadow-lg transition-all transform hover:scale-110 z-10"
            title="Cerrar"
          >
            <X className="h-5 w-5 text-slate-700" />
          </button>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
  
  // Usar un enfoque híbrido para asegurar compatibilidad en diferentes entornos
  return typeof document !== 'undefined' ? <ModalContent /> : null;
};
