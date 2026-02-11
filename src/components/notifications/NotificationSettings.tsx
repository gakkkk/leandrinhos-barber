import { useState, useEffect } from 'react';
import { Bell, BellOff, Clock, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const NOTIFICATION_SETTINGS_KEY = 'leandrinho-notification-settings';

interface NotificationSettingsData {
  enabled: boolean;
  reminderMinutes: number;
}

const loadSettings = (): NotificationSettingsData => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Erro ao carregar configurações de notificação:', e);
  }
  return { enabled: false, reminderMinutes: 15 };
};

const saveSettings = (settings: NotificationSettingsData) => {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Erro ao salvar configurações de notificação:', e);
  }
};

export function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettingsData>(loadSettings);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    updateReminderMinutes,
  } = usePushSubscription();

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Sincroniza estado local com subscription
  useEffect(() => {
    if (!isLoading) {
      setSettings(prev => ({ ...prev, enabled: isSubscribed }));
    }
  }, [isSubscribed, isLoading]);

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe(settings.reminderMinutes);
      if (success) {
        const newSettings = { ...settings, enabled: true };
        setSettings(newSettings);
        saveSettings(newSettings);
        toast({
          title: 'Notificações ativadas',
          description: 'Você receberá lembretes mesmo com o app fechado.',
        });
      } else {
        toast({
          title: 'Erro ao ativar',
          description: error || 'Não foi possível ativar as notificações.',
          variant: 'destructive',
        });
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        const newSettings = { ...settings, enabled: false };
        setSettings(newSettings);
        saveSettings(newSettings);
        toast({
          title: 'Notificações desativadas',
          description: 'Você não receberá mais lembretes.',
        });
      }
    }
  };

  const handleReminderChange = async (value: string) => {
    const minutes = Number(value);
    const newSettings = { ...settings, reminderMinutes: minutes };
    setSettings(newSettings);
    saveSettings(newSettings);
    
    if (isSubscribed) {
      await updateReminderMinutes(minutes);
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      const success = await subscribe(settings.reminderMinutes);
      if (!success) {
        toast({
          title: 'Erro',
          description: 'Ative as notificações primeiro.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Envia notificação de teste via service worker local
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🔔 Teste de Notificação', {
          body: 'As notificações estão funcionando! Você receberá lembretes antes dos agendamentos.',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
        });
        toast({
          title: 'Notificação enviada!',
          description: 'Verifique suas notificações.',
        });
      } catch (err) {
        console.error('Test notification error:', err);
        toast({
          title: 'Erro ao enviar',
          description: 'Instale o app na tela inicial para melhor experiência.',
          variant: 'destructive',
        });
      }
    }
  };

  const reminderOptions = [
    { value: '5', label: '5 minutos antes' },
    { value: '10', label: '10 minutos antes' },
    { value: '15', label: '15 minutos antes' },
    { value: '30', label: '30 minutos antes' },
    { value: '60', label: '1 hora antes' },
    { value: '120', label: '2 horas antes' },
  ];

  if (!isSupported) {
    return (
      <div className="card-premium p-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <div>
            <p className="font-medium">Notificações não suportadas</p>
            <p className="text-sm text-muted-foreground">
              Seu navegador não suporta notificações push.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="card-premium p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              settings.enabled ? "bg-primary/20" : "bg-secondary"
            )}>
              {isLoading ? (
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              ) : settings.enabled ? (
                <Bell className="w-6 h-6 text-primary" />
              ) : (
                <BellOff className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-display font-semibold text-foreground">
                Notificações Push
              </h3>
              <p className="text-sm text-muted-foreground">
                {settings.enabled 
                  ? 'Funciona mesmo com app fechado' 
                  : 'Ative para receber lembretes'}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">
                Notificações bloqueadas. Vá nas configurações do navegador para permitir.
              </p>
            </div>
          </div>
        )}
      </div>

      {settings.enabled && (
        <>
          <div className="card-premium p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">Tempo de Lembrete</h4>
                <p className="text-xs text-muted-foreground">
                  Quando você quer ser lembrado?
                </p>
              </div>
            </div>
            
            <Select
              value={String(settings.reminderMinutes)}
              onValueChange={handleReminderChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o tempo" />
              </SelectTrigger>
              <SelectContent>
                {reminderOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleTestNotification}
            disabled={isLoading}
          >
            <Send className="w-4 h-4 mr-2" />
            Enviar Notificação de Teste
          </Button>
        </>
      )}

      <div className="text-xs text-muted-foreground text-center space-y-1">
        <p>✅ Funciona mesmo com o app fechado!</p>
        <p>Instale o app na tela inicial para melhor experiência.</p>
      </div>
    </div>
  );
}
