import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Tournament } from "@db/schema";
import GameSchedule from "@/components/game-schedule";
import StandingsTable from "@/components/standings-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TournamentWithRelations = Tournament & {
  tournamentPlayers: Array<{
    playerId: number;
    player: { id: number; name: string };
  }>;
  games: Array<{
    id: number;
    roundNumber: number;
    courtNumber: number;
    team1Score: number | null;
    team2Score: number | null;
    isComplete: boolean;
    player1: { id: number; name: string } | null;
    player2: { id: number; name: string } | null;
    player3: { id: number; name: string } | null;
    player4: { id: number; name: string } | null;
  }>;
};

export default function PublicTournament({ params }: { params: { publicId: string } }) {
  const { data: tournament } = useQuery<TournamentWithRelations>({
    queryKey: [`/api/public/tournaments/${params.publicId}`],
  });

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">Tournament not found</h1>
          <p>This tournament might have been removed or made private.</p>
          <Button variant="ghost" size="sm" asChild className="mt-4">
            <a href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
          <Button variant="ghost" size="icon" className="self-start" asChild>
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold">{tournament.name}</h1>
            <p className="text-muted-foreground">
              Point System: {tournament.pointSystem} points • Courts: {tournament.courts}
            </p>
          </div>
        </div>

        <Tabs defaultValue="games" className="space-y-4">
          <TabsList>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="games" className="space-y-4">
            <GameSchedule
              games={tournament.games}
              isPublic={true}
            />
          </TabsContent>

          <TabsContent value="standings">
            <Card>
              <CardContent className="pt-6">
                <StandingsTable
                  games={tournament.games}
                  players={tournament.tournamentPlayers.map(tp => tp.player)}
                  pointSystem={tournament.pointSystem}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}