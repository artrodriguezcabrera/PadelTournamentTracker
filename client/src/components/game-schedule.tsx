import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { type Game } from "@db/schema";
import PointSelector from "./point-selector";

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
      const response = await apiRequest("POST", `/api/games/${gameId}/score`, {
        team1Score,
        team2Score,
      });
      return response.json();
    },
    onMutate: async ({ gameId, team1Score, team2Score }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/tournaments/${tournamentId}`] });

      // Snapshot the previous tournament data
      const previousTournament = queryClient.getQueryData([`/api/tournaments/${tournamentId}`]);

      // Optimistically update tournament data
      queryClient.setQueryData([`/api/tournaments/${tournamentId}`], (old: any) => {
        const newGames = old.games.map((game: GameWithPlayers) =>
          game.id === gameId
            ? {
                ...game,
                team1Score,
                team2Score,
                isComplete: true,
              }
            : game
        );
        return { ...old, games: newGames };
      });

      return { previousTournament };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, revert back to the previous tournament data
      if (context?.previousTournament) {
        queryClient.setQueryData(
          [`/api/tournaments/${tournamentId}`],
          context.previousTournament
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're up to date
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

    // Automatically submit the score when both teams have scores
    updateScore.mutate({
      gameId,
      team1Score: team === 'team1' ? points : remainingPoints,
      team2Score: team === 'team2' ? points : remainingPoints,
    });
  };

  return (
    <div className="grid gap-4">
      {games.map((game) => (
        <Card key={game.id}>
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {game.player1.name} & {game.player2.name}
                </div>
                {game.isComplete ? (
                  <div className="text-xl font-bold">{game.team1Score}</div>
                ) : (
                  <PointSelector
                    maxPoints={pointSystem}
                    value={scores[game.id]?.team1 || ""}
                    onChange={(points) => handleScoreChange(game.id, 'team1', points)}
                    disabled={updateScore.isPending}
                  />
                )}
              </div>

              <Separator className="my-2" />

              <div className="flex items-center justify-between">
                <div className="font-medium">
                  {game.player3.name} & {game.player4.name}
                </div>
                {game.isComplete ? (
                  <div className="text-xl font-bold">{game.team2Score}</div>
                ) : (
                  <PointSelector
                    maxPoints={pointSystem}
                    value={scores[game.id]?.team2 || ""}
                    onChange={(points) => handleScoreChange(game.id, 'team2', points)}
                    disabled={updateScore.isPending}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}