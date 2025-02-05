import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TournamentForm from "@/components/tournament-form";
import EditTournamentPlayers from "@/components/edit-tournament-players";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Users, MoreVertical, Edit, Trash, Shield } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { type Tournament } from "@db/schema";
import UserNav from "@/components/user-nav";
import { useAuth } from "@/hooks/use-auth";

type TournamentWithPlayers = Tournament & {
  tournamentPlayers: Array<{
    playerId: number;
    player: { id: number; name: string };
  }>;
};

export default function Home() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<number | null>(null);
  const [editingPlayers, setEditingPlayers] = useState<number | null>(null);
  const [deletingTournament, setDeletingTournament] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: tournaments } = useQuery<TournamentWithPlayers[]>({
    queryKey: ["/api/tournaments"],
  });

  const startTournament = useMutation({
    mutationFn: async (tournamentId: number) => {
      const response = await fetch(`/api/tournaments/${tournamentId}/start`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to start tournament');
      }
      return data;
    },
    onSuccess: (_data, tournamentId) => {
      window.location.href = `/tournament/${tournamentId}`;
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTournament = useMutation({
    mutationFn: async (tournamentId: number) => {
      await apiRequest("DELETE", `/api/tournaments/${tournamentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tournaments"] });
      toast({
        title: "Tournament deleted",
        description: "The tournament has been deleted successfully.",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold">Padel Bros</h1>
            <UserNav />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/players">
                <Users className="h-4 w-4 mr-2" />
                Players
              </a>
            </Button>
            {user?.isAdmin && (
              <Button variant="outline" asChild>
                <a href="/admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Dashboard
                </a>
              </Button>
            )}
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
                <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    {tournament.name}
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!tournament.isActive && (
                        <DropdownMenuItem
                          onClick={() => setEditingTournament(tournament.id)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Tournament
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeletingTournament(tournament.id)}
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Tournament
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Point System: {tournament.pointSystem} points
                  <br />
                  Courts: {tournament.courts}
                </p>
                <div className="flex flex-col gap-2">
                  {tournament.isActive ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      asChild
                    >
                      <a href={`/tournament/${tournament.id}`}>
                        View Tournament
                      </a>
                    </Button>
                  ) : (
                    <>
                      <Dialog
                        open={editingPlayers === tournament.id}
                        onOpenChange={(open) =>
                          setEditingPlayers(open ? tournament.id : null)
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
                              setEditingPlayers(null);
                              toast({
                                title: "Players updated",
                                description: "Tournament players have been updated successfully.",
                              });
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => startTournament.mutate(tournament.id)}
                        disabled={startTournament.isPending}
                      >
                        {startTournament.isPending ? "Starting..." : "Start Tournament"}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog
          open={editingTournament !== null}
          onOpenChange={(open) => !open && setEditingTournament(null)}
        >
          <DialogContent className="sm:max-w-[500px]">
            <TournamentForm
              tournament={tournaments?.find((t) => t.id === editingTournament)}
              onSuccess={() => {
                setEditingTournament(null);
                toast({
                  title: "Tournament updated",
                  description: "The tournament has been updated successfully.",
                });
              }}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deletingTournament !== null}
          onOpenChange={(open) => !open && setDeletingTournament(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the tournament and all its games.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deletingTournament) {
                    deleteTournament.mutate(deletingTournament);
                    setDeletingTournament(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}