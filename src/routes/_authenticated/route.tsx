import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, ClipboardList, Package, Users, LogOut, Menu, MessageCircle, ChefHat, ShieldCheck, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logoQueijaria from "@/assets/logo-queijaria.png";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut, status, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-grain text-muted-foreground">A carregar…</div>;
  }

  // Block users that aren't approved yet
  if (status && status !== "approved") {
    const messages: Record<string, { title: string; body: string }> = {
      pending: {
        title: "Conta pendente de aprovação",
        body: "A tua conta foi criada com sucesso e está a aguardar aprovação do administrador. Receberás acesso assim que for aprovada.",
      },
      rejected: {
        title: "Acesso não autorizado",
        body: "O acesso à tua conta foi recusado. Contacta o administrador para mais informações.",
      },
      blocked: {
        title: "Conta bloqueada",
        body: "A tua conta está temporariamente bloqueada. Contacta o administrador para a desbloquear.",
      },
    };
    const m = messages[status] ?? messages.pending;
    return (
      <div className="min-h-screen bg-grain flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card/80 backdrop-blur-md border border-border/70 rounded-2xl p-8 shadow-soft text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-accent/30 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="font-display text-2xl text-primary mb-2">{m.title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{m.body}</p>
          <div className="text-xs text-muted-foreground mb-4 truncate">{user.email}</div>
          <Button variant="outline" size="sm" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/encomendas", label: "Encomendas", icon: ClipboardList },
    { to: "/producao", label: "Produção", icon: ChefHat },
    { to: "/clientes", label: "Clientes", icon: Users },
    { to: "/produtos", label: "Produtos", icon: Package },
    { to: "/gestao-whatsapp", label: "Gestão WhatsApp", icon: MessageCircle },
    ...(isAdmin ? [{ to: "/gestao-equipa", label: "Gestão Equipa", icon: ShieldCheck }] : []),
  ];

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <>
      {nav.map((n) => {
        const active = location.pathname === n.to;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNav}
            className={`group relative flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm transition-all ${
              active
                ? "bg-accent/30 text-primary font-medium shadow-soft"
                : "text-muted-foreground hover:bg-muted/70 hover:text-primary"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-accent" />
            )}
            <n.icon className={`h-4 w-4 transition-colors ${active ? "text-accent-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-grain flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 flex-col border-r border-border/70 bg-card/70 backdrop-blur-md p-6">
        <div className="flex items-center gap-3 mb-10">
          <img
            src={logoQueijaria}
            alt="Queijaria"
            className="h-12 w-12 object-contain drop-shadow-sm"
          />
          <div>
            <div className="font-display text-lg font-semibold text-primary leading-tight">Queijaria</div>
            <div className="text-xs text-muted-foreground italic tracking-wide">Gestão artesanal</div>
          </div>
        </div>
        <div className="h-px divider-gold mb-6" />
        <nav className="flex flex-col gap-1.5 flex-1"><NavLinks /></nav>
        <div className="border-t border-border/70 pt-4 mt-4">
          <div className="text-xs text-muted-foreground mb-2 px-2 truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground hover:text-primary">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-card/85 backdrop-blur-md border-b border-border/70 px-4 py-3 flex items-center justify-between shadow-soft">
        <div className="flex items-center gap-2.5">
          <img
            src={logoQueijaria}
            alt="Queijaria"
            className="h-10 w-10 object-contain"
          />
          <div className="leading-tight">
            <div className="font-display font-semibold text-primary text-sm">Queijaria</div>
            <div className="text-[10px] text-muted-foreground italic">Gestão artesanal</div>
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-6">
            <div className="mt-10 flex flex-col gap-1.5">
              <NavLinks />
              <div className="border-t border-border/70 mt-6 pt-4">
                <div className="text-xs text-muted-foreground mb-2 px-2 truncate">{user.email}</div>
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 md:p-10 p-4 pt-20 md:pt-10 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
