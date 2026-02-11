import { useState, useEffect } from 'react';
import { MessageSquare, Clock, Save, Send, Loader2, Bug, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ReminderSettings {
  id: string;
  enabled: boolean;
  reminder_hours: number;
  message_template: string;
}

interface DiagnosticResult {
  endpoint?: string;
  requestPayload?: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: Record<string, unknown>;
  formattedPhone?: string;
  originalPhone?: string;
  timestamp?: string;
  error?: string;
}

interface WapiLog {
  id: string;
  created_at: string;
  phone: string;
  success: boolean;
  error_message: string | null;
  response_status: number | null;
}

export function ClientReminderSettings() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [recentLogs, setRecentLogs] = useState<WapiLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('client_reminder_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar as configurações.',
          variant: 'destructive',
        });
        return;
      }

      if (data) {
        setSettings(data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('wapi_logs')
        .select('id, created_at, phone, success, error_message, response_status')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading logs:', error);
        return;
      }

      setRecentLogs(data || []);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_reminder_settings')
        .update({
          enabled: settings.enabled,
          reminder_hours: settings.reminder_hours,
          message_template: settings.message_template,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast({
        title: 'Configurações salvas!',
        description: 'As configurações de lembrete foram atualizadas.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim()) {
      toast({
        title: 'Telefone necessário',
        description: 'Digite um número de telefone para teste.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setDiagnosticResult(null);
    
    try {
      const testMessage = (settings?.message_template || '')
        .replace('{nome}', 'Cliente Teste')
        .replace('{hora}', '14:00')
        .replace('{servico}', 'Corte + Barba');

      const { data, error } = await supabase.functions.invoke('send-wapi-reminder', {
        body: {
          phone: testPhone,
          message: testMessage,
          diagnosticMode: diagnosticMode,
        },
      });

      if (diagnosticMode && data) {
        setDiagnosticResult(data.diagnostics || { error: data.error, responseBody: data.details });
      }

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Mensagem enviada!',
          description: 'A mensagem de teste foi enviada com sucesso.',
        });
      } else {
        throw new Error(data?.error || 'Falha ao enviar');
      }
    } catch (error: unknown) {
      console.error('Error sending test:', error);
      
      // Tentar extrair dados de diagnóstico do erro
      if (diagnosticMode) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setDiagnosticResult(prev => prev || { error: errorMessage });
      }
      
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a mensagem de teste. Veja o diagnóstico abaixo.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
      if (diagnosticMode) {
        loadRecentLogs();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Configurações não encontradas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toggle Ativar/Desativar */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border/30">
        <div className="flex flex-col">
          <Label className="font-medium text-foreground text-sm">Lembrete WhatsApp</Label>
          <span className="text-xs text-muted-foreground">
            {settings.enabled ? 'Lembretes ativados' : 'Lembretes desativados'}
          </span>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
        />
      </div>

      {/* Horas de antecedência */}
      <div className="p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <Label className="font-medium text-foreground text-sm">Antecedência do lembrete</Label>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={48}
            value={settings.reminder_hours}
            onChange={(e) => setSettings({ ...settings, reminder_hours: parseInt(e.target.value) || 10 })}
            className="w-20 h-9 text-sm"
            disabled={!settings.enabled}
          />
          <span className="text-sm text-muted-foreground">horas antes do agendamento</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Ex: Se o cliente marcou às 19:00 e você definiu 10 horas, o lembrete será enviado às 9:00.
        </p>
      </div>

      {/* Template da mensagem */}
      <div className="p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <Label className="font-medium text-foreground text-sm">Mensagem do lembrete</Label>
        </div>
        <Textarea
          value={settings.message_template}
          onChange={(e) => setSettings({ ...settings, message_template: e.target.value })}
          className="min-h-[120px] text-sm resize-none"
          placeholder="Digite a mensagem de lembrete..."
          disabled={!settings.enabled}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>, <code className="bg-muted px-1 rounded">{'{hora}'}</code>, <code className="bg-muted px-1 rounded">{'{servico}'}</code>
        </p>
      </div>

      {/* Botão Salvar */}
      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? 'Salvando...' : 'Salvar Configurações'}
      </Button>

      {/* Teste de mensagem */}
      <div className="p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border/30">
        <Label className="font-medium text-foreground text-sm mb-2 block">Testar Mensagem</Label>
        <div className="flex gap-2">
          <Input
            type="tel"
            placeholder="Número (ex: 5537999999999)"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            className="flex-1 h-9 text-sm"
          />
          <Button 
            onClick={handleTestMessage} 
            disabled={isTesting || !settings.enabled}
            size="sm"
            variant="outline"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Envia uma mensagem de teste para verificar se a W-API está funcionando.
        </p>
      </div>

      {/* Modo Diagnóstico */}
      <Collapsible open={diagnosticMode} onOpenChange={setDiagnosticMode}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              <span>Diagnóstico W-API</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {diagnosticMode ? 'Ativado' : 'Desativado'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          <div className="p-3 sm:p-4 bg-muted/50 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              Com o modo diagnóstico ativo, o teste de mensagem mostrará informações detalhadas sobre a requisição e resposta da W-API.
            </p>

            {diagnosticResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  {diagnosticResult.responseStatus === 200 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className="text-sm font-medium">
                    {diagnosticResult.responseStatus === 200 ? 'Sucesso' : 'Erro'}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  {diagnosticResult.endpoint && (
                    <div>
                      <span className="font-medium text-muted-foreground">Endpoint:</span>
                      <code className="ml-2 bg-background px-1 rounded break-all">{diagnosticResult.endpoint}</code>
                    </div>
                  )}
                  {diagnosticResult.formattedPhone && (
                    <div>
                      <span className="font-medium text-muted-foreground">Telefone formatado:</span>
                      <code className="ml-2 bg-background px-1 rounded">{diagnosticResult.formattedPhone}</code>
                    </div>
                  )}
                  {diagnosticResult.responseStatus && (
                    <div>
                      <span className="font-medium text-muted-foreground">Status HTTP:</span>
                      <code className="ml-2 bg-background px-1 rounded">{diagnosticResult.responseStatus}</code>
                    </div>
                  )}
                  {diagnosticResult.timestamp && (
                    <div>
                      <span className="font-medium text-muted-foreground">Timestamp:</span>
                      <code className="ml-2 bg-background px-1 rounded">{new Date(diagnosticResult.timestamp).toLocaleString('pt-BR')}</code>
                    </div>
                  )}
                </div>

                {diagnosticResult.responseBody && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Resposta da API:</span>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(diagnosticResult.responseBody, null, 2)}
                    </pre>
                  </div>
                )}

                {diagnosticResult.requestPayload && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Payload enviado:</span>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-auto max-h-32">
                      {JSON.stringify(diagnosticResult.requestPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {diagnosticResult.error && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded">
                    <span className="text-xs text-destructive">{diagnosticResult.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Logs recentes */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Últimos envios:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadRecentLogs}
                  disabled={isLoadingLogs}
                  className="h-6 px-2"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {recentLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Nenhum log encontrado. Envie uma mensagem de teste.
                </p>
              ) : (
                <div className="space-y-1">
                  {recentLogs.map((log) => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-2 bg-background rounded text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                        <span className="font-mono">{log.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>{log.response_status}</span>
                        <span>{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}