import { type Game, type Player } from "@db/schema";

type Standing = {
  playerId: number;
  playerName: string;
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  points: number;
};

export function calculateStandings(
  games: Game[] | undefined,
  players: Player[] | undefined,
  pointSystem: number
): Standing[] {
  if (!games || !players) {
    return [];
  }

  // Initialize standings for all players
  const standings: Record<number, Standing> = {};

  players.forEach((p) => {
    if (p && p.id) {
      standings[p.id] = {
        playerId: p.id,
        playerName: p.name,
        gamesPlayed: 0,
        wins: 0,
        ties: 0,
        losses: 0,
        points: 0,
      };
    }
  });

  // Process completed games
  games.forEach((game) => {
    if (!game.isComplete || game.team1Score === null || game.team2Score === null) {
      return;
    }

    // Team 1 players
    const team1Players = [game.player1Id, game.player2Id];
    // Team 2 players
    const team2Players = [game.player3Id, game.player4Id];

    // Update games played
    [...team1Players, ...team2Players].forEach((playerId) => {
      if (playerId && standings[playerId]) {
        standings[playerId].gamesPlayed++;
      }
    });

    // Calculate points based on the point system and score ratio
    const team1Points = Math.round((game.team1Score / (game.team1Score + game.team2Score)) * pointSystem);
    const team2Points = pointSystem - team1Points;

    // Update wins, ties, losses and points
    if (game.team1Score > game.team2Score) {
      // Team 1 wins
      team1Players.forEach((playerId) => {
        if (playerId && standings[playerId]) {
          standings[playerId].wins++;
          standings[playerId].points += team1Points;
        }
      });
      team2Players.forEach((playerId) => {
        if (playerId && standings[playerId]) {
          standings[playerId].losses++;
          standings[playerId].points += team2Points;
        }
      });
    } else if (game.team1Score < game.team2Score) {
      // Team 2 wins
      team1Players.forEach((playerId) => {
        if (playerId && standings[playerId]) {
          standings[playerId].losses++;
          standings[playerId].points += team1Points;
        }
      });
      team2Players.forEach((playerId) => {
        if (playerId && standings[playerId]) {
          standings[playerId].wins++;
          standings[playerId].points += team2Points;
        }
      });
    } else {
      // Tie - split points evenly
      const tiePoints = pointSystem / 2;
      [...team1Players, ...team2Players].forEach((playerId) => {
        if (playerId && standings[playerId]) {
          standings[playerId].ties++;
          standings[playerId].points += tiePoints;
        }
      });
    }
  });

  return Object.values(standings);
}