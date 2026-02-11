import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssinaturasView } from '@/components/assinaturas/AssinaturasView';
import { FidelidadeView } from '@/components/fidelidade/FidelidadeView';
import { InstallPrompt, useInstallPrompt } from '@/components/pwa/InstallPrompt';
import { toast } from '@/hooks/use-toast';
import { Crown, Star } from 'lucide-react';

export default function Clube() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clubeTab, setClubeTab] = useState('assinaturas');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { canInstall, install } = useInstallPrompt();

  const handleRefresh = async () => {
    setIsLoading(true);
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    setIsLoading(false);
    toast({
      title: "Dados atualizados!",
      description: "Todas as informações foram sincronizadas.",
    });
    // Force re-render by toggling tab
    setClubeTab(prev => prev);
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
    <div className="min-h-screen bg-gradient-luxury pb-24">
      <Header 
        onRefresh={handleRefresh}
        onInstall={handleInstall}
        isLoading={isLoading}
        canInstall={canInstall}
      />
      
      <main className="pt-20 px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
        <Tabs value={clubeTab} onValueChange={setClubeTab} className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="assinaturas" className="gap-2">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">Clube de</span> Assinatura
            </TabsTrigger>
            <TabsTrigger value="fidelidade" className="gap-2">
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">Programa de</span> Fidelidade
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="assinaturas" className="mt-4">
            <AssinaturasView />
          </TabsContent>
          
          <TabsContent value="fidelidade" className="mt-4">
            <FidelidadeView />
          </TabsContent>
        </Tabs>
      </main>
      
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <InstallPrompt 
        open={showInstallPrompt}
        onOpenChange={setShowInstallPrompt}
        onInstall={handleInstall}
        canInstall={canInstall}
      />
    </div>
  );
}