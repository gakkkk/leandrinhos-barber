import { useState, useEffect } from 'react';
import { format, parseISO, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Lock, Unlock, Calendar, Clock, X, Check, Repeat, Settings, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bloqueio, DIAS_SEMANA } from '@/types';
import { EmptyState } from '@/components/shared/EmptyState';

// Cada dia pode ter um horário diferente
interface BloqueioFixoPorDia {
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
}

interface BloqueiosFixos {
  motivo: string;
  dias: Record<number, BloqueioFixoPorDia>; // 0-6 (Dom-Sáb)
}

interface BloqueiosListProps {
  bloqueios: Bloqueio[];
  onAdd: (bloqueio: Omit<Bloqueio, 'id'>) => void;
  onDelete: (id: string) => void;
}

const STORAGE_KEY = 'bloqueiosFixos';

const defaultDias: Record<number, BloqueioFixoPorDia> = {
  0: { ativo: false, hora_inicio: '12:00', hora_fim: '13:00' },
  1: { ativo: true, hora_inicio: '12:00', hora_fim: '13:00' },
  2: { ativo: true, hora_inicio: '12:00', hora_fim: '13:00' },
  3: { ativo: true, hora_inicio: '12:00', hora_fim: '13:00' },
  4: { ativo: true, hora_inicio: '12:00', hora_fim: '13:00' },
  5: { ativo: true, hora_inicio: '12:00', hora_fim: '13:00' },
  6: { ativo: false, hora_inicio: '12:00', hora_fim: '13:00' },
};

export function BloqueiosList({ bloqueios, onAdd, onDelete }: BloqueiosListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isConfiguringFixed, setIsConfiguringFixed] = useState(false);
  const [formData, setFormData] = useState({ 
    data: '', 
    hora_inicio: '', 
    hora_fim: '', 
    motivo: '' 
  });
  
  // Bloqueios fixos state - agora com horários diferentes por dia
  const [bloqueiosFixos, setBloqueiosFixos] = useState<BloqueiosFixos | null>(null);
  const [fixedFormData, setFixedFormData] = useState<BloqueiosFixos>({
    motivo: 'Almoço',
    dias: { ...defaultDias },
  });

  // Carregar bloqueios fixos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrar formato antigo se necessário
        if (parsed.dias_semana) {
          // Formato antigo - migrar
          const newFormat: BloqueiosFixos = {
            motivo: parsed.motivo || 'Almoço',
            dias: { ...defaultDias },
          };
          parsed.dias_semana.forEach((dia: number) => {
            newFormat.dias[dia] = {
              ativo: true,
              hora_inicio: parsed.hora_inicio || '12:00',
              hora_fim: parsed.hora_fim || '13:00',
            };
          });
          setBloqueiosFixos(newFormat);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newFormat));
        } else {
          setBloqueiosFixos(parsed);
        }
      } catch (e) {
        console.error('Erro ao carregar bloqueios fixos:', e);
      }
    }
  }, []);

  // Verificar e criar bloqueios fixos para hoje e próximos dias
  useEffect(() => {
    if (!bloqueiosFixos) return;

    const criarBloqueiosFixos = async () => {
      const hoje = startOfDay(new Date());
      const diasParaFrente = 30;
      
      for (let i = 0; i < diasParaFrente; i++) {
        const dia = addDays(hoje, i);
        const diaSemana = dia.getDay();
        const configDia = bloqueiosFixos.dias[diaSemana];
        
        // Verificar se o dia está ativo
        if (!configDia?.ativo) continue;
        
        const dataStr = format(dia, 'yyyy-MM-dd');
        
        // Verificar se já existe bloqueio para este dia/horário
        const bloqueioExistente = bloqueios.find(b => 
          b.data === dataStr && 
          b.hora_inicio === configDia.hora_inicio && 
          b.hora_fim === configDia.hora_fim
        );
        
        if (!bloqueioExistente) {
          onAdd({
            data: dataStr,
            hora_inicio: configDia.hora_inicio,
            hora_fim: configDia.hora_fim,
            motivo: bloqueiosFixos.motivo,
          });
        }
      }
    };

    criarBloqueiosFixos();
  }, [bloqueiosFixos]);

  const handleSubmit = () => {
    if (!formData.data || !formData.hora_inicio || !formData.hora_fim) return;
    onAdd(formData);
    setFormData({ data: '', hora_inicio: '', hora_fim: '', motivo: '' });
    setIsAdding(false);
  };

  const cancelAdd = () => {
    setIsAdding(false);
    setFormData({ data: '', hora_inicio: '', hora_fim: '', motivo: '' });
  };

  const handleSaveFixedBlock = () => {
    const hasActiveDay = Object.values(fixedFormData.dias).some(d => d.ativo);
    if (!hasActiveDay) return;
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fixedFormData));
    setBloqueiosFixos(fixedFormData);
    setIsConfiguringFixed(false);
  };

  const handleRemoveFixedBlock = () => {
    localStorage.removeItem(STORAGE_KEY);
    setBloqueiosFixos(null);
    setIsConfiguringFixed(false);
  };

  const toggleDiaSemana = (dia: number) => {
    setFixedFormData(prev => ({
      ...prev,
      dias: {
        ...prev.dias,
        [dia]: {
          ...prev.dias[dia],
          ativo: !prev.dias[dia].ativo,
        },
      },
    }));
  };

  const updateDiaHorario = (dia: number, field: 'hora_inicio' | 'hora_fim', value: string) => {
    setFixedFormData(prev => ({
      ...prev,
      dias: {
        ...prev.dias,
        [dia]: {
          ...prev.dias[dia],
          [field]: value,
        },
      },
    }));
  };

  // Ordenar bloqueios por data
  const bloqueiosOrdenados = [...bloqueios].sort((a, b) => {
    const dataA = a.data ? parseISO(a.data) : new Date(0);
    const dataB = b.data ? parseISO(b.data) : new Date(0);
    return dataB.getTime() - dataA.getTime();
  });

  // Contar dias ativos
  const diasAtivos = bloqueiosFixos 
    ? Object.entries(bloqueiosFixos.dias).filter(([_, config]) => config.ativo)
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-foreground">Bloqueios de Horário</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              if (bloqueiosFixos) {
                setFixedFormData(bloqueiosFixos);
              } else {
                setFixedFormData({ motivo: 'Almoço', dias: { ...defaultDias } });
              }
              setIsConfiguringFixed(true);
            }}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Repeat className="w-4 h-4" />
            Fixo
          </Button>
          <Button 
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            size="sm"
          >
            <Lock className="w-4 h-4" />
            Bloquear
          </Button>
        </div>
      </div>

      {/* Indicador de Bloqueio Fixo Ativo */}
      {bloqueiosFixos && !isConfiguringFixed && diasAtivos.length > 0 && (
        <div className="card-premium p-3 bg-primary/10 border-primary/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Bloqueio Fixo: {bloqueiosFixos.motivo}
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  {diasAtivos.map(([diaNum, config]) => (
                    <span key={diaNum} className="inline-block mr-2">
                      {DIAS_SEMANA[Number(diaNum)].slice(0, 3)}: {config.hora_inicio}-{config.hora_fim}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setFixedFormData(bloqueiosFixos);
                setIsConfiguringFixed(true);
              }}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Configurar Bloqueio Fixo - Com horários diferentes por dia */}
      {isConfiguringFixed && (
        <div className="card-premium p-4 space-y-4 animate-slide-in-right border-primary/30">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            Bloqueio Fixo (Recorrente)
          </h3>
          <p className="text-xs text-muted-foreground">
            Configure horários diferentes para cada dia da semana (ex: almoço em horários variados).
          </p>
          
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Motivo</Label>
              <Input
                placeholder="Ex: Almoço"
                value={fixedFormData.motivo}
                onChange={(e) => setFixedFormData(p => ({ ...p, motivo: e.target.value }))}
                className="input-premium mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Horários por dia</Label>
              <div className="space-y-2">
                {DIAS_SEMANA.map((dia, index) => {
                  const config = fixedFormData.dias[index];
                  return (
                    <div 
                      key={index} 
                      className={`p-2 rounded-lg border transition-colors ${
                        config.ativo 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-secondary/30 border-border/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => toggleDiaSemana(index)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            config.ativo
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                          }`}
                        >
                          {dia.slice(0, 3)}
                        </button>
                        <Switch
                          checked={config.ativo}
                          onCheckedChange={() => toggleDiaSemana(index)}
                        />
                      </div>
                      
                      {config.ativo && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={config.hora_inicio}
                            onChange={(e) => updateDiaHorario(index, 'hora_inicio', e.target.value)}
                            className="h-8 text-sm flex-1"
                          />
                          <span className="text-xs text-muted-foreground">às</span>
                          <Input
                            type="time"
                            value={config.hora_fim}
                            onChange={(e) => updateDiaHorario(index, 'hora_fim', e.target.value)}
                            className="h-8 text-sm flex-1"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveFixedBlock} size="sm" className="flex-1">
              <Check className="w-4 h-4" /> Salvar
            </Button>
            {bloqueiosFixos && (
              <Button variant="destructive" onClick={handleRemoveFixedBlock} size="sm">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsConfiguringFixed(false)} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Form - Bloqueio Único */}
      {isAdding && (
        <div className="card-premium p-4 space-y-4 animate-slide-in-right">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            Novo Bloqueio (Único)
          </h3>
          
          <div className="space-y-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData(p => ({ ...p, data: e.target.value }))}
                className="input-premium pl-10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  placeholder="Início"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData(p => ({ ...p, hora_inicio: e.target.value }))}
                  className="input-premium pl-10"
                />
              </div>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  placeholder="Fim"
                  value={formData.hora_fim}
                  onChange={(e) => setFormData(p => ({ ...p, hora_fim: e.target.value }))}
                  className="input-premium pl-10"
                />
              </div>
            </div>

            <Input
              placeholder="Motivo (opcional)"
              value={formData.motivo}
              onChange={(e) => setFormData(p => ({ ...p, motivo: e.target.value }))}
              className="input-premium"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSubmit} size="sm" className="flex-1">
              <Lock className="w-4 h-4" /> Bloquear Horário
            </Button>
            <Button variant="outline" onClick={cancelAdd} size="sm">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {bloqueios.length === 0 ? (
        <EmptyState 
          icon={Unlock}
          title="Nenhum bloqueio ativo"
          description="Todos os horários estão disponíveis"
        />
      ) : (
        <div className="space-y-2">
          {bloqueiosOrdenados.map((bloqueio) => {
            // Verificar se é um bloqueio fixo
            const diaSemana = bloqueio.data ? parseISO(bloqueio.data).getDay() : -1;
            const configFixo = bloqueiosFixos?.dias[diaSemana];
            const isFixedBlock = configFixo?.ativo && 
              bloqueio.hora_inicio === configFixo.hora_inicio && 
              bloqueio.hora_fim === configFixo.hora_fim &&
              bloqueio.motivo === bloqueiosFixos?.motivo;
            
            return (
              <div key={bloqueio.id} className={`card-premium p-4 animate-fade-in ${isFixedBlock ? 'border-primary/20' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isFixedBlock ? 'bg-primary/20' : 'bg-destructive/20'
                    }`}>
                      {isFixedBlock ? (
                        <Repeat className="w-5 h-5 text-primary" />
                      ) : (
                        <Lock className="w-5 h-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {bloqueio.data ? format(parseISO(bloqueio.data), "d 'de' MMMM", { locale: ptBR }) : 'Data não definida'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {bloqueio.hora_inicio} - {bloqueio.hora_fim}
                      </p>
                      {bloqueio.motivo && (
                        <p className="text-xs text-beige-muted mt-0.5">
                          {bloqueio.motivo}
                          {isFixedBlock && <span className="ml-1 text-primary">(fixo)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onDelete(bloqueio.id)}
                    className="text-success hover:text-success hover:bg-success/10"
                  >
                    <Unlock className="w-4 h-4 mr-1" />
                    Desbloquear
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
