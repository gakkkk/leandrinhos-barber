import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingActionButton({ onClick, className }: FloatingActionButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className={cn(
        "fixed bottom-24 right-4 h-14 w-14 rounded-full shadow-lg z-50",
        "bg-primary hover:bg-primary/90 text-primary-foreground",
        "transition-transform hover:scale-105 active:scale-95",
        className
      )}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
