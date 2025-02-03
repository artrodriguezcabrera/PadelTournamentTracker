import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { tournaments, players, games, tournamentPlayers } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Player routes
  app.get("/api/players", async (req, res) => {
    const allPlayers = await db.query.players.findMany();
    res.json(allPlayers);
  });

  app.post("/api/players", async (req, res) => {
    const { name } = req.body;
    const newPlayer = await db.insert(players).values({ name }).returning();
    res.json(newPlayer[0]);
  });

  app.patch("/api/players/:id", async (req, res) => {
    const { name } = req.body;
    const playerId = parseInt(req.params.id);

    const updatedPlayer = await db
      .update(players)
      .set({ name })
      .where(eq(players.id, playerId))
      .returning();

    if (updatedPlayer.length === 0) {
      res.status(404).json({ message: "Player not found" });
      return;
    }

    res.json(updatedPlayer[0]);
  });

  app.delete("/api/players/:id", async (req, res) => {
    const playerId = parseInt(req.params.id);

    // Check if player is part of any tournament
    const playerTournaments = await db.query.tournamentPlayers.findMany({
      where: eq(tournamentPlayers.playerId, playerId),
    });

    if (playerTournaments.length > 0) {
      res.status(400).json({
        message: "Cannot delete player that is part of a tournament"
      });
      return;
    }

    await db.delete(players).where(eq(players.id, playerId));
    res.json({ message: "Player deleted successfully" });
  });

  // Tournament routes
  app.get("/api/tournaments", async (req, res) => {
    const allTournaments = await db.query.tournaments.findMany({
      with: {
        tournamentPlayers: {
          with: {
            player: true,
          },
        },
      },
    });
    res.json(allTournaments);
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, parseInt(req.params.id)),
      with: {
        tournamentPlayers: {
          with: {
            player: true,
          },
        },
        games: {
          with: {
            player1: true,
            player2: true,
            player3: true,
            player4: true,
          },
        },
      },
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }
    res.json(tournament);
  });

  app.post("/api/tournaments", async (req, res) => {
    const { name, pointSystem, courts, playerIds } = req.body;

    // Ensure we have at least 4 players
    if (playerIds.length < 4) {
      res.status(400).json({ message: "At least 4 players are required for a tournament" });
      return;
    }

    const newTournament = await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({ name, pointSystem, courts })
        .returning();

      await tx.insert(tournamentPlayers).values(
        playerIds.map((playerId: number) => ({
          tournamentId: tournament.id,
          playerId,
        }))
      );

      return tournament;
    });

    res.json(newTournament);
  });

  app.post("/api/tournaments/:id/start", async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const tournamentData = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: {
        tournamentPlayers: {
          with: {
            player: true,
          },
        },
      },
    });

    if (!tournamentData) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    // Filter out any null values and ensure we have valid player IDs
    const playerIds = tournamentData.tournamentPlayers
      .map(tp => tp.playerId)
      .filter((id): id is number => id !== null);

    if (playerIds.length < 4) {
      res.status(400).json({ message: "Not enough players to start tournament" });
      return;
    }

    try {
      const gameMatches = generateGameMatchesWithCourts(playerIds, tournamentData.courts);
      console.log("Generated matches:", gameMatches); // Add logging

      if (!gameMatches || gameMatches.length === 0) {
        res.status(400).json({ message: "Could not generate valid game matches. Please ensure you have enough players and try again." });
        return;
      }

      await db.transaction(async (tx) => {
        // Set tournament to active
        await tx
          .update(tournaments)
          .set({ isActive: true })
          .where(eq(tournaments.id, tournamentId));

        // Create games for each match
        const gameValues = gameMatches.map(match => ({
          tournamentId,
          roundNumber: match.round,
          courtNumber: match.court,
          player1Id: match.players[0],
          player2Id: match.players[1],
          player3Id: match.players[2],
          player4Id: match.players[3],
        }));

        console.log("Creating games:", gameValues); // Add logging

        if (gameValues.length > 0) {
          await tx.insert(games).values(gameValues);
        }
      });

      res.json({
        message: "Tournament started successfully",
        gamesGenerated: gameMatches.length,
        games: gameMatches
      });
    } catch (error) {
      console.error("Error starting tournament:", error);
      res.status(500).json({
        message: "Failed to start tournament",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.patch("/api/tournaments/:id/players", async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { playerIds } = req.body;

    // Ensure we have at least 4 players
    if (playerIds.length < 4) {
      res.status(400).json({ message: "At least 4 players are required for a tournament" });
      return;
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    if (tournament.isActive) {
      res.status(400).json({ message: "Cannot modify players in an active tournament" });
      return;
    }

    await db.transaction(async (tx) => {
      // Delete existing tournament players
      await tx
        .delete(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tournamentId));

      // Insert new tournament players
      await tx.insert(tournamentPlayers).values(
        playerIds.map((playerId: number) => ({
          tournamentId,
          playerId,
        }))
      );
    });

    res.json({ message: "Tournament players updated successfully" });
  });

  app.post("/api/games/:id/score", async (req, res) => {
    const { team1Score, team2Score } = req.body;
    const gameId = parseInt(req.params.id);

    const updatedGame = await db
      .update(games)
      .set({
        team1Score,
        team2Score,
        isComplete: true,
      })
      .where(eq(games.id, gameId))
      .returning();

    res.json(updatedGame[0]);
  });

  return httpServer;
}

type Match = {
  players: number[];
  round: number;
  court: number;
};

function generateGameMatchesWithCourts(playerIds: number[], numCourts: number): Match[] {
  if (playerIds.length < 4) {
    throw new Error("Not enough players to generate matches");
  }

  const matches: Match[] = [];
  const gamesPerPlayer = 8; // Each player must play 8 games
  let round = 1;

  // Initialize tracking structures
  const usedPairings = new Set<string>();
  const playerGamesInRound = new Map<number, boolean>();
  const playerGameCounts = new Map<number, number>();

  // Initialize game counts
  playerIds.forEach(id => playerGameCounts.set(id, 0));

  // Track partnerships
  const getPairingKey = (p1: number, p2: number) => 
    [p1, p2].sort((a, b) => a - b).join(',');

  const hasPairingBeenUsed = (p1: number, p2: number) => 
    usedPairings.has(getPairingKey(p1, p2));

  const markPairingUsed = (p1: number, p2: number) => 
    usedPairings.add(getPairingKey(p1, p2));

  const incrementPlayerGames = (players: number[]) => {
    players.forEach(id => {
      playerGameCounts.set(id, (playerGameCounts.get(id) || 0) + 1);
    });
  };

  const findValidTeamCombination = (availablePlayers: number[]): number[] | null => {
    // Sort players by number of games played
    const players = [...availablePlayers].sort((a, b) => 
      (playerGameCounts.get(a) || 0) - (playerGameCounts.get(b) || 0)
    );

    // Try to find valid combinations prioritizing players with fewer games
    for (let i = 0; i < players.length - 3; i++) {
      const player1Games = playerGameCounts.get(players[i]) || 0;
      if (player1Games >= gamesPerPlayer) continue;

      for (let j = i + 1; j < players.length - 2; j++) {
        const player2Games = playerGameCounts.get(players[j]) || 0;
        if (player2Games >= gamesPerPlayer) continue;
        if (hasPairingBeenUsed(players[i], players[j])) continue;

        for (let k = j + 1; k < players.length - 1; k++) {
          const player3Games = playerGameCounts.get(players[k]) || 0;
          if (player3Games >= gamesPerPlayer) continue;

          for (let l = k + 1; l < players.length; l++) {
            const player4Games = playerGameCounts.get(players[l]) || 0;
            if (player4Games >= gamesPerPlayer) continue;
            if (!hasPairingBeenUsed(players[k], players[l])) {
              return [players[i], players[j], players[k], players[l]];
            }
          }
        }
      }
    }
    return null;
  };

  console.log(`Starting generation for ${playerIds.length} players, target ${gamesPerPlayer} games per player`);

  // Keep generating rounds until all players have played their required games
  while (true) {
    console.log(`Generating round ${round}`);
    console.log("Current game counts:", Object.fromEntries(playerGameCounts));

    // Check if all players have played their required games
    const allPlayersComplete = Array.from(playerGameCounts.entries()).every(
      ([_, games]) => games >= gamesPerPlayer
    );

    if (allPlayersComplete) {
      console.log("All players have completed their required games");
      break;
    }

    // Reset round-specific tracking
    playerGamesInRound.clear();
    const roundMatches: Match[] = [];

    // Must fill all courts in each round
    let courtsFilled = 0;
    for (let court = 1; court <= numCourts; court++) {
      // Get available players for this game (not played this round and haven't reached max games)
      const availablePlayers = playerIds.filter(id => 
        !playerGamesInRound.get(id) && 
        (playerGameCounts.get(id) || 0) < gamesPerPlayer
      );

      if (availablePlayers.length < 4) {
        console.log(`Not enough available players for court ${court} in round ${round}`);
        continue;
      }

      // Find valid team combinations
      const team = findValidTeamCombination(availablePlayers);

      if (team) {
        console.log(`Found valid team for round ${round}, court ${court}:`, team);
        // Mark partnerships and update tracking
        markPairingUsed(team[0], team[1]);
        markPairingUsed(team[2], team[3]);
        team.forEach(id => playerGamesInRound.set(id, true));
        incrementPlayerGames(team);

        roundMatches.push({
          players: team,
          round,
          court,
        });
        courtsFilled++;
      } else {
        console.log(`Could not find valid team for court ${court} in round ${round}`);
      }
    }

    // Only accept rounds where all courts were used
    if (courtsFilled === numCourts) {
      matches.push(...roundMatches);
      round++;
      console.log(`Successfully added ${roundMatches.length} matches for round ${round-1}`);
    } else {
      console.log(`Failed to fill all courts in round ${round}, retrying with different combinations`);
      // Reset any partnerships and game counts from this incomplete round
      roundMatches.forEach(match => {
        const [p1, p2, p3, p4] = match.players;
        usedPairings.delete(getPairingKey(p1, p2));
        usedPairings.delete(getPairingKey(p3, p4));
        match.players.forEach(id => {
          playerGameCounts.set(id, (playerGameCounts.get(id) || 0) - 1);
        });
      });
    }

    // Prevent infinite loops
    if (round > 100) {
      console.log("Could not generate a valid schedule after 100 rounds");
      return [];
    }
  }

  console.log("Final game counts:", Object.fromEntries(playerGameCounts));
  console.log(`Generation complete. Total matches: ${matches.length}`);

  return matches;
}

// Helper function to generate all possible team combinations for 4 players
function generatePossibleTeamCombinations(players: number[]): number[][] {
  if (players.length < 4) return [];

  const combinations: number[][] = [];
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      for (let k = 0; k < players.length; k++) {
        if (k === i || k === j) continue;
        for (let l = k + 1; l < players.length; l++) {
          if (l === i || l === j) continue;
          combinations.push([players[i], players[j], players[k], players[l]]);
        }
      }
    }
  }
  return combinations;
}

function repairSchedule(
  matches: Match[],
  playerIds: number[],
  usedPairings: Set<string>,
  playerGameCounts: Map<number, number>,
  requiredRounds: number
): boolean {
  // Implementation of schedule repair logic
  // This is a placeholder that always returns true for now
  return true;
}

function validateSchedule(
  matches: Match[],
  playerIds: number[],
  requiredRounds: number
): boolean {
  // Check if we have the correct number of rounds
  const rounds = new Set(matches.map(m => m.round));
  if (rounds.size !== requiredRounds) return false;

  // Check if each player plays at least once per round
  for (const round of rounds) {
    const playersInRound = new Set<number>();
    matches
      .filter(m => m.round === round)
      .forEach(m => m.players.forEach(p => playersInRound.add(p)));

    if (playersInRound.size < Math.floor(playerIds.length / 2) * 4) return false;
  }

  return true;
}