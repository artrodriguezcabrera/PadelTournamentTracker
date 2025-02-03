import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TournamentForm from "@/components/tournament-form";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trophy } from "lucide-react";

export default function Home() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: tournaments } = useQuery({
    queryKey: ["/api/tournaments"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Padel Tournaments</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>Create Tournament</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <TournamentForm
                onSuccess={() => {
                  setIsCreateOpen(false);
                  toast({
                    title: "Tournament created",
                    description: "Your tournament has been created successfully.",
                  });
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments?.map((tournament) => (
            <Card key={tournament.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  {tournament.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Point System: {tournament.pointSystem} points
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                >
                  <a href={`/tournament/${tournament.id}`}>
                    {tournament.isActive ? "View Tournament" : "Start Tournament"}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
