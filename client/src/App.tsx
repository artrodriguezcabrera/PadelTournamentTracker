import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Tournament from "@/pages/tournament";
import PublicTournament from "@/pages/public-tournament";
import Players from "@/pages/players";
import Auth from "@/pages/auth";
import Profile from "@/pages/profile";
import AdminDashboard from "@/pages/admin-dashboard";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={Auth} />
      <Route path="/tournament/public/:publicId" component={PublicTournament} />
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/tournament/:id" component={Tournament} />
      <ProtectedRoute path="/players" component={Players} />
      <ProtectedRoute path="/profile" component={Profile} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;