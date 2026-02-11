import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PushSubscriptionState {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

export function usePushSubscription() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    error: null,
  });

  // Verifica suporte e status atual
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window;
      
      if (!supported) {
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        setState({
          isSupported: true,
          isSubscribed: !!subscription,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('Error checking push subscription:', err);
        setState(prev => ({
          ...prev,
          isSupported: true,
          isLoading: false,
          error: 'Erro ao verificar subscription',
        }));
      }
    };

    checkSupport();
  }, []);

  // Busca a VAPID public key do backend
  const getVapidPublicKey = useCallback(async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('subscribe-push', {
        body: { action: 'get-vapid-key' },
      });

      if (error) throw error;
      return data?.publicKey || null;
    } catch (err) {
      console.error('Error getting VAPID key:', err);
      return null;
    }
  }, []);

  // Converte base64 URL-safe para Uint8Array
  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray.buffer;
  };

  // Inscreve para push notifications
  const subscribe = useCallback(async (reminderMinutes: number = 15): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Verificar permissão
      if (Notification.permission === 'denied') {
        throw new Error('Notificações bloqueadas pelo navegador');
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Permissão negada');
        }
      }

      // 2. Obter VAPID key
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        throw new Error('Não foi possível obter a chave VAPID');
      }

      // 3. Registrar subscription no PushManager
      const registration = await navigator.serviceWorker.ready;
      
      // Cancelar subscription anterior se existir
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      console.log('Push subscription created:', subscription.endpoint.slice(0, 50));

      // 4. Enviar para o backend
      const { error } = await supabase.functions.invoke('subscribe-push', {
        body: {
          action: 'subscribe',
          subscription: subscription.toJSON(),
          reminderMinutes,
        },
      });

      if (error) throw error;

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      return true;

    } catch (err) {
      console.error('Error subscribing to push:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao inscrever';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return false;
    }
  }, [getVapidPublicKey]);

  // Cancela subscription
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remover do backend
        await supabase.functions.invoke('subscribe-push', {
          body: {
            action: 'unsubscribe',
            subscription: subscription.toJSON(),
          },
        });

        // Cancelar localmente
        await subscription.unsubscribe();
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      return true;

    } catch (err) {
      console.error('Error unsubscribing from push:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      return false;
    }
  }, []);

  // Atualiza o tempo de lembrete
  const updateReminderMinutes = useCallback(async (reminderMinutes: number): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.warn('No subscription to update');
        return false;
      }

      const { error } = await supabase.functions.invoke('subscribe-push', {
        body: {
          action: 'subscribe',
          subscription: subscription.toJSON(),
          reminderMinutes,
        },
      });

      if (error) throw error;
      return true;

    } catch (err) {
      console.error('Error updating reminder minutes:', err);
      return false;
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    updateReminderMinutes,
  };
}
