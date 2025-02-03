import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TournamentForm from "@/components/tournament-form";
import EditTournamentPlayers from "@/components/edit-tournament-players";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users } from "lucide-react";

export default function Home() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: tournaments } = useQuery({
    queryKey: ["/api/tournaments"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Padel Tournaments</h1>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <a href="/players">
                <Users className="h-4 w-4 mr-2" />
                Players
              </a>
            </Button>
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
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <a href={`/tournament/${tournament.id}`}>
                      {tournament.isActive ? "View Tournament" : "Start Tournament"}
                    </a>
                  </Button>
                  {!tournament.isActive && (
                    <Dialog
                      open={editingTournament === tournament.id}
                      onOpenChange={(open) =>
                        setEditingTournament(open ? tournament.id : null)
                      }
                    >
                      <DialogTrigger asChild>
                        <Button variant="secondary" className="w-full">
                          <Users className="h-4 w-4 mr-2" />
                          Edit Players
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <EditTournamentPlayers
                          tournamentId={tournament.id}
                          currentPlayers={tournament.tournamentPlayers}
                          onSuccess={() => {
                            setEditingTournament(null);
                            toast({
                              title: "Players updated",
                              description: "Tournament players have been updated successfully.",
                            });
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}