import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const trainingPlans = mysqlTable("training_plans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["strength", "hypertrophy"]).notNull(),
  daysPerWeek: int("daysPerWeek").notNull(),
  durationWeeks: int("durationWeeks").default(12).notNull(),
  startDate: timestamp("startDate").defaultNow().notNull(),
  isActive: int("isActive").default(1).notNull(),
  generatedContent: text("generatedContent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type InsertTrainingPlan = typeof trainingPlans.$inferInsert;

export const dailyChecklists = mysqlTable("daily_checklists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trainingPlanId: int("trainingPlanId").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  dayOfWeek: varchar("dayOfWeek", { length: 20 }).notNull(),
  totalSeries: int("totalSeries").notNull(),
  completedSeries: int("completedSeries").default(0).notNull(),
  isCompleted: int("isCompleted").default(0).notNull(),
  xpEarned: int("xpEarned").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyChecklist = typeof dailyChecklists.$inferSelect;
export type InsertDailyChecklist = typeof dailyChecklists.$inferInsert;

export const userProgress = mysqlTable("user_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalXP: int("totalXP").default(0).notNull(),
  level: int("level").default(1).notNull(),
  streak: int("streak").default(0).notNull(),
  seriesCompletedHistorically: int("seriesCompletedHistorically").default(0).notNull(),
  seriesProgrammed: int("seriesProgrammed").default(0).notNull(),
  lastWorkoutDate: timestamp("lastWorkoutDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

export const exerciseHistory = mysqlTable("exercise_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trainingPlanId: int("trainingPlanId").notNull(),
  dailyChecklistId: int("dailyChecklistId").notNull(),
  exerciseName: varchar("exerciseName", { length: 255 }).notNull(),
  dayNumber: int("dayNumber").notNull(),
  exerciseIndex: int("exerciseIndex").notNull(),
  plannedSets: int("plannedSets").notNull(),
  plannedReps: varchar("plannedReps", { length: 50 }).notNull(),
  completedSets: int("completedSets").default(0).notNull(),
  completedReps: varchar("completedReps", { length: 50 }),
  weight: int("weight"),
  duration: int("duration"),
  notes: text("notes"),
  isCompleted: int("isCompleted").default(0).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExerciseHistory = typeof exerciseHistory.$inferSelect;
export type InsertExerciseHistory = typeof exerciseHistory.$inferInsert;

export const achievements = mysqlTable("achievements", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  conditionType: varchar("conditionType", { length: 50 }).notNull(), // 'total_xp', 'streak_days', 'workouts_done', 'series_completed'
  conditionValue: int("conditionValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export const userAchievements = mysqlTable("user_achievements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  achievementId: int("achievementId").notNull(),
  unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
});

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

