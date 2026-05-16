import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#6b4a2b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Queijaria" },
      { title: "Queijaria — Gestão de Encomendas" },
      { name: "description", content: "Plataforma artesanal para gestão de encomendas em tempo real." },
      { property: "og:title", content: "Queijaria — Gestão de Encomendas" },
      { name: "twitter:title", content: "Queijaria — Gestão de Encomendas" },
      { property: "og:description", content: "Plataforma artesanal para gestão de encomendas em tempo real." },
      { name: "twitter:description", content: "Plataforma artesanal para gestão de encomendas em tempo real." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8e6abeb-3dfc-4759-aebe-5b50e78a036b/id-preview-eb2467fa--3458a56d-1bbf-4121-93df-0cbe0ac37941.lovable.app-1778847358268.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a8e6abeb-3dfc-4759-aebe-5b50e78a036b/id-preview-eb2467fa--3458a56d-1bbf-4121-93df-0cbe0ac37941.lovable.app-1778847358268.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
