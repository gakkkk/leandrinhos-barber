import { 
  Calendar, Users, Scissors, Lock, Palmtree, Brain, 
  Settings, BarChart3, Package, Target, DollarSign, Cake, LayoutDashboard, Crown, Wrench 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'servicos', label: 'Serviços', icon: Scissors },
  { id: 'bloqueios', label: 'Bloqueios', icon: Lock },
  { id: 'ferias', label: 'Férias', icon: Palmtree },
  { id: 'ia', label: 'IA', icon: Brain },
];

const routeItems = [
  { path: '/caixa', label: 'Caixa', icon: DollarSign },
  { path: '/estoque', label: 'Estoque', icon: Package },
  { path: '/aniversarios', label: 'Anivers.', icon: Cake },
  { path: '/clube', label: 'Clube', icon: Crown },
  { path: '/ferramentas', label: 'Ferrament.', icon: Wrench },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { path: '/configuracoes', label: 'Config', icon: Settings },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const handleTabClick = (tabId: string) => {
    // Se não estiver na página inicial, navega para ela primeiro
    if (location.pathname !== '/') {
      navigate('/', { state: { activeTab: tabId } });
    } else {
      onTabChange(tabId);
    }
  };
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border/50 z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-start px-1 py-2 overflow-x-auto gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id && location.pathname === '/';
          
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-300 min-w-[48px] flex-shrink-0",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", isActive && "animate-pulse-gold")} />
              <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
        {routeItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-300 min-w-[48px] flex-shrink-0",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", isActive && "animate-pulse-gold")} />
              <span className="text-[9px] sm:text-[10px] font-medium whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
