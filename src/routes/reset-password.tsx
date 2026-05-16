import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logoQueijaria from "@/assets/logo-queijaria.png";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingHash, setCheckingHash] = useState(true);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setCheckingHash(false);
    } else {
      toast.error("Link de recuperação inválido ou expirado.");
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A password deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As passwords não coincidem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password atualizada com sucesso.");
      navigate({ to: "/login" });
    }
  };

  if (checkingHash) {
    return (
      <div className="min-h-screen bg-grain flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted-foreground text-sm"
        >
          A verificar link…
        </motion.div>
      </div>
    );
  }

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
          <h2 className="text-lg font-medium text-foreground mb-1">Nova password</h2>
          <p className="text-sm text-muted-foreground mb-4">Define uma nova password para a tua conta.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-primary hover:bg-primary/90">
              {busy ? "A atualizar…" : "Atualizar password"}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
