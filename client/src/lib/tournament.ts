type Game = {
  id: number;
  player1Id: number;
  player2Id: number;
  player3Id: number;
  player4Id: number;
  team1Score: number | null;
  team2Score: number | null;
  isComplete: boolean;
};

type Player = {
  playerId: number;
  player?: {
    id: number;
    name: string;
  };
};

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
  games: Game[],
  players: Player[],
  pointSystem: number
): Standing[] {
  // Initialize standings for all players
  const standings: Record<number, Standing> = {};
  
  players.forEach((p) => {
    if (p.player) {
      standings[p.playerId] = {
        playerId: p.playerId,
        playerName: p.player.name,
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
      if (standings[playerId]) {
        standings[playerId].gamesPlayed++;
      }
    });

    // Update wins, ties, losses
    if (game.team1Score > game.team2Score) {
      // Team 1 wins
      team1Players.forEach((playerId) => {
        if (standings[playerId]) {
          standings[playerId].wins++;
          standings[playerId].points += game.team1Score;
        }
      });
      team2Players.forEach((playerId) => {
        if (standings[playerId]) {
          standings[playerId].losses++;
          standings[playerId].points += game.team2Score;
        }
      });
    } else if (game.team1Score < game.team2Score) {
      // Team 2 wins
      team1Players.forEach((playerId) => {
        if (standings[playerId]) {
          standings[playerId].losses++;
          standings[playerId].points += game.team1Score;
        }
      });
      team2Players.forEach((playerId) => {
        if (standings[playerId]) {
          standings[playerId].wins++;
          standings[playerId].points += game.team2Score;
        }
      });
    } else {
      // Tie
      [...team1Players, ...team2Players].forEach((playerId) => {
        if (standings[playerId]) {
          standings[playerId].ties++;
          standings[playerId].points += game.team1Score;
        }
      });
    }
  });

  return Object.values(standings);
}
