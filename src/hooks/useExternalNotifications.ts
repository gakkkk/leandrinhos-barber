import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendNotification } from '@/lib/notificationService';

export const useExternalNotifications = () => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Subscribe to realtime notifications
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          console.log('New notification received:', payload);
          const notification = payload.new as {
            title: string;
            body: string;
            type: string;
            data: Record<string, unknown>;
          };

          // Send browser/service worker notification
          sendNotification(notification.title, notification.body, notification.type);
        }
      )
      .subscribe((status) => {
        console.log('Notification channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);
};
