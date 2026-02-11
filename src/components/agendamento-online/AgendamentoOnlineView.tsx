import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Phone, Scissors, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { AgendamentoPendente, AgendamentoOnlineConfig } from '@/types';

export function AgendamentoOnlineView() {
  const [config, setConfig] = useState<AgendamentoOnlineConfig | null>(null);
  const [pendentes, setPendentes] = useState<AgendamentoPendente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    const [{ data: configData }, { data: pendentesData }] = await Promise.all([
      supabase.from('agendamento_online_config').select('*').limit(1).single(),
      supabase.from('agendamentos_pendentes').select('*').eq('status', 'pendente').order('created_at', { ascending: false }),
    ]);
    
    if (configData) {
      setConfig(configData as AgendamentoOnlineConfig);
    }
    setPendentes((pendentesData || []) as AgendamentoPendente[]);
    setIsLoading(false);
  };

  const handleToggleAtivo = async () => {
    if (!config) return;
    
    const { error } = await supabase
      .from('agendamento_online_config')
      .update({ ativo: !config.ativo })
      .eq('id', config.id);
    
    if (!error) {
      setConfig({ ...config, ativo: !config.ativo });
      toast({ title: config.ativo ? 'Agendamento online desativado' : 'Agendamento online ativado!' });
    }
  };

  const handleUpdateConfig = async (field: string, value: number) => {
    if (!config) return;
    
    const { error } = await supabase
      .from('agendamento_online_config')
      .update({ [field]: value })
      .eq('id', config.id);
    
    if (!error) {
      setConfig({ ...config, [field]: value });
    }
  };

  const handleConfirmar = async (agendamento: AgendamentoPendente) => {
    // Aqui você integraria com o Google Calendar
    // Por enquanto, apenas atualiza o status
    const { error } = await supabase
      .from('agendamentos_pendentes')
      .update({ status: 'confirmado' })
      .eq('id', agendamento.id);
    
    if (!error) {
      toast({ title: 'Agendamento confirmado!' });
      // Notificar cliente via WhatsApp
      const msg = encodeURIComponent(
        `Olá ${agendamento.cliente_nome}! ✅\n\nSeu agendamento foi confirmado!\n\n📅 ${format(new Date(agendamento.data), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}\n⏰ ${agendamento.horario}\n💈 ${agendamento.servico}\n\nTe esperamos na Leandrinho's Barber!`
      );
      const phone = agendamento.cliente_telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
      loadData();
    }
  };

  const handleRecusar = async (id: string) => {
    const { error } = await supabase
      .from('agendamentos_pendentes')
      .update({ status: 'recusado' })
      .eq('id', id);
    
    if (!error) {
      toast({ title: 'Agendamento recusado' });
      loadData();
    }
  };

  const getPublicUrl = () => {
    // URL pública para clientes agendarem
    const baseUrl = window.location.origin;
    return `${baseUrl}/agendar`;
  };

  const copyPublicUrl = () => {
    navigator.clipboard.writeText(getPublicUrl());
    toast({ title: 'Link copiado!' });
  };

  if (isLoading) return <LoadingSpinner message="Carregando..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Agendamento Online</h2>
        </div>
        {config && (
          <Switch checked={config.ativo} onCheckedChange={handleToggleAtivo} />
        )}
      </div>

      {/* Configurações */}
      {config && (
        <div className="card-premium p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Status</span>
            <span className={`text-sm font-medium ${config.ativo ? 'text-green-500' : 'text-muted-foreground'}`}>
              {config.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Antecedência mínima (horas)</Label>
              <Input
                type="number"
                min={1}
                value={config.antecedencia_minima_horas}
                onChange={(e) => handleUpdateConfig('antecedencia_minima_horas', Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-xs">Máximo de dias à frente</Label>
              <Input
                type="number"
                min={1}
                value={config.antecedencia_maxima_dias}
                onChange={(e) => handleUpdateConfig('antecedencia_maxima_dias', Number(e.target.value))}
              />
            </div>
          </div>
          
          <div>
            <Label className="text-xs">Intervalo entre horários (min)</Label>
            <Select
              value={String(config.intervalo_minutos)}
              onValueChange={(v) => handleUpdateConfig('intervalo_minutos', Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-2">Link para clientes agendarem:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs flex-1 truncate">{getPublicUrl()}</code>
              <Button size="sm" variant="outline" onClick={copyPublicUrl}>
                Copiar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Agendamentos Pendentes */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Solicitações Pendentes ({pendentes.length})
        </h3>
        
        {pendentes.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhuma solicitação"
            description="Novos agendamentos dos clientes aparecerão aqui"
          />
        ) : (
          <div className="space-y-3">
            {pendentes.map((ag) => (
              <div key={ag.id} className="card-premium p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{ag.cliente_nome}</span>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3" />
                        <span>{ag.cliente_telefone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(ag.data), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{ag.horario}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Scissors className="w-3 h-3" />
                        <span>{ag.servico}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" onClick={() => handleConfirmar(ag)}>
                      <Check className="w-3 h-3 mr-1" />
                      Confirmar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRecusar(ag.id)}>
                      <X className="w-3 h-3 mr-1" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}