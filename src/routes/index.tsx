import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-grain">
        <div className="text-muted-foreground">A carregar…</div>
      </div>
    );
  }
  return <Navigate to={user ? "/dashboard" : "/login"} />;
}
