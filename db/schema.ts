import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pointSystem: integer("point_system").notNull(), // 16, 24, or 32
  courts: integer("courts").notNull().default(1),
  isActive: boolean("is_active").default(false),
  userId: integer("user_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false),
  publicId: text("public_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentPlayers = pgTable("tournament_players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id),
  playerId: integer("player_id").references(() => players.id),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id),
  roundNumber: integer("round_number").notNull().default(1),
  courtNumber: integer("court_number").notNull().default(1),
  player1Id: integer("player1_id").references(() => players.id),
  player2Id: integer("player2_id").references(() => players.id),
  player3Id: integer("player3_id").references(() => players.id),
  player4Id: integer("player4_id").references(() => players.id),
  team1Score: integer("team1_score"),
  team2Score: integer("team2_score"),
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations
export const userRelations = relations(users, ({ many }) => ({
  tournaments: many(tournaments),
  players: many(players),
}));

export const tournamentRelations = relations(tournaments, ({ one, many }) => ({
  user: one(users, {
    fields: [tournaments.userId],
    references: [users.id],
  }),
  tournamentPlayers: many(tournamentPlayers),
  games: many(games),
}));

export const playerRelations = relations(players, ({ one, many }) => ({
  user: one(users, {
    fields: [players.userId],
    references: [users.id],
  }),
  tournamentPlayers: many(tournamentPlayers),
}));

export const tournamentPlayersRelations = relations(tournamentPlayers, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentPlayers.tournamentId],
    references: [tournaments.id],
  }),
  player: one(players, {
    fields: [tournamentPlayers.playerId],
    references: [players.id],
  }),
}));

export const gameRelations = relations(games, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [games.tournamentId],
    references: [tournaments.id],
  }),
  player1: one(players, {
    fields: [games.player1Id],
    references: [players.id],
  }),
  player2: one(players, {
    fields: [games.player2Id],
    references: [players.id],
  }),
  player3: one(players, {
    fields: [games.player3Id],
    references: [players.id],
  }),
  player4: one(players, {
    fields: [games.player4Id],
    references: [players.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertPlayerSchema = createInsertSchema(players);
export const selectPlayerSchema = createSelectSchema(players);
export const insertTournamentSchema = createInsertSchema(tournaments);
export const selectTournamentSchema = createSelectSchema(tournaments);
export const insertGameSchema = createInsertSchema(games);
export const selectGameSchema = createSelectSchema(games);

// Types
export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type Game = typeof games.$inferSelect;