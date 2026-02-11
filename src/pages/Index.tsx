import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { AgendaView } from '@/components/agenda/AgendaView';
import { ClientesList } from '@/components/clientes/ClientesList';
import { ServicosList } from '@/components/servicos/ServicosList';
import { BloqueiosList } from '@/components/bloqueios/BloqueiosList';
import { FeriasList } from '@/components/ferias/FeriasList';
import { ConhecimentosList } from '@/components/conhecimentos/ConhecimentosList';
import { CaixaView } from '@/components/caixa/CaixaView';
import { EstoqueView } from '@/components/estoque/EstoqueView';
import { AniversariosView } from '@/components/aniversarios/AniversariosView';
import { MetasView } from '@/components/metas/MetasView';
import { DashboardResumo } from '@/components/dashboard/DashboardResumo';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { NovoAgendamentoDialog } from '@/components/agenda/NovoAgendamentoDialog';
import { InstallPrompt, useInstallPrompt } from '@/components/pwa/InstallPrompt';
import { toast } from '@/hooks/use-toast';
import { useSupabaseData } from '@/hooks/useSupabaseData';

const Index = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    // Verifica se há um tab no state da navegação
    return (location.state as { activeTab?: string })?.activeTab || 'dashboard';
  });
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  
  // Atualiza o tab quando navegar de outra página
  useEffect(() => {
    const state = location.state as { activeTab?: string };
    if (state?.activeTab) {
      setActiveTab(state.activeTab);
      // Limpa o state para evitar que persista
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const { canInstall, install } = useInstallPrompt();

  const {
    clientes,
    servicos,
    bloqueios,
    ferias,
    conhecimentos,
    agendamentos,
    horariosFuncionamento,
    isLoading,
    refresh,
    addCliente,
    editCliente,
    deleteCliente,
    addServico,
    editServico,
    deleteServico,
    addBloqueio,
    deleteBloqueio,
    addMultipleFerias,
    deleteFerias,
    addConhecimento,
    editConhecimento,
    deleteConhecimento,
  } = useSupabaseData();

  const handleRefresh = async () => {
    await refresh();
    toast({
      title: "Dados atualizados!",
      description: "Todas as informações foram sincronizadas.",
    });
  };

  const handleInstall = async () => {
    if (canInstall) {
      const installed = await install();
      if (installed) {
        toast({
          title: "App instalado!",
          description: "O app foi adicionado à sua tela inicial.",
        });
      }
    } else {
      setShowInstallPrompt(true);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner message="Carregando dados..." />;
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardResumo
            agendamentos={agendamentos}
            servicos={servicos}
            onOpenAgendamento={() => setShowNovoAgendamento(true)}
            onNavigateTo={setActiveTab}
          />
        );
      case 'agenda':
        return (
          <AgendaView 
            agendamentos={agendamentos}
            bloqueios={bloqueios}
            ferias={ferias}
            horariosFuncionamento={horariosFuncionamento}
            clientes={clientes}
            servicos={servicos}
            onEventCreated={refresh}
          />
        );
      case 'clientes':
        return (
          <ClientesList 
            clientes={clientes}
            onAdd={addCliente}
            onEdit={editCliente}
            onDelete={deleteCliente}
          />
        );
      case 'servicos':
        return (
          <ServicosList 
            servicos={servicos}
            onAdd={addServico}
            onEdit={editServico}
            onDelete={deleteServico}
          />
        );
      case 'bloqueios':
        return (
          <BloqueiosList 
            bloqueios={bloqueios}
            onAdd={addBloqueio}
            onDelete={deleteBloqueio}
          />
        );
      case 'ferias':
        return (
          <FeriasList 
            ferias={ferias}
            onAddMultiple={addMultipleFerias}
            onDelete={deleteFerias}
          />
        );
      case 'ia':
        return (
          <ConhecimentosList 
            conhecimentos={conhecimentos}
            onAdd={addConhecimento}
            onEdit={editConhecimento}
            onDelete={deleteConhecimento}
          />
        );
      case 'caixa':
        return <CaixaView />;
      case 'estoque':
        return <EstoqueView />;
      case 'aniversarios':
        return <AniversariosView />;
      case 'metas':
        return <MetasView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onRefresh={handleRefresh}
        onInstall={handleInstall}
        isLoading={isLoading}
        canInstall={canInstall}
      />
      
      <main className="pt-20 pb-24 px-4">
        {renderContent()}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Botão flutuante para novo agendamento */}
      {activeTab !== 'agenda' && (
        <FloatingActionButton onClick={() => setShowNovoAgendamento(true)} />
      )}

      {/* Dialog de novo agendamento */}
      <NovoAgendamentoDialog
        open={showNovoAgendamento}
        onOpenChange={setShowNovoAgendamento}
        clientes={clientes}
        servicos={servicos}
        horariosFuncionamento={horariosFuncionamento}
        ferias={ferias}
        onEventCreated={refresh}
        selectedDate={new Date()}
      />

      <InstallPrompt 
        open={showInstallPrompt}
        onOpenChange={setShowInstallPrompt}
        onInstall={handleInstall}
        canInstall={canInstall}
      />
    </div>
  );
};

export default Index;
