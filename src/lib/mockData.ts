import { Cliente, Servico, Bloqueio, Ferias, Conhecimento, Agendamento } from '@/types';

export const mockClientes: Cliente[] = [
  { id: '1', nome: 'João Silva', telefone: '(11) 99999-1111', observacoes: 'Prefere corte degradê' },
  { id: '2', nome: 'Pedro Santos', telefone: '(11) 99999-2222', observacoes: 'Alergia a alguns produtos' },
  { id: '3', nome: 'Carlos Oliveira', telefone: '(11) 99999-3333', observacoes: '' },
  { id: '4', nome: 'André Lima', telefone: '(11) 99999-4444', observacoes: 'Cliente VIP' },
  { id: '5', nome: 'Ricardo Souza', telefone: '(11) 99999-5555', observacoes: 'Barba completa sempre' },
];

export const mockServicos: Servico[] = [
  { id: '1', nome: 'Corte Masculino', preco: 45, duracao: 30 },
  { id: '2', nome: 'Barba', preco: 35, duracao: 20 },
  { id: '3', nome: 'Corte + Barba', preco: 70, duracao: 50 },
  { id: '4', nome: 'Degradê', preco: 55, duracao: 40 },
  { id: '5', nome: 'Pigmentação', preco: 80, duracao: 60 },
  { id: '6', nome: 'Hidratação', preco: 40, duracao: 25 },
];

export const mockBloqueios: Bloqueio[] = [
  { id: '1', data: '2024-12-10', hora_inicio: '12:00', hora_fim: '14:00', motivo: 'Almoço' },
  { id: '2', data: '2024-12-12', hora_inicio: '08:00', hora_fim: '10:00', motivo: 'Compromisso pessoal' },
];

export const mockFerias: Ferias[] = [
  { id: '1', data: '2024-12-24', descricao: 'Natal' },
  { id: '2', data: '2024-12-25', descricao: 'Natal' },
  { id: '3', data: '2024-12-31', descricao: 'Ano Novo' },
];

export const mockConhecimentos: Conhecimento[] = [
  { 
    id: '1', 
    titulo: 'Horário de Funcionamento', 
    conteudo: 'A barbearia funciona de segunda a sábado, das 9h às 20h. Domingos e feriados fechado.',
    created_at: '2024-12-01'
  },
  { 
    id: '2', 
    titulo: 'Serviços Especiais', 
    conteudo: 'Oferecemos corte masculino, barba, degradê, pigmentação e hidratação. Combos disponíveis.',
    created_at: '2024-12-01'
  },
];

export const mockAgendamentos: Agendamento[] = [
  { id: '1', cliente_nome: 'João Silva', servico: 'Corte Masculino', data: '2024-12-07', hora_inicio: '09:00', hora_fim: '09:30', status: 'confirmado' },
  { id: '2', cliente_nome: 'Pedro Santos', servico: 'Corte + Barba', data: '2024-12-07', hora_inicio: '10:00', hora_fim: '10:50', status: 'confirmado' },
  { id: '3', cliente_nome: 'Carlos Oliveira', servico: 'Barba', data: '2024-12-07', hora_inicio: '14:00', hora_fim: '14:20', status: 'pendente' },
  { id: '4', cliente_nome: 'André Lima', servico: 'Degradê', data: '2024-12-07', hora_inicio: '15:00', hora_fim: '15:40', status: 'confirmado' },
  { id: '5', cliente_nome: 'Ricardo Souza', servico: 'Pigmentação', data: '2024-12-08', hora_inicio: '11:00', hora_fim: '12:00', status: 'confirmado' },
];

export const horariosDisponiveis = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30'
];
