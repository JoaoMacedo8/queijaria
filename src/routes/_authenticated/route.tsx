import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, ClipboardList, Package, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-grain text-muted-foreground">A carregar…</div>;
  }

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/encomendas", label: "Encomendas", icon: ClipboardList },
    { to: "/produtos", label: "Produtos", icon: Package },
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
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active ? "bg-accent/40 text-primary font-medium" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-grain flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/60 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-10 w-10 rounded-full bg-accent/30 border border-accent flex items-center justify-center">
            <span className="font-display text-lg text-primary">Q</span>
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-primary leading-tight">Queijaria</div>
            <div className="text-xs text-muted-foreground italic">Gestão artesanal</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1"><NavLinks /></nav>
        <div className="border-t border-border pt-4 mt-4">
          <div className="text-xs text-muted-foreground mb-2 px-2 truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-card/90 backdrop-blur border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-accent/30 border border-accent flex items-center justify-center">
            <span className="font-display text-sm text-primary">Q</span>
          </div>
          <span className="font-display font-semibold text-primary">Queijaria</span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-8 flex flex-col gap-1">
              <NavLinks />
              <div className="border-t border-border mt-4 pt-4">
                <div className="text-xs text-muted-foreground mb-2 px-2 truncate">{user.email}</div>
                <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
                  <LogOut className="h-4 w-4 mr-2" /> Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 md:p-8 p-4 pt-20 md:pt-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
