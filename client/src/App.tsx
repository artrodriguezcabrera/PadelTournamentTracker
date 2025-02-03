import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Tournament from "@/pages/tournament";
import Players from "@/pages/players";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/tournament/:id" component={Tournament} />
      <Route path="/players" component={Players} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;