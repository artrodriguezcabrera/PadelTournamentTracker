import { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { tournaments, players, games, tournamentPlayers, users } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm"; // Added import for desc and sql
import { setupAuth, comparePasswords, hashPassword } from "./auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({ storage: multer.memoryStorage() });

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Setup authentication routes
  setupAuth(app);

  // Middleware to check if user is authenticated
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    next();
  };

  // Serve uploaded files
  const uploadsPath = path.join(process.cwd(), "uploads");
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsPath));

  // Player routes
  app.get("/api/players", requireAuth, async (req, res) => {
    const allPlayers = await db.query.players.findMany({
      where: eq(players.userId, req.user!.id),
    });
    res.json(allPlayers);
  });

  app.post("/api/players", requireAuth, async (req, res) => {
    const { name } = req.body;
    const newPlayer = await db
      .insert(players)
      .values({
        name,
        userId: req.user!.id,
      })
      .returning();
    res.json(newPlayer[0]);
  });

  app.patch("/api/players/:id", requireAuth, async (req, res) => {
    const { name } = req.body;
    const playerId = parseInt(req.params.id);

    // First verify the player belongs to the user
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      res.status(404).json({ message: "Player not found" });
      return;
    }

    if (player.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to modify this player" });
      return;
    }

    const updatedPlayer = await db
      .update(players)
      .set({ name })
      .where(eq(players.id, playerId))
      .returning();

    res.json(updatedPlayer[0]);
  });

  app.delete("/api/players/:id", requireAuth, async (req, res) => {
    const playerId = parseInt(req.params.id);

    // First verify the player belongs to the user
    const player = await db.query.players.findFirst({
      where: eq(players.id, playerId),
    });

    if (!player) {
      res.status(404).json({ message: "Player not found" });
      return;
    }

    if (player.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to delete this player" });
      return;
    }

    const playerTournaments = await db.query.tournamentPlayers.findMany({
      where: eq(tournamentPlayers.playerId, playerId),
    });

    if (playerTournaments.length > 0) {
      res.status(400).json({
        message: "Cannot delete player that is part of a tournament",
      });
      return;
    }

    await db.delete(players).where(eq(players.id, playerId));
    res.json({ message: "Player deleted successfully" });
  });

  // Tournament routes
  app.get("/api/tournaments", requireAuth, async (req, res) => {
    const allTournaments = await db.query.tournaments.findMany({
      where: eq(tournaments.userId, req.user!.id),
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

  app.get("/api/tournaments/:id", requireAuth, async (req, res) => {
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

    if (tournament.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to view this tournament" });
      return;
    }

    res.json(tournament);
  });

  app.post("/api/tournaments", requireAuth, async (req, res) => {
    const { name, pointSystem, courts, playerIds } = req.body;

    if (!playerIds || playerIds.length < 4) {
      res.status(400).json({ message: "At least 4 players are required for a tournament" });
      return;
    }

    const newTournament = await db.transaction(async (tx) => {
      const [tournament] = await tx
        .insert(tournaments)
        .values({
          name,
          pointSystem,
          courts,
          userId: req.user!.id,
        })
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

  app.patch("/api/tournaments/:id", requireAuth, async (req, res) => {
    const tournamentId = parseInt(req.params.id);
    const { name, pointSystem, courts } = req.body;

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    if (tournament.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to modify this tournament" });
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

  app.delete("/api/tournaments/:id", requireAuth, async (req, res) => {
    const tournamentId = parseInt(req.params.id);

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });

    if (!tournament) {
      res.status(404).json({ message: "Tournament not found" });
      return;
    }

    if (tournament.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to delete this tournament" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(tournamentPlayers)
        .where(eq(tournamentPlayers.tournamentId, tournamentId));

      await tx
        .delete(games)
        .where(eq(games.tournamentId, tournamentId));

      await tx
        .delete(tournaments)
        .where(eq(tournaments.id, tournamentId));
    });

    res.json({ message: "Tournament deleted successfully" });
  });

  app.post("/api/tournaments/:id/start", requireAuth, async (req, res) => {
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

      // Verify tournament belongs to user
      if (tournamentData.userId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to start this tournament" });
      }

      // Filter out any null values and ensure we have valid player IDs
      const playerIds = tournamentData.tournamentPlayers
        .map(tp => tp.playerId)
        .filter((id): id is number => id !== null);

      if (playerIds.length < 4) {
        return res.status(400).json({
          message: "Not enough players to start tournament. Minimum 4 players required.",
          currentPlayers: playerIds.length,
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
            courts: tournamentData.courts,
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
          games: gameMatches,
        });
      } catch (error) {
        console.error("Error generating game matches:", error);
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Failed to generate game matches",
          playerCount: playerIds.length,
          courts: tournamentData.courts,
        });
      }
    } catch (error) {
      console.error("Error starting tournament:", error);
      return res.status(500).json({
        message: "Failed to start tournament",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.patch("/api/tournaments/:id/players", requireAuth, async (req, res) => {
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

    if (tournament.userId !== req.user!.id) {
      res.status(403).json({ message: "Not authorized to modify players in this tournament" });
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

  app.post("/api/games/:id/score", requireAuth, async (req, res) => {
    const { team1Score, team2Score } = req.body;
    const gameId = parseInt(req.params.id);

    // Verify the game belongs to a tournament owned by the user
    const game = await db.query.games.findFirst({
      where: eq(games.id, gameId),
      with: {
        tournament: true,
      },
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.tournament.userId !== req.user!.id) {
      return res.status(403).json({ message: "Not authorized to update this game" });
    }

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

  app.post("/api/user/password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id),
    });

    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    await db
      .update(users)
      .set({
        password: await hashPassword(newPassword),
      })
      .where(eq(users.id, req.user!.id));

    res.json({ message: "Password updated successfully" });
  });


  // Admin routes
  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const [totalUsers] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [totalTournaments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournaments);

    const [activeTournaments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tournaments)
      .where(eq(tournaments.isActive, true));

    const usersList = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        isAdmin: users.isAdmin,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10);

    const recentTournaments = await db
      .select()
      .from(tournaments)
      .orderBy(desc(tournaments.createdAt))
      .limit(10);

    res.json({
      totalUsers: totalUsers.count,
      totalTournaments: totalTournaments.count,
      activeTournaments: activeTournaments.count,
      completedTournaments: totalTournaments.count - activeTournaments.count,
      usersList,
      recentTournaments,
    });
  });

  // Make user admin
  app.post("/api/admin/make-admin", requireAuth, async (req, res) => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { email } = req.body;
    const [user] = await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.email, email))
      .returning();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  });

  // Add the following routes inside registerRoutes function, before return httpServer:
  app.post("/api/user/profile", requireAuth, async (req, res) => {
    const { name } = req.body;

    try {
      const [updatedUser] = await db
        .update(users)
        .set({ name })
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          profilePhoto: users.profilePhoto,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Profile updated successfully:", {
        userId: updatedUser.id,
        name: updatedUser.name,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/user/photo", requireAuth, upload.single("photo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Ensure uploads directory exists
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.promises.mkdir(uploadDir, { recursive: true });

      // Generate a unique filename
      const timestamp = Date.now();
      const filename = `${req.user!.id}-${timestamp}-${req.file.originalname}`;
      const filepath = path.join(uploadDir, filename);

      // Write the file
      await fs.promises.writeFile(filepath, req.file.buffer);

      // Update user profile photo in database
      const [updatedUser] = await db
        .update(users)
        .set({ profilePhoto: `/uploads/${filename}` })
        .where(eq(users.id, req.user!.id))
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          profilePhoto: users.profilePhoto,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("File uploaded successfully:", {
        filename,
        filepath,
        userId: req.user!.id,
        profilePhoto: updatedUser.profilePhoto
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({
        message: "Failed to upload photo",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
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

  const N = playerIds.length;
  // Calculate total required partnerships
  const totalPartnerships = (N * (N - 1)) / 2;
  // Calculate required rounds
  const requiredRounds = Math.ceil(totalPartnerships / (numCourts * 2)); // Each match creates 2 partnerships
  // Calculate target games per player for even distribution
  const targetGamesPerPlayer = Math.ceil((requiredRounds * numCourts * 4) / N);

  console.log(`Generating schedule for ${N} players on ${numCourts} courts`);
  console.log(`Total partnerships needed: ${totalPartnerships}`);
  console.log(`Required rounds: ${requiredRounds}`);
  console.log(`Target games per player: ${targetGamesPerPlayer}`);

  const matches: Match[] = [];
  const playerGamesCount = new Map<number, number>();
  const usedPairings = new Set<string>();
  let round = 1;

  // Initialize game counts
  playerIds.forEach(id => playerGamesCount.set(id, 0));

  // Get pairing key for tracking partnerships
  const getPairingKey = (p1: number, p2: number) =>
    [p1, p2].sort((a, b) => a - b).join(',');

  while (round <= requiredRounds) {
    const playersUsedInRound = new Set<number>();
    const roundMatches: Match[] = [];
    const skippedCourts = new Set<number>();

    // Try to fill ALL courts before proceeding to next round
    for (let currentCourt = 1; currentCourt <= numCourts || skippedCourts.size > 0;) {
      // If we've processed all courts, try skipped ones
      if (currentCourt > numCourts) {
        if (skippedCourts.size === 0) break;
        currentCourt = Array.from(skippedCourts)[0];
        skippedCourts.delete(currentCourt);
      }

      // Get available players for this match
      const availablePlayers = playerIds
        .filter(id =>
          !playersUsedInRound.has(id) &&
          (playerGamesCount.get(id) || 0) < targetGamesPerPlayer
        )
        .sort((a, b) => (playerGamesCount.get(a) || 0) - (playerGamesCount.get(b) || 0));

      if (availablePlayers.length < 4) {
        if (currentCourt === 1 && roundMatches.length === 0) {
          // If we can't even fill first court, we're done
          return matches;
        }
        // Skip this court and try next
        skippedCourts.add(currentCourt);
        currentCourt++;
        continue;
      }

      // Try to create a valid match
      let match: number[] | null = null;
      let attempts = 0;
      const maxAttempts = 10;

      while (!match && attempts < maxAttempts) {
        // Try to find 4 players that haven't partnered before
        const remainingPlayers = [...availablePlayers];
        const team: number[] = [];

        // Select first player (least games played)
        if (remainingPlayers.length > 0) {
          team.push(remainingPlayers.shift()!);

          // Find partner for first player
          for (let i = 0; i < remainingPlayers.length; i++) {
            if (!usedPairings.has(getPairingKey(team[0], remainingPlayers[i]))) {
              team.push(remainingPlayers[i]);
              remainingPlayers.splice(i, 1);
              break;
            }
          }

          // Select first player for second team
          if (team.length === 2 && remainingPlayers.length > 0) {
            team.push(remainingPlayers.shift()!);

            // Find partner for third player
            for (let i = 0; i < remainingPlayers.length; i++) {
              if (!usedPairings.has(getPairingKey(team[2], remainingPlayers[i]))) {
                team.push(remainingPlayers[i]);
                break;
              }
            }
          }

          if (team.length === 4) {
            match = team;
          }
        }

        attempts++;
      }

      if (!match) {
        if (currentCourt === 1 && roundMatches.length === 0) {
          // If we can't create any valid matches, we're done
          return matches;
        }
        // Skip this court and try next
        skippedCourts.add(currentCourt);
        currentCourt++;
        continue;
      }

      // Record the match
      roundMatches.push({
        players: match,
        round,
        court: currentCourt,
      });

      // Mark players as used and update counts
      match.forEach(id => {
        playersUsedInRound.add(id);
        playerGamesCount.set(id, (playerGamesCount.get(id) || 0) + 1);
      });

      // Record partnerships
      usedPairings.add(getPairingKey(match[0], match[1]));
      usedPairings.add(getPairingKey(match[2], match[3]));

      currentCourt++;
    }

    // If we couldn't create any matches in this round, we're done
    if (roundMatches.length === 0) {
      console.log(`Could not create any matches in round ${round}`);
      break;
    }

    // Add all matches from this round to final schedule
    matches.push(...roundMatches);
    console.log(`Round ${round}: Created ${roundMatches.length} matches`);
    round++;
  }

  if (matches.length === 0) {
    throw new Error("Could not generate any valid matches");
  }

  // Log final game distribution
  console.log("\nFinal game distribution:");
  for (const [playerId, games] of playerGamesCount.entries()) {
    console.log(`Player ${playerId}: ${games} games`);
    if (Math.abs(games - targetGamesPerPlayer) > 1) {
      console.warn(`Warning: Player ${playerId} has uneven game count: ${games} vs target ${targetGamesPerPlayer}`);
    }
  }

  return matches.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.court - b.court;
  });
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