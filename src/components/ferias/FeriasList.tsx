import { useState } from 'react';
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Palmtree, Plus, Trash2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ferias } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';

interface FeriasListProps {
  ferias: Ferias[];
  onAddMultiple: (datas: string[], descricao?: string) => void;
  onDelete: (id: string) => void;
}

export function FeriasList({ ferias, onAddMultiple, onDelete }: FeriasListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [descricao, setDescricao] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Datas já em férias
  const feriasDates = new Set(ferias.map(f => f.data));

  const handleSubmit = () => {
    if (selectedDates.size === 0) return;
    onAddMultiple(Array.from(selectedDates).sort(), descricao || undefined);
    setSelectedDates(new Set());
    setDescricao('');
    setIsAdding(false);
  };

  const toggleDate = (dateStr: string) => {
    const newDates = new Set(selectedDates);
    if (newDates.has(dateStr)) {
      newDates.delete(dateStr);
    } else {
      newDates.add(dateStr);
    }
    setSelectedDates(newDates);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setSelectedDates(new Set());
    setDescricao('');
  };

  // Gerar dias do mês atual
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Agrupar férias por mês para exibição
  const feriasByMonth = ferias.reduce((acc, f) => {
    if (!f.data) return acc;
    const monthKey = f.data.substring(0, 7); // YYYY-MM
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(f);
    return acc;
  }, {} as Record<string, Ferias[]>);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">Férias</h2>
        <Button 
          onClick={() => { setIsAdding(true); }}
          disabled={isAdding}
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      {/* Add Form - Calendar */}
      {isAdding && (
        <div className="card-premium p-4 space-y-4 animate-slide-in-right">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-primary" />
            Selecione os dias de férias
          </h3>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="iconSm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-foreground capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="ghost" size="iconSm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-muted-foreground py-1 font-medium">{day}</div>
            ))}
            
            {/* Empty cells for alignment */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDates.has(dateStr);
              const isAlreadyFerias = feriasDates.has(dateStr);
              const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
              
              return (
                <button
                  key={dateStr}
                  onClick={() => !isAlreadyFerias && !isPast && toggleDate(dateStr)}
                  disabled={isAlreadyFerias || isPast}
                  className={`
                    p-2 rounded-md text-sm transition-colors
                    ${isAlreadyFerias 
                      ? 'bg-primary/50 text-primary-foreground cursor-not-allowed' 
                      : isPast
                        ? 'text-muted-foreground/50 cursor-not-allowed'
                        : isSelected 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-muted text-foreground'
                    }
                  `}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="text-sm text-muted-foreground">
            {selectedDates.size} dia(s) selecionado(s)
          </div>

          <Input
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="input-premium"
          />

          <div className="flex gap-2">
            <Button onClick={handleSubmit} size="sm" className="flex-1" disabled={selectedDates.size === 0}>
              Salvar
            </Button>
            <Button variant="outline" onClick={cancelAdd} size="sm">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {ferias.length === 0 ? (
        <EmptyState 
          icon={Palmtree}
          title="Nenhum dia de férias"
          description="Adicione seus dias de descanso"
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(feriasByMonth).sort().map(([monthKey, monthFerias]) => (
            <div key={monthKey} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground capitalize">
                {format(parseISO(`${monthKey}-01`), 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <div className="flex flex-wrap gap-2">
                {monthFerias.sort((a, b) => a.data.localeCompare(b.data)).map((f) => (
                  <div 
                    key={f.id} 
                    className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{format(parseISO(f.data), 'd MMM', { locale: ptBR })}</span>
                    <button 
                      onClick={() => onDelete(f.id)}
                      className="hover:bg-destructive/20 rounded-full p-0.5 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
