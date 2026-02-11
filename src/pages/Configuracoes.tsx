import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Save, Bell, ToggleLeft, LogOut, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { HorarioFuncionamento, DIAS_SEMANA } from '@/types';
import { fetchHorariosFuncionamento, upsertHorariosFuncionamento, fetchVariavelExterna, updateVariavelExterna } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { ClientReminderSettings } from '@/components/notifications/ClientReminderSettings';
import { useAuth } from '@/contexts/AuthContext';

interface HorarioLocal {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  fechado: boolean;
}

const defaultHorarios: HorarioLocal[] = [
  { dia_semana: 0, hora_inicio: '', hora_fim: '', fechado: true },
  { dia_semana: 1, hora_inicio: '09:00', hora_fim: '19:00', fechado: false },
  { dia_semana: 2, hora_inicio: '09:00', hora_fim: '19:00', fechado: false },
  { dia_semana: 3, hora_inicio: '09:00', hora_fim: '19:00', fechado: false },
  { dia_semana: 4, hora_inicio: '09:00', hora_fim: '19:00', fechado: false },
  { dia_semana: 5, hora_inicio: '09:00', hora_fim: '19:00', fechado: false },
  { dia_semana: 6, hora_inicio: '09:00', hora_fim: '18:00', fechado: false },
];

export default function Configuracoes() {
  const { logout } = useAuth();
  const [horarios, setHorarios] = useState<HorarioLocal[]>(defaultHorarios);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [variavelAtiva, setVariavelAtiva] = useState(false);
  const [isTogglingVariavel, setIsTogglingVariavel] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    const [horariosResult, variavelResult] = await Promise.all([
      fetchHorariosFuncionamento(),
      fetchVariavelExterna(1),
    ]);
    
    const { data } = horariosResult;
    
    if (data && data.length > 0) {
      const horariosFromDb = defaultHorarios.map(defaultH => {
        const dbHorario = data.find((h: HorarioFuncionamento) => h.dia_semana === defaultH.dia_semana);
        if (dbHorario) {
          return {
            dia_semana: dbHorario.dia_semana,
            hora_inicio: dbHorario.hora_inicio || '',
            hora_fim: dbHorario.hora_fim || '',
            fechado: dbHorario.fechado,
          };
        }
        return defaultH;
      });
      setHorarios(horariosFromDb);
    }
    
    if (variavelResult.data && variavelResult.data.length > 0) {
      setVariavelAtiva(variavelResult.data[0].bot_ativo);
    }
    
    setIsLoading(false);
  };

  const handleToggleVariavel = async () => {
    setIsTogglingVariavel(true);
    const newValue = !variavelAtiva;
    
    const { error } = await updateVariavelExterna(1, newValue);
    
    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível alterar a variável.",
        variant: "destructive",
      });
    } else {
      setVariavelAtiva(newValue);
      toast({
        title: newValue ? "Ativado!" : "Desativado!",
        description: `A variável foi ${newValue ? 'ativada' : 'desativada'} com sucesso.`,
      });
    }
    
    setIsTogglingVariavel(false);
  };

  const handleFechadoChange = (diaSemana: number, fechado: boolean) => {
    setHorarios(prev => prev.map(h => 
      h.dia_semana === diaSemana 
        ? { ...h, fechado, hora_inicio: fechado ? '' : h.hora_inicio || '09:00', hora_fim: fechado ? '' : h.hora_fim || '19:00' }
        : h
    ));
  };

  const handleHorarioChange = (diaSemana: number, field: 'hora_inicio' | 'hora_fim', value: string) => {
    setHorarios(prev => prev.map(h => 
      h.dia_semana === diaSemana ? { ...h, [field]: value } : h
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    const horariosToSave = horarios.map(h => ({
      dia_semana: h.dia_semana,
      hora_inicio: h.fechado ? null : h.hora_inicio || null,
      hora_fim: h.fechado ? null : h.hora_fim || null,
      fechado: h.fechado,
    }));

    const { error } = await upsertHorariosFuncionamento(horariosToSave);
    
    if (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os horários.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Horários salvos!",
        description: "Os horários de funcionamento foram atualizados.",
      });
    }
    
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center px-3 sm:px-4">
          <Link to="/" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="font-display text-base sm:text-lg font-semibold text-foreground ml-2">Configurações</h1>
        </header>
        <main className="pt-18 sm:pt-20 pb-8 px-3 sm:px-4">
          <LoadingSpinner message="Carregando..." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center">
          <Link to="/" className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="font-display text-base sm:text-lg font-semibold text-foreground ml-2">Configurações</h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="text-xs sm:text-sm">
          <Save className="w-4 h-4 mr-1 sm:mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </header>
      
      <main className="pt-18 sm:pt-20 pb-8 px-3 sm:px-4 animate-fade-in">
        {/* Horários de Funcionamento */}
        <div className="card-premium p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">Horários de Funcionamento</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            Defina os horários de funcionamento do estabelecimento para cada dia da semana.
          </p>
          
          <div className="space-y-3">
            {horarios.map((horario) => (
              <div 
                key={horario.dia_semana} 
                className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-lg border border-border/30"
              >
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-foreground text-sm">
                    {DIAS_SEMANA[horario.dia_semana]}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!horario.fechado}
                      onCheckedChange={(checked) => handleFechadoChange(horario.dia_semana, !checked)}
                    />
                    <span className="text-xs text-muted-foreground min-w-[50px]">
                      {horario.fechado ? 'Fechado' : 'Aberto'}
                    </span>
                  </div>
                </div>
                
                {!horario.fechado && (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="time"
                      value={horario.hora_inicio}
                      onChange={(e) => handleHorarioChange(horario.dia_semana, 'hora_inicio', e.target.value)}
                      className="flex-1 h-9 text-sm"
                    />
                    <span className="text-muted-foreground text-sm">às</span>
                    <Input
                      type="time"
                      value={horario.hora_fim}
                      onChange={(e) => handleHorarioChange(horario.dia_semana, 'hora_fim', e.target.value)}
                      className="flex-1 h-9 text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notificações */}
        <div className="card-premium p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">Notificações</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            Configure lembretes para não perder nenhum agendamento.
          </p>
          
          <NotificationSettings />
        </div>

        {/* Lembrete WhatsApp para Clientes */}
        <div className="card-premium p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">Lembrete WhatsApp</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            Configure lembretes automáticos via WhatsApp para os clientes.
          </p>
          
          <ClientReminderSettings />
        </div>

        {/* Variável Externa */}
        <div className="card-premium p-3 sm:p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <ToggleLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <h2 className="font-display text-base sm:text-lg font-semibold text-foreground">Controle Externo</h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
            Ative ou desative o controle externo da aplicação.
          </p>
          
          <div className="flex items-center justify-between p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border/30">
            <div className="flex flex-col">
              <Label className="font-medium text-foreground text-sm">Variável Ativa</Label>
              <span className="text-xs text-muted-foreground">
                {variavelAtiva ? 'Atualmente ativada' : 'Atualmente desativada'}
              </span>
            </div>
            <Switch
              checked={variavelAtiva}
              onCheckedChange={handleToggleVariavel}
              disabled={isTogglingVariavel}
            />
          </div>
        </div>

        {/* Logout */}
        <div className="card-premium p-3 sm:p-4">
          <Button 
            onClick={logout} 
            variant="destructive" 
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
        </div>
      </main>
    </div>
  );
}
