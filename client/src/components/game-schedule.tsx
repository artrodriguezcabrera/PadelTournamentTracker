import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { type Game } from "@db/schema";

type GameWithPlayers = Game & {
  player1: { name: string };
  player2: { name: string };
  player3: { name: string };
  player4: { name: string };
};

type GameScheduleProps = {
  tournamentId: number;
  games: GameWithPlayers[];
};

export default function GameSchedule({ tournamentId, games }: GameScheduleProps) {
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
      await apiRequest("POST", `/api/games/${gameId}/score`, {
        team1Score,
        team2Score,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/tournaments/${tournamentId}`],
      });
    },
  });

  const handleScoreSubmit = (gameId: number) => {
    const gameScores = scores[gameId];
    if (!gameScores) return;

    const team1Score = parseInt(gameScores.team1);
    const team2Score = parseInt(gameScores.team2);

    if (isNaN(team1Score) || isNaN(team2Score)) return;

    updateScore.mutate({ gameId, team1Score, team2Score });
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Score"
                      className="w-20"
                      value={scores[game.id]?.team1 || ""}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [game.id]: {
                            ...scores[game.id],
                            team1: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Score"
                      className="w-20"
                      value={scores[game.id]?.team2 || ""}
                      onChange={(e) =>
                        setScores({
                          ...scores,
                          [game.id]: {
                            ...scores[game.id],
                            team2: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {!game.isComplete && (
                <Button
                  onClick={() => handleScoreSubmit(game.id)}
                  disabled={updateScore.isPending}
                  className="w-full mt-2"
                >
                  Submit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}