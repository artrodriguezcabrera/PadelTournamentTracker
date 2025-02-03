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

  // Function to check if a combination has been used
  const hasBeenUsed = (players: number[]) => {
    const sorted = [...players].sort().join(',');
    return usedCombinations.has(sorted);
  };

  // Function to add a combination to used set
  const markAsUsed = (players: number[]) => {
    const sorted = [...players].sort().join(',');
    usedCombinations.add(sorted);
  };

  // Keep generating rounds until we have a reasonable number of unique combinations
  // or until we can't generate any more unique matches
  while (round <= 10) { // Limit to 10 rounds maximum
    const availablePlayers = new Set(playerIds);
    const roundMatches: Match[] = [];

    // For each court in this round
    for (let court = 1; court <= numCourts && availablePlayers.size >= 4; court++) {
      // Get 4 random players who haven't played together in this combination
      let attempts = 0;
      let validMatch: number[] | null = null;

      while (attempts < 50 && !validMatch) { // Limit attempts to prevent infinite loops
        const players = Array.from(availablePlayers)
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        if (players.length === 4 && !hasBeenUsed(players)) {
          validMatch = players;
          players.forEach(p => availablePlayers.delete(p));
          markAsUsed(players);
        }
        attempts++;
      }

      if (validMatch) {
        roundMatches.push({
          players: validMatch,
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