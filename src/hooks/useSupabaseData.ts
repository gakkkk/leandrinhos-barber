import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import {
  fetchClientes, createCliente, updateCliente, deleteCliente,
  fetchServicos, createServico, updateServico, deleteServico,
  fetchBloqueios, createBloqueio, deleteBloqueio,
  fetchFerias, createMultipleFerias, deleteFerias,
  fetchConhecimentos, createConhecimento, updateConhecimento, deleteConhecimento,
  fetchHorariosFuncionamento,
} from '@/lib/supabase';
import { fetchGoogleCalendarEvents, convertToAgendamento } from '@/lib/googleCalendar';
import { Cliente, Servico, Bloqueio, Ferias, Conhecimento, Agendamento, HorarioFuncionamento } from '@/types';
import { notifyNewClient } from '@/lib/notificationService';

export function useSupabaseData() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [conhecimentos, setConhecimentos] = useState<Conhecimento[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [horariosFuncionamento, setHorariosFuncionamento] = useState<HorarioFuncionamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCalendarEvents = useCallback(async () => {
    // Buscar eventos do mês atual e próximo
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const { data, error } = await fetchGoogleCalendarEvents(timeMin, timeMax);
    
    if (error) {
      console.warn('Não foi possível carregar eventos do Google Calendar:', error);
      return [];
    }

    return data?.map(convertToAgendamento) || [];
  }, []);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientesRes, servicosRes, bloqueiosRes, feriasRes, conhecimentosRes, horariosRes, calendarEvents] = await Promise.all([
        fetchClientes(),
        fetchServicos(),
        fetchBloqueios(),
        fetchFerias(),
        fetchConhecimentos(),
        fetchHorariosFuncionamento(),
        loadCalendarEvents(),
      ]);

      // Mapear dados do banco para formato do app
      if (clientesRes.data) {
        const mappedClientes = clientesRes.data.map((c: any) => ({
          id: c.id,
          nome: c.nomewpp || c.nome || '',
          telefone: c.telefone || '',
          observacoes: c.observacoes || '',
        }));
        setClientes(mappedClientes);
      }
      if (servicosRes.data) {
        const mappedServicos = servicosRes.data.map((s: any) => ({
          id: s.id,
          nome: s.nome || '',
          descricao: s.descricao || '',
          preco: s.preco || 0,
          duracao: s.duracao_minutos || s.duracao || 30,
        }));
        setServicos(mappedServicos);
      }
      if (bloqueiosRes.data) {
        const mappedBloqueios = bloqueiosRes.data.map((b: any) => {
          // Extrair data e hora de campos timestamp (inicio, fim)
          const inicio = b.inicio ? new Date(b.inicio) : null;
          const fim = b.fim ? new Date(b.fim) : null;
          return {
            id: b.id,
            data: inicio ? inicio.toISOString().split('T')[0] : (b.data || ''),
            hora_inicio: inicio ? inicio.toTimeString().slice(0, 5) : (b.hora_inicio || ''),
            hora_fim: fim ? fim.toTimeString().slice(0, 5) : (b.hora_fim || ''),
            motivo: b.motivo || '',
          };
        });
        setBloqueios(mappedBloqueios);
      }
      if (feriasRes.data) {
        const mappedFerias = feriasRes.data.map((f: any) => ({
          id: f.id,
          data: f.data || '',
          descricao: f.descricao || '',
        }));
        setFerias(mappedFerias);
      }
      if (conhecimentosRes.data) setConhecimentos(conhecimentosRes.data);
      if (horariosRes.data) setHorariosFuncionamento(horariosRes.data);
      setAgendamentos(calendarEvents);
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [loadCalendarEvents]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Clientes handlers
  const handleAddCliente = async (cliente: Omit<Cliente, 'id'>) => {
    const { data, error } = await createCliente(cliente);
    if (error) {
      toast({ title: "Erro ao adicionar cliente", variant: "destructive" });
      return;
    }
    if (data && data[0]) {
      const mappedCliente = {
        id: data[0].id,
        nome: data[0].nomewpp || data[0].nome || cliente.nome,
        telefone: data[0].telefone || cliente.telefone,
        observacoes: data[0].observacoes || cliente.observacoes || '',
      };
      setClientes(prev => [...prev, mappedCliente]);
      
      // Send notification for new client
      notifyNewClient(mappedCliente.nome, mappedCliente.telefone);
      
      toast({ title: "Cliente adicionado!" });
    }
  };

  const handleEditCliente = async (cliente: Cliente) => {
    const { error } = await updateCliente(cliente.id, {
      nome: cliente.nome,
      telefone: cliente.telefone,
      observacoes: cliente.observacoes,
    });
    if (error) {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" });
      return;
    }
    setClientes(prev => prev.map(c => c.id === cliente.id ? cliente : c));
    toast({ title: "Cliente atualizado!" });
  };

  const handleDeleteCliente = async (id: string) => {
    const { error } = await deleteCliente(id);
    if (error) {
      toast({ title: "Erro ao remover cliente", variant: "destructive" });
      return;
    }
    setClientes(prev => prev.filter(c => c.id !== id));
    toast({ title: "Cliente removido!" });
  };

  // Serviços handlers
  const handleAddServico = async (servico: Omit<Servico, 'id'>) => {
    const { data, error } = await createServico(servico);
    if (error) {
      toast({ title: "Erro ao adicionar serviço", variant: "destructive" });
      return;
    }
    if (data && data[0]) {
      const mappedServico = {
        id: data[0].id,
        nome: data[0].nome || servico.nome,
        descricao: data[0].descricao || servico.descricao || '',
        preco: data[0].preco || servico.preco,
        duracao: data[0].duracao_minutos || data[0].duracao || servico.duracao || 30,
      };
      setServicos(prev => [...prev, mappedServico]);
      toast({ title: "Serviço adicionado!" });
    }
  };

  const handleEditServico = async (servico: Servico) => {
    const { error } = await updateServico(servico.id, {
      nome: servico.nome,
      descricao: servico.descricao,
      preco: servico.preco,
      duracao: servico.duracao,
    });
    if (error) {
      toast({ title: "Erro ao atualizar serviço", variant: "destructive" });
      return;
    }
    setServicos(prev => prev.map(s => s.id === servico.id ? servico : s));
    toast({ title: "Serviço atualizado!" });
  };

  const handleDeleteServico = async (id: string) => {
    const { error } = await deleteServico(id);
    if (error) {
      toast({ title: "Erro ao remover serviço", variant: "destructive" });
      return;
    }
    setServicos(prev => prev.filter(s => s.id !== id));
    toast({ title: "Serviço removido!" });
  };

  // Bloqueios handlers
  const handleAddBloqueio = async (bloqueio: Omit<Bloqueio, 'id'>) => {
    const { data, error } = await createBloqueio(bloqueio);
    if (error) {
      toast({ title: "Erro ao bloquear horário", variant: "destructive" });
      return;
    }
    if (data && data[0]) {
      setBloqueios(prev => [...prev, data[0]]);
      toast({ title: "Horário bloqueado!" });
    }
  };

  const handleDeleteBloqueio = async (id: string) => {
    const { error } = await deleteBloqueio(id);
    if (error) {
      toast({ title: "Erro ao desbloquear horário", variant: "destructive" });
      return;
    }
    setBloqueios(prev => prev.filter(b => b.id !== id));
    toast({ title: "Horário desbloqueado!" });
  };

  // Férias handlers - cada dia é uma row separada
  const handleAddMultipleFerias = async (datas: string[], descricao?: string) => {
    const diasToAdd = datas.map(data => ({ data, descricao }));
    const { data, error } = await createMultipleFerias(diasToAdd);
    if (error) {
      toast({ title: "Erro ao adicionar férias", variant: "destructive" });
      return;
    }
    if (data) {
      const newFerias = data.map((f: any) => ({
        id: f.id,
        data: f.data,
        descricao: f.descricao || '',
      }));
      setFerias(prev => [...prev, ...newFerias]);
      toast({ title: `${datas.length} dia(s) de férias adicionado(s)!` });
    }
  };

  const handleDeleteFerias = async (id: string) => {
    const { error } = await deleteFerias(id);
    if (error) {
      toast({ title: "Erro ao remover férias", variant: "destructive" });
      return;
    }
    setFerias(prev => prev.filter(f => f.id !== id));
    toast({ title: "Férias removidas!" });
  };

  // Conhecimentos handlers
  const handleAddConhecimento = async (c: Omit<Conhecimento, 'id'>) => {
    const { data, error } = await createConhecimento(c);
    if (error) {
      toast({ title: "Erro ao adicionar conhecimento", variant: "destructive" });
      return;
    }
    if (data && data[0]) {
      setConhecimentos(prev => [...prev, data[0]]);
      toast({ title: "Conhecimento adicionado!" });
    }
  };

  const handleEditConhecimento = async (c: Conhecimento) => {
    const { error } = await updateConhecimento(c.id, {
      titulo: c.titulo,
      conteudo: c.conteudo,
    });
    if (error) {
      toast({ title: "Erro ao atualizar conhecimento", variant: "destructive" });
      return;
    }
    setConhecimentos(prev => prev.map(item => item.id === c.id ? c : item));
    toast({ title: "Conhecimento atualizado!" });
  };

  const handleDeleteConhecimento = async (id: string) => {
    const { error } = await deleteConhecimento(id);
    if (error) {
      toast({ title: "Erro ao remover conhecimento", variant: "destructive" });
      return;
    }
    setConhecimentos(prev => prev.filter(c => c.id !== id));
    toast({ title: "Conhecimento removido!" });
  };

  return {
    // Data
    clientes,
    servicos,
    bloqueios,
    ferias,
    conhecimentos,
    agendamentos,
    horariosFuncionamento,
    isLoading,
    
    // Actions
    refresh: loadAllData,
    
    // Clientes
    addCliente: handleAddCliente,
    editCliente: handleEditCliente,
    deleteCliente: handleDeleteCliente,
    
    // Serviços
    addServico: handleAddServico,
    editServico: handleEditServico,
    deleteServico: handleDeleteServico,
    
    // Bloqueios
    addBloqueio: handleAddBloqueio,
    deleteBloqueio: handleDeleteBloqueio,
    
    // Férias
    addMultipleFerias: handleAddMultipleFerias,
    deleteFerias: handleDeleteFerias,
    
    // Conhecimentos
    addConhecimento: handleAddConhecimento,
    editConhecimento: handleEditConhecimento,
    deleteConhecimento: handleDeleteConhecimento,
  };
}
