import { useState, useEffect } from 'react';
import { Download, Smartphone, X, Share, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    
    return outcome === 'accepted';
  };

  return { 
    canInstall: !!deferredPrompt && !isInstalled, 
    isInstalled, 
    install 
  };
}

interface InstallPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => void;
  canInstall: boolean;
}

export function InstallPrompt({ open, onOpenChange, onInstall, canInstall }: InstallPromptProps) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Instalar Aplicativo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tenha acesso rápido ao app direto na tela inicial do seu celular
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {canInstall ? (
            <Button onClick={onInstall} className="w-full" size="lg">
              <Download className="w-5 h-5 mr-2" />
              Instalar agora
            </Button>
          ) : (
            <div className="space-y-4">
              {isIOS && (
                <div className="card-premium p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">No iPhone/iPad:</p>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">1</span>
                      Toque no botão <Share className="w-4 h-4 inline mx-1" /> Compartilhar
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">2</span>
                      Role e toque em "Adicionar à Tela de Início"
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">3</span>
                      Confirme tocando em "Adicionar"
                    </li>
                  </ol>
                </div>
              )}

              {isAndroid && (
                <div className="card-premium p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">No Android:</p>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">1</span>
                      Toque no menu <MoreVertical className="w-4 h-4 inline mx-1" /> do navegador
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">2</span>
                      Toque em "Adicionar à tela inicial"
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs">3</span>
                      Confirme a instalação
                    </li>
                  </ol>
                </div>
              )}

              {!isIOS && !isAndroid && (
                <div className="card-premium p-4">
                  <p className="text-sm text-muted-foreground">
                    Use o menu do navegador para instalar este app como um aplicativo.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
