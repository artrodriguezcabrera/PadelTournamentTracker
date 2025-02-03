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
  let round = 1;
  const usedPairings = new Set<string>();
  const playerGameCounts = new Map<number, number>();

  // Initialize game counts for all players
  playerIds.forEach(id => playerGameCounts.set(id, 0));

  // Function to check if a pairing has been used
  const hasPairingBeenUsed = (player1: number, player2: number) => {
    const key = [player1, player2].sort((a, b) => a - b).join(',');
    return usedPairings.has(key);
  };

  // Function to mark a pairing as used
  const markPairingUsed = (player1: number, player2: number) => {
    const key = [player1, player2].sort((a, b) => a - b).join(',');
    usedPairings.add(key);
  };

  // Function to increment game count for players
  const incrementPlayerGames = (players: number[]) => {
    players.forEach(playerId => {
      playerGameCounts.set(playerId, (playerGameCounts.get(playerId) || 0) + 1);
    });
  };

  // Keep generating rounds until we can't make more valid matches
  let consecutiveFailedAttempts = 0;
  const maxFailedAttempts = 10; // Increased to allow more attempts for finding valid combinations

  while (consecutiveFailedAttempts < maxFailedAttempts) {
    const availablePlayers = new Set(playerIds);
    const roundMatches: Match[] = [];
    let matchesInRound = 0;

    // Try to create matches for each court
    for (let court = 1; court <= numCourts && availablePlayers.size >= 4; court++) {
      let validMatch = false;
      let attempts = 0;
      const maxAttempts = 100; // Increased attempts to find better combinations

      while (!validMatch && attempts < maxAttempts && availablePlayers.size >= 4) {
        attempts++;

        // Sort players by number of games played to prioritize those with fewer games
        const playerArray = Array.from(availablePlayers)
          .sort((a, b) => {
            const aGames = playerGameCounts.get(a) || 0;
            const bGames = playerGameCounts.get(b) || 0;
            return aGames - bGames;
          });

        // Take the first 4 players
        const selectedPlayers = playerArray.slice(0, 4);

        if (selectedPlayers.length === 4) {
          // Try different team combinations to find one that hasn't played together
          const combinations = generatePossibleTeamCombinations(selectedPlayers);

          for (const combo of combinations) {
            const team1HasPlayedTogether = hasPairingBeenUsed(combo[0], combo[1]);
            const team2HasPlayedTogether = hasPairingBeenUsed(combo[2], combo[3]);

            if (!team1HasPlayedTogether && !team2HasPlayedTogether) {
              markPairingUsed(combo[0], combo[1]);
              markPairingUsed(combo[2], combo[3]);
              incrementPlayerGames(combo);

              // Remove these players from available pool
              combo.forEach(p => availablePlayers.delete(p));

              roundMatches.push({
                players: combo,
                round,
                court,
              });

              validMatch = true;
              matchesInRound++;
              break;
            }
          }
        }
      }
    }

    if (matchesInRound === 0) {
      consecutiveFailedAttempts++;
    } else {
      consecutiveFailedAttempts = 0;
      matches.push(...roundMatches);
      round++;
    }

    // Check if we have achieved all possible pairings
    const totalPairs = new Set<string>();
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        totalPairs.add([playerIds[i], playerIds[j]].sort((a, b) => a - b).join(','));
      }
    }

    // If we've used all possible pairings, we can stop
    let allPairingsUsed = true;
    totalPairs.forEach(pair => {
      if (!usedPairings.has(pair)) {
        allPairingsUsed = false;
      }
    });

    if (allPairingsUsed) {
      break;
    }
  }

  // Verify that games are balanced
  const gameCounts = Array.from(playerGameCounts.values());
  const minGames = Math.min(...gameCounts);
  const maxGames = Math.max(...gameCounts);

  // Strict balance check - maximum 1 game difference
  if (maxGames - minGames > 1) {
    return [];
  }

  return matches;
}

// Helper function to generate all possible team combinations for 4 players
function generatePossibleTeamCombinations(players: number[]): number[][] {
  return [
    [players[0], players[1], players[2], players[3]],
    [players[0], players[2], players[1], players[3]],
    [players[0], players[3], players[1], players[2]],
    [players[1], players[2], players[0], players[3]],
    [players[1], players[3], players[0], players[2]],
    [players[2], players[3], players[0], players[1]]
  ];
}