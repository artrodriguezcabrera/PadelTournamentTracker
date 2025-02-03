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
    const { name, pointSystem, playerIds } = req.body;

    // Ensure we have at least 4 players
    if (playerIds.length < 4) {
      res.status(400).json({ message: "At least 4 players are required for a tournament" });
      return;
    }

    const newTournament = await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({ name, pointSystem })
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

    // Generate all possible game combinations
    const playerIds = tournamentData.tournamentPlayers.map(tp => tp.player.id);
    const gameMatches = generateGameMatches(playerIds);

    await db.transaction(async (tx) => {
      await tx
        .update(tournaments)
        .set({ isActive: true })
        .where(eq(tournaments.id, tournamentId));

      await tx.insert(games).values(
        gameMatches.map(match => ({
          tournamentId,
          player1Id: match[0],
          player2Id: match[1],
          player3Id: match[2],
          player4Id: match[3],
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

function generateGameMatches(playerIds: number[]): number[][] {
  if (playerIds.length < 4) {
    throw new Error("Not enough players to generate matches");
  }

  const matches: number[][] = [];
  const n = playerIds.length;

  // Generate all possible combinations of 4 players
  // This ensures each player gets to play with and against every other player
  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      for (let k = j + 1; k < n - 1; k++) {
        for (let l = k + 1; l < n; l++) {
          // Create all possible team combinations for these 4 players
          // (i,j) vs (k,l)
          matches.push([playerIds[i], playerIds[j], playerIds[k], playerIds[l]]);
          // (i,k) vs (j,l)
          matches.push([playerIds[i], playerIds[k], playerIds[j], playerIds[l]]);
          // (i,l) vs (j,k)
          matches.push([playerIds[i], playerIds[l], playerIds[j], playerIds[k]]);
        }
      }
    }
  }

  return matches;
}