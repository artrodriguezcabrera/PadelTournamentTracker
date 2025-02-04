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
    if (!playerIds || playerIds.length < 4) {
      res.status(400).json({ message: "At least 4 players are required for a tournament" });
      return;
    }

    // Create tournament with players
    const newTournament = await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({ name, pointSystem, courts })
        .returning();

      // Insert tournament players
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

  app.patch("/api/tournaments/:id", async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { name, pointSystem, courts } = req.body;

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    if (tournament.isActive) {
      res.status(400).json({ message: "Cannot modify an active tournament" });
      return;
    }

    const updatedTournament = await db
      .update(tournaments)
      .set({ name, pointSystem, courts })
      .where(eq(tournaments.id, tournamentId))
      .returning();

    res.json(updatedTournament[0]);
  });

  app.delete("/api/tournaments/:id", async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    await db.transaction(async (tx) => {
      // Delete tournament players first due to foreign key constraint
      await tx
        .delete(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tournamentId));

      // Delete tournament games
      await tx
        .delete(games)
        .where(eq(games.tournamentId, tournamentId));

      // Delete tournament
      await tx
        .delete(tournaments)
        .where(eq(tournaments.id, tournamentId));
    });

    res.json({ message: "Tournament deleted successfully" });
  });

  app.post("/api/tournaments/:id/start", async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    try {
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
        return res.status(404).json({ message: "Tournament not found" });
      }

      // Filter out any null values and ensure we have valid player IDs
      const playerIds = tournamentData.tournamentPlayers
        .map(tp => tp.playerId)
        .filter((id): id is number => id !== null);

      if (playerIds.length < 4) {
        return res.status(400).json({ 
          message: "Not enough players to start tournament. Minimum 4 players required.",
          currentPlayers: playerIds.length
        });
      }

      console.log(`Starting tournament ${tournamentId} with ${playerIds.length} players`);
      console.log("Player IDs:", playerIds);

      try {
        const gameMatches = generateGameMatchesWithCourts(playerIds, tournamentData.courts);

        if (!gameMatches || gameMatches.length === 0) {
          return res.status(400).json({ 
            message: "Could not generate valid game matches. Please ensure you have enough players and try again.",
            error: "No valid matches could be generated",
            playerCount: playerIds.length,
            courts: tournamentData.courts
          });
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

          console.log("Creating games:", gameValues);

          if (gameValues.length > 0) {
            await tx.insert(games).values(gameValues);
          }
        });

        return res.json({
          message: "Tournament started successfully",
          gamesGenerated: gameMatches.length,
          rounds: Math.max(...gameMatches.map(m => m.round)),
          games: gameMatches
        });
      } catch (error) {
        console.error("Error generating game matches:", error);
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Failed to generate game matches",
          playerCount: playerIds.length,
          courts: tournamentData.courts
        });
      }
    } catch (error) {
      console.error("Error starting tournament:", error);
      return res.status(500).json({
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
  const playerGamesCount = new Map<number, number>();
  const usedPairings = new Set<string>();
  let round = 1;
  const maxGamesPerPlayer = 8;
  const maxAttempts = 100;
  let attempts = 0;

  // Initialize game counts
  playerIds.forEach(id => playerGamesCount.set(id, 0));

  // Get pairing key for tracking partnerships
  const getPairingKey = (p1: number, p2: number) =>
    [p1, p2].sort((a, b) => a - b).join(',');

  while (attempts < maxAttempts) {
    attempts++;

    // Check if all players have played maximum games
    const allPlayersMaxedOut = Array.from(playerGamesCount.values())
      .every(count => count >= maxGamesPerPlayer);

    if (allPlayersMaxedOut) {
      console.log("All players have completed maximum games");
      break;
    }

    // Track players used in this round
    const playersUsedInRound = new Set<number>();
    let roundMatches = [];
    let retryCount = 0;
    const maxRetries = 3; // Allow multiple attempts to fill all courts

    // Keep trying to fill all courts until we succeed or exhaust retries
    while (roundMatches.length < numCourts && retryCount < maxRetries) {
      for (let court = 1; court <= numCourts; court++) {
        // Skip if we already have a match for this court
        if (roundMatches.some(m => m.court === court)) {
          continue;
        }

        // Get available players for this match
        const availablePlayers = playerIds
          .filter(id => 
            !playersUsedInRound.has(id) && 
            (playerGamesCount.get(id) || 0) < maxGamesPerPlayer
          )
          .sort((a, b) => (playerGamesCount.get(a) || 0) - (playerGamesCount.get(b) || 0));

        if (availablePlayers.length < 4) {
          break; // Not enough players for another match
        }

        const match = createValidMatch(
          availablePlayers,
          usedPairings,
          getPairingKey
        );

        if (match) {
          // Mark players as used for this round
          match.forEach(id => playersUsedInRound.add(id));

          // Add to round matches
          roundMatches.push({
            players: match,
            round,
            court
          });
        }
      }

      // If we couldn't fill all courts, increment retry counter
      if (roundMatches.length < numCourts) {
        retryCount++;
      }
    }

    // If we couldn't create any matches for this round, we're done
    if (roundMatches.length === 0) {
      console.log("Could not create any matches in round", round);
      break;
    }

    // Process all matches for this round
    roundMatches.forEach(match => {
      // Record partnerships
      usedPairings.add(getPairingKey(match.players[0], match.players[1]));
      usedPairings.add(getPairingKey(match.players[2], match.players[3]));

      // Update game counts
      match.players.forEach(id => {
        playerGamesCount.set(id, (playerGamesCount.get(id) || 0) + 1);
      });

      // Add to final schedule
      matches.push(match);
    });

    console.log(`Round ${round}: Created ${roundMatches.length} matches`);
    round++;
  }

  if (matches.length === 0) {
    throw new Error("Could not generate any valid matches");
  }

  // Sort matches first by round, then by court number
  return matches.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.court - b.court;
  });
}

// Helper function to create a valid match
function createValidMatch(
  availablePlayers: number[],
  usedPairings: Set<string>,
  getPairingKey: (p1: number, p2: number) => string
): number[] | null {
  for (let i = 0; i < availablePlayers.length - 3; i++) {
    for (let j = i + 1; j < availablePlayers.length - 2; j++) {
      // Check if first pair has played together
      if (usedPairings.has(getPairingKey(availablePlayers[i], availablePlayers[j]))) {
        continue;
      }

      for (let k = j + 1; k < availablePlayers.length - 1; k++) {
        for (let l = k + 1; l < availablePlayers.length; l++) {
          // Check if second pair has played together
          if (usedPairings.has(getPairingKey(availablePlayers[k], availablePlayers[l]))) {
            continue;
          }

          // Return valid match
          return [
            availablePlayers[i],
            availablePlayers[j],
            availablePlayers[k],
            availablePlayers[l]
          ];
        }
      }
    }
  }

  return null;
}

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