import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message = 'Carregando...', className, size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-8", className)}>
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
