import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoQueijaria from "@/assets/logo-queijaria.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "recover") {
      const res = await resetPassword(email);
      setBusy(false);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Email enviado. Verifica a tua caixa de entrada.");
        setMode("login");
      }
      return;
    }
    const res = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, name || email.split("@")[0]);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
    } else if (mode === "signup") {
      toast.success("Conta criada. Verifica o teu email para confirmar.");
    }
  };

  return (
    <div className="min-h-screen bg-grain flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <img
            src={logoQueijaria}
            alt="Logotipo Queijaria Serra d'Padrela"
            className="mx-auto mb-4 h-32 w-32 sm:h-40 sm:w-40 object-contain drop-shadow-sm"
          />
          <h1 className="text-3xl font-display font-semibold text-primary">Queijaria</h1>
          <p className="text-sm text-muted-foreground mt-1 italic">Gestão artesanal de encomendas</p>
        </div>

        <Card className="p-6 shadow-lg border-border/60">
          <AnimatePresence mode="wait">
            {mode === "recover" ? (
              <motion.div
                key="recover"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-medium text-foreground mb-1">Recuperar password</h2>
                <p className="text-sm text-muted-foreground mb-4">Indica o teu email para receberes um link de recuperação.</p>
                <form onSubmit={submit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="recover-email">Email</Label>
                    <Input id="recover-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@queijaria.pt" />
                  </div>
                  <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                    {busy ? "A enviar…" : "Enviar link"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Voltar ao login
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex gap-2 mb-6 p-1 bg-muted rounded-lg">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={`flex-1 py-2 text-sm rounded-md transition-all ${mode === "login" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground"}`}
                  >Entrar</button>
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className={`flex-1 py-2 text-sm rounded-md transition-all ${mode === "signup" ? "bg-card shadow-sm font-medium text-foreground" : "text-muted-foreground"}`}
                  >Registar</button>
                </div>

                <form onSubmit={submit} className="space-y-4">
                  {mode === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="António Silva" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@queijaria.pt" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Palavra-passe</Label>
                    <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  {mode === "login" && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setMode("recover")}
                        className="text-sm text-primary hover:underline"
                      >
                        Esqueci-me da password?
                      </button>
                    </div>
                  )}
                  <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
                    {busy ? "A processar…" : mode === "login" ? "Entrar" : "Criar conta"}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
}
