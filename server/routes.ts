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

    // Generate all possible game combinations with court assignments
    const playerIds = tournamentData.tournamentPlayers.map(tp => tp.playerId);

    try {
      const gameMatches = generateGameMatchesWithCourts(playerIds, tournamentData.courts);

      if (gameMatches.length === 0) {
        res.status(400).json({ message: "Could not generate valid game matches" });
        return;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(tournaments)
          .set({ isActive: true })
          .where(eq(tournaments.id, tournamentId));

        const gameValues = gameMatches.map(match => ({
          tournamentId,
          roundNumber: match.round,
          courtNumber: match.court,
          player1Id: match.players[0],
          player2Id: match.players[1],
          player3Id: match.players[2],
          player4Id: match.players[3],
        }));

        if (gameValues.length > 0) {
          await tx.insert(games).values(gameValues);
        }
      });

      res.json({ message: "Tournament started successfully", gamesGenerated: gameMatches.length });
    } catch (error) {
      console.error("Error starting tournament:", error);
      res.status(500).json({ message: "Failed to start tournament" });
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

    // Function to check if adding these players would create imbalance
    const wouldCreateImbalance = (players: number[]) => {
      const currentMax = Math.max(...Array.from(playerGameCounts.values()));
      const currentMin = Math.min(...Array.from(playerGameCounts.values()));
      // Allow up to 1 game difference while generating, but not in the final result
      return players.some(playerId => 
        (playerGameCounts.get(playerId) || 0) + 1 > currentMin + 1
      );
    };

    // Function to check if we can create a complete round
    const canCreateCompleteRound = (availablePlayers: Set<number>) => {
      // For a complete round, we need enough players for all courts
      const playersNeeded = numCourts * 4;
      return availablePlayers.size >= playersNeeded;
    };

    // Keep generating rounds until we can't make more balanced matches
    while (round <= 10) { // Limit to 10 rounds as safety
      const availablePlayers = new Set(playerIds);
      const roundMatches: Match[] = [];
      let validRound = false;

      // Only proceed with this round if we can make it complete
      if (!canCreateCompleteRound(availablePlayers)) {
        break;
      }

      // For each court in this round
      for (let court = 1; court <= numCourts && availablePlayers.size >= 4; court++) {
        let validMatch = false;

        // Try to find a valid match with unused pairings
        for (let attempts = 0; attempts < 20 && !validMatch; attempts++) {
          // Randomly select 4 players
          const selectedPlayers = Array.from(availablePlayers)
            .sort(() => Math.random() - 0.5)
            .slice(0, 4);

          if (selectedPlayers.length === 4) {
            // Check if this match would create imbalance
            if (wouldCreateImbalance(selectedPlayers)) {
              continue;
            }

            // Create teams: (0,1) vs (2,3)
            const team1HasPlayedTogether = hasPairingBeenUsed(selectedPlayers[0], selectedPlayers[1]);
            const team2HasPlayedTogether = hasPairingBeenUsed(selectedPlayers[2], selectedPlayers[3]);

            // Allow the match if at least one team has not played together
            if (!team1HasPlayedTogether || !team2HasPlayedTogether) {
              if (!team1HasPlayedTogether) {
                markPairingUsed(selectedPlayers[0], selectedPlayers[1]);
              }
              if (!team2HasPlayedTogether) {
                markPairingUsed(selectedPlayers[2], selectedPlayers[3]);
              }
              incrementPlayerGames(selectedPlayers);

              // Remove these players from available pool
              selectedPlayers.forEach(p => availablePlayers.delete(p));

              roundMatches.push({
                players: selectedPlayers,
                round,
                court,
              });
              validMatch = true;
              validRound = true;
            }
          }
        }
      }

      // If we couldn't generate valid matches for this round, we're done
      if (!validRound || roundMatches.length < numCourts) {
          // Remove the incomplete round's matches from player counts
          roundMatches.forEach(match => {
            match.players.forEach(playerId => {
                playerGameCounts.set(playerId, (playerGameCounts.get(playerId) || 1) - 1);
            });
        });
        break;
      }

      matches.push(...roundMatches);
      round++;
    }

    // Verify that all players have the same number of games
    const gameCounts = new Set(Array.from(playerGameCounts.values()));
    if (gameCounts.size > 1) {
      // If games are not balanced, return no matches to trigger regeneration
      return [];
    }

    return matches;
  }