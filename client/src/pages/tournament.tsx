import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameSchedule from "@/components/game-schedule";
import StandingsTable from "@/components/standings-table";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { type Game, type Player } from "@db/schema";

type TournamentResponse = {
  id: number;
  name: string;
  pointSystem: number;
  isActive: boolean;
  tournamentPlayers: Array<{
    player: Player;
  }>;
  games: Array<Game & {
    player1: Player;
    player2: Player;
    player3: Player;
    player4: Player;
  }>;
};

export default function Tournament() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data: tournament, isLoading } = useQuery<TournamentResponse>({
    queryKey: [`/api/tournaments/${id}`],
  });

  const startTournament = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/tournaments/${id}/start`);
    },
    onSuccess: () => {
      toast({
        title: "Tournament started",
        description: "The games have been scheduled.",
      });
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!tournament) {
    return <div>Tournament not found</div>;
  }

  const players = tournament.tournamentPlayers.map(tp => tp.player);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <h1 className="text-4xl font-bold">{tournament.name}</h1>
        </div>

        {!tournament.isActive ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-4">Ready to begin?</h2>
                <Button
                  size="lg"
                  onClick={() => startTournament.mutate()}
                  disabled={startTournament.isPending}
                >
                  Start Tournament
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="games">
            <TabsList className="mb-4">
              <TabsTrigger value="games">Games</TabsTrigger>
              <TabsTrigger value="standings">Standings</TabsTrigger>
            </TabsList>
            <TabsContent value="games">
              <GameSchedule tournamentId={tournament.id} games={tournament.games} />
            </TabsContent>
            <TabsContent value="standings">
              <StandingsTable
                games={tournament.games}
                players={players}
                pointSystem={tournament.pointSystem}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}