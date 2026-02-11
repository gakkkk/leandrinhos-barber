import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { useExternalNotifications } from "./hooks/useExternalNotifications";
import { ReminderController } from "@/components/notifications/ReminderController";
import Index from "./pages/Index";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import Estoque from "./pages/Estoque";
import Metas from "./pages/Metas";
import Caixa from "./pages/Caixa";
import Aniversarios from "./pages/Aniversarios";
import Clube from "./pages/Clube";
import Ferramentas from "./pages/Ferramentas";
import Agendar from "./pages/Agendar";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();

  // Listen for external notifications (from n8n, etc.)
  useExternalNotifications();

  if (!isAuthenticated) {
    // Se estiver tentando acessar a raiz e não estiver logado, 
    // redireciona para o agendamento (comportamento "App de Agendamento")
    if (window.location.pathname === '/') {
      window.location.href = '/agendar';
      return null;
    }
    // Para outras rotas protegidas, manda pro login
    return <Login />;
  }

  return (
    <>
      {/* Keeps appointment reminder checks active on any route */}
      <ReminderController />

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/caixa" element={<Caixa />} />
        <Route path="/aniversarios" element={<Aniversarios />} />
        <Route path="/clube" element={<Clube />} />
        <Route path="/ferramentas" element={<Ferramentas />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rota pública para agendamento online */}
            <Route path="/agendar" element={<Agendar />} />
            <Route path="/login" element={<Login />} />

            {/* Redirecionamento inteligente:
                - Se tentar acessar raiz e não estiver logado -> vai pro Agendar
                - Se estiver logado -> vai pro Dashboard (via ProtectedRoutes)
            */}
            <Route path="/" element={
              <ProtectedRoutes />
            } />

            {/* Rotas protegidas */}
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

