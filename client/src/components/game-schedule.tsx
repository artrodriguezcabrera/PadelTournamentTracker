import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { type Game } from "@db/schema";
import PointSelector from "./point-selector";
import { Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type GameWithPlayers = Game & {
  player1: { name: string };
  player2: { name: string };
  player3: { name: string };
  player4: { name: string };
};

type GameScheduleProps = {
  tournamentId: number;
  games: GameWithPlayers[];
  pointSystem: number;
};

export default function GameSchedule({ tournamentId, games, pointSystem }: GameScheduleProps) {
  const [scores, setScores] = useState<Record<number, { team1: string; team2: string }>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const updateScore = useMutation({
    mutationFn: async ({
      gameId,
      team1Score,
      team2Score,
    }: {
      gameId: number;
      team1Score: number;
      team2Score: number;
    }) => {
      await apiRequest("POST", `/api/games/${gameId}/score`, {
        team1Score,
        team2Score,
      });
    },
    onMutate: async ({ gameId, team1Score, team2Score }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/tournaments/${tournamentId}`] });
      const previousTournament = queryClient.getQueryData([`/api/tournaments/${tournamentId}`]);

      queryClient.setQueryData([`/api/tournaments/${tournamentId}`], (old: any) => {
        if (!old || !old.games) return old;
        const newGames = old.games.map((game: GameWithPlayers) => {
          if (game.id === gameId) {
            return {
              ...game,
              team1Score,
              team2Score,
              isComplete: true,
            };
          }
          return game;
        });
        return {
          ...old,
          games: newGames,
        };
      });

      return { previousTournament };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTournament) {
        queryClient.setQueryData(
          [`/api/tournaments/${tournamentId}`],
          context.previousTournament
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}`] });
    },
  });

  const handleScoreChange = (gameId: number, team: 'team1' | 'team2', points: number) => {
    const oppositeTeam = team === 'team1' ? 'team2' : 'team1';
    const remainingPoints = pointSystem - points;

    setScores({
      ...scores,
      [gameId]: {
        ...(scores[gameId] || {}),
        [team]: points.toString(),
        [oppositeTeam]: remainingPoints.toString(),
      },
    });
    setLastUpdated(gameId);

    updateScore.mutate({
      gameId,
      team1Score: team === 'team1' ? points : remainingPoints,
      team2Score: team === 'team2' ? points : remainingPoints,
    });
  };

  // Get unique round numbers while preserving order
  const rounds = [...new Set(games.map(game => game.roundNumber))];

  return (
    <div className="space-y-8">
      {rounds.map((roundNumber) => {
        // Get all games for this round
        const roundGames = games.filter(game => game.roundNumber === roundNumber);
        // Get unique court numbers for this round while preserving order
        const courts = [...new Set(roundGames.map(game => game.courtNumber))];

        return (
          <motion.div 
            key={roundNumber} 
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            layoutId={`round-${roundNumber}`}
          >
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6" />
              Round {roundNumber}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {courts.map((courtNumber) => {
                // Get games for this court in this round
                const courtGames = roundGames.filter(game => game.courtNumber === courtNumber);

                return (
                  <div key={`court-${roundNumber}-${courtNumber}`} className="space-y-4">
                    <h3 className="text-lg font-semibold text-muted-foreground">
                      Court {courtNumber}
                    </h3>
                    <AnimatePresence>
                      {courtGames.map((game) => (
                        <motion.div
                          key={`game-${game.id}`}
                          layoutId={`game-${game.id}`}
                          animate={lastUpdated === game.id ? {
                            scale: [1, 1.02, 1],
                            transition: { duration: 0.3 }
                          } : {}}
                        >
                          <Card className={cn(
                            "transition-shadow duration-200",
                            lastUpdated === game.id && "shadow-lg"
                          )}>
                            <CardContent className="pt-6">
                              <div className="flex flex-col space-y-4">
                                <motion.div 
                                  className="flex items-center justify-between"
                                  animate={lastUpdated === game.id ? { 
                                    backgroundColor: ["transparent", "rgba(var(--primary) / 0.1)", "transparent"],
                                    transition: { duration: 0.3 }
                                  } : {}}
                                >
                                  <div className="font-medium">
                                    {game.player1.name} & {game.player2.name}
                                  </div>
                                  <PointSelector
                                    maxPoints={pointSystem}
                                    value={(game.isComplete ? game.team1Score : scores[game.id]?.team1) || ""}
                                    onChange={(points) => handleScoreChange(game.id, 'team1', points)}
                                    disabled={updateScore.isPending}
                                  />
                                </motion.div>

                                <Separator className="my-2" />

                                <motion.div 
                                  className="flex items-center justify-between"
                                  animate={lastUpdated === game.id ? { 
                                    backgroundColor: ["transparent", "rgba(var(--primary) / 0.1)", "transparent"],
                                    transition: { duration: 0.3 }
                                  } : {}}
                                >
                                  <div className="font-medium">
                                    {game.player3.name} & {game.player4.name}
                                  </div>
                                  <PointSelector
                                    maxPoints={pointSystem}
                                    value={(game.isComplete ? game.team2Score : scores[game.id]?.team2) || ""}
                                    onChange={(points) => handleScoreChange(game.id, 'team2', points)}
                                    disabled={updateScore.isPending}
                                  />
                                </motion.div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}