import { useState, useEffect } from 'react';
import { Star, Check, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Avaliacao } from '@/types';

export function AvaliacoesView() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPendentes, setShowPendentes] = useState(true);

  useEffect(() => {
    loadAvaliacoes();
  }, []);

  const loadAvaliacoes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('avaliacoes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: 'Erro ao carregar avaliações', variant: 'destructive' });
    } else {
      setAvaliacoes(data || []);
    }
    setIsLoading(false);
  };

  const handleAprovar = async (id: string) => {
    const { error } = await supabase
      .from('avaliacoes')
      .update({ aprovado: true })
      .eq('id', id);
    
    if (!error) {
      toast({ title: 'Avaliação aprovada!' });
      loadAvaliacoes();
    }
  };

  const handleRejeitar = async (id: string) => {
    const { error } = await supabase.from('avaliacoes').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Avaliação removida!' });
      loadAvaliacoes();
    }
  };

  const renderStars = (nota: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`w-4 h-4 ${n <= nota ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const pendentes = avaliacoes.filter(a => !a.aprovado);
  const aprovadas = avaliacoes.filter(a => a.aprovado);
  const mediaNota = avaliacoes.length > 0
    ? (avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length).toFixed(1)
    : '0.0';

  if (isLoading) return <LoadingSpinner message="Carregando avaliações..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Avaliações</h2>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="font-bold">{mediaNota}</span>
          <span className="text-muted-foreground">({avaliacoes.length})</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={showPendentes ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowPendentes(true)}
        >
          Pendentes ({pendentes.length})
        </Button>
        <Button
          variant={!showPendentes ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowPendentes(false)}
        >
          Aprovadas ({aprovadas.length})
        </Button>
      </div>

      {/* Lista */}
      {(showPendentes ? pendentes : aprovadas).length === 0 ? (
        <EmptyState
          icon={Star}
          title={showPendentes ? 'Nenhuma pendente' : 'Nenhuma aprovada'}
          description={showPendentes ? 'Novas avaliações aparecerão aqui' : 'Aprove avaliações para exibir na página pública'}
        />
      ) : (
        <div className="space-y-3">
          {(showPendentes ? pendentes : aprovadas).map((av) => (
            <div key={av.id} className="card-premium p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{av.cliente_nome}</span>
                    {renderStars(av.nota)}
                  </div>
                  {av.comentario && (
                    <p className="text-sm text-muted-foreground mb-2">"{av.comentario}"</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {av.servico && <span>{av.servico}</span>}
                    <span>•</span>
                    <span>{format(new Date(av.created_at!), 'dd/MM/yyyy')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {showPendentes ? (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => handleAprovar(av.id)}>
                        <Check className="w-4 h-4 text-green-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleRejeitar(av.id)}>
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <Button size="icon" variant="ghost" onClick={() => handleRejeitar(av.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}