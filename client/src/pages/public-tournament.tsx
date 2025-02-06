import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Tournament } from "@db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TournamentWithRelations = Tournament & {
  tournamentPlayers: Array<{
    playerId: number;
    player: { id: number; name: string };
  }>;
  games: Array<any>; // Use the proper Game type here
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

        <Tabs defaultValue="games">
          <TabsList>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="games">
            <div className="grid gap-4">
              {tournament.games.map((game) => (
                <Card key={game.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Round {game.roundNumber} - Court {game.courtNumber}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-medium mb-2">Team 1</h3>
                        <p>{game.player1?.name}</p>
                        <p>{game.player2?.name}</p>
                        {game.isComplete && (
                          <p className="text-2xl font-bold mt-2">{game.team1Score}</p>
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium mb-2">Team 2</h3>
                        <p>{game.player3?.name}</p>
                        <p>{game.player4?.name}</p>
                        {game.isComplete && (
                          <p className="text-2xl font-bold mt-2">{game.team2Score}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="standings">
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Games Played</TableHead>
                      <TableHead>Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tournament.tournamentPlayers.map(({ player }) => {
                      const playerGames = tournament.games.filter(
                        (g) =>
                          g.player1Id === player.id ||
                          g.player2Id === player.id ||
                          g.player3Id === player.id ||
                          g.player4Id === player.id
                      );
                      const completedGames = playerGames.filter((g) => g.isComplete);
                      const points = completedGames.reduce((total, game) => {
                        const isTeam1 =
                          game.player1Id === player.id || game.player2Id === player.id;
                        const score = isTeam1 ? game.team1Score : game.team2Score;
                        return total + (score || 0);
                      }, 0);

                      return (
                        <TableRow key={player.id}>
                          <TableCell>{player.name}</TableCell>
                          <TableCell>{completedGames.length}</TableCell>
                          <TableCell>{points}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
