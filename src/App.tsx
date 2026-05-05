import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import { useAuth } from "@/contexts/AuthContext";
import { BannedScreen } from "@/components/BannedScreen";

const Home = () => {
  const { user, loading, ban } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (user && ban) return <BannedScreen reason={ban.reason} />;
  return user ? <Index /> : <Landing />;
};
import Friends from "./pages/Friends";
import Chat from "./pages/Chat";
import AIChat from "./pages/AIChat";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Home />} />
            <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/ai" element={<ProtectedRoute><AIChat /></ProtectedRoute>} />
            <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
