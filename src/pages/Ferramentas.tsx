import { useState } from 'react';
import { ArrowLeft, Wrench, Users, DollarSign, Image, Star, Ticket, Clock, Megaphone, Receipt, QrCode, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

import { ProfissionaisView } from '@/components/profissionais/ProfissionaisView';
import { ComissoesView } from '@/components/comissoes/ComissoesView';
import { GaleriaView } from '@/components/galeria/GaleriaView';
import { AvaliacoesView } from '@/components/avaliacoes/AvaliacoesView';
import { CuponsView } from '@/components/cupons/CuponsView';
import { ListaEsperaView } from '@/components/lista-espera/ListaEsperaView';
import { CampanhasView } from '@/components/campanhas/CampanhasView';
import { DespesasFixasView } from '@/components/despesas-fixas/DespesasFixasView';
import { PixConfigView } from '@/components/pix/PixConfigView';
import { AgendamentoOnlineView } from '@/components/agendamento-online/AgendamentoOnlineView';

const ferramentas = [
  { id: 'profissionais', label: 'Equipe', icon: Users },
  { id: 'comissoes', label: 'Comissões', icon: DollarSign },
  { id: 'galeria', label: 'Galeria', icon: Image },
  { id: 'avaliacoes', label: 'Avaliações', icon: Star },
  { id: 'cupons', label: 'Cupons', icon: Ticket },
  { id: 'espera', label: 'Espera', icon: Clock },
  { id: 'campanhas', label: 'Campanhas', icon: Megaphone },
  { id: 'despesas', label: 'Despesas', icon: Receipt },
  { id: 'pix', label: 'PIX', icon: QrCode },
  { id: 'agendamento', label: 'Agend. Online', icon: Calendar },
];

export default function Ferramentas() {
  const [activeTab, setActiveTab] = useState('profissionais');

  const renderContent = () => {
    switch (activeTab) {
      case 'profissionais':
        return <ProfissionaisView />;
      case 'comissoes':
        return <ComissoesView />;
      case 'galeria':
        return <GaleriaView />;
      case 'avaliacoes':
        return <AvaliacoesView />;
      case 'cupons':
        return <CuponsView />;
      case 'espera':
        return <ListaEsperaView />;
      case 'campanhas':
        return <CampanhasView />;
      case 'despesas':
        return <DespesasFixasView />;
      case 'pix':
        return <PixConfigView />;
      case 'agendamento':
        return <AgendamentoOnlineView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center px-3 sm:px-4">
        <Link to="/" className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </Link>
        <Wrench className="w-5 h-5 text-primary ml-2" />
        <h1 className="font-display text-base sm:text-lg font-semibold text-foreground ml-2">Ferramentas</h1>
      </header>

      <main className="pt-16 sm:pt-18 pb-8 px-3 sm:px-4 animate-fade-in">
        {/* Menu de navegação horizontal */}
        <div className="mb-4 -mx-3 px-3 overflow-x-auto pb-2">
          <div className="flex gap-2 min-w-max">
            {ferramentas.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo */}
        {renderContent()}
      </main>
    </div>
  );
}