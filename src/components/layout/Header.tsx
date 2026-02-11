import { RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onRefresh: () => void;
  onInstall: () => void;
  isLoading?: boolean;
  canInstall?: boolean;
}

export function Header({ onRefresh, onInstall, isLoading, canInstall }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 safe-area-inset-top">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center shadow-gold">
            <span className="text-lg font-display font-bold text-primary-foreground">L</span>
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold text-gold">Leandrinho's</h1>
            <p className="text-xs text-beige-muted -mt-1">Barber</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onRefresh}
            disabled={isLoading}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
          
          {canInstall && (
            <Button
              variant="outlineGold"
              size="sm"
              onClick={onInstall}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
