import { useState, useEffect, useCallback, useRef } from 'react';
import { Agendamento } from '@/types';

interface NotificationSettings {
  enabled: boolean;
  reminderMinutes: number;
}

const NOTIFICATION_SETTINGS_KEY = 'leandrinho-notification-settings';
const NOTIFIED_APPOINTMENTS_KEY = 'leandrinho-notified-appointments';

const loadSettings = (): NotificationSettings => {
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

const saveSettings = (settings: NotificationSettings) => {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Erro ao salvar configurações de notificação:', e);
  }
};

const loadNotifiedIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(NOTIFIED_APPOINTMENTS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Erro ao carregar IDs notificados:', e);
  }
  return new Set();
};

const saveNotifiedIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(NOTIFIED_APPOINTMENTS_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Erro ao salvar IDs notificados:', e);
  }
};

// Detecta se está em dispositivo móvel
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Envia notificação via Service Worker (funciona em mobile)
const sendViaServiceWorker = async (title: string, body: string, tag?: string): Promise<boolean> => {
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: tag || 'default',
        requireInteraction: true,
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Erro ao enviar via Service Worker:', e);
    return false;
  }
};

export function useNotifications(agendamentos: Agendamento[]) {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const notifiedIdsRef = useRef<Set<string>>(loadNotifiedIds());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('Notification' in window || ('serviceWorker' in navigator));

  // Atualiza permissão
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      console.warn('Notificações não são suportadas neste navegador');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      console.log('Permissão de notificação:', result);
      return result === 'granted';
    } catch (e) {
      console.error('Erro ao solicitar permissão:', e);
      return false;
    }
  }, []);

  const toggleNotifications = useCallback(async (enabled: boolean) => {
    if (enabled) {
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          return false;
        }
      }
    }

    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    saveSettings(newSettings);
    console.log('Notificações:', enabled ? 'ativadas' : 'desativadas');
    return true;
  }, [permission, settings, requestPermission]);

  const setReminderMinutes = useCallback((minutes: number) => {
    const newSettings = { ...settings, reminderMinutes: minutes };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings]);

  const sendNotification = useCallback(async (title: string, options?: NotificationOptions): Promise<boolean> => {
    if (permission !== 'granted') {
      console.warn('Permissão de notificação não concedida:', permission);
      return false;
    }

    const body = options?.body || '';
    const tag = options?.tag;
    
    // Em mobile, sempre usa Service Worker
    if (isMobileDevice()) {
      console.log('Enviando notificação via Service Worker (mobile)');
      return await sendViaServiceWorker(title, body, tag);
    }

    // Em desktop, tenta Service Worker primeiro, depois fallback para Notification API
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          console.log('Enviando notificação via Service Worker (desktop)');
          return await sendViaServiceWorker(title, body, tag);
        }
      }
      
      // Fallback para Notification API no desktop
      console.log('Enviando notificação via Notification API');
      const notification = new Notification(title, {
        icon: '/logo.png',
        badge: '/logo.png',
        requireInteraction: true,
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return true;
    } catch (e) {
      console.error('Erro ao enviar notificação:', e);
      return false;
    }
  }, [permission]);

  const checkUpcomingAppointments = useCallback(() => {
    if (!settings.enabled || permission !== 'granted') {
      return;
    }

    const now = new Date();
    const reminderMs = settings.reminderMinutes * 60 * 1000;

    console.log(`Verificando agendamentos: ${agendamentos.length} encontrados`);

    agendamentos.forEach(async agendamento => {
      const [year, month, day] = agendamento.data.split('-').map(Number);
      const [hour, minute] = agendamento.hora_inicio.split(':').map(Number);
      const appointmentTime = new Date(year, month - 1, day, hour, minute);
      
      const timeDiff = appointmentTime.getTime() - now.getTime();
      
      // Se está dentro do período de lembrete e não foi notificado ainda
      if (timeDiff > 0 && timeDiff <= reminderMs && !notifiedIdsRef.current.has(agendamento.id)) {
        const minutesUntil = Math.round(timeDiff / 60000);
        
        console.log(`Agendamento próximo: ${agendamento.cliente_nome} em ${minutesUntil} minutos`);
        
        await sendNotification(`Agendamento em ${minutesUntil} min`, {
          body: `${agendamento.cliente_nome}\n${agendamento.servico}\nHorário: ${agendamento.hora_inicio} - ${agendamento.hora_fim}`,
          tag: agendamento.id,
        });

        notifiedIdsRef.current.add(agendamento.id);
        saveNotifiedIds(notifiedIdsRef.current);
      }
    });

    // Limpa IDs de agendamentos passados
    const todayStr = now.toISOString().split('T')[0];
    let changed = false;
    agendamentos.forEach(a => {
      if (a.data < todayStr && notifiedIdsRef.current.has(a.id)) {
        notifiedIdsRef.current.delete(a.id);
        changed = true;
      }
    });
    if (changed) {
      saveNotifiedIds(notifiedIdsRef.current);
    }
  }, [settings, permission, agendamentos, sendNotification]);

  // Configura intervalo de verificação
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!settings.enabled || permission !== 'granted') {
      return;
    }

    // Verifica imediatamente
    checkUpcomingAppointments();

    // Verifica a cada 30 segundos
    intervalRef.current = setInterval(checkUpcomingAppointments, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [settings.enabled, permission, checkUpcomingAppointments]);

  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    if (permission !== 'granted') {
      console.warn('Permissão não concedida. Solicitando...');
      const granted = await requestPermission();
      if (granted) {
        return await sendNotification('Notificacao de Teste', {
          body: 'As notificacoes estao funcionando corretamente! Voce recebera lembretes antes dos agendamentos.',
        });
      }
      return false;
    }
    
    return await sendNotification('Notificacao de Teste', {
      body: 'As notificacoes estao funcionando corretamente! Voce recebera lembretes antes dos agendamentos.',
    });
  }, [sendNotification, permission, requestPermission]);

  return {
    isSupported,
    permission,
    settings,
    requestPermission,
    toggleNotifications,
    setReminderMinutes,
    sendTestNotification,
    sendNotification,
  };
}