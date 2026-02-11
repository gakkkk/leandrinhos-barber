export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamento_online_config: {
        Row: {
          antecedencia_maxima_dias: number
          antecedencia_minima_horas: number
          ativo: boolean
          created_at: string
          id: string
          intervalo_minutos: number
          mensagem_confirmacao: string | null
          updated_at: string
        }
        Insert: {
          antecedencia_maxima_dias?: number
          antecedencia_minima_horas?: number
          ativo?: boolean
          created_at?: string
          id?: string
          intervalo_minutos?: number
          mensagem_confirmacao?: string | null
          updated_at?: string
        }
        Update: {
          antecedencia_maxima_dias?: number
          antecedencia_minima_horas?: number
          ativo?: boolean
          created_at?: string
          id?: string
          intervalo_minutos?: number
          mensagem_confirmacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agendamentos_pendentes: {
        Row: {
          cliente_nome: string
          cliente_telefone: string
          created_at: string
          data: string
          google_event_id: string | null
          horario: string
          id: string
          observacoes: string | null
          profissional_id: string | null
          servico: string
          status: string
          updated_at: string
        }
        Insert: {
          cliente_nome: string
          cliente_telefone: string
          created_at?: string
          data: string
          google_event_id?: string | null
          horario: string
          id?: string
          observacoes?: string | null
          profissional_id?: string | null
          servico: string
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string
          created_at?: string
          data?: string
          google_event_id?: string | null
          horario?: string
          id?: string
          observacoes?: string | null
          profissional_id?: string | null
          servico?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_pendentes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      aniversarios_clientes: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          data_aniversario: string
          id: string
          notificado_este_ano: boolean | null
          updated_at: string
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          data_aniversario: string
          id?: string
          notificado_este_ano?: boolean | null
          updated_at?: string
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          data_aniversario?: string
          id?: string
          notificado_este_ano?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      assinatura_uso: {
        Row: {
          assinatura_id: string
          created_at: string
          data_uso: string
          id: string
          observacoes: string | null
          servico_utilizado: string
        }
        Insert: {
          assinatura_id: string
          created_at?: string
          data_uso?: string
          id?: string
          observacoes?: string | null
          servico_utilizado: string
        }
        Update: {
          assinatura_id?: string
          created_at?: string
          data_uso?: string
          id?: string
          observacoes?: string | null
          servico_utilizado?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_uso_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          data_inicio: string
          data_vencimento: string | null
          id: string
          observacoes: string | null
          plano_id: string | null
          servicos_usados_mes: number | null
          status: string
          ultimo_reset_mes: string | null
          updated_at: string
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          data_inicio?: string
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          plano_id?: string | null
          servicos_usados_mes?: number | null
          status?: string
          ultimo_reset_mes?: string | null
          updated_at?: string
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          data_inicio?: string
          data_vencimento?: string | null
          id?: string
          observacoes?: string | null
          plano_id?: string | null
          servicos_usados_mes?: number | null
          status?: string
          ultimo_reset_mes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          aprovado: boolean
          cliente_nome: string
          cliente_telefone: string | null
          comentario: string | null
          created_at: string
          data_servico: string | null
          id: string
          nota: number
          profissional_id: string | null
          servico: string | null
        }
        Insert: {
          aprovado?: boolean
          cliente_nome: string
          cliente_telefone?: string | null
          comentario?: string | null
          created_at?: string
          data_servico?: string | null
          id?: string
          nota: number
          profissional_id?: string | null
          servico?: string | null
        }
        Update: {
          aprovado?: boolean
          cliente_nome?: string
          cliente_telefone?: string | null
          comentario?: string | null
          created_at?: string
          data_servico?: string | null
          id?: string
          nota?: number
          profissional_id?: string | null
          servico?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa: {
        Row: {
          categoria: string | null
          created_at: string
          data: string
          descricao: string
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data?: string
          descricao: string
          id?: string
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          tipo?: string
          valor?: number
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          agendada_para: string | null
          created_at: string
          cupom_id: string | null
          enviada: boolean
          enviada_em: string | null
          filtro_dias_inativo: number | null
          id: string
          mensagem: string
          nome: string
          tipo: string
          total_destinatarios: number | null
          total_enviados: number | null
          total_erros: number | null
        }
        Insert: {
          agendada_para?: string | null
          created_at?: string
          cupom_id?: string | null
          enviada?: boolean
          enviada_em?: string | null
          filtro_dias_inativo?: number | null
          id?: string
          mensagem: string
          nome: string
          tipo?: string
          total_destinatarios?: number | null
          total_enviados?: number | null
          total_erros?: number | null
        }
        Update: {
          agendada_para?: string | null
          created_at?: string
          cupom_id?: string | null
          enviada?: boolean
          enviada_em?: string | null
          filtro_dias_inativo?: number | null
          id?: string
          mensagem?: string
          nome?: string
          tipo?: string
          total_destinatarios?: number | null
          total_enviados?: number | null
          total_erros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas_destinatarios: {
        Row: {
          campanha_id: string
          cliente_nome: string
          cliente_telefone: string
          created_at: string
          enviado: boolean
          enviado_em: string | null
          erro: string | null
          id: string
        }
        Insert: {
          campanha_id: string
          cliente_nome: string
          cliente_telefone: string
          created_at?: string
          enviado?: boolean
          enviado_em?: string | null
          erro?: string | null
          id?: string
        }
        Update: {
          campanha_id?: string
          cliente_nome?: string
          cliente_telefone?: string
          created_at?: string
          enviado?: boolean
          enviado_em?: string | null
          erro?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_destinatarios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          message_template: string
          reminder_hours: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          message_template?: string
          reminder_hours?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          message_template?: string
          reminder_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      comissoes: {
        Row: {
          cliente_nome: string | null
          created_at: string
          data: string
          id: string
          observacoes: string | null
          pago: boolean
          pago_em: string | null
          percentual: number
          profissional_id: string
          servico: string
          valor_comissao: number
          valor_servico: number
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          pago_em?: string | null
          percentual: number
          profissional_id: string
          servico: string
          valor_comissao: number
          valor_servico: number
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          data?: string
          id?: string
          observacoes?: string | null
          pago?: boolean
          pago_em?: string | null
          percentual?: number
          profissional_id?: string
          servico?: string
          valor_comissao?: number
          valor_servico?: number
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          aniversariante: boolean
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          primeira_visita: boolean
          quantidade_maxima: number | null
          quantidade_usada: number
          servicos_aplicaveis: string[] | null
          tipo: string
          updated_at: string
          valido_ate: string | null
          valor: number
        }
        Insert: {
          aniversariante?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          primeira_visita?: boolean
          quantidade_maxima?: number | null
          quantidade_usada?: number
          servicos_aplicaveis?: string[] | null
          tipo?: string
          updated_at?: string
          valido_ate?: string | null
          valor: number
        }
        Update: {
          aniversariante?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          primeira_visita?: boolean
          quantidade_maxima?: number | null
          quantidade_usada?: number
          servicos_aplicaveis?: string[] | null
          tipo?: string
          updated_at?: string
          valido_ate?: string | null
          valor?: number
        }
        Relationships: []
      }
      cupons_uso: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          cupom_id: string
          id: string
          valor_desconto: number
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          cupom_id: string
          id?: string
          valor_desconto: number
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          cupom_id?: string
          id?: string
          valor_desconto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_uso_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_fixas: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          dia_vencimento: number
          id: string
          nome: string
          observacoes: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome: string
          observacoes?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          dia_vencimento?: number
          id?: string
          nome?: string
          observacoes?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      estoque: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          nome: string
          preco_custo: number | null
          preco_venda: number | null
          quantidade: number
          quantidade_minima: number
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          quantidade?: number
          quantidade_minima?: number
          updated_at?: string
        }
        Relationships: []
      }
      ferias: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      fidelidade_config: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          pontos_minimos_resgate: number
          pontos_por_real: number
          updated_at: string
          validade_pontos_dias: number | null
          valor_ponto_resgate: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          pontos_minimos_resgate?: number
          pontos_por_real?: number
          updated_at?: string
          validade_pontos_dias?: number | null
          valor_ponto_resgate?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          pontos_minimos_resgate?: number
          pontos_por_real?: number
          updated_at?: string
          validade_pontos_dias?: number | null
          valor_ponto_resgate?: number
        }
        Relationships: []
      }
      fidelidade_pontos: {
        Row: {
          cliente_nome: string
          cliente_telefone: string | null
          created_at: string
          id: string
          pontos_acumulados: number
          pontos_expirados: number
          pontos_resgatados: number
          updated_at: string
        }
        Insert: {
          cliente_nome: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          pontos_acumulados?: number
          pontos_expirados?: number
          pontos_resgatados?: number
          updated_at?: string
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string | null
          created_at?: string
          id?: string
          pontos_acumulados?: number
          pontos_expirados?: number
          pontos_resgatados?: number
          updated_at?: string
        }
        Relationships: []
      }
      fidelidade_transacoes: {
        Row: {
          cliente_id: string
          created_at: string
          data_transacao: string
          descricao: string | null
          id: string
          pontos: number
          referencia_servico: string | null
          tipo: string
          valor_relacionado: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_transacao?: string
          descricao?: string | null
          id?: string
          pontos: number
          referencia_servico?: string | null
          tipo: string
          valor_relacionado?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_transacao?: string
          descricao?: string | null
          id?: string
          pontos?: number
          referencia_servico?: string | null
          tipo?: string
          valor_relacionado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "fidelidade_pontos"
            referencedColumns: ["id"]
          },
        ]
      }
      galeria: {
        Row: {
          cliente_nome: string | null
          created_at: string
          descricao: string | null
          destaque: boolean
          foto_antes_url: string | null
          foto_depois_url: string
          id: string
          profissional_id: string | null
          servico: string | null
          titulo: string
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          foto_antes_url?: string | null
          foto_depois_url: string
          id?: string
          profissional_id?: string | null
          servico?: string | null
          titulo: string
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          foto_antes_url?: string | null
          foto_depois_url?: string
          id?: string
          profissional_id?: string | null
          servico?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "galeria_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_espera: {
        Row: {
          cliente_nome: string
          cliente_telefone: string
          created_at: string
          data_preferida: string
          horario_preferido: string | null
          id: string
          notificado: boolean
          notificado_em: string | null
          servico: string | null
          status: string
        }
        Insert: {
          cliente_nome: string
          cliente_telefone: string
          created_at?: string
          data_preferida: string
          horario_preferido?: string | null
          id?: string
          notificado?: boolean
          notificado_em?: string | null
          servico?: string | null
          status?: string
        }
        Update: {
          cliente_nome?: string
          cliente_telefone?: string
          created_at?: string
          data_preferida?: string
          horario_preferido?: string | null
          id?: string
          notificado?: boolean
          notificado_em?: string | null
          servico?: string | null
          status?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          meta_atendimentos: number
          meta_faturamento: number
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          meta_atendimentos?: number
          meta_faturamento?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          meta_atendimentos?: number
          meta_faturamento?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          read: boolean
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          read?: boolean
          title?: string
          type?: string
        }
        Relationships: []
      }
      notified_reminders: {
        Row: {
          event_id: string
          id: string
          notified_at: string
          reminder_minutes: number
        }
        Insert: {
          event_id: string
          id?: string
          notified_at?: string
          reminder_minutes: number
        }
        Update: {
          event_id?: string
          id?: string
          notified_at?: string
          reminder_minutes?: number
        }
        Relationships: []
      }
      pix_config: {
        Row: {
          ativo: boolean
          chave: string
          cidade: string
          created_at: string
          id: string
          nome_beneficiario: string
          tipo_chave: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          cidade?: string
          created_at?: string
          id?: string
          nome_beneficiario: string
          tipo_chave?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          cidade?: string
          created_at?: string
          id?: string
          nome_beneficiario?: string
          tipo_chave?: string
          updated_at?: string
        }
        Relationships: []
      }
      planos_assinatura: {
        Row: {
          ativo: boolean
          beneficios: Json | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco: number
          quantidade_servicos_mes: number | null
          servicos_incluidos: string[] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          beneficios?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco: number
          quantidade_servicos_mes?: number | null
          servicos_incluidos?: string[] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          beneficios?: Json | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco?: number
          quantidade_servicos_mes?: number | null
          servicos_incluidos?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          ativo: boolean
          comissao_padrao: number
          created_at: string
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          pix_chave: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          comissao_padrao?: number
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          pix_chave?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          comissao_padrao?: number
          created_at?: string
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          pix_chave?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          reminder_minutes: number | null
          updated_at: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          reminder_minutes?: number | null
          updated_at?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          reminder_minutes?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reminders: {
        Row: {
          appointment_time: string
          client_name: string
          client_phone: string
          created_at: string
          error: string | null
          event_id: string
          id: string
          reminder_time: string
          sent: boolean
          sent_at: string | null
          service_name: string
        }
        Insert: {
          appointment_time: string
          client_name: string
          client_phone: string
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          reminder_time: string
          sent?: boolean
          sent_at?: string | null
          service_name: string
        }
        Update: {
          appointment_time?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          reminder_time?: string
          sent?: boolean
          sent_at?: string | null
          service_name?: string
        }
        Relationships: []
      }
      variaveis_externas: {
        Row: {
          ativo: boolean
          created_at: string | null
          descricao: string | null
          id: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          descricao?: string | null
          id: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          descricao?: string | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      wapi_logs: {
        Row: {
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          message: string
          phone: string
          reminder_id: string | null
          request_payload: Json
          response_body: Json | null
          response_status: number | null
          success: boolean
        }
        Insert: {
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          message: string
          phone: string
          reminder_id?: string | null
          request_payload: Json
          response_body?: Json | null
          response_status?: number | null
          success?: boolean
        }
        Update: {
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          message?: string
          phone?: string
          reminder_id?: string | null
          request_payload?: Json
          response_body?: Json | null
          response_status?: number | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wapi_logs_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
