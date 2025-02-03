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
import { type Game, type Player } from "@db/schema";
import { cn } from "@/lib/utils";

type TournamentPlayer = {
  playerId: number;
  player: Player;
};

type StandingsTableProps = {
  games: Game[];
  players: TournamentPlayer[];
  pointSystem: number;
};

export default function StandingsTable({
  games,
  players,
  pointSystem,
}: StandingsTableProps) {
  // Convert tournament players to the format expected by calculateStandings
  const formattedPlayers = players.map(tp => ({
    id: tp.playerId,
    name: tp.player.name
  }));
  const standings = calculateStandings(games, formattedPlayers, pointSystem);

  // Sort standings by points first, then wins, then point difference
  const sortedStandings = [...standings].sort((a, b) => {
    // Compare points first
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    // If points are equal, compare wins
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    // If wins are equal, compare point difference
    return b.pointDifference - a.pointDifference;
  });

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
            <TableHead className="text-center">+/-</TableHead>
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
              <TableCell className={cn(
                "text-center font-medium",
                standing.pointDifference > 0 ? "text-green-600" : 
                standing.pointDifference < 0 ? "text-red-600" : ""
              )}>
                {standing.pointDifference > 0 ? "+" : ""}{standing.pointDifference}
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