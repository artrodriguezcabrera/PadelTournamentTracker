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
    const gameMatches = generateGameMatchesWithCourts(playerIds, tournamentData.courts);

    await db.transaction(async (tx) => {
      await tx
        .update(tournaments)
        .set({ isActive: true })
        .where(eq(tournaments.id, tournamentId));

      await tx.insert(games).values(
        gameMatches.map(match => ({
          tournamentId,
          roundNumber: match.round,
          courtNumber: match.court,
          player1Id: match.players[0],
          player2Id: match.players[1],
          player3Id: match.players[2],
          player4Id: match.players[3],
        }))
      );
    });

    res.json({ message: "Tournament started" });
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
  const usedCombinations = new Set<string>();
  const partnerships = new Map<string, boolean>();

  // Initialize all possible partnerships as unused
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      partnerships.set(`${playerIds[i]},${playerIds[j]}`, false);
    }
  }

  // Function to check if a partnership has been used
  const hasPartnershipBeenUsed = (player1: number, player2: number) => {
    const key = [player1, player2].sort((a, b) => a - b).join(',');
    return partnerships.get(key);
  };

  // Function to mark a partnership as used
  const markPartnershipUsed = (player1: number, player2: number) => {
    const key = [player1, player2].sort((a, b) => a - b).join(',');
    partnerships.set(key, true);
  };

  // Function to check if all partnerships have been used
  const allPartnershipsUsed = () => {
    return Array.from(partnerships.values()).every(used => used);
  };

  // Keep generating rounds until all partnerships have been used
  while (!allPartnershipsUsed() && round <= 20) { // Limit to 20 rounds as safety
    const availablePlayers = new Set(playerIds);
    const roundMatches: Match[] = [];

    // For each court in this round
    for (let court = 1; court <= numCourts && availablePlayers.size >= 4; court++) {
      let bestMatch: number[] | null = null;
      let bestScore = -1;

      // Try to find the best match with unused partnerships
      for (let attempts = 0; attempts < 50 && !bestMatch; attempts++) {
        const players = Array.from(availablePlayers)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        if (players.length === 4) {
          // Calculate score based on number of unused partnerships
          let score = 0;
          // Check partnerships within team 1 (0,1)
          if (!hasPartnershipBeenUsed(players[0], players[1])) score++;
          // Check partnerships within team 2 (2,3)
          if (!hasPartnershipBeenUsed(players[2], players[3])) score++;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = players;
          }
        }
      }

      if (bestMatch) {
        // Mark partnerships as used
        markPartnershipUsed(bestMatch[0], bestMatch[1]); // Team 1
        markPartnershipUsed(bestMatch[2], bestMatch[3]); // Team 2

        // Remove used players from available pool
        bestMatch.forEach(p => availablePlayers.delete(p));

        roundMatches.push({
          players: bestMatch,
          round,
          court,
        });
      }
    }

    // If we couldn't generate any matches for this round, we're done
    if (roundMatches.length === 0) {
      break;
    }

    matches.push(...roundMatches);
    round++;
  }

  return matches;
}