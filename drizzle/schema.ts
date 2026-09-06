import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const studyCycles = sqliteTable("studyCycles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleKey: text("cycleKey").notNull(),
  startAt: integer("startAt", { mode: "timestamp" }).notNull(),
  endAt: integer("endAt", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "completed"] }).default("active").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("studyCycles_user_cycleKey_unique").on(table.userId, table.cycleKey),
  index("studyCycles_user_status_idx").on(table.userId, table.status)
]);

export const subjects = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  color: text("color").default("#10B981").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("subjects_user_cycle_idx").on(table.userId, table.cycleId)]);

export const chapters = sqliteTable("chapters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subjectId: integer("subjectId").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("chapters_subject_idx").on(table.subjectId)]);

export const lessons = sqliteTable("lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chapterId: integer("chapterId").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  estimatedMinutes: integer("estimatedMinutes").default(30).notNull(),
  notes: text("notes"),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("lessons_chapter_idx").on(table.chapterId)]);

export const lessonProgress = sqliteTable("lessonProgress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: integer("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["not_started", "in_progress", "completed"] }).default("not_started").notNull(),
  progress: integer("progress").default(0).notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  lastReviewedAt: integer("lastReviewedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("lessonProgress_user_lesson_unique").on(table.userId, table.lessonId),
  index("lessonProgress_user_status_idx").on(table.userId, table.status)
]);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledFor: text("scheduledFor"),
  deadline: integer("deadline", { mode: "timestamp" }),
  priority: text("priority", { enum: ["urgent", "medium", "low"] }).default("medium").notNull(),
  status: text("status", { enum: ["open", "completed"] }).default("open").notNull(),
  category: text("category").default("دراسة").notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("tasks_user_cycle_date_idx").on(table.userId, table.cycleId, table.scheduledFor)]);

export const assistantMessages = sqliteTable("assistantMessages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("assistantMessages_user_created_idx").on(table.userId, table.createdAt)]);

export const dailyStudySummaries = sqliteTable("dailyStudySummaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  summaryDate: text("summaryDate").notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("dailyStudySummaries_user_date_unique").on(table.userId, table.summaryDate),
  index("dailyStudySummaries_cycle_date_idx").on(table.cycleId, table.summaryDate)
]);

export const habits = sqliteTable("habits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  frequency: text("frequency", { enum: ["daily", "weekly"] }).default("daily").notNull(),
  target: integer("target").default(1).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("habits_user_cycle_idx").on(table.userId, table.cycleId)]);

export const habitCompletions = sqliteTable("habitCompletions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  habitId: integer("habitId").notNull().references(() => habits.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  completedOn: text("completedOn").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("habitCompletions_habit_date_unique").on(table.habitId, table.completedOn),
  index("habitCompletions_user_cycle_idx").on(table.userId, table.cycleId)
]);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  deadline: integer("deadline", { mode: "timestamp" }),
  progress: integer("progress").default(0).notNull(),
  status: text("status", { enum: ["active", "completed"] }).default("active").notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("goals_user_cycle_idx").on(table.userId, table.cycleId)]);

export const goalMilestones = sqliteTable("goalMilestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  goalId: integer("goalId").notNull().references(() => goals.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetPercent: integer("targetPercent").notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
}, table => [index("goalMilestones_goal_idx").on(table.goalId)]);

export const pomodoroSessions = sqliteTable("pomodoroSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  subjectId: integer("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  plannedMinutes: integer("plannedMinutes").notNull(),
  completedMinutes: integer("completedMinutes").default(0).notNull(),
  state: text("state", { enum: ["running", "paused", "completed", "cancelled"] }).default("running").notNull(),
  startedAt: integer("startedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  pausedAt: integer("pausedAt", { mode: "timestamp" }),
  pausedSeconds: integer("pausedSeconds").default(0).notNull(),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("pomodoroSessions_user_cycle_idx").on(table.userId, table.cycleId)]);

export const studyVideoSessions = sqliteTable("studyVideoSessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  videoUrl: text("videoUrl").notNull(),
  lessonTitle: text("lessonTitle"),
  subject: text("subject", { enum: ["arabic", "history", "english", "programming_ai", "german", "other"] }).default("other").notNull(),
  sourceMode: text("sourceMode", { enum: ["embedded", "external"] }).default("embedded").notNull(),
  manualProgress: text("manualProgress", { enum: ["started", "middle", "finished", "reviewed"] }).default("started").notNull(),
  timerRunning: integer("timerRunning", { mode: "boolean" }).default(false).notNull(),
  activeSeconds: integer("activeSeconds").default(0).notNull(),
  completedBlocks: integer("completedBlocks").default(0).notNull(),
  phase: text("phase", { enum: ["watching", "break", "completed"] }).default("watching").notNull(),
  breakEndsAt: integer("breakEndsAt", { mode: "timestamp" }),
  lastPlaybackPosition: integer("lastPlaybackPosition"),
  lastPlaybackAt: integer("lastPlaybackAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("studyVideoSessions_user_cycle_idx").on(table.userId, table.cycleId)]);

export const videoNotes = sqliteTable("videoNotes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: integer("sessionId").notNull().references(() => studyVideoSessions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  timestampSeconds: integer("timestampSeconds"),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index("videoNotes_user_session_idx").on(table.userId, table.sessionId),
  index("videoNotes_session_timestamp_idx").on(table.sessionId, table.timestampSeconds)
]);

export const exams = sqliteTable("exams", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  subjectId: integer("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  chapterId: integer("chapterId").references(() => chapters.id, { onDelete: "set null" }),
  lessonId: integer("lessonId").references(() => lessons.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  origin: text("origin", { enum: ["manual", "notebook_ai"] }).default("manual").notNull(),
  notebookId: integer("notebookId"),
  quizPayload: text("quizPayload", { mode: "json" }).$type<{ sourceNames: string[]; questions: { question: string; answer: string; choices?: string[] }[] }>(),
  quizReviewedAt: integer("quizReviewedAt", { mode: "timestamp" }),
  scheduledAt: integer("scheduledAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("exams_user_cycle_idx").on(table.userId, table.cycleId)]);

export const examLessons = sqliteTable("examLessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  examId: integer("examId").notNull().references(() => exams.id, { onDelete: "cascade" }),
  lessonId: integer("lessonId").notNull().references(() => lessons.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("examLessons_exam_lesson_unique").on(table.examId, table.lessonId),
  index("examLessons_lesson_idx").on(table.lessonId)
]);

export const examAttempts = sqliteTable("examAttempts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  examId: integer("examId").notNull().references(() => exams.id, { onDelete: "cascade" }),
  totalQuestions: integer("totalQuestions").notNull(),
  correctAnswers: integer("correctAnswers").notNull(),
  incorrectAnswers: integer("incorrectAnswers").notNull(),
  score: integer("score").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).default("medium").notNull(),
  missedTopics: text("missedTopics", { mode: "json" }).$type<string[]>(),
  comprehensionScore: integer("comprehensionScore").notNull(),
  completionRewarded: integer("completionRewarded", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index("examAttempts_user_cycle_idx").on(table.userId, table.cycleId),
  uniqueIndex("examAttempts_exam_attempt_unique").on(table.examId, table.id)
]);

export const notebooks = sqliteTable("notebooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("notebooks_user_cycle_idx").on(table.userId, table.cycleId)]);

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebookId").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("notes_notebook_idx").on(table.notebookId)]);

export const notebookSources = sqliteTable("notebookSources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notebookId: integer("notebookId").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
  fileName: text("fileName").notNull(),
  mimeType: text("mimeType").notNull(),
  storageKey: text("storageKey").notNull(),
  storageUrl: text("storageUrl").notNull(),
  extractedText: text("extractedText"),
  characterCount: integer("characterCount").default(0).notNull(),
  isTruncated: integer("isTruncated", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("notebookSources_notebook_idx").on(table.notebookId)]);

export const flashcardDecks = sqliteTable("flashcardDecks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  color: text("color").default("#8B5CF6").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("flashcardDecks_user_cycle_idx").on(table.userId, table.cycleId)]);

export const flashcards = sqliteTable("flashcards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deckId: integer("deckId").notNull().references(() => flashcardDecks.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  answer: text("answer").notNull(),
  state: text("state", { enum: ["new", "learning", "mastered"] }).default("new").notNull(),
  nextReviewAt: integer("nextReviewAt", { mode: "timestamp" }),
  lastReviewedAt: integer("lastReviewedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("flashcards_deck_state_idx").on(table.deckId, table.state)]);

export const calendarEvents = sqliteTable("calendarEvents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  eventType: text("eventType", { enum: ["important_date", "custom"] }).default("important_date").notNull(),
  startsAt: integer("startsAt", { mode: "timestamp" }).notNull(),
  endsAt: integer("endsAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [index("calendarEvents_user_cycle_date_idx").on(table.userId, table.cycleId, table.startsAt)]);

export const lessonSources = sqliteTable("lessonSources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  platform: text("platform").notNull(),
  teacherName: text("teacherName").notNull(),
  delivery: text("delivery", { enum: ["online", "in_person", "hybrid"] }).default("online").notNull(),
  role: text("role", { enum: ["primary", "review", "support"] }).default("primary").notNull(),
  url: text("url"),
  location: text("location"),
  weeklyPlan: text("weeklyPlan"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  index("lessonSources_user_subject_idx").on(table.userId, table.subject),
  index("lessonSources_user_active_idx").on(table.userId, table.active)
]);

export const rewards = sqliteTable("rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  catalogId: integer("catalogId").notNull(),
  title: text("title").notNull(),
  cost: integer("cost").notNull(),
  rarity: text("rarity", { enum: ["common", "uncommon", "rare", "epic", "legendary", "mythic"] }).notNull(),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
}, table => [uniqueIndex("rewards_catalogId_unique").on(table.catalogId)]);

export const rewardPurchases = sqliteTable("rewardPurchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  rewardId: integer("rewardId").notNull().references(() => rewards.id, { onDelete: "restrict" }),
  cost: integer("cost").notNull(),
  referenceKey: text("referenceKey").notNull(),
  purchasedAt: integer("purchasedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("rewardPurchases_referenceKey_unique").on(table.referenceKey),
  index("rewardPurchases_user_cycle_idx").on(table.userId, table.cycleId)
]);

export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  catalogId: integer("catalogId").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  rarity: text("rarity", { enum: ["common", "uncommon", "rare", "epic", "legendary", "mythic"] }).notNull(),
  metric: text("metric").notNull(),
  target: integer("target").notNull(),
}, table => [uniqueIndex("achievements_catalogId_unique").on(table.catalogId)]);

export const userAchievements = sqliteTable("userAchievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  achievementId: integer("achievementId").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: integer("unlockedAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [uniqueIndex("userAchievements_cycle_achievement_unique").on(table.userId, table.cycleId, table.achievementId)]);

export const coinTransactions = sqliteTable("coinTransactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type", { enum: ["earn", "spend"] }).notNull(),
  reason: text("reason").notNull(),
  referenceKey: text("referenceKey").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("coinTransactions_referenceKey_unique").on(table.referenceKey),
  index("coinTransactions_user_cycle_idx").on(table.userId, table.cycleId)
]);

export const studyEvents = sqliteTable("studyEvents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  cycleId: integer("cycleId").notNull().references(() => studyCycles.id, { onDelete: "cascade" }),
  subjectId: integer("subjectId").references(() => subjects.id, { onDelete: "set null" }),
  eventType: text("eventType", { enum: ["lesson_complete", "lesson_review", "task_complete", "habit_complete", "goal_complete", "pomodoro_complete", "video_block", "exam_complete"] }).notNull(),
  referenceId: text("referenceId").notNull(),
  durationMinutes: integer("durationMinutes").default(0).notNull(),
  occurredAt: integer("occurredAt", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
}, table => [
  uniqueIndex("studyEvents_user_reference_unique").on(table.userId, table.referenceId),
  index("studyEvents_user_cycle_date_idx").on(table.userId, table.cycleId, table.occurredAt)
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type StudyCycle = typeof studyCycles.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Exam = typeof exams.$inferSelect;
export type Notebook = typeof notebooks.$inferSelect;
export type Note = typeof notes.$inferSelect;
