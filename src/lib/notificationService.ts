// Notification Service for sending push notifications for various events

// Detecta se está em dispositivo móvel
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Verifica se notificações estão habilitadas - apenas verifica permissão do navegador
const areNotificationsEnabled = (): boolean => {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
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
      } as NotificationOptions);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Erro ao enviar via Service Worker:', e);
    return false;
  }
};

// Envia notificação
export const sendNotification = async (title: string, body: string, tag?: string): Promise<boolean> => {
  if (!areNotificationsEnabled()) {
    console.log('Notificações não estão habilitadas');
    return false;
  }

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
      body,
      icon: '/logo.png',
      badge: '/logo.png',
      requireInteraction: true,
      tag,
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
};

// Notificação para novo agendamento
export const notifyNewAppointment = (clienteName: string, servico: string, data: string, horario: string) => {
  const formattedDate = new Date(data).toLocaleDateString('pt-BR');
  sendNotification(
    '📅 Novo Agendamento',
    `Cliente: ${clienteName}\nServiço: ${servico}\nData: ${formattedDate} às ${horario}`,
    'new-appointment'
  );
};

// Notificação para agendamento reagendado
export const notifyRescheduledAppointment = (clienteName: string, servico: string, data: string, horario: string) => {
  const formattedDate = new Date(data).toLocaleDateString('pt-BR');
  sendNotification(
    '🔄 Agendamento Reagendado',
    `Cliente: ${clienteName}\nServiço: ${servico}\nNova Data: ${formattedDate} às ${horario}`,
    'rescheduled-appointment'
  );
};

// Notificação para agendamento cancelado
export const notifyDeletedAppointment = (clienteName: string, servico: string, data: string, horario: string) => {
  const formattedDate = new Date(data).toLocaleDateString('pt-BR');
  sendNotification(
    '❌ Agendamento Cancelado',
    `Cliente: ${clienteName}\nServiço: ${servico}\nData: ${formattedDate} às ${horario}`,
    'deleted-appointment'
  );
};

// Notificação para novo cliente cadastrado
export const notifyNewClient = (clienteName: string, telefone: string) => {
  sendNotification(
    '👤 Novo Cliente Cadastrado',
    `Nome: ${clienteName}\nTelefone: ${telefone}`,
    'new-client'
  );
};
