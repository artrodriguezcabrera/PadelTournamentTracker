import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { calculateStandings } from "@/lib/tournament";
import { Trophy, Medal } from "lucide-react";

type StandingsTableProps = {
  games: Array<{
    id: number;
    player1Id: number;
    player2Id: number;
    player3Id: number;
    player4Id: number;
    team1Score: number | null;
    team2Score: number | null;
    isComplete: boolean;
  }>;
  players: Array<{
    playerId: number;
    player?: {
      id: number;
      name: string;
    };
  }>;
  pointSystem: number;
};

export default function StandingsTable({
  games,
  players,
  pointSystem,
}: StandingsTableProps) {
  const standings = calculateStandings(games, players, pointSystem);

  // Sort standings by total points descending
  const sortedStandings = [...standings].sort((a, b) => b.points - a.points);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">Games</TableHead>
            <TableHead className="text-center">Won</TableHead>
            <TableHead className="text-center">Tied</TableHead>
            <TableHead className="text-center">Lost</TableHead>
            <TableHead className="text-center">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStandings.map((standing, index) => (
            <TableRow key={standing.playerId}>
              <TableCell className="font-medium">
                <div className="flex items-center">
                  {index === 0 ? (
                    <Trophy className="h-4 w-4 text-yellow-500 mr-2" />
                  ) : index === 1 ? (
                    <Medal className="h-4 w-4 text-gray-400 mr-2" />
                  ) : index === 2 ? (
                    <Medal className="h-4 w-4 text-amber-600 mr-2" />
                  ) : (
                    index + 1
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">{standing.playerName}</TableCell>
              <TableCell className="text-center">{standing.gamesPlayed}</TableCell>
              <TableCell className="text-center text-green-600">
                {standing.wins}
              </TableCell>
              <TableCell className="text-center text-yellow-600">
                {standing.ties}
              </TableCell>
              <TableCell className="text-center text-red-600">
                {standing.losses}
              </TableCell>
              <TableCell className="text-center font-bold">
                {standing.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
