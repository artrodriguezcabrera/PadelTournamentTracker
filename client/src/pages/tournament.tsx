import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameSchedule from "@/components/game-schedule";
import StandingsTable from "@/components/standings-table";
import { ArrowLeft } from "lucide-react";
import { type Game, type Player } from "@db/schema";
import { useState } from "react";
import { cn } from "@/lib/utils";

type TournamentResponse = {
  id: number;
  name: string;
  pointSystem: number;
  isActive: boolean;
  tournamentPlayers: Array<{
    playerId: number;
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
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("games");

  const { data: tournament, isLoading } = useQuery<TournamentResponse>({
    queryKey: [`/api/tournaments/${id}`],
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!tournament) {
    return <div>Tournament not found</div>;
  }

  const completedGames = tournament.games.filter(game => game.isComplete);
  const players = tournament.tournamentPlayers;
  const rounds = [...new Set(tournament.games.map(game => game.roundNumber))];
  const currentRound = selectedRound ?? rounds[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 sm:mb-8">
          <Button variant="ghost" size="icon" className="self-start" asChild>
            <a href="/">
              <ArrowLeft className="h-4 w-4" />
            </a>
          </Button>
          <h1 className="text-2xl sm:text-4xl font-bold">{tournament.name}</h1>
        </div>

        <Tabs defaultValue="games" onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto mb-4">
            <TabsTrigger value="games" className="flex-1 sm:flex-none">Games</TabsTrigger>
            <TabsTrigger value="standings" className="flex-1 sm:flex-none">Standings</TabsTrigger>
          </TabsList>

          {activeTab === "games" && (
            <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
              {rounds.map((round) => (
                <Button
                  key={round}
                  variant={currentRound === round ? "default" : "outline"}
                  className={cn(
                    "min-w-[3rem] flex-shrink-0",
                    currentRound === round && "font-bold"
                  )}
                  onClick={() => setSelectedRound(round)}
                >
                  {round}
                </Button>
              ))}
            </div>
          )}

          <TabsContent value="games">
            <GameSchedule
              tournamentId={tournament.id}
              games={tournament.games.filter(game => game.roundNumber === currentRound)}
              pointSystem={tournament.pointSystem}
              roundNumber={currentRound}
            />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTable
              games={completedGames}
              players={players}
              pointSystem={tournament.pointSystem}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}