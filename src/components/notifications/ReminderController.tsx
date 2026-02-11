import { useEffect, useState } from "react";
import { fetchGoogleCalendarEvents, convertToAgendamento } from "@/lib/googleCalendar";
import { useNotifications } from "@/hooks/useNotifications";
import type { Agendamento } from "@/types";

/**
 * Mantém os lembretes de agendamento funcionando em qualquer tela do app.
 * Observação: este lembrete depende do app estar aberto/minimizado.
 */
export function ReminderController() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);

  // Inicia o motor de lembretes (usa settings no localStorage via useNotifications)
  useNotifications(agendamentos);

  useEffect(() => {
    let isMounted = true;

    const loadCalendarEvents = async () => {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

      const { data, error } = await fetchGoogleCalendarEvents(timeMin, timeMax);
      if (!isMounted) return;

      if (error || !data) {
        console.warn("[ReminderController] Não foi possível carregar eventos:", error);
        return;
      }

      setAgendamentos(data.map(convertToAgendamento));
    };

    // Carrega imediatamente e depois atualiza periodicamente (para captar mudanças feitas fora do app)
    loadCalendarEvents();
    const interval = window.setInterval(loadCalendarEvents, 3 * 60 * 1000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
