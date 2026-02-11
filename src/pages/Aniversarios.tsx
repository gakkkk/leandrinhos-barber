import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { AniversariosView } from '@/components/aniversarios/AniversariosView';
import { FloatingActionButton } from '@/components/shared/FloatingActionButton';
import { NovoAgendamentoDialog } from '@/components/agenda/NovoAgendamentoDialog';
import { InstallPrompt, useInstallPrompt } from '@/components/pwa/InstallPrompt';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { toast } from '@/hooks/use-toast';
import { useState } from 'react';

const Aniversarios = () => {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  
  const {
    clientes,
    servicos,
    horariosFuncionamento,
    ferias,
    isLoading,
    refresh,
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

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onRefresh={handleRefresh}
        onInstall={handleInstall}
        isLoading={isLoading}
        canInstall={canInstall}
      />
      
      <main className="pt-20 pb-24 px-4">
        <AniversariosView />
      </main>

      <BottomNav activeTab="aniversarios" onTabChange={() => {}} />

      <FloatingActionButton onClick={() => setShowNovoAgendamento(true)} />

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

export default Aniversarios;
