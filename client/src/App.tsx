import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Entrenamiento from "./pages/Entrenamiento";
import Nutricion from "./pages/Nutricion";
import Progreso from "./pages/Progreso";
import DashboardLayout from "./components/DashboardLayout";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ClerkTokenProvider } from "./components/ClerkTokenProvider";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const isClerkConfigured = Boolean(clerkPubKey);

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isClerkConfigured) {
      navigate("/");
    }
  }, [navigate]);

  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground text-center max-w-md">
          Configura <code className="text-accent">VITE_CLERK_PUBLISHABLE_KEY</code> en tu archivo{" "}
          <code className="text-accent">.env</code> para acceder al dashboard.
        </p>
      </div>
    );
  }

  return <AuthenticatedRoute component={Component} />;
}

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/");
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
      <Component />
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path={"/entrenamiento"} component={() => <ProtectedRoute component={Entrenamiento} />} />
      <Route path={"/nutricion"} component={() => <ProtectedRoute component={Nutricion} />} />
      <Route path={"/progreso"} component={() => <ProtectedRoute component={Progreso} />} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function AppShell() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function App() {
  if (!isClerkConfigured) {
    return <AppShell />;
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey!}>
      <ClerkTokenProvider>
        <AppShell />
      </ClerkTokenProvider>
    </ClerkProvider>
  );
}

export default App;
