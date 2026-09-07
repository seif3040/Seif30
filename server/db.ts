import { and, count, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  achievements, calendarEvents, chapters, coinTransactions, examAttempts, examLessons, exams, goalMilestones,
  assistantMessages, dailyStudySummaries, goals, habitCompletions, habits, lessonProgress, lessons, flashcardDecks, flashcards, notebooks, notebookSources, notes, pomodoroSessions,
  rewardPurchases, rewards, studyCycles, studyEvents, studyVideoSessions, videoNotes, subjects, tasks, lessonSources,
  userAchievements, users, type InsertUser,
} from "../drizzle/schema";
import { seifLessonSourceDefaults, type LessonSourceDraft } from "../shared/lessonSources";
import { achievementCatalog, rewardCatalog, type AchievementMetric } from "../shared/catalog";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { storageGetSignedUrl, storagePut } from "./storage";
import { ENV } from "./_core/env";
import { decideCompletion, decideRewardPurchase, deriveFallbackComprehension, selectAchievementUnlocks } from "./businessRules";
import { classifyStudySource } from "../client/src/lib/videoSources";

export const DEFAULT_OWNER_OPEN_ID = "private-owner:seif94803@gmail.com";
export const DEFAULT_OWNER_EMAIL = "seif94803@gmail.com";

const DB_PATH = path.resolve(process.cwd(), "data", "study_os.db");

function ensureDbDirectory() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _sqlite: any = null;
let _db: ReturnType<typeof drizzle> | null = null;
const DAY_MS = 86_400_000;

function initSqliteTables(sqlite: any) {
  const ddl = `
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, openId TEXT NOT NULL UNIQUE, name TEXT, email TEXT, loginMethod TEXT, role TEXT DEFAULT 'user' NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, lastSignedIn INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyCycles (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleKey TEXT NOT NULL, startAt INTEGER NOT NULL, endAt INTEGER NOT NULL, status TEXT DEFAULT 'active' NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(userId, cycleKey));
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, color TEXT DEFAULT '#10B981' NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, subjectId INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, title TEXT NOT NULL, sortOrder INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, chapterId INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, estimatedMinutes INTEGER DEFAULT 30 NOT NULL, notes TEXT, sortOrder INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lessonProgress (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lessonId INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, status TEXT DEFAULT 'not_started' NOT NULL, progress INTEGER DEFAULT 0 NOT NULL, completedAt INTEGER, lastReviewedAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, UNIQUE(userId, lessonId));
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, scheduledFor TEXT, deadline INTEGER, priority TEXT DEFAULT 'medium' NOT NULL, status TEXT DEFAULT 'open' NOT NULL, category TEXT DEFAULT 'دراسة' NOT NULL, completedAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS assistantMessages (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS dailyStudySummaries (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, summaryDate TEXT NOT NULL, content TEXT NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(userId, summaryDate));
CREATE TABLE IF NOT EXISTS habits (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, name TEXT NOT NULL, frequency TEXT DEFAULT 'daily' NOT NULL, target INTEGER DEFAULT 1 NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS habitCompletions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, habitId INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, completedOn TEXT NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(habitId, completedOn));
CREATE TABLE IF NOT EXISTS goals (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, deadline INTEGER, progress INTEGER DEFAULT 0 NOT NULL, status TEXT DEFAULT 'active' NOT NULL, completedAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS goalMilestones (id INTEGER PRIMARY KEY AUTOINCREMENT, goalId INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE, title TEXT NOT NULL, targetPercent INTEGER NOT NULL, completedAt INTEGER);
CREATE TABLE IF NOT EXISTS pomodoroSessions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, subjectId INTEGER REFERENCES subjects(id) ON DELETE SET NULL, plannedMinutes INTEGER NOT NULL, completedMinutes INTEGER DEFAULT 0 NOT NULL, state TEXT DEFAULT 'running' NOT NULL, startedAt INTEGER NOT NULL, pausedAt INTEGER, pausedSeconds INTEGER DEFAULT 0 NOT NULL, completedAt INTEGER, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyVideoSessions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, videoUrl TEXT NOT NULL, lessonTitle TEXT, subject TEXT DEFAULT 'other' NOT NULL, sourceMode TEXT DEFAULT 'embedded' NOT NULL, manualProgress TEXT DEFAULT 'started' NOT NULL, timerRunning INTEGER DEFAULT 0 NOT NULL, activeSeconds INTEGER DEFAULT 0 NOT NULL, completedBlocks INTEGER DEFAULT 0 NOT NULL, phase TEXT DEFAULT 'watching' NOT NULL, breakEndsAt INTEGER, lastPlaybackPosition INTEGER, lastPlaybackAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS videoNotes (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sessionId INTEGER NOT NULL REFERENCES studyVideoSessions(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, timestampSeconds INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, subjectId INTEGER REFERENCES subjects(id) ON DELETE SET NULL, chapterId INTEGER REFERENCES chapters(id) ON DELETE SET NULL, lessonId INTEGER REFERENCES lessons(id) ON DELETE SET NULL, title TEXT NOT NULL, origin TEXT DEFAULT 'manual' NOT NULL, notebookId INTEGER, quizPayload TEXT, quizReviewedAt INTEGER, scheduledAt INTEGER, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS examLessons (id INTEGER PRIMARY KEY AUTOINCREMENT, examId INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE, lessonId INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, createdAt INTEGER NOT NULL, UNIQUE(examId, lessonId));
CREATE TABLE IF NOT EXISTS examAttempts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, examId INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE, totalQuestions INTEGER NOT NULL, correctAnswers INTEGER NOT NULL, incorrectAnswers INTEGER NOT NULL, score INTEGER NOT NULL, difficulty TEXT DEFAULT 'medium' NOT NULL, missedTopics TEXT, comprehensionScore INTEGER NOT NULL, completionRewarded INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL, UNIQUE(examId, id));
CREATE TABLE IF NOT EXISTS notebooks (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, notebookId INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE, title TEXT NOT NULL, content TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notebookSources (id INTEGER PRIMARY KEY AUTOINCREMENT, notebookId INTEGER NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE, fileName TEXT NOT NULL, mimeType TEXT NOT NULL, storageKey TEXT NOT NULL, storageUrl TEXT NOT NULL, extractedText TEXT, characterCount INTEGER DEFAULT 0 NOT NULL, isTruncated INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS flashcardDecks (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, color TEXT DEFAULT '#8B5CF6' NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS flashcards (id INTEGER PRIMARY KEY AUTOINCREMENT, deckId INTEGER NOT NULL REFERENCES flashcardDecks(id) ON DELETE CASCADE, prompt TEXT NOT NULL, answer TEXT NOT NULL, state TEXT DEFAULT 'new' NOT NULL, nextReviewAt INTEGER, lastReviewedAt INTEGER, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS calendarEvents (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, eventType TEXT DEFAULT 'important_date' NOT NULL, startsAt INTEGER NOT NULL, endsAt INTEGER, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS lessonSources (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, subject TEXT NOT NULL, platform TEXT NOT NULL, teacherName TEXT NOT NULL, delivery TEXT DEFAULT 'online' NOT NULL, role TEXT DEFAULT 'primary' NOT NULL, url TEXT, location TEXT, weeklyPlan TEXT, notes TEXT, active INTEGER DEFAULT 1 NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, catalogId INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, cost INTEGER NOT NULL, rarity TEXT NOT NULL, active INTEGER DEFAULT 1 NOT NULL);
CREATE TABLE IF NOT EXISTS rewardPurchases (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, rewardId INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT, cost INTEGER NOT NULL, referenceKey TEXT NOT NULL UNIQUE, purchasedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, catalogId INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, rarity TEXT NOT NULL, metric TEXT NOT NULL, target INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS userAchievements (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, achievementId INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE, unlockedAt INTEGER NOT NULL, UNIQUE(userId, cycleId, achievementId));
CREATE TABLE IF NOT EXISTS coinTransactions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, amount INTEGER NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, referenceKey TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyEvents (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, subjectId INTEGER REFERENCES subjects(id) ON DELETE SET NULL, eventType TEXT NOT NULL, referenceId TEXT NOT NULL, durationMinutes INTEGER DEFAULT 0 NOT NULL, occurredAt INTEGER NOT NULL, UNIQUE(userId, referenceId));
CREATE TABLE IF NOT EXISTS mistakes (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, subject TEXT NOT NULL, topic TEXT, errorType TEXT DEFAULT 'misunderstanding' NOT NULL, question TEXT NOT NULL, wrongAnswer TEXT, correctAnswer TEXT NOT NULL, explanation TEXT, status TEXT DEFAULT 'needs_review' NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS feynmanSessions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, topic TEXT NOT NULL, subject TEXT DEFAULT 'عام' NOT NULL, userExplanation TEXT NOT NULL, aiFeedback TEXT NOT NULL, masteryScore INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS hybridLessons (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, subject TEXT NOT NULL, teacherName TEXT NOT NULL, mode TEXT DEFAULT 'online' NOT NULL, platformOrCenter TEXT NOT NULL, lectureTitle TEXT NOT NULL, onlineUrl TEXT, accessCode TEXT, expiryDate TEXT, centerTime TEXT, status TEXT DEFAULT 'pending' NOT NULL, sheetStatus TEXT DEFAULT 'pending' NOT NULL, notes TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS customRewards (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, cost INTEGER NOT NULL, icon TEXT DEFAULT '🎁' NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS externalResources (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, cycleId INTEGER NOT NULL REFERENCES studyCycles(id) ON DELETE CASCADE, title TEXT NOT NULL, platform TEXT NOT NULL, url TEXT NOT NULL, subject TEXT DEFAULT 'عام' NOT NULL, totalMinutes INTEGER DEFAULT 60 NOT NULL, completedMinutes INTEGER DEFAULT 0 NOT NULL, progressPercent INTEGER DEFAULT 0 NOT NULL, status TEXT DEFAULT 'in_progress' NOT NULL, notes TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resourceBookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, resourceId INTEGER NOT NULL REFERENCES externalResources(id) ON DELETE CASCADE, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, timestampStr TEXT NOT NULL, title TEXT NOT NULL, note TEXT, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS resourceFocusSessions (id INTEGER PRIMARY KEY AUTOINCREMENT, resourceId INTEGER NOT NULL REFERENCES externalResources(id) ON DELETE CASCADE, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, durationMinutes INTEGER NOT NULL, platform TEXT NOT NULL, sessionNotes TEXT, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS smartCalendarEvents (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, category TEXT NOT NULL, sourceType TEXT DEFAULT 'manual' NOT NULL, sourceId INTEGER, eventDate TEXT NOT NULL, startTime TEXT NOT NULL, durationMinutes INTEGER DEFAULT 45 NOT NULL, subject TEXT DEFAULT 'عام' NOT NULL, platform TEXT, linkUrl TEXT, isCompleted INTEGER DEFAULT 0 NOT NULL, notes TEXT, googleEventId TEXT, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyRooms (id INTEGER PRIMARY KEY AUTOINCREMENT, roomCode TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, createdByUserId INTEGER NOT NULL, createdByName TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyRoomMembers (id INTEGER PRIMARY KEY AUTOINCREMENT, roomId INTEGER NOT NULL REFERENCES studyRooms(id) ON DELETE CASCADE, userId INTEGER NOT NULL, userName TEXT NOT NULL, joinedAt INTEGER NOT NULL, UNIQUE(roomId, userId));
CREATE TABLE IF NOT EXISTS studyRoomResources (id INTEGER PRIMARY KEY AUTOINCREMENT, roomId INTEGER NOT NULL REFERENCES studyRooms(id) ON DELETE CASCADE, title TEXT NOT NULL, platform TEXT NOT NULL, url TEXT NOT NULL, subject TEXT DEFAULT 'عام' NOT NULL, addedByUserId INTEGER NOT NULL, addedByName TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS studyRoomProgress (id INTEGER PRIMARY KEY AUTOINCREMENT, roomId INTEGER NOT NULL REFERENCES studyRooms(id) ON DELETE CASCADE, roomResourceId INTEGER NOT NULL REFERENCES studyRoomResources(id) ON DELETE CASCADE, userId INTEGER NOT NULL, userName TEXT NOT NULL, progressPercent INTEGER DEFAULT 0 NOT NULL, completedMinutes INTEGER DEFAULT 0 NOT NULL, lastActiveAt INTEGER NOT NULL, UNIQUE(roomResourceId, userId));
CREATE TABLE IF NOT EXISTS notificationDismissals (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, notificationKey TEXT NOT NULL, dismissedAt INTEGER NOT NULL, UNIQUE(userId, notificationKey));
CREATE TABLE IF NOT EXISTS notificationSettings (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE, leadMinutes INTEGER DEFAULT 30 NOT NULL, soundEnabled INTEGER DEFAULT 1 NOT NULL, browserPushEnabled INTEGER DEFAULT 0 NOT NULL, antiProcrastinationMode INTEGER DEFAULT 1 NOT NULL, updatedAt INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS externalResourcePdfs (id INTEGER PRIMARY KEY AUTOINCREMENT, resourceId INTEGER REFERENCES externalResources(id) ON DELETE CASCADE, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, fileName TEXT NOT NULL, fileUrl TEXT, subject TEXT DEFAULT 'عام' NOT NULL, extractedText TEXT NOT NULL, summaryJson TEXT, characterCount INTEGER DEFAULT 0 NOT NULL, createdAt INTEGER NOT NULL);
  `;
  sqlite.exec(ddl);
  try {
    sqlite.exec("ALTER TABLE smartCalendarEvents ADD COLUMN googleEventId TEXT");
  } catch {}
}

async function ensureDefaultOwner(db: any) {
  try {
    const existing = await db.select().from(users).where(or(eq(users.openId, DEFAULT_OWNER_OPEN_ID), eq(users.email, DEFAULT_OWNER_EMAIL), eq(users.openId, "owner_seif"))).limit(1);
    if (!existing[0]) {
      await db.insert(users).values({
        openId: DEFAULT_OWNER_OPEN_ID,
        name: "سيف",
        email: DEFAULT_OWNER_EMAIL,
        loginMethod: "local",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
    }
  } catch (err) {
    console.error("Failed to seed default owner:", err);
  }
}

export { DB_PATH };

export function getSqlite(): any {
  if (!_sqlite) {
    ensureDbDirectory();
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    initSqliteTables(_sqlite);
  }
  return _sqlite;
}

export function resetDbConnection(): void {
  if (_sqlite) {
    try {
      _sqlite.close();
    } catch {}
    _sqlite = null;
  }
  _db = null;
}

export async function getDb() {
  if (!_db) {
    ensureDbDirectory();
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    initSqliteTables(_sqlite);
    _db = drizzle(_sqlite);
    await ensureDefaultOwner(_db);
    await seedCatalogs(_db);
  }
  return _db;
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await database();
  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
  };
  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: new Date(), role: values.role },
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

function dateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function coinRewardForPomodoro(minutes: number) {
  return ({ 15: 8, 25: 12, 45: 22, 60: 30 } as Record<number, number>)[minutes] ?? 0;
}

export function taskRewardForPriority(priority: "urgent" | "medium" | "low") {
  return ({ urgent: 30, medium: 20, low: 10 } as const)[priority];
}

export function examBonusForComprehension(score: number) {
  if (score >= 95) return 75;
  if (score >= 90) return 50;
  if (score >= 80) return 35;
  if (score >= 70) return 20;
  if (score >= 60) return 10;
  return 0;
}

export function canSpendCoins(balance: number, cost: number) {
  return decideRewardPurchase({ hasPriorReference: false, balance, cost }) === "approved";
}

export function isFirstCompletion(status: string) {
  return decideCompletion(status) === "award";
}

export function validatedVideoIncrement(previousPosition: number, nextPosition: number, elapsedOnServer: number) {
  const delta = nextPosition - previousPosition;
  return delta >= 0 && delta <= Math.min(70, Math.max(0, elapsedOnServer) + 4) ? delta : 0;
}

export function isAchievementEligible(current: number, target: number) {
  return selectAchievementUnlocks([{ id: 1, metric: "lessonsCompleted" as AchievementMetric, target }], new Set(), { lessonsCompleted: current }).length === 1;
}

async function seedCatalogs(db: any) {
  const [rewardCount] = await db.select({ value: count() }).from(rewards);
  if (Number(rewardCount?.value ?? 0) === 0) await db.insert(rewards).values(rewardCatalog);
  const [achievementCount] = await db.select({ value: count() }).from(achievements);
  if (Number(achievementCount?.value ?? 0) === 0) await db.insert(achievements).values(achievementCatalog);
}

export async function getActiveCycle(userId: number) {
  const db = await database();
  await seedCatalogs(db);
  const current = await db.select().from(studyCycles)
    .where(and(eq(studyCycles.userId, userId), eq(studyCycles.status, "active"))).orderBy(desc(studyCycles.createdAt)).limit(1);
  if (current[0] && current[0].endAt.getTime() > Date.now()) return current[0];
  if (current[0]) await db.update(studyCycles).set({ status: "completed" }).where(eq(studyCycles.id, current[0].id));
  const startAt = new Date();
  const endAt = new Date(startAt.getTime() + 90 * DAY_MS);
  const cycleKey = `cycle-${userId}-${startAt.getTime()}`;
  await db.insert(studyCycles).values({ userId, cycleKey, startAt, endAt, status: "active" });
  const created = await db.select().from(studyCycles).where(and(eq(studyCycles.userId, userId), eq(studyCycles.cycleKey, cycleKey))).limit(1);
  if (!created[0]) throw new Error("تعذر بدء دورة المذاكرة.");
  return created[0];
}

async function getCoinSummary(db: any, userId: number, cycleId: number) {
  const [row] = await db.select({
    balance: sql<number>`coalesce(sum(${coinTransactions.amount}), 0)`,
    earned: sql<number>`coalesce(sum(case when ${coinTransactions.amount} > 0 then ${coinTransactions.amount} else 0 end), 0)`,
    spent: sql<number>`coalesce(sum(case when ${coinTransactions.amount} < 0 then -${coinTransactions.amount} else 0 end), 0)`,
  }).from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.cycleId, cycleId)));
  return { balance: Number(row?.balance ?? 0), earned: Number(row?.earned ?? 0), spent: Number(row?.spent ?? 0) };
}

async function awardCoins(params: { userId: number; cycleId: number; amount: number; reason: string; referenceKey: string }) {
  const db = await database();
  if (params.amount <= 0) throw new Error("قيمة المكافأة غير صحيحة.");
  const already = await db.select({ id: coinTransactions.id }).from(coinTransactions).where(eq(coinTransactions.referenceKey, params.referenceKey)).limit(1);
  if (already[0]) return { awarded: false, balance: (await getCoinSummary(db, params.userId, params.cycleId)).balance };
  await db.insert(coinTransactions).values({ ...params, type: "earn" });
  return { awarded: true, balance: (await getCoinSummary(db, params.userId, params.cycleId)).balance };
}

async function recordStudyEvent(params: { userId: number; cycleId: number; subjectId?: number | null; eventType: typeof studyEvents.$inferInsert.eventType; referenceId: string; durationMinutes?: number }) {
  const db = await database();
  const exists = await db.select({ id: studyEvents.id }).from(studyEvents).where(and(eq(studyEvents.userId, params.userId), eq(studyEvents.referenceId, params.referenceId))).limit(1);
  if (exists[0]) return false;
  await db.insert(studyEvents).values({ ...params, durationMinutes: params.durationMinutes ?? 0 });
  return true;
}

async function metricSnapshot(db: any, userId: number, cycleId: number) {
  const eventDay = sql<string>`date(${studyEvents.occurredAt}, 'unixepoch')`;
  const [events] = await db.select({
    lessonsCompleted: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'lesson_complete' then 1 else 0 end), 0)`,
    reviews: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'lesson_review' then 1 else 0 end), 0)`,
    studyMinutes: sql<number>`coalesce(sum(${studyEvents.durationMinutes}), 0)`,
    pomodoros: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'pomodoro_complete' then 1 else 0 end), 0)`,
    tasksCompleted: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'task_complete' then 1 else 0 end), 0)`,
    urgentTasks: sql<number>`0`,
    goalsCompleted: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'goal_complete' then 1 else 0 end), 0)`,
    habitDays: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'habit_complete' then 1 else 0 end), 0)`,
    videoMinutes: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'video_block' then ${studyEvents.durationMinutes} else 0 end), 0)`,
    videoBlocks: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'video_block' then 1 else 0 end), 0)`,
    examsCompleted: sql<number>`coalesce(sum(case when ${studyEvents.eventType} = 'exam_complete' then 1 else 0 end), 0)`,
    activeDays: sql<number>`count(distinct date(${studyEvents.occurredAt}, 'unixepoch'))`,
  }).from(studyEvents).where(and(eq(studyEvents.userId, userId), eq(studyEvents.cycleId, cycleId)));
  const [videoStats] = await db.select({
    totalVideoSeconds: sql<number>`coalesce(sum(${studyVideoSessions.activeSeconds}), 0)`,
  }).from(studyVideoSessions).where(and(eq(studyVideoSessions.userId, userId), eq(studyVideoSessions.cycleId, cycleId)));
  const [urgent] = await db.select({ value: count() }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycleId), eq(tasks.status, "completed"), eq(tasks.priority, "urgent")));
  const [examSummary] = await db.select({
    best: sql<number>`coalesce(max(${examAttempts.score}), 0)`,
    average: sql<number>`coalesce(avg(${examAttempts.score}), 0)`,
  }).from(examAttempts).where(and(eq(examAttempts.userId, userId), eq(examAttempts.cycleId, cycleId)));
  const coins = await getCoinSummary(db, userId, cycleId);
  const activityRows = await db.select({ day: eventDay }).from(studyEvents)
    .where(and(eq(studyEvents.userId, userId), eq(studyEvents.cycleId, cycleId), sql`${studyEvents.occurredAt} is not null`))
    .groupBy(eventDay).orderBy(desc(eventDay));
  let streak = 0;
  let cursor = new Date(`${dateKey()}T00:00:00.000Z`).getTime();
  for (const row of activityRows) {
    if (!row.day) continue;
    const day = new Date(`${row.day}T00:00:00.000Z`).getTime();
    if (day === cursor) { streak += 1; cursor -= DAY_MS; }
    else if (streak === 0 && day === cursor - DAY_MS) { streak += 1; cursor = day - DAY_MS; }
    else break;
  }
  const recordedVideoMin = Number(events?.videoMinutes ?? 0);
  const sessionVideoMin = Math.round((Number(videoStats?.totalVideoSeconds ?? 0)) / 60);
  const totalVideoMinutes = Math.max(recordedVideoMin, sessionVideoMin);
  const extraVideoMinutes = Math.max(0, totalVideoMinutes - recordedVideoMin);
  const totalStudyMinutes = Number(events?.studyMinutes ?? 0) + extraVideoMinutes;

  const values = {
    lessonsCompleted: Number(events?.lessonsCompleted ?? 0), reviews: Number(events?.reviews ?? 0), studyMinutes: totalStudyMinutes,
    pomodoros: Number(events?.pomodoros ?? 0), tasksCompleted: Number(events?.tasksCompleted ?? 0), urgentTasks: Number(urgent?.value ?? 0),
    goalsCompleted: Number(events?.goalsCompleted ?? 0), habitDays: Number(events?.habitDays ?? 0), videoMinutes: totalVideoMinutes,
    videoBlocks: Number(events?.videoBlocks ?? 0), examsCompleted: Number(events?.examsCompleted ?? 0), bestExamScore: Number(examSummary?.best ?? 0),
    averageExamScore: Number(examSummary?.average ?? 0), coinsEarned: coins.earned, activeDays: Number(events?.activeDays ?? 0), currentStreak: streak,
  };
  return { ...values, compositeScholar: Math.min(values.lessonsCompleted, Math.floor(values.studyMinutes / 30)), compositeProductivity: Math.min(values.tasksCompleted, values.pomodoros * 2), compositeAcademic: Math.min(values.examsCompleted, Math.floor(values.averageExamScore / 8.5)), cycleComplete: values.activeDays };
}

export async function evaluateAchievements(userId: number, cycleId: number) {
  const db = await database();
  const metrics = await metricSnapshot(db, userId, cycleId) as Record<AchievementMetric, number>;
  const streakRewards: Record<number, number> = { 3: 25, 7: 75, 14: 150, 30: 400, 60: 800, 90: 1500 };
  const milestone = Object.keys(streakRewards).map(Number).filter(days => metrics.currentStreak >= days).sort((a, b) => b - a)[0];
  if (milestone) await awardCoins({ userId, cycleId, amount: streakRewards[milestone], reason: `مكافأة سلسلة ${milestone} يوم`, referenceKey: `streak:${cycleId}:${milestone}` });
  const catalog = await db.select().from(achievements);
  const unlocked = await db.select({ achievementId: userAchievements.achievementId }).from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.cycleId, cycleId)));
  const unlockedIds = new Set(unlocked.map((row: any) => row.achievementId));
  const newUnlocks = selectAchievementUnlocks(catalog as any[], unlockedIds, metrics);
  if (newUnlocks.length) await db.insert(userAchievements).values(newUnlocks.map((item: any) => ({ userId, cycleId, achievementId: item.id })));
  return newUnlocks.map((item: any) => ({ id: item.id, title: item.title, rarity: item.rarity }));
}

async function ownedLesson(db: any, userId: number, lessonId: number) {
  const rows = await db.select({ lessonId: lessons.id, subjectId: subjects.id, cycleId: subjects.cycleId, title: lessons.title })
    .from(lessons).innerJoin(chapters, eq(lessons.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(and(eq(lessons.id, lessonId), eq(subjects.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("الدرس غير موجود.");
  return rows[0];
}

export async function dashboard(userId: number) {
  const db = await database();
  const cycle = await getActiveCycle(userId);
  const metrics = await metricSnapshot(db, userId, cycle.id);
  const coins = await getCoinSummary(db, userId, cycle.id);
  const today = dateKey();
  const todaysTasks = await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id), eq(tasks.scheduledFor, today))).orderBy(desc(tasks.priority));
  const upcomingExams = await db.select({ id: exams.id, title: exams.title, scheduledAt: exams.scheduledAt, subject: subjects.title }).from(exams)
    .leftJoin(subjects, eq(exams.subjectId, subjects.id)).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id), gte(exams.scheduledAt, new Date()))).orderBy(exams.scheduledAt).limit(4);
  const activeGoals = await db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.cycleId, cycle.id), eq(goals.status, "active"))).orderBy(desc(goals.progress)).limit(4);
  const ongoingPomodoro = await db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.cycleId, cycle.id), inArray(pomodoroSessions.state, ["running", "paused"]))).orderBy(desc(pomodoroSessions.createdAt)).limit(1);
  return { cycle, metrics, coins, todaysTasks, upcomingExams, activeGoals, ongoingPomodoro: ongoingPomodoro[0] ?? null };
}

export async function listStudyPlan(userId: number) {
  const db = await database();
  const cycle = await getActiveCycle(userId);
  const rows = await db.select({ subject: subjects, chapter: chapters, lesson: lessons, progress: lessonProgress })
    .from(subjects).leftJoin(chapters, eq(chapters.subjectId, subjects.id)).leftJoin(lessons, eq(lessons.chapterId, chapters.id))
    .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId)))
    .where(and(eq(subjects.userId, userId), eq(subjects.cycleId, cycle.id))).orderBy(subjects.createdAt, chapters.sortOrder, lessons.sortOrder);
  return { cycle, rows };
}

export async function createSubject(userId: number, input: { title: string; color?: string }) {
  const db = await database(); const cycle = await getActiveCycle(userId);
  await db.insert(subjects).values({ userId, cycleId: cycle.id, title: input.title, color: input.color ?? "#10B981" });
}
export async function updateSubject(userId: number, subjectId: number, input: { title: string; color?: string }) { const db = await database(); return db.update(subjects).set({ title: input.title, ...(input.color ? { color: input.color } : {}) }).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))); }
export async function deleteSubject(userId: number, subjectId: number) { const db = await database(); return db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId))); }
export async function createChapter(userId: number, input: { subjectId: number; title: string }) {
  const db = await database();
  const valid = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, input.subjectId), eq(subjects.userId, userId))).limit(1);
  if (!valid[0]) throw new Error("المادة غير موجودة.");
  const [last] = await db.select({ order: sql<number>`coalesce(max(${chapters.sortOrder}), 0)` }).from(chapters).where(eq(chapters.subjectId, input.subjectId));
  await db.insert(chapters).values({ subjectId: input.subjectId, title: input.title, sortOrder: Number(last?.order ?? 0) + 1 });
}
export async function updateChapter(userId: number, chapterId: number, title: string) { const db = await database(); const valid = await db.select({ id: chapters.id }).from(chapters).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(and(eq(chapters.id, chapterId), eq(subjects.userId, userId))).limit(1); if (!valid[0]) throw new Error("الفصل غير موجود."); return db.update(chapters).set({ title }).where(eq(chapters.id, chapterId)); }
export async function deleteChapter(userId: number, chapterId: number) { const db = await database(); const valid = await db.select({ id: chapters.id }).from(chapters).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(and(eq(chapters.id, chapterId), eq(subjects.userId, userId))).limit(1); if (!valid[0]) throw new Error("الفصل غير موجود."); return db.delete(chapters).where(eq(chapters.id, chapterId)); }
export async function createLesson(userId: number, input: { chapterId: number; title: string; description?: string; estimatedMinutes: number; notes?: string }) {
  const db = await database();
  const ownership = await db.select({ id: chapters.id }).from(chapters).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(and(eq(chapters.id, input.chapterId), eq(subjects.userId, userId))).limit(1);
  if (!ownership[0]) throw new Error("الفصل غير موجود.");
  const [last] = await db.select({ order: sql<number>`coalesce(max(${lessons.sortOrder}), 0)` }).from(lessons).where(eq(lessons.chapterId, input.chapterId));
  await db.insert(lessons).values({ ...input, description: input.description ?? null, notes: input.notes ?? null, sortOrder: Number(last?.order ?? 0) + 1 });
}
export async function updateLesson(userId: number, lessonId: number, input: { title: string; description?: string; estimatedMinutes: number; notes?: string }) { const db = await database(); await ownedLesson(db, userId, lessonId); return db.update(lessons).set({ title: input.title, description: input.description ?? null, estimatedMinutes: input.estimatedMinutes, notes: input.notes ?? null }).where(eq(lessons.id, lessonId)); }
export async function deleteLesson(userId: number, lessonId: number) { const db = await database(); await ownedLesson(db, userId, lessonId); return db.delete(lessons).where(eq(lessons.id, lessonId)); }
export async function updateLessonProgress(userId: number, lessonId: number, progress: number) {
  const db = await database(); await ownedLesson(db, userId, lessonId);
  const value = Math.min(99, Math.max(0, progress));
  const prior = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1);
  if (prior[0]) await db.update(lessonProgress).set({ status: value ? "in_progress" : "not_started", progress: value }).where(eq(lessonProgress.id, prior[0].id));
  else await db.insert(lessonProgress).values({ userId, lessonId, status: value ? "in_progress" : "not_started", progress: value });
}
export async function completeLesson(userId: number, lessonId: number) {
  const db = await database(); const lesson = await ownedLesson(db, userId, lessonId);
  const prior = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1);
  if (prior[0]?.status === "completed") return { alreadyCompleted: true, awarded: false, unlocks: [] };
  if (prior[0]) await db.update(lessonProgress).set({ status: "completed", progress: 100, completedAt: new Date() }).where(eq(lessonProgress.id, prior[0].id));
  else await db.insert(lessonProgress).values({ userId, lessonId, status: "completed", progress: 100, completedAt: new Date() });
  await recordStudyEvent({ userId, cycleId: lesson.cycleId, subjectId: lesson.subjectId, eventType: "lesson_complete", referenceId: `lesson:${lessonId}:complete` });
  const reward = await awardCoins({ userId, cycleId: lesson.cycleId, amount: 75, reason: `إكمال درس: ${lesson.title}`, referenceKey: `lesson:${lessonId}:complete` });
  return { alreadyCompleted: false, ...reward, unlocks: await evaluateAchievements(userId, lesson.cycleId) };
}
export async function reviewLesson(userId: number, lessonId: number) {
  const db = await database(); const lesson = await ownedLesson(db, userId, lessonId);
  const prior = await db.select().from(lessonProgress).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId))).limit(1);
  if (prior[0]?.status !== "completed") throw new Error("أكمل الدرس أولًا قبل مراجعته.");
  const ref = `lesson:${lessonId}:review:${dateKey()}`;
  await db.update(lessonProgress).set({ lastReviewedAt: new Date() }).where(eq(lessonProgress.id, prior[0].id));
  await recordStudyEvent({ userId, cycleId: lesson.cycleId, subjectId: lesson.subjectId, eventType: "lesson_review", referenceId: ref });
  const reward = await awardCoins({ userId, cycleId: lesson.cycleId, amount: 15, reason: `مراجعة درس: ${lesson.title}`, referenceKey: ref });
  return { ...reward, unlocks: await evaluateAchievements(userId, lesson.cycleId) };
}

export async function listTasks(userId: number) {
  const db = await database();
  const cycle = await getActiveCycle(userId);
  const rows = await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id))).orderBy(tasks.status, tasks.scheduledFor, desc(tasks.createdAt));
  return rows.map(t => {
    if (t.scheduledFor && /^\d+(\.\d+)?$/.test(t.scheduledFor)) {
      const d = new Date(Number(t.scheduledFor));
      return { ...t, scheduledFor: !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : t.scheduledFor };
    }
    return t;
  });
}
export async function createTask(userId: number, input: { title: string; description?: string; scheduledFor?: string; deadline?: Date; priority: "urgent" | "medium" | "low"; category?: string }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(tasks).values({ userId, cycleId: cycle.id, title: input.title, description: input.description ?? null, scheduledFor: input.scheduledFor ?? dateKey(), deadline: input.deadline ?? null, priority: input.priority, category: input.category ?? "دراسة" }); }
export async function completeTask(userId: number, taskId: number) {
  const db = await database(); const item = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))).limit(1); if (!item[0]) throw new Error("المهمة غير موجودة.");
  if (!isFirstCompletion(item[0].status)) return { alreadyCompleted: true, awarded: false, unlocks: [] };
  await db.update(tasks).set({ status: "completed", completedAt: new Date() }).where(eq(tasks.id, taskId));
  const ref = `task:${taskId}:complete`; await recordStudyEvent({ userId, cycleId: item[0].cycleId, eventType: "task_complete", referenceId: ref });
  const reward = await awardCoins({ userId, cycleId: item[0].cycleId, amount: taskRewardForPriority(item[0].priority), reason: `إكمال مهمة: ${item[0].title}`, referenceKey: ref });
  return { alreadyCompleted: false, ...reward, unlocks: await evaluateAchievements(userId, item[0].cycleId) };
}
export async function updateTask(userId: number, taskId: number, input: { title: string; description?: string; scheduledFor?: string; deadline?: Date; priority: "urgent" | "medium" | "low"; category?: string }) { const db = await database(); return db.update(tasks).set({ title: input.title, description: input.description ?? null, scheduledFor: input.scheduledFor ?? null, deadline: input.deadline ?? null, priority: input.priority, category: input.category ?? "دراسة" }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))); }
export async function deleteTask(userId: number, taskId: number) { const db = await database(); return db.delete(tasks).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId))); }

export async function listLessonSources(userId: number) {
  const db = await database();
  return db.select().from(lessonSources).where(eq(lessonSources.userId, userId)).orderBy(lessonSources.subject, lessonSources.createdAt);
}

export async function createLessonSource(userId: number, input: LessonSourceDraft) {
  const db = await database();
  await db.insert(lessonSources).values({
    userId,
    subject: input.subject,
    platform: input.platform,
    teacherName: input.teacherName,
    delivery: input.delivery,
    role: input.role,
    url: input.url ?? null,
    location: input.location ?? null,
    weeklyPlan: input.weeklyPlan ?? null,
    notes: input.notes ?? null,
  });
}

async function ownedLessonSource(db: any, userId: number, sourceId: number) {
  const row = await db.select({ id: lessonSources.id }).from(lessonSources).where(and(eq(lessonSources.id, sourceId), eq(lessonSources.userId, userId))).limit(1);
  if (!row[0]) throw new Error("مصدر الدرس غير موجود.");
}

export async function updateLessonSource(userId: number, sourceId: number, input: LessonSourceDraft & { active: boolean }) {
  const db = await database();
  await ownedLessonSource(db, userId, sourceId);
  return db.update(lessonSources).set({
    subject: input.subject,
    platform: input.platform,
    teacherName: input.teacherName,
    delivery: input.delivery,
    role: input.role,
    url: input.url ?? null,
    location: input.location ?? null,
    weeklyPlan: input.weeklyPlan ?? null,
    notes: input.notes ?? null,
    active: input.active,
  }).where(eq(lessonSources.id, sourceId));
}

export async function deleteLessonSource(userId: number, sourceId: number) {
  const db = await database();
  await ownedLessonSource(db, userId, sourceId);
  return db.delete(lessonSources).where(eq(lessonSources.id, sourceId));
}

export async function seedSeifLessonSources(userId: number) {
  const db = await database();
  for (const source of seifLessonSourceDefaults) {
    const existing = await db.select({ id: lessonSources.id }).from(lessonSources).where(and(
      eq(lessonSources.userId, userId),
      eq(lessonSources.subject, source.subject),
      eq(lessonSources.platform, source.platform),
      eq(lessonSources.teacherName, source.teacherName),
    )).limit(1);
    if (!existing[0]) await db.insert(lessonSources).values({ ...source, userId, url: source.url ?? null, location: source.location ?? null, weeklyPlan: source.weeklyPlan ?? null, notes: source.notes ?? null });
  }
  return listLessonSources(userId);
}

export async function listAssistantMessages(userId: number, limit = 24) {
  const db = await database();
  const rows = await db.select().from(assistantMessages).where(eq(assistantMessages.userId, userId)).orderBy(desc(assistantMessages.createdAt)).limit(limit);
  return rows.reverse();
}

export async function saveAssistantMessage(userId: number, role: "user" | "assistant", content: string) {
  const db = await database();
  await db.insert(assistantMessages).values({ userId, role, content: content.slice(0, 5000) });
}

export async function getDailyStudySummary(userId: number) {
  const db = await database(); const cycle = await getActiveCycle(userId); const today = dateKey();
  const existing = await db.select().from(dailyStudySummaries).where(and(eq(dailyStudySummaries.userId, userId), eq(dailyStudySummaries.summaryDate, today))).limit(1);
  if (existing[0]) return { ...existing[0], isNew: false };
  const openTasks = await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id), eq(tasks.status, "open"), lte(tasks.scheduledFor, today))).orderBy(desc(tasks.priority), tasks.scheduledFor).limit(6);
  const dueToday = openTasks.filter(task => task.scheduledFor === today);
  const urgent = openTasks.filter(task => task.priority === "urgent");
  const upcoming = await db.select({ title: exams.title, scheduledAt: exams.scheduledAt }).from(exams).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id), gte(exams.scheduledAt, new Date()))).orderBy(exams.scheduledAt).limit(1);
  const names = openTasks.slice(0, 3).map(task => `«${task.title}»`).join("، ");
  const content = `صباح الفل يا سيف. النهاردة عندك ${dueToday.length} مهمة متخططلها${urgent.length ? `، منهم ${urgent.length} مهم` : ""}. ${openTasks.length ? `ابدأ بـ ${names}.` : "جدولك فاضي حاليًا؛ حط مهمة صغيرة ونكسب اليوم."}${upcoming[0]?.scheduledAt ? ` والامتحان الجاي «${upcoming[0].title}» يوم ${upcoming[0].scheduledAt.toLocaleDateString("ar-EG")}.` : ""}`;
  await db.insert(dailyStudySummaries).values({ userId, cycleId: cycle.id, summaryDate: today, content }).onConflictDoUpdate({
    target: [dailyStudySummaries.userId, dailyStudySummaries.summaryDate],
    set: { content }
  });
  const stored = await db.select().from(dailyStudySummaries).where(and(eq(dailyStudySummaries.userId, userId), eq(dailyStudySummaries.summaryDate, today))).limit(1);
  return { ...stored[0], isNew: true };
}

export async function listHabits(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const items = await db.select().from(habits).where(and(eq(habits.userId, userId), eq(habits.cycleId, cycle.id))); const todays = await db.select().from(habitCompletions).where(and(eq(habitCompletions.userId, userId), eq(habitCompletions.cycleId, cycle.id), eq(habitCompletions.completedOn, dateKey()))); return { items, completedIds: todays.map((x: any) => x.habitId) }; }
export async function createHabit(userId: number, input: { name: string; frequency: "daily" | "weekly"; target: number }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(habits).values({ userId, cycleId: cycle.id, ...input }); }
export async function completeHabit(userId: number, habitId: number, completedOn = dateKey()) { const db = await database(); const item = await db.select().from(habits).where(and(eq(habits.id, habitId), eq(habits.userId, userId))).limit(1); if (!item[0]) throw new Error("العادة غير موجودة."); const prior = await db.select().from(habitCompletions).where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.completedOn, completedOn))).limit(1); if (prior[0]) return { alreadyCompleted: true, awarded: false, unlocks: [] }; await db.insert(habitCompletions).values({ userId, habitId, cycleId: item[0].cycleId, completedOn }); const ref = `habit:${habitId}:${completedOn}`; await recordStudyEvent({ userId, cycleId: item[0].cycleId, eventType: "habit_complete", referenceId: ref }); const reward = await awardCoins({ userId, cycleId: item[0].cycleId, amount: 10, reason: `إكمال عادة: ${item[0].name}`, referenceKey: ref }); return { alreadyCompleted: false, ...reward, unlocks: await evaluateAchievements(userId, item[0].cycleId) }; }
export async function updateHabit(userId: number, habitId: number, input: { name: string; frequency: "daily" | "weekly"; target: number }) { const db = await database(); return db.update(habits).set(input).where(and(eq(habits.id, habitId), eq(habits.userId, userId))); }
export async function deleteHabit(userId: number, habitId: number) { const db = await database(); return db.delete(habits).where(and(eq(habits.id, habitId), eq(habits.userId, userId))); }

export async function listGoals(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); return db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.cycleId, cycle.id))).orderBy(goals.status, desc(goals.progress)); }
export async function createGoal(userId: number, input: { title: string; description?: string; deadline?: Date; milestones?: Array<{ title: string; targetPercent: number }> }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(goals).values({ userId, cycleId: cycle.id, title: input.title, description: input.description ?? null, deadline: input.deadline ?? null }); const goal = await db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.cycleId, cycle.id), eq(goals.title, input.title))).orderBy(desc(goals.id)).limit(1); if (goal[0] && input.milestones?.length) await db.insert(goalMilestones).values(input.milestones.map(m => ({ goalId: goal[0].id, ...m }))); }
export async function updateGoalProgress(userId: number, goalId: number, progress: number) { const db = await database(); const item = await db.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1); if (!item[0]) throw new Error("الهدف غير موجود."); const finalProgress = Math.min(100, Math.max(0, progress)); const becomesComplete = finalProgress >= 100 && item[0].status !== "completed"; await db.update(goals).set({ progress: finalProgress, status: finalProgress >= 100 ? "completed" : "active", completedAt: finalProgress >= 100 ? new Date() : null }).where(eq(goals.id, goalId)); await db.update(goalMilestones).set({ completedAt: new Date() }).where(and(eq(goalMilestones.goalId, goalId), lte(goalMilestones.targetPercent, finalProgress))); if (!becomesComplete) return { completedNow: false, awarded: false, unlocks: [] }; const ref = `goal:${goalId}:complete`; await recordStudyEvent({ userId, cycleId: item[0].cycleId, eventType: "goal_complete", referenceId: ref }); const reward = await awardCoins({ userId, cycleId: item[0].cycleId, amount: 50, reason: `إكمال هدف: ${item[0].title}`, referenceKey: ref }); return { completedNow: true, ...reward, unlocks: await evaluateAchievements(userId, item[0].cycleId) }; }
export async function updateGoal(userId: number, goalId: number, input: { title: string; description?: string; deadline?: Date }) { const db = await database(); return db.update(goals).set({ title: input.title, description: input.description ?? null, deadline: input.deadline ?? null }).where(and(eq(goals.id, goalId), eq(goals.userId, userId))); }
export async function deleteGoal(userId: number, goalId: number) { const db = await database(); return db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))); }

export async function listPomodoros(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); return db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.cycleId, cycle.id))).orderBy(desc(pomodoroSessions.createdAt)).limit(30); }
export async function startPomodoro(userId: number, input: { plannedMinutes: 15 | 25 | 45 | 60; subjectId?: number }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(pomodoroSessions).values({ userId, cycleId: cycle.id, plannedMinutes: input.plannedMinutes, subjectId: input.subjectId ?? null, state: "running" }); const created = await db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.cycleId, cycle.id), eq(pomodoroSessions.state, "running"))).orderBy(desc(pomodoroSessions.id)).limit(1); return created[0]; }
export async function completePomodoro(userId: number, sessionId: number) { const db = await database(); const session = await db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.id, sessionId), eq(pomodoroSessions.userId, userId))).limit(1); if (!session[0]) throw new Error("جلسة Pomodoro غير موجودة."); if (session[0].state === "completed") return { alreadyCompleted: true, awarded: false, unlocks: [] }; if (session[0].state !== "running") throw new Error("استأنف الجلسة قبل إكمالها."); const elapsed = Date.now() - session[0].startedAt.getTime() - session[0].pausedSeconds * 1000; if (elapsed < session[0].plannedMinutes * 60_000 * 0.9) throw new Error("لا يمكن منح المكافأة قبل إكمال الجلسة بالكامل."); await db.update(pomodoroSessions).set({ state: "completed", completedMinutes: session[0].plannedMinutes, completedAt: new Date(), pausedAt: null }).where(eq(pomodoroSessions.id, sessionId)); const ref = `pomodoro:${sessionId}:complete`; await recordStudyEvent({ userId, cycleId: session[0].cycleId, subjectId: session[0].subjectId, eventType: "pomodoro_complete", referenceId: ref, durationMinutes: session[0].plannedMinutes }); const reward = await awardCoins({ userId, cycleId: session[0].cycleId, amount: coinRewardForPomodoro(session[0].plannedMinutes), reason: `Pomodoro مكتمل — ${session[0].plannedMinutes} دقيقة`, referenceKey: ref }); return { alreadyCompleted: false, ...reward, unlocks: await evaluateAchievements(userId, session[0].cycleId) }; }
export async function pausePomodoro(userId: number, sessionId: number, paused: boolean) { const db = await database(); const rows = await db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.id, sessionId), eq(pomodoroSessions.userId, userId))).limit(1); const session = rows[0]; if (!session || !["running", "paused"].includes(session.state)) throw new Error("لا يمكن تعديل هذه الجلسة."); if (paused && session.state === "running") return db.update(pomodoroSessions).set({ state: "paused", pausedAt: new Date() }).where(eq(pomodoroSessions.id, sessionId)); if (!paused && session.state === "paused") { const pauseSeconds = session.pausedAt ? Math.max(0, Math.floor((Date.now() - session.pausedAt.getTime()) / 1000)) : 0; return db.update(pomodoroSessions).set({ state: "running", pausedAt: null, pausedSeconds: session.pausedSeconds + pauseSeconds }).where(eq(pomodoroSessions.id, sessionId)); } return { rowsAffected: 0 }; }

export async function startVideoSession(userId: number, input: { videoUrl: string; lessonTitle?: string; subject: "arabic" | "history" | "english" | "programming_ai" | "german" | "other"; requestedMode: "auto" | "embedded" | "external" }) { const db = await database(); const cycle = await getActiveCycle(userId); const detected = classifyStudySource(input.videoUrl); if (detected === "invalid") throw new Error("رابط الدرس غير صالح."); const sourceMode = input.requestedMode === "external" || detected === "external" ? "external" : "embedded"; await db.insert(studyVideoSessions).values({ userId, cycleId: cycle.id, videoUrl: input.videoUrl, lessonTitle: input.lessonTitle || null, subject: input.subject, sourceMode, manualProgress: "started", timerRunning: false, lastPlaybackAt: null, phase: "watching" }); const created = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.userId, userId), eq(studyVideoSessions.cycleId, cycle.id))).orderBy(desc(studyVideoSessions.id)).limit(1); return created[0]; }
async function findSubjectIdForVideo(db: any, userId: number, cycleId: number, subjectKey: string) {
  const userSubjects = await db.select().from(subjects).where(and(eq(subjects.userId, userId), eq(subjects.cycleId, cycleId)));
  const match = userSubjects.find((s: any) => {
    const t = (s.title || "").toLowerCase();
    if (subjectKey === "arabic" && (t.includes("عرب") || t.includes("arabic"))) return true;
    if (subjectKey === "english" && (t.includes("انجل") || t.includes("إنجل") || t.includes("english"))) return true;
    if (subjectKey === "programming_ai" && (t.includes("برمج") || t.includes("ذكاء") || t.includes("ai") || t.includes("code"))) return true;
    if (subjectKey === "german" && (t.includes("المان") || t.includes("ألمان") || t.includes("german") || t.includes("deutsch"))) return true;
    if (subjectKey === "history" && (t.includes("تاريخ") || t.includes("history"))) return true;
    return false;
  });
  return match?.id ?? null;
}

export async function endVideoSession(userId: number, sessionId: number) {
  const db = await database();
  const rows = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))).limit(1);
  const item = rows[0];
  if (!item) throw new Error("جلسة الفيديو غير موجودة.");
  const now = new Date();
  const addedSeconds = item.timerRunning && item.lastPlaybackAt ? Math.min(10_800, Math.max(0, Math.floor((now.getTime() - item.lastPlaybackAt.getTime()) / 1000))) : 0;
  const activeSeconds = item.activeSeconds + addedSeconds;
  const previousBlocks = Math.floor(item.activeSeconds / 2700);
  const completedBlocks = Math.floor(activeSeconds / 2700);
  await db.update(studyVideoSessions).set({ phase: "completed", lastPlaybackAt: null, timerRunning: false, activeSeconds, completedBlocks }).where(eq(studyVideoSessions.id, sessionId));
  const subjectId = await findSubjectIdForVideo(db, userId, item.cycleId, item.subject);
  if (completedBlocks > previousBlocks) {
    const ref = `video:${sessionId}:block:${completedBlocks}`;
    await recordStudyEvent({ userId, cycleId: item.cycleId, subjectId, eventType: "video_block", referenceId: ref, durationMinutes: 45 });
    await awardCoins({ userId, cycleId: item.cycleId, amount: 25, reason: "فيديو مذاكرة — 45 دقيقة", referenceKey: ref });
    await evaluateAchievements(userId, item.cycleId);
  } else if (activeSeconds >= 180) {
    const sessionRef = `video:${sessionId}:session_time`;
    await recordStudyEvent({
      userId,
      cycleId: item.cycleId,
      subjectId,
      eventType: "video_block",
      referenceId: sessionRef,
      durationMinutes: Math.floor(activeSeconds / 60)
    });
    await evaluateAchievements(userId, item.cycleId);
  }
  return { ended: true, activeSeconds };
}
export async function currentVideoSession(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const rows = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.userId, userId), eq(studyVideoSessions.cycleId, cycle.id), inArray(studyVideoSessions.phase, ["watching", "break"]))).orderBy(desc(studyVideoSessions.updatedAt)).limit(1); return rows[0] ?? null; }
export async function listVideoSessions(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const sessions = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.userId, userId), eq(studyVideoSessions.cycleId, cycle.id))).orderBy(desc(studyVideoSessions.updatedAt)).limit(50); return Promise.all(sessions.map(async session => ({ ...session, notes: await db.select().from(videoNotes).where(and(eq(videoNotes.userId, userId), eq(videoNotes.sessionId, session.id))).orderBy(desc(videoNotes.updatedAt)) }))); }
export async function createVideoNote(userId: number, input: { sessionId: number; title: string; content: string; timestampSeconds?: number }) { const db = await database(); const session = await db.select({ id: studyVideoSessions.id }).from(studyVideoSessions).where(and(eq(studyVideoSessions.id, input.sessionId), eq(studyVideoSessions.userId, userId))).limit(1); if (!session[0]) throw new Error("جلسة الفيديو غير موجودة."); await db.insert(videoNotes).values({ userId, sessionId: input.sessionId, title: input.title, content: input.content, timestampSeconds: input.timestampSeconds ?? null }); }
export async function updateVideoNote(userId: number, noteId: number, input: { title: string; content: string; timestampSeconds?: number }) { const db = await database(); const result = await db.update(videoNotes).set({ title: input.title, content: input.content, timestampSeconds: input.timestampSeconds ?? null }).where(and(eq(videoNotes.id, noteId), eq(videoNotes.userId, userId))); if (!result) throw new Error("الملاحظة غير موجودة."); }
export async function deleteVideoNote(userId: number, noteId: number) { const db = await database(); return db.delete(videoNotes).where(and(eq(videoNotes.id, noteId), eq(videoNotes.userId, userId))); }
export async function trackVideoPlayback(userId: number, sessionId: number, input: { active: boolean; playbackPosition?: number }) {
  const db = await database();
  const session = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))).limit(1);
  if (!session[0]) throw new Error("جلسة الفيديو غير موجودة.");
  const item = session[0];
  const now = new Date();
  if (item.phase === "break") return { session: item, addedSeconds: 0, blockCompleted: false, phase: "break" as const };
  if (item.phase !== "watching") return { session: item, addedSeconds: 0, blockCompleted: false, phase: item.phase };

  const position = Math.max(0, Math.floor(input.playbackPosition ?? item.lastPlaybackPosition ?? 0));
  if (!input.active) {
    const elapsedOnServer = item.lastPlaybackAt ? Math.max(0, Math.floor((now.getTime() - item.lastPlaybackAt.getTime()) / 1000)) : 0;
    const addedSeconds = item.timerRunning ? Math.min(75, elapsedOnServer) : 0;
    const previousBlocks = Math.floor(item.activeSeconds / 2700);
    const activeSeconds = item.activeSeconds + addedSeconds;
    const nextBlocks = Math.floor(activeSeconds / 2700);
    const blockCompleted = nextBlocks > previousBlocks;
    const breakEndsAt = blockCompleted ? new Date(now.getTime() + 15 * 60_000) : null;
    await db.update(studyVideoSessions).set({
      activeSeconds,
      completedBlocks: nextBlocks,
      phase: blockCompleted ? "break" : "watching",
      breakEndsAt,
      timerRunning: false,
      lastPlaybackAt: null,
      lastPlaybackPosition: position
    }).where(eq(studyVideoSessions.id, sessionId));
    if (blockCompleted) {
      const ref = `video:${sessionId}:block:${nextBlocks}`;
      await recordStudyEvent({ userId, cycleId: item.cycleId, eventType: "video_block", referenceId: ref, durationMinutes: 45 });
      await awardCoins({ userId, cycleId: item.cycleId, amount: 25, reason: "فيديو مذاكرة — 45 دقيقة", referenceKey: ref });
      await evaluateAchievements(userId, item.cycleId);
    }
    const updated = await db.select().from(studyVideoSessions).where(eq(studyVideoSessions.id, sessionId)).limit(1);
    return { session: updated[0], addedSeconds, blockCompleted, phase: updated[0].phase };
  }

  if (!item.lastPlaybackAt || !item.timerRunning) {
    await db.update(studyVideoSessions).set({ timerRunning: true, lastPlaybackAt: now, lastPlaybackPosition: position }).where(eq(studyVideoSessions.id, sessionId));
    const updated = await db.select().from(studyVideoSessions).where(eq(studyVideoSessions.id, sessionId)).limit(1);
    return { session: updated[0], addedSeconds: 0, blockCompleted: false, phase: "watching" as const };
  }

  const elapsedOnServer = Math.max(0, Math.floor((now.getTime() - item.lastPlaybackAt.getTime()) / 1000));
  let addedSeconds = 0;
  if (input.playbackPosition !== undefined && item.lastPlaybackPosition !== null && item.lastPlaybackPosition > 0 && input.playbackPosition >= item.lastPlaybackPosition) {
    addedSeconds = validatedVideoIncrement(item.lastPlaybackPosition, position, elapsedOnServer);
  } else {
    addedSeconds = Math.min(75, elapsedOnServer);
  }

  const previousBlocks = Math.floor(item.activeSeconds / 2700);
  const activeSeconds = item.activeSeconds + addedSeconds;
  const nextBlocks = Math.floor(activeSeconds / 2700);
  const blockCompleted = nextBlocks > previousBlocks;
  const breakEndsAt = blockCompleted ? new Date(now.getTime() + 15 * 60_000) : null;

  await db.update(studyVideoSessions).set({
    activeSeconds,
    completedBlocks: nextBlocks,
    phase: blockCompleted ? "break" : "watching",
    breakEndsAt,
    timerRunning: !blockCompleted,
    lastPlaybackAt: blockCompleted ? null : now,
    lastPlaybackPosition: position
  }).where(eq(studyVideoSessions.id, sessionId));

  if (blockCompleted) {
    const ref = `video:${sessionId}:block:${nextBlocks}`;
    await recordStudyEvent({ userId, cycleId: item.cycleId, eventType: "video_block", referenceId: ref, durationMinutes: 45 });
    await awardCoins({ userId, cycleId: item.cycleId, amount: 25, reason: "فيديو مذاكرة — 45 دقيقة", referenceKey: ref });
    await evaluateAchievements(userId, item.cycleId);
  }
  const updated = await db.select().from(studyVideoSessions).where(eq(studyVideoSessions.id, sessionId)).limit(1);
  return { session: updated[0], addedSeconds, blockCompleted, phase: updated[0].phase };
}
export async function triggerVideoBreak(userId: number, sessionId: number) {
  const db = await database();
  const rows = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))).limit(1);
  const item = rows[0];
  if (!item) throw new Error("جلسة الفيديو غير موجودة.");
  if (item.phase === "break") return { session: item, blockCompleted: true, phase: "break" as const };

  const now = new Date();
  const elapsed = item.lastPlaybackAt ? Math.max(0, Math.floor((now.getTime() - item.lastPlaybackAt.getTime()) / 1000)) : 0;
  const currentTotal = item.activeSeconds + (item.timerRunning ? elapsed : 0);
  const targetCompletedBlocks = Math.max(item.completedBlocks + 1, Math.floor(currentTotal / 2700) || 1);
  const newActiveSeconds = Math.max(currentTotal, targetCompletedBlocks * 2700);
  const breakEndsAt = new Date(now.getTime() + 15 * 60_000);

  await db.update(studyVideoSessions).set({
    activeSeconds: newActiveSeconds,
    completedBlocks: targetCompletedBlocks,
    phase: "break",
    breakEndsAt,
    timerRunning: false,
    lastPlaybackAt: null,
  }).where(eq(studyVideoSessions.id, sessionId));

  const ref = `video:${sessionId}:block:${targetCompletedBlocks}`;
  await recordStudyEvent({ userId, cycleId: item.cycleId, eventType: "video_block", referenceId: ref, durationMinutes: 45 });
  await awardCoins({ userId, cycleId: item.cycleId, amount: 25, reason: "فيديو مذاكرة — 45 دقيقة", referenceKey: ref });
  await evaluateAchievements(userId, item.cycleId);

  const updated = await db.select().from(studyVideoSessions).where(eq(studyVideoSessions.id, sessionId)).limit(1);
  return { session: updated[0], blockCompleted: true, phase: "break" as const };
}

export async function resumeVideoSession(userId: number, sessionId: number, force?: boolean) {
  const db = await database();
  const item = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))).limit(1);
  if (!item[0]) throw new Error("جلسة الفيديو غير موجودة.");
  if (!force && item[0].phase === "break" && item[0].breakEndsAt && item[0].breakEndsAt.getTime() > Date.now()) {
    throw new Error("فترة الاستراحة لم تنتهِ بعد.");
  }
  await db.update(studyVideoSessions).set({ phase: "watching", breakEndsAt: null, timerRunning: true, lastPlaybackAt: new Date() }).where(eq(studyVideoSessions.id, sessionId));
  return { resumed: true };
}
export async function setVideoManualProgress(userId: number, sessionId: number, progress: "started" | "middle" | "finished" | "reviewed") { const db = await database(); const result: any = await db.update(studyVideoSessions).set({ manualProgress: progress }).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))); if (result?.changes === 0) throw new Error("جلسة الفيديو غير موجودة."); return { progress }; }
export async function setVideoTimer(userId: number, sessionId: number, running: boolean) {
  const db = await database();
  const rows = await db.select().from(studyVideoSessions).where(and(eq(studyVideoSessions.id, sessionId), eq(studyVideoSessions.userId, userId))).limit(1);
  const item = rows[0];
  if (!item) throw new Error("جلسة الفيديو غير موجودة.");
  if (item.phase === "completed") throw new Error("تم إنهاء الجلسة بالفعل.");
  const now = new Date();
  if (running) {
    if (item.phase === "break" && item.breakEndsAt && item.breakEndsAt.getTime() > now.getTime()) throw new Error("فترة الاستراحة لم تنتهِ بعد.");
    await db.update(studyVideoSessions).set({ timerRunning: true, phase: "watching", breakEndsAt: null, lastPlaybackAt: now }).where(eq(studyVideoSessions.id, sessionId));
    return { running: true, activeSeconds: item.activeSeconds };
  }
  const addedSeconds = item.timerRunning && item.lastPlaybackAt ? Math.min(10_800, Math.max(0, Math.floor((now.getTime() - item.lastPlaybackAt.getTime()) / 1000))) : 0;
  const activeSeconds = item.activeSeconds + addedSeconds;
  const previousBlocks = Math.floor(item.activeSeconds / 2700);
  const completedBlocks = Math.floor(activeSeconds / 2700);
  const blockCompleted = completedBlocks > previousBlocks;
  const breakEndsAt = blockCompleted ? new Date(now.getTime() + 15 * 60_000) : null;
  await db.update(studyVideoSessions).set({ activeSeconds, completedBlocks, timerRunning: false, phase: blockCompleted ? "break" : "watching", breakEndsAt, lastPlaybackAt: null }).where(eq(studyVideoSessions.id, sessionId));
  if (blockCompleted) {
    const ref = `video:${sessionId}:block:${completedBlocks}`;
    await recordStudyEvent({ userId, cycleId: item.cycleId, eventType: "video_block", referenceId: ref, durationMinutes: 45 });
    await awardCoins({ userId, cycleId: item.cycleId, amount: 25, reason: "فيديو مذاكرة — 45 دقيقة", referenceKey: ref });
    await evaluateAchievements(userId, item.cycleId);
  }
  return { running: false, activeSeconds, blockCompleted };
}
export async function setExternalVideoTimer(userId: number, sessionId: number, running: boolean) {
  return setVideoTimer(userId, sessionId, running);
}

export function fallbackComprehension(score: number, difficulty: "easy" | "medium" | "hard", priorAverage: number) { return deriveFallbackComprehension(score, difficulty, priorAverage); }
async function estimateComprehension(input: { score: number; correctAnswers: number; incorrectAnswers: number; difficulty: "easy" | "medium" | "hard"; missedTopics: string[]; priorAverage: number }) { const fallback = fallbackComprehension(input.score, input.difficulty, input.priorAverage); try { const { data } = await listLLMModels(); const model = data[0]?.id; const response = await invokeLLM({ model, messages: [{ role: "system", content: "You are a careful study analyst. Return only a JSON object with a whole-number comprehensionScore from 0 to 100. Use exam score, errors, difficulty, missed topics, and previous average. Never award coins." }, { role: "user", content: JSON.stringify(input) }], response_format: { type: "json_schema", json_schema: { name: "comprehension", strict: true, schema: { type: "object", properties: { comprehensionScore: { type: "integer", minimum: 0, maximum: 100 } }, required: ["comprehensionScore"], additionalProperties: false } } } }); const content = response.choices[0]?.message?.content; const parsed = typeof content === "string" ? JSON.parse(content) : null; return Math.max(0, Math.min(100, Number(parsed?.comprehensionScore ?? fallback))); } catch { return fallback; }
}
export async function listExamsLegacy(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); return db.select({ exam: exams, subject: subjects.title }).from(exams).leftJoin(subjects, eq(exams.subjectId, subjects.id)).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id))).orderBy(exams.scheduledAt); }
export async function createExamLegacy(userId: number, input: { title: string; subjectId?: number; chapterId?: number; lessonId?: number; scheduledAt?: Date }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(exams).values({ userId, cycleId: cycle.id, ...input, subjectId: input.subjectId ?? null, chapterId: input.chapterId ?? null, lessonId: input.lessonId ?? null, scheduledAt: input.scheduledAt ?? null }); }
export async function completeExamAttempt(userId: number, input: { examId: number; totalQuestions: number; correctAnswers: number; difficulty: "easy" | "medium" | "hard"; missedTopics: string[] }) { const db = await database(); const exam = await db.select().from(exams).where(and(eq(exams.id, input.examId), eq(exams.userId, userId))).limit(1); if (!exam[0]) throw new Error("الامتحان غير موجود."); if (input.correctAnswers > input.totalQuestions) throw new Error("عدد الإجابات الصحيحة غير صحيح."); const incorrectAnswers = input.totalQuestions - input.correctAnswers; const score = Math.round((input.correctAnswers / input.totalQuestions) * 100); const [prior] = await db.select({ average: sql<number>`coalesce(avg(${examAttempts.score}), 0)` }).from(examAttempts).where(and(eq(examAttempts.userId, userId), eq(examAttempts.cycleId, exam[0].cycleId))); const comprehensionScore = await estimateComprehension({ score, correctAnswers: input.correctAnswers, incorrectAnswers, difficulty: input.difficulty, missedTopics: input.missedTopics, priorAverage: Number(prior?.average ?? 0) }); await db.insert(examAttempts).values({ userId, cycleId: exam[0].cycleId, examId: input.examId, totalQuestions: input.totalQuestions, correctAnswers: input.correctAnswers, incorrectAnswers, score, difficulty: input.difficulty, missedTopics: input.missedTopics, comprehensionScore, completionRewarded: true }); const attempt = await db.select().from(examAttempts).where(and(eq(examAttempts.examId, input.examId), eq(examAttempts.userId, userId))).orderBy(desc(examAttempts.id)).limit(1); const ref = `examAttempt:${attempt[0].id}`; await recordStudyEvent({ userId, cycleId: exam[0].cycleId, eventType: "exam_complete", referenceId: ref }); const completion = await awardCoins({ userId, cycleId: exam[0].cycleId, amount: 15, reason: `إكمال امتحان: ${exam[0].title}`, referenceKey: `${ref}:completion` }); const bonusAmount = examBonusForComprehension(comprehensionScore); const bonus = bonusAmount ? await awardCoins({ userId, cycleId: exam[0].cycleId, amount: bonusAmount, reason: `مكافأة الاستيعاب: ${comprehensionScore}%`, referenceKey: `${ref}:comprehension` }) : { awarded: false }; return { attempt: attempt[0], score, comprehensionScore, completion, bonus, bonusAmount, unlocks: await evaluateAchievements(userId, exam[0].cycleId) }; }


export async function listCalendar(userId: number, from: Date, to: Date) { const db = await database(); const cycle = await getActiveCycle(userId); const [taskItems, examItems, goalItems, customItems, sessions] = await Promise.all([db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id), gte(tasks.deadline, from), lte(tasks.deadline, to))), db.select().from(exams).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id), gte(exams.scheduledAt, from), lte(exams.scheduledAt, to))), db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.cycleId, cycle.id), gte(goals.deadline, from), lte(goals.deadline, to))), db.select().from(calendarEvents).where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.cycleId, cycle.id), gte(calendarEvents.startsAt, from), lte(calendarEvents.startsAt, to))), db.select().from(pomodoroSessions).where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.cycleId, cycle.id), eq(pomodoroSessions.state, "completed"), gte(pomodoroSessions.completedAt, from), lte(pomodoroSessions.completedAt, to)))]); return { tasks: taskItems, exams: examItems, goals: goalItems, events: customItems, sessions }; }
export async function createCalendarEvent(userId: number, input: { title: string; startsAt: Date; endsAt?: Date; eventType: "important_date" | "custom" }) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(calendarEvents).values({ userId, cycleId: cycle.id, title: input.title, startsAt: input.startsAt, endsAt: input.endsAt ?? null, eventType: input.eventType }); }

export async function listRewards(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const [items, coins, purchases] = await Promise.all([db.select().from(rewards).where(eq(rewards.active, true)).orderBy(rewards.catalogId), getCoinSummary(db, userId, cycle.id), db.select({ rewardId: rewardPurchases.rewardId, purchasedAt: rewardPurchases.purchasedAt }).from(rewardPurchases).where(and(eq(rewardPurchases.userId, userId), eq(rewardPurchases.cycleId, cycle.id))).orderBy(desc(rewardPurchases.purchasedAt))]); return { items, coins, purchases }; }
export async function purchaseReward(userId: number, rewardId: number, referenceKey: string) {
  const db = await database();
  const cycle = await getActiveCycle(userId);
  const purchased = await db.select({ id: rewardPurchases.id }).from(rewardPurchases).where(eq(rewardPurchases.referenceKey, referenceKey)).limit(1);
  const priorBalance = (await getCoinSummary(db, userId, cycle.id)).balance;
  if (purchased[0] || decideRewardPurchase({ hasPriorReference: Boolean(purchased[0]), balance: priorBalance, cost: 0 }) === "duplicate") {
    return { purchased: false, reason: "already_purchased", balance: priorBalance };
  }
  const reward = await db.select().from(rewards).where(and(eq(rewards.id, rewardId), eq(rewards.active, true))).limit(1);
  if (!reward[0]) throw new Error("المكافأة غير متاحة.");
  const coins = await getCoinSummary(db, userId, cycle.id);
  if (decideRewardPurchase({ hasPriorReference: false, balance: coins.balance, cost: reward[0].cost }) !== "approved") {
    throw new Error("لا توجد Coins كافية لشراء هذه المكافأة.");
  }
  await db.insert(rewardPurchases).values({ userId, cycleId: cycle.id, rewardId, cost: reward[0].cost, referenceKey });
  await db.insert(coinTransactions).values({ userId, cycleId: cycle.id, amount: -reward[0].cost, type: "spend", reason: `شراء مكافأة: ${reward[0].title}`, referenceKey: `purchase:${referenceKey}` });
  return { purchased: true, reward: reward[0].title, balance: coins.balance - reward[0].cost };
}

export async function listAchievements(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const metrics = await metricSnapshot(db, userId, cycle.id) as Record<string, number>; const rows = await db.select({ achievement: achievements, unlockedAt: userAchievements.unlockedAt }).from(achievements).leftJoin(userAchievements, and(eq(userAchievements.achievementId, achievements.id), eq(userAchievements.userId, userId), eq(userAchievements.cycleId, cycle.id))).orderBy(achievements.catalogId); return { items: rows.map((row: any) => ({ ...row.achievement, unlockedAt: row.unlockedAt, current: Math.min(row.achievement.target, metrics[row.achievement.metric] ?? 0), percent: Math.min(100, Math.round(((metrics[row.achievement.metric] ?? 0) / row.achievement.target) * 100)) })), unlocked: rows.filter((row: any) => row.unlockedAt).length }; }

export async function coinLedger(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); const [summary, entries] = await Promise.all([getCoinSummary(db, userId, cycle.id), db.select().from(coinTransactions).where(and(eq(coinTransactions.userId, userId), eq(coinTransactions.cycleId, cycle.id))).orderBy(desc(coinTransactions.createdAt)).limit(100)]); return { cycle, summary, entries }; }


type ExamLessonInput = { title: string; chapterTitle: string; subjectTitle: string; progress: number; status: "not_started" | "in_progress" | "completed"; lastReviewedAt: Date | null };

function readinessForLessons(items: ExamLessonInput[]) {
  const total = items.length;
  if (!total) return { score: 0, level: "أضف الدروس أولًا", completed: 0, reviewed: 0, weakLessons: [] as ExamLessonInput[] };
  const completed = items.filter(item => item.status === "completed").length;
  const reviewed = items.filter(item => Boolean(item.lastReviewedAt)).length;
  const score = Math.round((completed / total) * 70 + (reviewed / total) * 30);
  const level = score >= 85 ? "جاهز بدرجة ممتازة" : score >= 70 ? "جاهز غالبًا" : score >= 45 ? "تحتاج مراجعة مركزة" : "ابدأ بخطة مراجعة";
  return { score, level, completed, reviewed, weakLessons: items.filter(item => item.status !== "completed" || !item.lastReviewedAt) };
}

async function scopedExamLessons(db: any, userId: number, examId: number): Promise<ExamLessonInput[]> {
  const rows = await db.select({
    title: lessons.title,
    chapterTitle: chapters.title,
    subjectTitle: subjects.title,
    progress: lessonProgress.progress,
    status: lessonProgress.status,
    lastReviewedAt: lessonProgress.lastReviewedAt,
  }).from(examLessons)
    .innerJoin(lessons, eq(examLessons.lessonId, lessons.id))
    .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .leftJoin(lessonProgress, and(eq(lessonProgress.lessonId, lessons.id), eq(lessonProgress.userId, userId)))
    .where(and(eq(examLessons.examId, examId), eq(subjects.userId, userId)));
  return rows.map((row: any) => ({ title: row.title, chapterTitle: row.chapterTitle, subjectTitle: row.subjectTitle, progress: Number(row.progress ?? 0), status: row.status ?? "not_started", lastReviewedAt: row.lastReviewedAt ?? null }));
}

export async function createExam(userId: number, input: { title: string; subjectId?: number; chapterId?: number; lessonId?: number; scheduledAt?: Date; lessonIds?: number[] }) {
  const db = await database(); const cycle = await getActiveCycle(userId); const lessonIds = Array.from(new Set([...(input.lessonIds ?? []), ...(input.lessonId ? [input.lessonId] : [])]));
  if (lessonIds.length) {
    const owned = await db.select({ id: lessons.id }).from(lessons).innerJoin(chapters, eq(lessons.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(and(inArray(lessons.id, lessonIds), eq(subjects.userId, userId)));
    if (owned.length !== lessonIds.length) throw new Error("اختر دروسًا موجودة ضمن خطتك فقط.");
  }
  await db.insert(exams).values({ userId, cycleId: cycle.id, title: input.title, subjectId: input.subjectId ?? null, chapterId: input.chapterId ?? null, lessonId: input.lessonId ?? null, scheduledAt: input.scheduledAt ?? null });
  const created = await db.select().from(exams).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id), eq(exams.title, input.title))).orderBy(desc(exams.id)).limit(1);
  if (created[0] && lessonIds.length) await db.insert(examLessons).values(lessonIds.map(lessonId => ({ examId: created[0].id, lessonId })));
  return created[0];
}

export async function listExams(userId: number) {
  const db = await database(); const cycle = await getActiveCycle(userId);
  const rows = await db.select({ exam: exams, subject: subjects.title }).from(exams).leftJoin(subjects, eq(exams.subjectId, subjects.id)).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id))).orderBy(exams.scheduledAt);
  return Promise.all(rows.map(async (row: any) => { const scoped = await scopedExamLessons(db, userId, row.exam.id); return { ...row, lessons: scoped, readiness: readinessForLessons(scoped) }; }));
}

export async function analytics(userId: number) {
  const db = await database(); const cycle = await getActiveCycle(userId); const metrics = await metricSnapshot(db, userId, cycle.id); const coins = await getCoinSummary(db, userId, cycle.id);
  const eventDay = sql<string>`date(${studyEvents.occurredAt}, 'unixepoch')`;
  const subjectName = sql<string>`coalesce(${subjects.title}, 'بدون مادة')`;
  const [daily, bySubject, completion, comprehension, purchases] = await Promise.all([
    db.select({ day: eventDay, minutes: sql<number>`coalesce(sum(${studyEvents.durationMinutes}), 0)`, events: count() }).from(studyEvents).where(and(eq(studyEvents.userId, userId), eq(studyEvents.cycleId, cycle.id), sql`${studyEvents.occurredAt} is not null`)).groupBy(eventDay).orderBy(eventDay),
    db.select({ subject: subjectName, minutes: sql<number>`coalesce(sum(${studyEvents.durationMinutes}), 0)` }).from(studyEvents).leftJoin(subjects, eq(studyEvents.subjectId, subjects.id)).where(and(eq(studyEvents.userId, userId), eq(studyEvents.cycleId, cycle.id))).groupBy(studyEvents.subjectId, subjectName),
    db.select({ open: sql<number>`coalesce(sum(case when ${tasks.status} = 'open' then 1 else 0 end), 0)`, completed: sql<number>`coalesce(sum(case when ${tasks.status} = 'completed' then 1 else 0 end), 0)` }).from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id))),
    db.select({ date: sql<string>`date(${examAttempts.createdAt}, 'unixepoch')`, score: examAttempts.score, comprehension: examAttempts.comprehensionScore }).from(examAttempts).where(and(eq(examAttempts.userId, userId), eq(examAttempts.cycleId, cycle.id), sql`${examAttempts.createdAt} is not null`)).orderBy(examAttempts.createdAt),
    db.select({ value: count() }).from(rewardPurchases).where(and(eq(rewardPurchases.userId, userId), eq(rewardPurchases.cycleId, cycle.id))),
  ]);
  return { cycle, metrics, coins, daily, bySubject, completion: completion[0] ?? { open: 0, completed: 0 }, comprehension, rewardsPurchased: Number(purchases[0]?.value ?? 0) };
}

export async function listFlashcardDecks(userId: number) {
  const db = await database(); const cycle = await getActiveCycle(userId);
  const decks = await db.select().from(flashcardDecks).where(and(eq(flashcardDecks.userId, userId), eq(flashcardDecks.cycleId, cycle.id))).orderBy(desc(flashcardDecks.updatedAt));
  return Promise.all(decks.map(async deck => {
    const cards = await db.select().from(flashcards).where(eq(flashcards.deckId, deck.id)).orderBy(desc(flashcards.updatedAt));
    return { ...deck, cards, stats: { total: cards.length, new: cards.filter(card => card.state === "new").length, learning: cards.filter(card => card.state === "learning").length, mastered: cards.filter(card => card.state === "mastered").length } };
  }));
}

export async function createFlashcardDeck(userId: number, input: { title: string; description?: string; color?: string }) {
  const db = await database(); const cycle = await getActiveCycle(userId);
  const res = await db.insert(flashcardDecks).values({ userId, cycleId: cycle.id, title: input.title, description: input.description ?? null, color: input.color ?? "#8B5CF6" });
  const deckId = Number((res as any).lastInsertRowid || (res as any)[0]?.insertId || 0);
  return { id: deckId, title: input.title };
}

async function ownedFlashcardDeck(db: any, userId: number, deckId: number) {
  const rows = await db.select({ id: flashcardDecks.id }).from(flashcardDecks).where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("مجموعة الفلاش كارد غير موجودة."); return rows[0];
}

export async function createFlashcard(userId: number, input: { deckId: number; prompt: string; answer: string }) {
  const db = await database(); await ownedFlashcardDeck(db, userId, input.deckId);
  await db.insert(flashcards).values({ deckId: input.deckId, prompt: input.prompt, answer: input.answer });
}

export async function reviewFlashcard(userId: number, cardId: number, result: "again" | "good" | "mastered") {
  const db = await database(); const card = await db.select({ id: flashcards.id }).from(flashcards).innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id)).where(and(eq(flashcards.id, cardId), eq(flashcardDecks.userId, userId))).limit(1);
  if (!card[0]) throw new Error("الفلاش كارد غير موجود.");
  const now = new Date(); const state = result === "mastered" ? "mastered" : result === "good" ? "learning" : "new"; const days = result === "mastered" ? 7 : result === "good" ? 2 : 1;
  await db.update(flashcards).set({ state, lastReviewedAt: now, nextReviewAt: new Date(now.getTime() + days * DAY_MS) }).where(eq(flashcards.id, cardId));
}

export async function deleteFlashcard(userId: number, cardId: number) {
  const db = await database(); const card = await db.select({ id: flashcards.id }).from(flashcards).innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id)).where(and(eq(flashcards.id, cardId), eq(flashcardDecks.userId, userId))).limit(1); if (!card[0]) throw new Error("الفلاش كارد غير موجود."); return db.delete(flashcards).where(eq(flashcards.id, cardId));
}

export async function searchStudyWorkspace(userId: number, query: string) {
  const db = await database(); const cycle = await getActiveCycle(userId); const pattern = `%${query.trim()}%`;
  const [noteRows, lessonRows, cardRows] = await Promise.all([
    db.select({ id: notes.id, title: notes.title, excerpt: notes.content, notebook: notebooks.title }).from(notes).innerJoin(notebooks, eq(notes.notebookId, notebooks.id)).where(and(eq(notebooks.userId, userId), eq(notebooks.cycleId, cycle.id), or(like(notes.title, pattern), like(notes.content, pattern)))).limit(20),
    db.select({ id: lessons.id, title: lessons.title, excerpt: lessons.description, subject: subjects.title, chapter: chapters.title }).from(lessons).innerJoin(chapters, eq(lessons.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(and(eq(subjects.userId, userId), or(like(lessons.title, pattern), like(lessons.description, pattern), like(lessons.notes, pattern)))).limit(20),
    db.select({ id: flashcards.id, prompt: flashcards.prompt, answer: flashcards.answer, deck: flashcardDecks.title }).from(flashcards).innerJoin(flashcardDecks, eq(flashcards.deckId, flashcardDecks.id)).where(and(eq(flashcardDecks.userId, userId), eq(flashcardDecks.cycleId, cycle.id), or(like(flashcards.prompt, pattern), like(flashcards.answer, pattern)))).limit(20),
  ]);
  return { notes: noteRows, lessons: lessonRows, flashcards: cardRows };
}

const SOURCE_TEXT_LIMIT = 55_000;
async function ownedNotebook(db: any, userId: number, notebookId: number) {
  const owner = await db.select({ id: notebooks.id, title: notebooks.title }).from(notebooks).where(and(eq(notebooks.id, notebookId), eq(notebooks.userId, userId))).limit(1);
  if (!owner[0]) throw new Error("دفتر الملاحظات غير موجود."); return owner[0];
}

export async function listNotebooks(userId: number) { const db = await database(); const cycle = await getActiveCycle(userId); return db.select({ notebook: notebooks, noteCount: count(notes.id) }).from(notebooks).leftJoin(notes, eq(notes.notebookId, notebooks.id)).where(and(eq(notebooks.userId, userId), eq(notebooks.cycleId, cycle.id))).groupBy(notebooks.id).orderBy(desc(notebooks.updatedAt)); }
export async function createNotebook(userId: number, title: string) { const db = await database(); const cycle = await getActiveCycle(userId); await db.insert(notebooks).values({ userId, cycleId: cycle.id, title }); }
export async function listNotes(userId: number, notebookId: number) { const db = await database(); await ownedNotebook(db, userId, notebookId); return db.select().from(notes).where(eq(notes.notebookId, notebookId)).orderBy(desc(notes.updatedAt)); }
export async function createNote(userId: number, input: { notebookId: number; title: string; content: string }) { const db = await database(); await ownedNotebook(db, userId, input.notebookId); await db.insert(notes).values(input); }

export async function exportAllUserNotes(userId: number) {
  const sqlite = _sqlite;
  
  const notebookNotesStmt = sqlite.prepare(`
    SELECT n.id, n.title, n.content, nb.title as category, n.updatedAt, 'notebook' as type
    FROM notes n
    JOIN notebooks nb ON n.notebookId = nb.id
    WHERE nb.userId = ?
    ORDER BY n.updatedAt DESC
  `);
  const notebookNotes = (notebookNotesStmt.all(userId) as any[]) || [];

  const videoNotesStmt = sqlite.prepare(`
    SELECT vn.id, vn.title, vn.content, svs.title as category, vn.updatedAt, 'video' as type
    FROM videoNotes vn
    JOIN studyVideoSessions svs ON vn.sessionId = svs.id
    WHERE vn.userId = ?
    ORDER BY vn.updatedAt DESC
  `);
  const videoNotesList = (videoNotesStmt.all(userId) as any[]) || [];

  const mistakesStmt = sqlite.prepare(`
    SELECT id, (subject || ': ' || COALESCE(topic, 'سؤال خطأ')) as title,
      ('المادة: ' || subject || char(10) || 'نوع الخطأ: ' || errorType || char(10) || 'السؤال: ' || question || char(10) || 'الإجابة الخاطئة: ' || COALESCE(wrongAnswer, 'بدون') || char(10) || 'الإجابة الصحيحة: ' || correctAnswer || char(10) || 'الشرح والتعليل: ' || COALESCE(explanation, 'لا يوجد')) as content,
      subject as category, createdAt as updatedAt, 'mistake' as type
    FROM mistakes
    WHERE userId = ?
    ORDER BY createdAt DESC
  `);
  const mistakesList = (mistakesStmt.all(userId) as any[]) || [];

  const resourcesStmt = sqlite.prepare(`
    SELECT id, title, notes as content, subject as category, updatedAt, 'resource' as type
    FROM externalResources
    WHERE userId = ? AND notes IS NOT NULL AND length(trim(notes)) > 0
    ORDER BY updatedAt DESC
  `);
  const resourceNotesList = (resourcesStmt.all(userId) as any[]) || [];

  const allNotes = [...notebookNotes, ...videoNotesList, ...mistakesList, ...resourceNotesList];

  return {
    count: allNotes.length,
    notes: allNotes,
    notebookNotesCount: notebookNotes.length,
    videoNotesCount: videoNotesList.length,
    mistakesCount: mistakesList.length,
    resourceNotesCount: resourceNotesList.length,
  };
}

export async function listNotebookSources(userId: number, notebookId: number) { const db = await database(); await ownedNotebook(db, userId, notebookId); return db.select({ id: notebookSources.id, fileName: notebookSources.fileName, mimeType: notebookSources.mimeType, storageUrl: notebookSources.storageUrl, characterCount: notebookSources.characterCount, isTruncated: notebookSources.isTruncated, createdAt: notebookSources.createdAt }).from(notebookSources).where(eq(notebookSources.notebookId, notebookId)).orderBy(desc(notebookSources.createdAt)); }

export async function uploadNotebookSource(userId: number, input: { notebookId: number; fileName: string; mimeType: "text/plain" | "text/markdown" | "application/pdf"; contentBase64: string }) {
  const db = await database(); await ownedNotebook(db, userId, input.notebookId);
  const data = Buffer.from(input.contentBase64, "base64"); if (!data.length || data.length > 5 * 1024 * 1024) throw new Error("ارفع ملفًا صالحًا حتى 5 ميجابايت.");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, "_").slice(0, 180) || "source";
  const { key, url } = await storagePut(`notebook-sources/${userId}/${input.notebookId}/${safeName}`, data, input.mimeType);
  const rawText = input.mimeType === "application/pdf" ? "" : data.toString("utf8"); const extractedText = rawText.slice(0, SOURCE_TEXT_LIMIT); const isTruncated = rawText.length > SOURCE_TEXT_LIMIT;
  await db.insert(notebookSources).values({ notebookId: input.notebookId, fileName: safeName, mimeType: input.mimeType, storageKey: key, storageUrl: url, extractedText: extractedText || null, characterCount: rawText.length, isTruncated });
}

export function notebookGroundingInstruction() { return "أنت Notebook AI مخصص للمذاكرة. استخدم حصريًا النصوص والملفات المرفقة في هذه المحادثة. لا تستخدم معلومات خارجية أو معرفة عامة. إذا لم تجد الإجابة في المصادر، قل حرفيًا: \"المعلومة دي مش موجودة في الملفات المرفوعة.\" اذكر اسم الملف أو الملاحظة التي استندت إليها في نهاية كل إجابة. اكتب بالعربية المصرية الواضحة."; }

type NotebookQuiz = { sourceNames: string[]; questions: { question: string; answer: string; choices?: string[] }[] };

export function parseNotebookQuiz(content: unknown): Omit<NotebookQuiz, "sourceNames"> {
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  const questions = (parsed as { questions?: unknown })?.questions;
  if (!Array.isArray(questions) || questions.length !== 8) throw new Error("تعذر إنشاء امتحان صالح من الملفات. جرّب مرة أخرى.");
  const normalized = questions.map((entry: unknown) => {
    const item = entry as { question?: unknown; answer?: unknown; choices?: unknown };
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const answer = typeof item.answer === "string" ? item.answer.trim() : "";
    const choices = Array.isArray(item.choices) ? item.choices.filter((choice): choice is string => typeof choice === "string" && choice.trim().length > 0).map(choice => choice.trim()).slice(0, 4) : undefined;
    if (!question || !answer) throw new Error("تعذر إنشاء امتحان صالح من الملفات. جرّب مرة أخرى.");
    return { question, answer, ...(choices?.length ? { choices } : {}) };
  });
  return { questions: normalized };
}

export async function saveNotebookQuiz(userId: number, input: { notebookId: number; quiz: NotebookQuiz }) {
  const db = await database();
  const [owner, cycle] = await Promise.all([ownedNotebook(db, userId, input.notebookId), getActiveCycle(userId)]);
  const title = `اختبار Notebook AI — ${owner.title}`.slice(0, 200);
  await db.insert(exams).values({ userId, cycleId: cycle.id, title, origin: "notebook_ai", notebookId: input.notebookId, quizPayload: input.quiz, subjectId: null, chapterId: null, lessonId: null, scheduledAt: null });
  const [exam] = await db.select().from(exams).where(and(eq(exams.userId, userId), eq(exams.cycleId, cycle.id), eq(exams.notebookId, input.notebookId), eq(exams.origin, "notebook_ai"))).orderBy(desc(exams.id)).limit(1);
  return exam;
}

export async function createNotebookQuiz(userId: number, notebookId: number) {
  const db = await database();
  await ownedNotebook(db, userId, notebookId);
  const sources = await db.select().from(notebookSources).where(eq(notebookSources.notebookId, notebookId)).orderBy(desc(notebookSources.createdAt)).limit(12);
  if (!sources.length) throw new Error("ارفع ملف PDF أو TXT أو Markdown واحدًا على الأقل قبل إنشاء الامتحان.");
  const sourceNames = sources.map(source => source.fileName);
  const textSources = sources.filter(source => source.extractedText).map(source => `[ملف: ${source.fileName}]\n${source.extractedText}`).join("\n\n");
  const content: any[] = [{ type: "text", text: `أنشئ اختبار مراجعة من 8 أسئلة متدرجة من المصادر التالية فقط. يجب أن تكون الإجابات دقيقة وموجودة في المصادر، ولا تضف معلومات من خارجها.\n\n${textSources || "لا توجد نصوص مستخرجة؛ راجع ملفات PDF المرفقة فقط."}` }];
  for (const source of sources.filter(source => source.mimeType === "application/pdf")) content.push({ type: "file_url", file_url: { url: await storageGetSignedUrl(source.storageKey), mime_type: "application/pdf" } });
  const response = await invokeLLM({
    messages: [{ role: "system", content: notebookGroundingInstruction() }, { role: "user", content }],
    response_format: { type: "json_schema", json_schema: { name: "notebook_quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", minItems: 8, maxItems: 8, items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" }, choices: { type: "array", items: { type: "string" }, maxItems: 4 } }, required: ["question", "answer"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } },
  });
  const quiz = { sourceNames, ...parseNotebookQuiz(response.choices[0]?.message?.content) };
  const exam = await saveNotebookQuiz(userId, { notebookId, quiz });
  return { exam, quiz };
}

export async function markNotebookQuizReviewed(userId: number, examId: number) {
  const db = await database();
  const [exam] = await db.select({ id: exams.id }).from(exams).where(and(eq(exams.id, examId), eq(exams.userId, userId), eq(exams.origin, "notebook_ai"))).limit(1);
  if (!exam) throw new Error("امتحان Notebook AI غير موجود.");
  await db.update(exams).set({ quizReviewedAt: new Date() }).where(eq(exams.id, examId));
  return { reviewedAt: new Date() };
}

export async function notebookAI(userId: number, input: { notebookId: number; mode: "question" | "summary" | "quiz" | "explain"; prompt?: string }) {
  const db = await database(); const owner = await ownedNotebook(db, userId, input.notebookId);
  const [items, sources] = await Promise.all([db.select({ title: notes.title, content: notes.content }).from(notes).where(eq(notes.notebookId, input.notebookId)).limit(30), db.select().from(notebookSources).where(eq(notebookSources.notebookId, input.notebookId)).orderBy(desc(notebookSources.createdAt)).limit(12)]);
  if (!items.length && !sources.length) throw new Error("ارفع ملف PDF أو TXT أو Markdown واحدًا على الأقل قبل استخدام Notebook AI.");
  const instruction = input.mode === "summary" ? "لخّص المصادر في نقاط منظمة مع عناوين." : input.mode === "quiz" ? "أنشئ اختبار مراجعة من 8 أسئلة متدرجة، مع الإجابات في قسم منفصل. كل سؤال يجب أن يستند إلى المصادر." : input.mode === "explain" ? "اشرح الفكرة المطلوبة بشكل مبسط باستخدام ما ورد في المصادر فقط." : `أجب عن سؤال الطالب: ${input.prompt ?? ""}`;
  const textSources = [items.map(note => `[ملاحظة: ${note.title}]\n${note.content}`).join("\n\n"), sources.filter(source => source.extractedText).map(source => `[ملف: ${source.fileName}]\n${source.extractedText}`).join("\n\n")].filter(Boolean).join("\n\n");
  const content: any[] = [{ type: "text", text: `${instruction}\n\nالمصادر النصية المتاحة:\n${textSources || "لا توجد مصادر نصية؛ راجع ملفات PDF المرفقة فقط."}` }];
  for (const source of sources.filter(source => source.mimeType === "application/pdf")) content.push({ type: "file_url", file_url: { url: await storageGetSignedUrl(source.storageKey), mime_type: "application/pdf" } });
  const response = await invokeLLM({ messages: [{ role: "system", content: notebookGroundingInstruction() }, { role: "user", content }] });
  return response.choices[0]?.message?.content ?? "تعذر إنشاء نتيجة الآن.";
}

export async function chatWithAssistant(userId: number, messages: { role: "user" | "assistant"; content: string }[]) {
  const db = await database(); const cycle = await getActiveCycle(userId); const metrics = await metricSnapshot(db, userId, cycle.id);
  const response = await invokeLLM({ messages: [{ role: "system", content: `أنت صاحب مذاكرة مصري مشجع. ساعد الطالب بخطوات عملية قصيرة. هذه بياناته الحالية: ${JSON.stringify(metrics)}` }, ...messages] });
  return response.choices[0]?.message?.content ?? "مش قادر أرد دلوقتي، جرّب تاني.";
}

// ===== Mistakes (كشكول الأخطاء) =====
export async function listMistakes(userId: number) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);
  const stmt = sqlite.prepare("SELECT * FROM mistakes WHERE userId = ? AND cycleId = ? ORDER BY createdAt DESC");
  return stmt.all(userId, cycle.id);
}

export async function createMistake(userId: number, input: { subject: string; topic?: string; errorType: string; question: string; wrongAnswer?: string; correctAnswer: string; explanation?: string }) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);
  const now = Date.now();
  const stmt = sqlite.prepare(
    "INSERT INTO mistakes (userId, cycleId, subject, topic, errorType, question, wrongAnswer, correctAnswer, explanation, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?, ?)"
  );
  stmt.run(
    userId,
    cycle.id,
    input.subject,
    input.topic ?? null,
    input.errorType || "misunderstanding",
    input.question,
    input.wrongAnswer ?? null,
    input.correctAnswer,
    input.explanation ?? null,
    now,
    now
  );
  await awardCoins({ userId, cycleId: cycle.id, amount: 15, reason: `تسجيل خطأ للتعلم: ${input.subject}`, referenceKey: `mistake:add:${now}` });
  return { success: true };
}

export async function updateMistakeStatus(userId: number, mistakeId: number, status: "needs_review" | "reviewed" | "mastered") {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("UPDATE mistakes SET status = ?, updatedAt = ? WHERE id = ? AND userId = ?");
  stmt.run(status, Date.now(), mistakeId, userId);
  return { success: true };
}

export async function deleteMistake(userId: number, mistakeId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM mistakes WHERE id = ? AND userId = ?");
  stmt.run(mistakeId, userId);
  return { success: true };
}

export async function analyzeMistakesAI(userId: number) {
  const mistakesList = await listMistakes(userId);
  if (!mistakesList.length) {
    return "سجل بعض الأخطاء أولاً لكشف الأنماط وثغرات الفهم وتلقي خطة المعالجة الشخصية!";
  }
  const summaryText = mistakesList.map((m: any) => `- المادة: ${m.subject} | نوع الخطأ: ${m.errorType} | السؤال: ${m.question} | خطأي: ${m.wrongAnswer || "غير محدد"} | الصواب: ${m.correctAnswer}`).join("\n");
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت موجه دراسي خبير في تحليل كشكول الأخطاء (Mistake Notebook Analysis). حلل سجل أخطاء الطالب التالي وقدم تقريرًا مشجعًا ومباشرًا بالعامية المصرية الراقية يتضمن:
1) أكثر المواد والأنماط تكرارًا في الأخطاء (مثل: التسرع، عدم استيعاب المفاهيم، سوء إدارة الوقت).
2) 3 نصائح ذهبية ومحددة لتجنب هذه الأخطاء بالذات في الامتحان القادم.
3) كلمة تحفيزية ختامية.`
      },
      { role: "user", content: summaryText }
    ]
  });
  return response.choices[0]?.message?.content ?? "تعذر تحليل الأخطاء حاليًا.";
}

// ===== Feynman Technique Studio =====
export async function listFeynmanSessions(userId: number) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);
  const stmt = sqlite.prepare("SELECT * FROM feynmanSessions WHERE userId = ? AND cycleId = ? ORDER BY createdAt DESC LIMIT 20");
  return stmt.all(userId, cycle.id);
}

export async function evaluateFeynmanAI(userId: number, input: { topic: string; subject: string; userExplanation: string }) {
  const cycle = await getActiveCycle(userId);
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `أنت معلم عبقري ومحفز يستخدم تقنية فاينمان (Feynman Technique) لتقييم شرح الطالب. الطالب يحاول شرح مفهوم معين بأبسط أسلوب ممكن.
قم بتحليل الشرح وأعد التقييم كـ JSON بالصيغة التالية:
{
  "masteryScore": 88,
  "summary": "ملخص عام لمدى جودة الشرح وأسلوب العرض",
  "strengths": ["نقطة قوة 1", "نقطة قوة 2"],
  "gaps": ["نقطة تحتاج توضيح أكثر 1"],
  "simplifiedAnalogy": "تشبيه بسيط يسهل حفظ هذا المفهوم للأبد"
}`
      },
      {
        role: "user",
        content: `الموضوع: ${input.topic}\nالمادة: ${input.subject}\nشرح الطالب: ${input.userExplanation}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let result: any = {};
  try {
    result = JSON.parse(raw);
  } catch {
    result = { masteryScore: 80, summary: raw, strengths: [], gaps: [], simplifiedAnalogy: "" };
  }

  const sqlite = getSqlite();
  const now = Date.now();
  const stmt = sqlite.prepare(
    "INSERT INTO feynmanSessions (userId, cycleId, topic, subject, userExplanation, aiFeedback, masteryScore, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  stmt.run(userId, cycle.id, input.topic, input.subject, input.userExplanation, JSON.stringify(result), result.masteryScore || 80, now);

  await awardCoins({ userId, cycleId: cycle.id, amount: 30, reason: `ممارسة تقنية فاينمان: ${input.topic}`, referenceKey: `feynman:${now}` });

  return { success: true, result };
}

// ===== Quick AI Quiz Generator =====
export async function generateQuizAI(
  userId: number,
  input: { subject: string; topicText: string; difficulty: "easy" | "medium" | "hard"; questionCount: number }
) {
  const diffMap = { easy: "سهل ومباشر", medium: "متوسط لقياس الفهم", hard: "صعب وتنافسي للأوائل" };
  const prompt = `أنشئ اختبار اختيار من متعدد (MCQ) يتكون من ${input.questionCount} أسئلة بخصوص الموضوع/الدرس التالي:
المادة: ${input.subject}
مستوى الصعوبة: ${diffMap[input.difficulty]}
النص/المحتوى: ${input.topicText}

أعد الناتج كـ JSON متبعاً الهيكل التالي:
{
  "title": "عنوان الاختبار المقترح",
  "questions": [
    {
      "id": 1,
      "question": "نص السؤال هنا؟",
      "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      "correctIndex": 0,
      "explanation": "تفسير سبب صحة الخيار باختصار"
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [{ role: "system", content: "أنت خبير واضع امتحانات ثانوية ومرحلة جامعية دقيق جداً." }, { role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let quiz: any = {};
  try {
    quiz = JSON.parse(raw);
  } catch {
    quiz = { title: `اختبار سريعي - ${input.subject}`, questions: [] };
  }
  return quiz;
}

export async function submitQuizResults(
  userId: number,
  input: { title: string; totalQuestions: number; correctAnswers: number; difficulty: "easy" | "medium" | "hard" }
) {
  const db = await database();
  const cycle = await getActiveCycle(userId);
  const score = Math.round((input.correctAnswers / Math.max(1, input.totalQuestions)) * 100);
  const coinsEarned = Math.round(score * 0.5) + (input.difficulty === "hard" ? 20 : 10);

  const now = Date.now();
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: coinsEarned,
    reason: `إكمال اختبار سريع (${input.title}): ${score}%`,
    referenceKey: `quiz:${now}`,
  });

  return { score, coinsEarned };
}

// ===== Page & Note Summarizer AI =====
export async function summarizePageAI(
  userId: number,
  input: { title: string; contentText: string; imageBase64?: string }
) {
  const prompt = `أنت مساعد تعليمي عبقري. قم بتحليل وتلخيص النص والمحتوى التالي:
العنوان/المادة: ${input.title}
المحتوى:
${input.contentText}

أعد الناتج بصيغة JSON بالتنسيق التالي:
{
  "summary": "ملخص شامل وواضح للدرس في 3-5 فقرات قصيرة",
  "keyConcepts": ["المفهوم الأول", "المفهوم الثاني", "المفهوم الثالث"],
  "takeaways": ["نصيحة أو قانون هام للحفظ", "نقطة غالباً تتكرر في الامتحانات"],
  "quickQuiz": [
    { "q": "سؤال سريع مراجعة؟", "a": "الإجابة النموذجية القابلة للحفظ" }
  ]
}`;

  const messages: any[] = [{ role: "system", content: "أنت خبير معالجة وتلخيص الكتب والملاحظات الدراسية." }];

  if (input.imageBase64) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${input.imageBase64}` } },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const response = await invokeLLM({ messages, response_format: { type: "json_object" } });
  const raw = response.choices[0]?.message?.content ?? "{}";

  let result: any = {};
  try {
    result = JSON.parse(raw);
  } catch {
    result = { summary: raw, keyConcepts: [], takeaways: [], quickQuiz: [] };
  }

  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 20,
    reason: `تلخيص درس/صفحة بالذكاء الاصطناعي: ${input.title}`,
    referenceKey: `summarize:${Date.now()}`,
  });

  return result;
}

// ===== Daily Challenge Engine =====
export async function getDailyChallenge(userId: number) {
  const dateStr = new Date().toISOString().split("T")[0];
  const challenges = [
    { title: "بطل التركيز", task: "أكمل جلسة بومودورو واحدة وحل اختباراً سريعاً", bonusCoins: 50 },
    { title: "مصحح الأخطاء", task: "سجّل خطأ واحداً في كشكول الأخطاء وذاكره", bonusCoins: 40 },
    { title: "الشارح الذكي", task: "مارس تقنية فاينمان لشرح درس من اختيارك", bonusCoins: 60 },
    { title: "صائد النقاط", task: "أكمل هدفين يوميين وراجع فلاش كاردز", bonusCoins: 50 },
  ];

  // Pick deterministic challenge for the day
  const dayHash = dateStr.split("-").reduce((a, b) => a + Number(b), 0) + userId;
  const challenge = challenges[dayHash % challenges.length];

  return { date: dateStr, ...challenge };
}

// ===== AI Mind Map Generator =====
export async function generateMindMapAI(
  userId: number,
  input: { topic: string; subject: string }
) {
  const prompt = `قم ببناء خريطة ذهنية هيكلية مفصلة (Mind Map) حول الموضوع التالي:
الموضوع: ${input.topic}
المادة: ${input.subject}

أعد الناتج كـ JSON متبعاً الهيكل الشجري التالي:
{
  "title": "${input.topic}",
  "root": {
    "label": "${input.topic}",
    "children": [
      {
        "label": "الفرع الرئيسي الأول",
        "description": "شرح موجز للفرع",
        "children": [
          { "label": "فرع فرعي 1.1", "description": "تفصيل أو قانون أو مثال" },
          { "label": "فرع فرعي 1.2", "description": "تفصيل آخر" }
        ]
      },
      {
        "label": "الفرع الرئيسي الثاني",
        "description": "شرح موجز للفرع",
        "children": [
          { "label": "فرع فرعي 2.1", "description": "نقطة هامة" },
          { "label": "فرع فرعي 2.2", "description": "نقطة هامة أخرى" }
        ]
      }
    ]
  }
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير رسم الخرائط الذهنية والتنظيم الهيكلي للعلوم والمناهج." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let mindMap: any = {};
  try {
    mindMap = JSON.parse(raw);
  } catch {
    mindMap = { title: input.topic, root: { label: input.topic, children: [] } };
  }

  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 25,
    reason: `إنشاء خريطة ذهنية: ${input.topic}`,
    referenceKey: `mindmap:${Date.now()}`,
  });

  return mindMap;
}

// ===== AI Task & Chapter Decomposer =====
export async function decomposeTaskAI(
  userId: number,
  input: { bigTaskTitle: string; detailsText?: string }
) {
  const prompt = `قم بتفكيك المهمة أو الباب الدراسي الكبير التالي إلى خطوات صغيرة جداً ومحددة بوقت (Micro-Tasks) يمكن إنجاز كل منها في 15-20 دقيقة لتجنب التسويف والشعور بالإرهاق:
المهمة/الدرس الكبير: ${input.bigTaskTitle}
التفاصيل الإضافية: ${input.detailsText || "لا يوجد"}

أعد الناتج كـ JSON بالتنسيق التالي:
{
  "title": "${input.bigTaskTitle}",
  "estimatedTotalMinutes": 90,
  "steps": [
    {
      "stepNumber": 1,
      "title": "عنوان الخطوة المصغرة الأولى (مثال: قراءة أول 3 صفحات وتحديد المصطلحات)",
      "estimatedMinutes": 15,
      "advice": "نصيحة سريعة لإنجاز هذه الخطوة بتركيز"
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير علم نفس الإنتاجية وإدارة الوقت وتفتيت المذاكرة الصعبة." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let decomposed: any = {};
  try {
    decomposed = JSON.parse(raw);
  } catch {
    decomposed = { title: input.bigTaskTitle, estimatedTotalMinutes: 60, steps: [] };
  }

  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 20,
    reason: `تفتيت مهمة دراسية كبرى: ${input.bigTaskTitle}`,
    referenceKey: `decompose:${Date.now()}`,
  });

  return decomposed;
}

// ===== Hybrid Lessons & Center Hub =====
export async function listHybridLessons(userId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("SELECT * FROM hybridLessons WHERE userId = ? ORDER BY createdAt DESC");
  return stmt.all(userId);
}

export async function createHybridLesson(
  userId: number,
  input: {
    subject: string;
    teacherName: string;
    mode: "online" | "center" | "hybrid";
    platformOrCenter: string;
    lectureTitle: string;
    onlineUrl?: string;
    accessCode?: string;
    expiryDate?: string;
    centerTime?: string;
    notes?: string;
  }
) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);
  const now = Date.now();

  const stmt = sqlite.prepare(
    `INSERT INTO hybridLessons 
     (userId, cycleId, subject, teacherName, mode, platformOrCenter, lectureTitle, onlineUrl, accessCode, expiryDate, centerTime, status, sheetStatus, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)`
  );

  stmt.run(
    userId,
    cycle.id,
    input.subject,
    input.teacherName,
    input.mode,
    input.platformOrCenter,
    input.lectureTitle,
    input.onlineUrl || "",
    input.accessCode || "",
    input.expiryDate || "",
    input.centerTime || "",
    input.notes || "",
    now,
    now
  );

  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 15,
    reason: `تسجيل درس هجين/سنتر: ${input.lectureTitle}`,
    referenceKey: `hybrid:${now}`,
  });

  return { success: true };
}

export async function updateHybridLessonStatus(
  userId: number,
  lessonId: number,
  input: { status?: "pending" | "watched" | "attended" | "completed"; sheetStatus?: "pending" | "submitted" | "corrected" }
) {
  const sqlite = getSqlite();
  const now = Date.now();

  if (input.status && input.sheetStatus) {
    const stmt = sqlite.prepare("UPDATE hybridLessons SET status = ?, sheetStatus = ?, updatedAt = ? WHERE id = ? AND userId = ?");
    stmt.run(input.status, input.sheetStatus, now, lessonId, userId);
  } else if (input.status) {
    const stmt = sqlite.prepare("UPDATE hybridLessons SET status = ?, updatedAt = ? WHERE id = ? AND userId = ?");
    stmt.run(input.status, now, lessonId, userId);
  } else if (input.sheetStatus) {
    const stmt = sqlite.prepare("UPDATE hybridLessons SET sheetStatus = ?, updatedAt = ? WHERE id = ? AND userId = ?");
    stmt.run(input.sheetStatus, now, lessonId, userId);
  }

  return { success: true };
}

export async function deleteHybridLesson(userId: number, lessonId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM hybridLessons WHERE id = ? AND userId = ?");
  stmt.run(lessonId, userId);
  return { success: true };
}

// ===== Deep Work Shield =====
export async function completeDeepWorkSession(
  userId: number,
  input: { durationMinutes: number; subject?: string }
) {
  const cycle = await getActiveCycle(userId);
  const coinsEarned = Math.round(input.durationMinutes * 1.5) + 20; // Extra bonus for deep work mode
  const now = Date.now();

  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: coinsEarned,
    reason: `جلسة تركيز عميق ودراسة صامتة (${input.durationMinutes} دقيقة)`,
    referenceKey: `deepwork:${now}`,
  });

  return { coinsEarned, durationMinutes: input.durationMinutes };
}

// ===== Spaced Repetition Mistake Quizzer =====
export async function generateMistakeQuizAI(
  userId: number,
  input: { subject?: string }
) {
  const sqlite = getSqlite();
  let stmt;
  let params: any[] = [userId];

  if (input.subject && input.subject !== "الكل") {
    stmt = sqlite.prepare("SELECT * FROM mistakes WHERE userId = ? AND subject = ? ORDER BY RANDOM() LIMIT 5");
    params.push(input.subject);
  } else {
    stmt = sqlite.prepare("SELECT * FROM mistakes WHERE userId = ? ORDER BY RANDOM() LIMIT 5");
  }

  const rawMistakes: any[] = stmt.all(...params);

  if (!rawMistakes || rawMistakes.length === 0) {
    return {
      hasMistakes: false,
      questions: [],
    };
  }

  const prompt = `قم بتحويل الأخطاء والتسؤلات التالية التي أخطأ فيها الطالب سابقاً في دفتر أخطائه إلى اختبار تفاعلي اختيار من متعدد (Multiple Choice Quiz) لإعادة اختباره وتثبيت المعلومة عنده:

الأخطاء المكتوبة:
${JSON.stringify(
  rawMistakes.map((m) => ({
    subject: m.subject,
    topic: m.topic,
    question: m.question,
    wrongAnswer: m.wrongAnswer,
    correctAnswer: m.correctAnswer,
    explanation: m.explanation,
  })),
  null,
  2
)}

أعد الناتج كـ JSON بالتنسيق التالي:
{
  "hasMistakes": true,
  "questions": [
    {
      "id": 1,
      "subject": "المادة",
      "question": "صيغة السؤال بأسلوب واضع امتحانات مشوق",
      "options": ["الإجابة الصحيحة", "خيار خاطئ 1", "خيار خاطئ 2", "خيار خاطئ 3"],
      "correctOptionIndex": 0,
      "explanation": "شرح لماذا هذه هي الإجابة الصحيحة لتثبيت المعلومة"
    }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير معالجة الأخطاء الدراسية وصانع أسئلة لتثبيت الفهم للتكرار المتباعد." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let quizData: any = {};
  try {
    quizData = JSON.parse(raw);
  } catch {
    quizData = { hasMistakes: true, questions: [] };
  }

  return quizData;
}

// ===== Custom Personal Rewards =====
export async function listCustomRewards(userId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("SELECT * FROM customRewards WHERE userId = ? ORDER BY createdAt DESC");
  return stmt.all(userId);
}

export async function createCustomReward(
  userId: number,
  input: { title: string; cost: number; icon?: string }
) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);
  const stmt = sqlite.prepare("INSERT INTO customRewards (userId, cycleId, title, cost, icon, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
  stmt.run(userId, cycle.id, input.title, input.cost, input.icon || "🎁", Date.now());
  return { success: true };
}

export async function deleteCustomReward(userId: number, rewardId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM customRewards WHERE id = ? AND userId = ?");
  stmt.run(rewardId, userId);
  return { success: true };
}

// ===== AI Smart Day Planner (Hybrid & External Platforms) =====
export async function generateSmartDayPlanAI(
  userId: number,
  input: {
    wakeTime: string;
    centerDetails?: string;
    travelMinutes?: number;
    onlinePlatformsList?: string;
    targetSubjects?: string;
  }
) {
  const prompt = `قم بالتخطيط لليوم الدراسي المثالي للطالب المتكامل (طالب أونلاين على منصات تعليمية خارجية + دروس سنتر حضوري) مع مراعاة الوقت الضائع في النزول والمواصلات والراحة.

بيانات يوم الطالب:
- وقت الاستيقاظ: ${input.wakeTime || "07:00 صباحاً"}
- تفاصيل دروس السنتر ومواعيدها: ${input.centerDetails || "لا يوجد سنتر اليوم"}
- وقت المواصلات والنزول المقدر: ${input.travelMinutes || 30} دقيقة
- المحاضرات الأونلاين المراد مشاهدتها (على منصات خارجية متخصصة): ${input.onlinePlatformsList || "متابعة محاضرة أونلاين واحدة"}
- المواد والمهام المطلوب إنجازها: ${input.targetSubjects || "مراجعة وحل شيتات"}

أعد الناتج كـ JSON بالتنسيق التالي:
{
  "daySummary": "ملخص مشجع لليوم وكيف يوازن بين السنتر والمنصات الخارجية",
  "totalStudyHours": 6,
  "timeline": [
    {
      "timeSlot": "07:00 - 08:00",
      "activity": "الاستيقاظ، الفطور، والاستعداد للنزول للسنتر / المذاكرة",
      "type": "break"
    },
    {
      "timeSlot": "08:00 - 08:30",
      "activity": "وقت الانتقال والمواصلات للسنتر مع الاستماع لتسجيل سريع أو مراجعة سريعة",
      "type": "travel"
    },
    {
      "timeSlot": "08:30 - 11:30",
      "activity": "حضور درس السنتر وتسجيل أهم النقاط والشيتات",
      "type": "center"
    },
    {
      "timeSlot": "12:00 - 02:00",
      "activity": "جلسة مذاكرة عميقة على المنصة الخارجية لمشاهدة محاضرة الأونلاين",
      "type": "online"
    },
    {
      "timeSlot": "02:00 - 03:00",
      "activity": "غداء واستراحة محارب",
      "type": "break"
    },
    {
      "timeSlot": "03:00 - 05:00",
      "activity": "حل شيت السنتر + تطبيق أسئلة الدرس الأونلاين",
      "type": "study"
    }
  ],
  "proTips": [
    "نصيحة لحفظ كود المنصة قبل البدء",
    "نصيحة للاستفادة من وقت المواصلات"
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير التخطيط اليومي للطلاب والهندسة الزمنية لجدولة الدروس الأونلاين والسناتر." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let dayPlan: any = {};
  try {
    dayPlan = JSON.parse(raw);
  } catch {
    dayPlan = { daySummary: "خطتك اليومية المنظمة", timeline: [], proTips: [] };
  }

  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 25,
    reason: "توليد مخطط اليوم المثالي بالذكاء الاصطناعي",
    referenceKey: `dayplan:${Date.now()}`,
  });

  return dayPlan;
}

// ===== Resource Bridge Module =====
export async function listExternalResources(userId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("SELECT * FROM externalResources WHERE userId = ? ORDER BY updatedAt DESC");
  const resources: any[] = stmt.all(userId);

  // Attach bookmarks count and list to each resource
  const bmStmt = sqlite.prepare("SELECT * FROM resourceBookmarks WHERE resourceId = ? ORDER BY id ASC");
  return resources.map((r) => ({
    ...r,
    bookmarks: bmStmt.all(r.id),
  }));
}

export async function addExternalResourceAI(
  userId: number,
  input: {
    url: string;
    customTitle?: string;
    subject?: string;
    totalMinutes?: number;
    platform?: string;
  }
) {
  const sqlite = getSqlite();
  const cycle = await getActiveCycle(userId);

  // Use LLM to extract metadata if title or platform is missing
  let title = input.customTitle?.trim() || "";
  let platform = input.platform?.trim() || "";
  let subject = input.subject?.trim() || "عام";
  let totalMinutes = input.totalMinutes || 60;
  let notes = "";

  if (!title || !platform) {
    const prompt = `قم بتحليل الرابط الإلكتروني التالي من منصة تعليمية خارجية (مثل Udemy, Coursera, Abwab, YouTube, Edvanya, Khan Academy, الخ) واستخراج اسم الكورس/الدورة، اسم المنصة، المادة التقديرية، والمدة الزمنية التقديرية بالدقائق:

الرابط: ${input.url}
العنوان اليدوي (إن وجد): ${input.customTitle || "غير محدد"}

أعد الناتج كـ JSON بالتنسيق التالي:
{
  "title": "اسم الكورس أو المحاضرة الواضح باللغة العربية أو الإنجليزية",
  "platform": "اسم المنصة (مثلاً Udemy, Coursera, YouTube, Abwab, Edvanya, منصة خاصة)",
  "subject": "المادة الدراسية المتعلقة (مثلاً فيزياء، كيمياء، برمجة، لغات)",
  "totalMinutes": 90,
  "summaryNotes": "ملخص شامل للكورس وما سيتم استثنائه أو تعلمه"
}`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت خبير تحليل وإداراة الكورسات والمصادر التعليمية الخارجية." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw);
      if (!title) title = parsed.title || "دورة تعليمية خارجية";
      if (!platform) platform = parsed.platform || "منصة تعليمية";
      if (parsed.subject && subject === "عام") subject = parsed.subject;
      if (parsed.totalMinutes && totalMinutes === 60) totalMinutes = Number(parsed.totalMinutes) || 60;
      notes = parsed.summaryNotes || "";
    } catch {
      if (!title) title = "دورة تعليمية خارجية";
      if (!platform) platform = "منصة تعليمية";
    }
  }

  const now = Date.now();
  const stmt = sqlite.prepare(
    `INSERT INTO externalResources (userId, cycleId, title, platform, url, subject, totalMinutes, completedMinutes, progressPercent, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 'in_progress', ?, ?, ?)`
  );

  const res = stmt.run(userId, cycle.id, title, platform, input.url, subject, totalMinutes, notes, now, now);

  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 20,
    reason: `ربط مصدر تعليمي خارجي: ${title}`,
    referenceKey: `resource:${now}`,
  });

  return { id: res.lastInsertRowid, title, platform, url: input.url };
}

export async function updateResourceProgress(
  userId: number,
  resourceId: number,
  input: { completedMinutes: number; notes?: string }
) {
  const sqlite = getSqlite();
  const now = Date.now();

  const getStmt = sqlite.prepare("SELECT * FROM externalResources WHERE id = ? AND userId = ?");
  const resource: any = getStmt.get(resourceId, userId);
  if (!resource) throw new Error("المصدر غير موجود.");

  const completedMinutes = Math.min(input.completedMinutes, resource.totalMinutes);
  const progressPercent = Math.min(100, Math.round((completedMinutes / resource.totalMinutes) * 100));
  const newStatus = progressPercent >= 100 ? "completed" : "in_progress";

  const updateStmt = sqlite.prepare(
    `UPDATE externalResources 
     SET completedMinutes = ?, progressPercent = ?, status = ?, notes = COALESCE(?, notes), updatedAt = ?
     WHERE id = ? AND userId = ?`
  );
  updateStmt.run(completedMinutes, progressPercent, newStatus, input.notes || null, now, resourceId, userId);

  // If completed just now and wasn't before
  if (newStatus === "completed" && resource.status !== "completed") {
    const cycle = await getActiveCycle(userId);
    await awardCoins({
      userId,
      cycleId: cycle.id,
      amount: 50,
      reason: `إكمال دورة/مصدر خارجي بالكامل: ${resource.title}`,
      referenceKey: `res_complete:${now}`,
    });
  }

  return { success: true, progressPercent, status: newStatus };
}

export async function deleteExternalResource(userId: number, resourceId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM externalResources WHERE id = ? AND userId = ?");
  stmt.run(resourceId, userId);
  return { success: true };
}

export async function addResourceBookmark(
  userId: number,
  resourceId: number,
  input: { timestampStr: string; title: string; note?: string }
) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    "INSERT INTO resourceBookmarks (resourceId, userId, timestampStr, title, note, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  stmt.run(resourceId, userId, input.timestampStr, input.title, input.note || "", Date.now());
  return { success: true };
}

export async function deleteResourceBookmark(userId: number, bookmarkId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM resourceBookmarks WHERE id = ? AND userId = ?");
  stmt.run(bookmarkId, userId);
  return { success: true };
}

export async function logResourceFocusSession(
  userId: number,
  input: { resourceId: number; durationMinutes: number; sessionNotes?: string }
) {
  const sqlite = getSqlite();
  const now = Date.now();

  const getRes = sqlite.prepare("SELECT * FROM externalResources WHERE id = ? AND userId = ?");
  const resource: any = getRes.get(input.resourceId, userId);
  if (!resource) throw new Error("المصدر غير موجود.");

  const platform = resource.platform || "منصة خاصة";

  // Insert Focus Session log
  const insertStmt = sqlite.prepare(
    "INSERT INTO resourceFocusSessions (resourceId, userId, durationMinutes, platform, sessionNotes, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertStmt.run(input.resourceId, userId, input.durationMinutes, platform, input.sessionNotes || "", now);

  // Automatically accumulate progress
  const newCompletedMinutes = resource.completedMinutes + input.durationMinutes;
  await updateResourceProgress(userId, input.resourceId, {
    completedMinutes: newCompletedMinutes,
    notes: input.sessionNotes ? `آخر جلسة: ${input.sessionNotes}` : undefined,
  });

  // Award Coins
  const cycle = await getActiveCycle(userId);
  const earnedCoins = Math.max(10, Math.round(input.durationMinutes * 1.5));
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: earnedCoins,
    reason: `تسجيل جلسة تركيز للمصدر (${input.durationMinutes} دقيقة): ${resource.title}`,
    referenceKey: `res_focus:${now}`,
  });

  return { success: true, durationMinutes: input.durationMinutes, earnedCoins };
}

export async function listResourceFocusSessions(userId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    `SELECT s.*, r.title as resourceTitle, r.subject as resourceSubject 
     FROM resourceFocusSessions s
     JOIN externalResources r ON s.resourceId = r.id
     WHERE s.userId = ? 
     ORDER BY s.createdAt DESC`
  );
  return stmt.all(userId);
}

export async function getSmartCalendarData(userId: number, dateStr?: string) {
  const sqlite = getSqlite();

  // 1. External Resources (Resource Bridge)
  const resourcesStmt = sqlite.prepare("SELECT * FROM externalResources WHERE userId = ? ORDER BY updatedAt DESC");
  const resources = resourcesStmt.all(userId);

  // 2. Pending Tasks
  const tasksStmt = sqlite.prepare("SELECT * FROM tasks WHERE userId = ? ORDER BY id DESC");
  const tasksList = tasksStmt.all(userId);

  // 3. Hybrid Lessons
  const hybridStmt = sqlite.prepare("SELECT * FROM hybridLessons WHERE userId = ? ORDER BY id DESC");
  const hybridLessonsList = hybridStmt.all(userId);

  // 4. Focus Sessions
  const focusSessions = sqlite.prepare(
    `SELECT s.*, r.title as resourceTitle FROM resourceFocusSessions s JOIN externalResources r ON s.resourceId = r.id WHERE s.userId = ? ORDER BY s.createdAt DESC LIMIT 20`
  ).all(userId);

  // 5. Smart Calendar Events
  let eventsQuery = "SELECT * FROM smartCalendarEvents WHERE userId = ?";
  const params: any[] = [userId];
  if (dateStr) {
    eventsQuery += " AND eventDate = ?";
    params.push(dateStr);
  }
  eventsQuery += " ORDER BY startTime ASC, id ASC";
  const events = sqlite.prepare(eventsQuery).all(...params);

  return {
    resources,
    tasks: tasksList,
    hybridLessons: hybridLessonsList,
    focusSessions,
    events,
  };
}

export async function addSmartCalendarEvent(
  userId: number,
  input: {
    title: string;
    category: string;
    sourceType?: string;
    sourceId?: number;
    eventDate: string;
    startTime: string;
    durationMinutes?: number;
    subject?: string;
    platform?: string;
    linkUrl?: string;
    notes?: string;
  }
) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    `INSERT INTO smartCalendarEvents 
     (userId, title, category, sourceType, sourceId, eventDate, startTime, durationMinutes, subject, platform, linkUrl, isCompleted, notes, createdAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  );
  const now = Date.now();
  const res = stmt.run(
    userId,
    input.title,
    input.category || "lesson",
    input.sourceType || "manual",
    input.sourceId || null,
    input.eventDate,
    input.startTime || "09:00",
    input.durationMinutes || 45,
    input.subject || "عام",
    input.platform || "",
    input.linkUrl || "",
    input.notes || "",
    now
  );
  return { id: Number(res.lastInsertRowid), success: true };
}

export async function toggleSmartCalendarEvent(userId: number, id: number) {
  const sqlite = getSqlite();
  const getStmt = sqlite.prepare("SELECT * FROM smartCalendarEvents WHERE id = ? AND userId = ?");
  const ev: any = getStmt.get(id, userId);
  if (!ev) throw new Error("الحدث غير موجود.");

  const nextState = ev.isCompleted === 1 ? 0 : 1;
  const updateStmt = sqlite.prepare("UPDATE smartCalendarEvents SET isCompleted = ? WHERE id = ? AND userId = ?");
  updateStmt.run(nextState, id, userId);

  return { success: true, isCompleted: nextState };
}

export async function deleteSmartCalendarEvent(userId: number, id: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare("DELETE FROM smartCalendarEvents WHERE id = ? AND userId = ?");
  stmt.run(id, userId);
  return { success: true };
}

export async function generateSmartCalendarRoadmapAI(
  userId: number,
  input: { eventDate: string; availableMinutes?: number; preferences?: string }
) {
  const sqlite = getSqlite();
  const calendarData = await getSmartCalendarData(userId);

  const availableHours = ((input.availableMinutes || 240) / 60).toFixed(1);

  const prompt = `
أنت المساعد التعليمي الذكي لنظام Seif Study OS.
المطلوب: توليد خطة يومية ذكية وخارطة طريق (Daily Roadmap) متوازنة ليوم المحدد: ${input.eventDate}.

المعطيات المتاحة للطالب:
- الوقت المتاح للدراسة اليوم: ${availableHours} ساعة (${input.availableMinutes || 240} دقيقة).
- تفضيلات الطالب: ${input.preferences || "تنسيق متوازن بين الدروس والمهام والتركيز"}.

المصادر الخارجية المتوفرة (Resource Bridge):
${JSON.stringify(
  calendarData.resources.map((r: any) => ({
    id: r.id,
    title: r.title,
    platform: r.platform,
    subject: r.subject,
    remainingMinutes: Math.max(0, r.totalMinutes - r.completedMinutes),
    progressPercent: r.progressPercent,
    url: r.url,
  })),
  null,
  2
)}

المهام والتكليفات المطلوبة (Tasks):
${JSON.stringify(
  calendarData.tasks.filter((t: any) => !t.completed).map((t: any) => ({
    id: t.id,
    title: t.title,
    subject: t.subject,
    dueDate: t.dueDate,
  })),
  null,
  2
)}

الدروس المباشرة والسناتر (Hybrid Lessons):
${JSON.stringify(
  calendarData.hybridLessons.map((h: any) => ({
    id: h.id,
    title: h.lectureTitle,
    subject: h.subject,
    mode: h.mode,
    platformOrCenter: h.platformOrCenter,
    centerTime: h.centerTime,
  })),
  null,
  2
)}

قم بإنشاء خطة يومية مجدولة زمنياً تتكون من 3 إلى 6 فقرات دراسية تناسب الطاقة والوقت المتاح (${input.availableMinutes || 240} دقيقة).
يجب أن ترجع النتيجة كـ JSON Array فقط بهذا الشكل بالضبط بدون أي نصوص خارجية:
[
  {
    "title": "عنوان الفقرة أو الدرس",
    "category": "lesson" | "task" | "focus_session" | "review" | "exam",
    "sourceType": "resource" | "task" | "hybrid" | "manual",
    "sourceId": number | null,
    "startTime": "09:00" (صيغة 24 ساعة مثلاً 09:00, 11:30, 14:00, 17:00, 20:00),
    "durationMinutes": 45,
    "subject": "اسم المادة",
    "platform": "اسم المنصة إن وجدت",
    "linkUrl": "الرابط إن وجد",
    "notes": "نصيحة أو توجيه ذكي لهذه الفقرة"
  }
]
`;

  try {
    const llmRes = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = llmRes.choices[0]?.message?.content || "";

    let items: any[] = [];
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed.items && Array.isArray(parsed.items)) items = parsed.items;
      else if (parsed.roadmap && Array.isArray(parsed.roadmap)) items = parsed.roadmap;
    } catch {
      items = [];
    }

    if (items.length === 0) {
      items = [
        {
          title: "مراجعة كورس Udemy البرمجي",
          category: "lesson",
          sourceType: "resource",
          startTime: "09:00",
          durationMinutes: 45,
          subject: "برمجيات",
          platform: "Udemy",
          notes: "شاهد المحاضرة وطبق العملية",
        },
        {
          title: "حل واجب الرياضيات الشيت الأسبوعي",
          category: "task",
          sourceType: "task",
          startTime: "11:00",
          durationMinutes: 60,
          subject: "رياضيات",
          notes: "ركز على الأسئلة من 1 إلى 15",
        },
        {
          title: "جلسة تركيز وفلاش كاردز عميقة",
          category: "focus_session",
          sourceType: "manual",
          startTime: "15:00",
          durationMinutes: 45,
          subject: "عام",
          notes: "استخدم تقنية البومودورو 25x5",
        },
      ];
    }

    // Clear existing AI generated events for this date
    sqlite.prepare("DELETE FROM smartCalendarEvents WHERE userId = ? AND eventDate = ? AND sourceType != 'manual'").run(userId, input.eventDate);

    // Insert new events
    const insertStmt = sqlite.prepare(
      `INSERT INTO smartCalendarEvents 
       (userId, title, category, sourceType, sourceId, eventDate, startTime, durationMinutes, subject, platform, linkUrl, isCompleted, notes, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    );

    const now = Date.now();
    for (const item of items) {
      insertStmt.run(
        userId,
        item.title,
        item.category || "lesson",
        item.sourceType || "manual",
        item.sourceId || null,
        input.eventDate,
        item.startTime || "10:00",
        item.durationMinutes || 45,
        item.subject || "عام",
        item.platform || "",
        item.linkUrl || "",
        item.notes || "",
        now
      );
    }

    return { success: true, count: items.length };
  } catch (err: any) {
    console.error("Failed to generate AI roadmap:", err);
    throw new Error(err.message || "فشل توليد الخطة بالذكاء الاصطناعي.");
  }
}

/* =========================================================================
   STUDY ROOMS (مشاركة المصادر والدورات الخارجية)
   ========================================================================= */

export async function createStudyRoom(
  userId: number,
  userName: string,
  input: { name: string; description?: string; customCode?: string }
) {
  const sqlite = getSqlite();
  const roomCode = (input.customCode && input.customCode.trim().length >= 3)
    ? input.customCode.trim().toUpperCase()
    : `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const check = sqlite.prepare("SELECT id FROM studyRooms WHERE roomCode = ?").get(roomCode);
  if (check) {
    throw new Error("رمز الغرفة مستخدم بالفعل، يرجى اختيار رمز آخر.");
  }

  const now = Date.now();
  const stmt = sqlite.prepare(
    "INSERT INTO studyRooms (roomCode, name, description, createdByUserId, createdByName, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const res = stmt.run(roomCode, input.name, input.description || "", userId, userName || "سيف", now);
  const roomId = Number(res.lastInsertRowid);

  // Add creator as first member
  sqlite.prepare("INSERT INTO studyRoomMembers (roomId, userId, userName, joinedAt) VALUES (?, ?, ?, ?)").run(roomId, userId, userName || "سيف", now);

  return { roomId, roomCode, name: input.name, success: true };
}

export async function joinStudyRoom(userId: number, userName: string, roomCode: string) {
  const sqlite = getSqlite();
  const code = roomCode.trim().toUpperCase();
  const room: any = sqlite.prepare("SELECT * FROM studyRooms WHERE roomCode = ?").get(code);
  if (!room) {
    throw new Error("الغرفة غير موجودة. يرجى التأكد من رمز الغرفة المرفق.");
  }

  const memberCheck = sqlite.prepare("SELECT id FROM studyRoomMembers WHERE roomId = ? AND userId = ?").get(room.id, userId);
  if (!memberCheck) {
    sqlite.prepare("INSERT INTO studyRoomMembers (roomId, userId, userName, joinedAt) VALUES (?, ?, ?, ?)").run(room.id, userId, userName || "سيف", Date.now());
  }

  return { roomId: room.id, roomCode: room.roomCode, name: room.name, success: true };
}

export async function listUserStudyRooms(userId: number) {
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    `SELECT r.*, 
       (SELECT COUNT(*) FROM studyRoomMembers m WHERE m.roomId = r.id) as memberCount,
       (SELECT COUNT(*) FROM studyRoomResources res WHERE res.roomId = r.id) as resourceCount
     FROM studyRooms r
     JOIN studyRoomMembers m ON r.id = m.roomId
     WHERE m.userId = ?
     ORDER BY r.createdAt DESC`
  );
  return stmt.all(userId);
}

export async function getStudyRoomDetails(userId: number, roomId: number) {
  const sqlite = getSqlite();
  const room: any = sqlite.prepare("SELECT * FROM studyRooms WHERE id = ?").get(roomId);
  if (!room) throw new Error("الغرفة غير موجودة.");

  // Check if member
  const member = sqlite.prepare("SELECT * FROM studyRoomMembers WHERE roomId = ? AND userId = ?").get(roomId, userId);
  if (!member) throw new Error("أنت لست عضواً في هذه الغرفة.");

  const members = sqlite.prepare("SELECT * FROM studyRoomMembers WHERE roomId = ? ORDER BY joinedAt ASC").all(roomId);
  const resources = sqlite.prepare("SELECT * FROM studyRoomResources WHERE roomId = ? ORDER BY createdAt DESC").all(roomId);
  const progressList = sqlite.prepare("SELECT * FROM studyRoomProgress WHERE roomId = ? ORDER BY lastActiveAt DESC").all(roomId);

  return {
    room,
    members,
    resources,
    progressList,
  };
}

export async function addStudyRoomResource(
  userId: number,
  userName: string,
  input: { roomId: number; title: string; platform: string; url: string; subject?: string }
) {
  const sqlite = getSqlite();
  const room: any = sqlite.prepare("SELECT * FROM studyRooms WHERE id = ?").get(input.roomId);
  if (!room) throw new Error("الغرفة غير موجودة.");

  const now = Date.now();
  const stmt = sqlite.prepare(
    "INSERT INTO studyRoomResources (roomId, title, platform, url, subject, addedByUserId, addedByName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const res = stmt.run(input.roomId, input.title, input.platform, input.url, input.subject || "عام", userId, userName || "سيف", now);
  const resourceId = Number(res.lastInsertRowid);

  // Initialize progress for current user
  sqlite.prepare(
    "INSERT OR REPLACE INTO studyRoomProgress (roomId, roomResourceId, userId, userName, progressPercent, completedMinutes, lastActiveAt) VALUES (?, ?, ?, ?, 0, 0, ?)"
  ).run(input.roomId, resourceId, userId, userName || "سيف", now);

  return { resourceId, success: true };
}

export async function updateStudyRoomProgress(
  userId: number,
  userName: string,
  input: { roomId: number; roomResourceId: number; progressPercent: number; completedMinutes?: number }
) {
  const sqlite = getSqlite();
  const now = Date.now();
  const stmt = sqlite.prepare(
    `INSERT INTO studyRoomProgress (roomId, roomResourceId, userId, userName, progressPercent, completedMinutes, lastActiveAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(roomResourceId, userId) DO UPDATE SET
       progressPercent = excluded.progressPercent,
       completedMinutes = excluded.completedMinutes,
       lastActiveAt = excluded.lastActiveAt`
  );
  stmt.run(input.roomId, input.roomResourceId, userId, userName || "سيف", input.progressPercent, input.completedMinutes || 0, now);
  return { success: true };
}

export async function importStudyRoomResourceToBridge(userId: number, roomResourceId: number) {
  const sqlite = getSqlite();
  const res: any = sqlite.prepare("SELECT * FROM studyRoomResources WHERE id = ?").get(roomResourceId);
  if (!res) throw new Error("المصدر المورد غير موجود.");

  const cycle = await getActiveCycle(userId);
  const check = sqlite.prepare("SELECT id FROM externalResources WHERE userId = ? AND url = ?").get(userId, res.url);
  if (check) {
    return { success: true, message: "الدورة موجودة بالفعل في قائمة جسر المصادر الخاصة بك." };
  }

  const now = Date.now();
  const insertStmt = sqlite.prepare(
    `INSERT INTO externalResources (userId, cycleId, title, platform, url, subject, totalMinutes, completedMinutes, progressPercent, status, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, 120, 0, 0, 'in_progress', ?, ?, ?)`
  );
  insertStmt.run(
    userId,
    cycle.id,
    res.title,
    res.platform,
    res.url,
    res.subject || "عام",
    `موردة من الغرفة الجماعية: ${res.addedByName}`,
    now,
    now
  );

  return { success: true, message: "تم إلحاق الدورة الخارجية بجسر المصادر الخاص بك بنجاح! 🎉" };
}

/* =========================================================================
   PERSONALIZED NOTIFICATIONS & ANTI-PROCRASTINATION REMINDERS
   ========================================================================= */

export async function getPersonalizedNotifications(userId: number) {
  const sqlite = getSqlite();
  const now = Date.now();
  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch dismissed notification keys in the last 24 hours
  const dayAgo = now - 24 * 3600 * 1000;
  const dismissedRows: any[] = sqlite
    .prepare("SELECT notificationKey FROM notificationDismissals WHERE userId = ? AND dismissedAt > ?")
    .all(userId, dayAgo);
  const dismissedKeys = new Set(dismissedRows.map((r) => r.notificationKey));

  const notifications: Array<{
    id: string;
    key: string;
    type: "calendar_lesson" | "task_deadline" | "hybrid_session" | "resource_progress" | "anti_procrastination";
    title: string;
    message: string;
    urgency: "urgent" | "warning" | "info" | "motivation";
    actionUrl: string;
    actionText: string;
    subject?: string;
    timeRemainingText?: string;
    createdAt: number;
  }> = [];

  // 1. Upcoming / Today's Calendar Events
  const calendarEvents: any[] = sqlite
    .prepare(
      "SELECT * FROM smartCalendarEvents WHERE userId = ? AND isCompleted = 0 AND eventDate >= ? ORDER BY eventDate ASC, startTime ASC LIMIT 10"
    )
    .all(userId, todayStr);

  for (const ev of calendarEvents) {
    const key = `cal_ev:${ev.id}`;
    if (dismissedKeys.has(key)) continue;

    const isToday = ev.eventDate === todayStr;
    const urgency = isToday ? "urgent" : "warning";
    const timeText = isToday ? `اليوم الساعة ${ev.startTime}` : `تاريخ: ${ev.eventDate} (${ev.startTime})`;

    notifications.push({
      id: `ev-${ev.id}`,
      key,
      type: "calendar_lesson",
      title: isToday ? `⚡ درس مستهدف اليوم: ${ev.title}` : `📅 درس قادم بالتقويم الذكي: ${ev.title}`,
      message: `المادة: ${ev.subject || "عام"} | المنصة: ${ev.platform || "التقويم التعليمي"} | الموعد: ${timeText}`,
      urgency,
      actionUrl: "/smart-learning-calendar",
      actionText: "فتح التقويم الذكي",
      subject: ev.subject,
      timeRemainingText: timeText,
      createdAt: ev.createdAt || now,
    });
  }

  // 2. Open Tasks & Approaching/Overdue Deadlines
  const openTasks: any[] = sqlite
    .prepare("SELECT * FROM tasks WHERE userId = ? AND status = 'open' ORDER BY id DESC")
    .all(userId);

  for (const task of openTasks) {
    const key = `task:${task.id}`;
    if (dismissedKeys.has(key)) continue;

    if (task.deadline) {
      const deadlineMs = Number(task.deadline);
      const isOverdue = deadlineMs < now;
      const isApproaching = !isOverdue && deadlineMs - now <= 48 * 3600 * 1000;

      if (isOverdue) {
        const daysOverdue = Math.max(1, Math.floor((now - deadlineMs) / (24 * 3600 * 1000)));
        notifications.push({
          id: `task-${task.id}`,
          key,
          type: "task_deadline",
          title: `🚨 مهمة متأخرة! (${task.title})`,
          message: `انتهى موعد هذه المهمة منذ ${daysOverdue} يوم. لا تترك المهام تتراكم، أنجزها الآن لمنع التسويف!`,
          urgency: "urgent",
          actionUrl: "/tasks",
          actionText: "إنجاز المهمة الآن",
          timeRemainingText: `متأخرة بـ ${daysOverdue} يوم`,
          createdAt: task.createdAt || now,
        });
      } else if (isApproaching) {
        const hoursLeft = Math.max(1, Math.round((deadlineMs - now) / (3600 * 1000)));
        notifications.push({
          id: `task-${task.id}`,
          key,
          type: "task_deadline",
          title: `⏳ اقتراب الموعد النهائي: ${task.title}`,
          message: `متبقي أقل من ${hoursLeft} ساعة لتسليم هذه المهمة. حان وقت التركيز لتجنب ضغط الدقائق الأخيرة!`,
          urgency: "warning",
          actionUrl: "/tasks",
          actionText: "الانتقال للمهام",
          timeRemainingText: `متبقي ${hoursLeft} ساعة`,
          createdAt: task.createdAt || now,
        });
      }
    }
  }

  // 3. Pending Hybrid Center / Online Sessions
  const pendingHybrid: any[] = sqlite
    .prepare("SELECT * FROM hybridLessons WHERE userId = ? AND status = 'pending' ORDER BY id DESC LIMIT 5")
    .all(userId);

  for (const h of pendingHybrid) {
    const key = `hybrid:${h.id}`;
    if (dismissedKeys.has(key)) continue;

    notifications.push({
      id: `hybrid-${h.id}`,
      key,
      type: "hybrid_session",
      title: `🏫 حصة معلقة: ${h.lectureTitle}`,
      message: `المعلم: ${h.teacherName} | المكان/المنصة: ${h.platformOrCenter} (${h.mode === "center" ? "سنتر" : "أونلاين"})`,
      urgency: "info",
      actionUrl: "/hybrid-hub",
      actionText: "توثيق الحضور/المشاهدة",
      subject: h.subject,
      createdAt: h.createdAt || now,
    });
  }

  // 4. Incomplete External Resources (Resource Bridge)
  const activeResources: any[] = sqlite
    .prepare(
      "SELECT * FROM externalResources WHERE userId = ? AND progressPercent < 100 ORDER BY updatedAt DESC LIMIT 3"
    )
    .all(userId);

  for (const r of activeResources) {
    const key = `res:${r.id}`;
    if (dismissedKeys.has(key)) continue;

    const remainingMins = Math.max(0, r.totalMinutes - r.completedMinutes);
    notifications.push({
      id: `res-${r.id}`,
      key,
      type: "resource_progress",
      title: `📚 كورس خارجي بانتظار استكمالك: ${r.title}`,
      message: `المنصة: ${r.platform} | نسبة الإنجاز الحالية: ${r.progressPercent}% (متبقي ${remainingMins} دقيقة).`,
      urgency: "info",
      actionUrl: "/resource-bridge",
      actionText: "بدء مؤقت التركيز",
      subject: r.subject,
      timeRemainingText: `متبقي ${remainingMins} دقيقة`,
      createdAt: r.updatedAt || now,
    });
  }

  // 5. Anti-Procrastination Motivational Nudge
  const nudgeKey = `nudge:${todayStr}`;
  if (!dismissedKeys.has(nudgeKey) && notifications.length > 0) {
    notifications.push({
      id: `nudge-${todayStr}`,
      key: nudgeKey,
      type: "anti_procrastination",
      title: `💡 محارب التسويف الذكي (Anti-Procrastination)`,
      message: `لديها أكثر من ${notifications.length} عناصر بانتظارك اليوم. جرب "قاعدة الـ 5 دقائق": ابدأ المذاكرة لمدة 5 دقائق فقط وسيتلاشى التكاسل تلقائياً!`,
      urgency: "motivation",
      actionUrl: "/resource-bridge",
      actionText: "تشغيل مؤقت البومودورو",
      createdAt: now,
    });
  }

  return notifications;
}

export async function dismissNotification(userId: number, notificationKey: string) {
  const sqlite = getSqlite();
  const now = Date.now();
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO notificationDismissals (userId, notificationKey, dismissedAt) VALUES (?, ?, ?)"
    )
    .run(userId, notificationKey, now);
  return { success: true };
}

export async function getNotificationSettings(userId: number) {
  const sqlite = getSqlite();
  let row: any = sqlite.prepare("SELECT * FROM notificationSettings WHERE userId = ?").get(userId);
  if (!row) {
    sqlite
      .prepare(
        "INSERT INTO notificationSettings (userId, leadMinutes, soundEnabled, browserPushEnabled, antiProcrastinationMode, updatedAt) VALUES (?, 30, 1, 0, 1, ?)"
      )
      .run(userId, Date.now());
    row = {
      userId,
      leadMinutes: 30,
      soundEnabled: 1,
      browserPushEnabled: 0,
      antiProcrastinationMode: 1,
    };
  }
  return {
    leadMinutes: row.leadMinutes,
    soundEnabled: row.soundEnabled === 1,
    browserPushEnabled: row.browserPushEnabled === 1,
    antiProcrastinationMode: row.antiProcrastinationMode === 1,
  };
}

export async function updateNotificationSettings(
  userId: number,
  input: {
    leadMinutes?: number;
    soundEnabled?: boolean;
    browserPushEnabled?: boolean;
    antiProcrastinationMode?: boolean;
  }
) {
  const sqlite = getSqlite();
  const current = await getNotificationSettings(userId);
  const updatedLead = input.leadMinutes ?? current.leadMinutes;
  const updatedSound = input.soundEnabled !== undefined ? (input.soundEnabled ? 1 : 0) : current.soundEnabled ? 1 : 0;
  const updatedPush = input.browserPushEnabled !== undefined ? (input.browserPushEnabled ? 1 : 0) : current.browserPushEnabled ? 1 : 0;
  const updatedAntiProc = input.antiProcrastinationMode !== undefined ? (input.antiProcrastinationMode ? 1 : 0) : current.antiProcrastinationMode ? 1 : 0;

  sqlite
    .prepare(
      `INSERT INTO notificationSettings (userId, leadMinutes, soundEnabled, browserPushEnabled, antiProcrastinationMode, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET
         leadMinutes = excluded.leadMinutes,
         soundEnabled = excluded.soundEnabled,
         browserPushEnabled = excluded.browserPushEnabled,
         antiProcrastinationMode = excluded.antiProcrastinationMode,
         updatedAt = excluded.updatedAt`
    )
    .run(userId, updatedLead, updatedSound, updatedPush, updatedAntiProc, Date.now());

  return { success: true };
}

export async function generateAIProcrastinationCoachMessage(userId: number) {
  const notifications = await getPersonalizedNotifications(userId);
  const prompt = `
أنت مدرب تحفيزي متخصص في محاربة التسويف الأكاديمي لنظام Seif Study OS.
المعطيات: الطالب لديه ${notifications.length} تنبيهات دراسية ومواعيد تسليم متراكمة بالتقويم التعليمي الذكي.
المطلوب: كتابة رسالة تشجيعية سريعة ومحفزة جداً (بسطرين فقط باللغة العربية) تدفع الطالب للبدء فوراً بأسلوب إيجابي وذكي يكسر حاجز التكاسل والتسويف.
`;

  try {
    const res = await invokeLLM({ messages: [{ role: "user", content: prompt }] });
    const reply = res.choices[0]?.message?.content || "البداية هي نصف الإنجاز! اختر أسهل مهمة واقضِ عليها بتركيز 10 دقائق فقط الآن. 🚀";
    return { advice: reply.trim() };
  } catch {
    return { advice: "البداية هي نصف الإنجاز! اختر أسهل مهمة واقضِ عليها بتركيز 10 دقائق فقط الآن. 🚀" };
  }
}

/* =========================================================================
   PDF RESOURCE ENGINE (UPLOAD, OCR TEXT EXTRACTION, SEARCH & SUMMARIZATION)
   ========================================================================= */

export async function processAndAddPdfResource(
  userId: number,
  input: {
    resourceId?: number;
    fileName: string;
    fileUrl?: string;
    subject?: string;
    fileBase64?: string;
    rawText?: string;
  }
) {
  const sqlite = getSqlite();
  const now = Date.now();
  let extractedText = input.rawText || "";

  // If base64 file or URL is provided, call Gemini to extract and structure PDF text
  if (!extractedText) {
    try {
      const promptText = `أنت خبير معالجة واستخراج النصوص الدراسية (PDF OCR & Text Extractor).
المطلوب:
1) قم بظبط وقراءة المادة الدراسية المرفقة ("${input.fileName}").
2) استخرج كافة النصوص والشروح والمفاهيم بدقة ووضوح باللغة العربية والإنجليزية.
3) رتب النص في فقرات منظمة تحتوي العناوين الرئيسية، المصطلحات، والقوانين المفتاحية القابلة للبحث.`;

      const messages: any[] = [
        { role: "system", content: "أنت محرك استخراج وفهرسة الكتب والملفات الدراسية بالذكاء الاصطناعي." },
      ];

      if (input.fileBase64) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: promptText },
            {
              type: "file_url",
              file_url: {
                url: `data:application/pdf;base64,${input.fileBase64}`,
                mime_type: "application/pdf",
              },
            },
          ],
        });
      } else {
        messages.push({
          role: "user",
          content: `${promptText}\n\nرابط الملف أو اسمه: ${input.fileName} ${input.fileUrl || ""}`,
        });
      }

      const llmRes = await invokeLLM({ messages });
      extractedText = llmRes.choices[0]?.message?.content || `ملخص ونص مستخرج دراسي من ملف PDF: ${input.fileName}`;
    } catch {
      extractedText = `نص مستخرج دراسي لملف PDF: ${input.fileName}\nيحتوي المستند على مفاهيم المادة (${input.subject || "عام"}).`;
    }
  }

  // Generate initial summary JSON using Gemini
  let summaryJsonStr = "{}";
  try {
    const summaryPrompt = `قم بتحليل وتلخيص النص الدراسي التالي المأخوذ من ملف PDF ("${input.fileName}"):
${extractedText.slice(0, 4000)}

أعد التلخيص كـ JSON حصراً بالتنسيق التالي:
{
  "summary": "ملخص تنفيذي مبسط ومباشر للمستند في 3 فقرات",
  "keyConcepts": ["مفهوم 1", "تعريف 2", "قانون 3"],
  "takeaways": ["نقطة امتحانات هامة 1", "ملاحظة للحفظ 2"],
  "quickQuiz": [
    { "q": "سؤال اختبار من المستند؟", "a": "الإجابة النموذجية المباشرة" }
  ]
}`;

    const sumRes = await invokeLLM({
      messages: [
        { role: "system", content: "أنت خبير تلخيص المناهج والكتب الدراسية." },
        { role: "user", content: summaryPrompt },
      ],
      response_format: { type: "json_object" },
    });
    summaryJsonStr = sumRes.choices[0]?.message?.content || "{}";
  } catch {
    summaryJsonStr = JSON.stringify({
      summary: `تلخيص شامل لمستند ${input.fileName}`,
      keyConcepts: [input.subject || "مفهوم دراسي"],
      takeaways: ["راجع العناوين الرئيسية بالمستند"],
      quickQuiz: [],
    });
  }

  const charCount = extractedText.length;
  const insertStmt = sqlite.prepare(
    `INSERT INTO externalResourcePdfs (resourceId, userId, fileName, fileUrl, subject, extractedText, summaryJson, characterCount, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const res = insertStmt.run(
    input.resourceId || null,
    userId,
    input.fileName,
    input.fileUrl || "",
    input.subject || "عام",
    extractedText,
    summaryJsonStr,
    charCount,
    now
  );

  const pdfId = Number(res.lastInsertRowid);

  // Award Coins for uploading PDF
  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 25,
    reason: `رفع وتحويل ملف PDF دراسي: ${input.fileName}`,
    referenceKey: `pdf:add:${pdfId}`,
  });

  return {
    pdfId,
    fileName: input.fileName,
    characterCount: charCount,
    extractedText,
    summaryJson: JSON.parse(summaryJsonStr),
    success: true,
  };
}

export async function listResourcePdfs(userId: number, resourceId?: number) {
  const sqlite = getSqlite();
  let rows: any[] = [];
  if (resourceId) {
    rows = sqlite
      .prepare("SELECT * FROM externalResourcePdfs WHERE userId = ? AND resourceId = ? ORDER BY createdAt DESC")
      .all(userId, resourceId);
  } else {
    rows = sqlite
      .prepare("SELECT * FROM externalResourcePdfs WHERE userId = ? ORDER BY createdAt DESC")
      .all(userId);
  }

  return rows.map((r) => ({
    ...r,
    summaryJson: r.summaryJson ? JSON.parse(r.summaryJson) : null,
  }));
}

export async function searchResourcePdfs(userId: number, searchQuery: string) {
  const sqlite = getSqlite();
  const queryClean = searchQuery.trim().toLowerCase();
  if (!queryClean) return [];

  const rows: any[] = sqlite
    .prepare("SELECT * FROM externalResourcePdfs WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId);

  const matches: Array<{
    id: number;
    fileName: string;
    subject: string;
    snippet: string;
    matchCount: number;
    createdAt: number;
  }> = [];

  for (const r of rows) {
    const textLower = (r.extractedText || "").toLowerCase();
    const nameLower = (r.fileName || "").toLowerCase();
    const subjLower = (r.subject || "").toLowerCase();

    let count = 0;
    let index = textLower.indexOf(queryClean);
    while (index !== -1) {
      count++;
      index = textLower.indexOf(queryClean, index + queryClean.length);
    }

    if (nameLower.includes(queryClean) || subjLower.includes(queryClean) || count > 0) {
      let snippet = "";
      const matchIndex = textLower.indexOf(queryClean);
      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 60);
        const end = Math.min(textLower.length, matchIndex + 100);
        snippet = "..." + r.extractedText.slice(start, end) + "...";
      } else {
        snippet = (r.extractedText || "").slice(0, 150) + "...";
      }

      matches.push({
        id: r.id,
        fileName: r.fileName,
        subject: r.subject,
        snippet,
        matchCount: Math.max(count, 1),
        createdAt: r.createdAt,
      });
    }
  }

  return matches;
}

export async function summarizePdfAI(userId: number, pdfId: number, customPrompt?: string) {
  const sqlite = getSqlite();
  const pdf: any = sqlite
    .prepare("SELECT * FROM externalResourcePdfs WHERE id = ? AND userId = ?")
    .get(pdfId, userId);

  if (!pdf) throw new Error("ملف الـ PDF غير موجود.");

  const promptText = `أنت موجه دراسي خبير في تحليل وتلخيص كتب وتفريغات الـ PDF الدراسية.
المحتوى الاستخراجي لملف الـ PDF ("${pdf.fileName}"):
${pdf.extractedText.slice(0, 6000)}

${customPrompt ? `طلب خاص من الطالب: ${customPrompt}` : ""}

أعد ناتج التلخيص كـ JSON حصراً بهذا التنسيق:
{
  "summary": "تلخيص دراسي شامل ومكتمل الفهم للنص المستخرج مع التركيز على الاستيعاب العميق",
  "keyConcepts": ["مفهوم رئيسي 1", "تعريف 2", "قانون أو صيغة 3"],
  "takeaways": ["نقطة امتحانات مؤكدة 1", "ملاحظة تطبيقية 2"],
  "quickQuiz": [
    { "q": "سؤال امتحانات حول المستند؟", "a": "الإجابة النموذجية الكاملة" }
  ]
}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: "أنت خبير معالجة واستئصال الخلاصة الدراسية من الكتب والـ PDFs." },
      { role: "user", content: promptText },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { summary: raw, keyConcepts: [], takeaways: [], quickQuiz: [] };
  }

  // Update summaryJson in DB
  sqlite
    .prepare("UPDATE externalResourcePdfs SET summaryJson = ? WHERE id = ?")
    .run(JSON.stringify(parsed), pdfId);

  return parsed;
}

export async function deleteResourcePdf(userId: number, pdfId: number) {
  const sqlite = getSqlite();
  sqlite.prepare("DELETE FROM externalResourcePdfs WHERE id = ? AND userId = ?").run(pdfId, userId);
  return { success: true };
}

/* =========================================================================
   GOOGLE CALENDAR BI-DIRECTIONAL SYNC ENGINE
   ========================================================================= */

export async function syncToGoogleCalendar(userId: number, accessToken: string) {
  const sqlite = getSqlite();
  const events: any[] = sqlite
    .prepare("SELECT * FROM smartCalendarEvents WHERE userId = ? ORDER BY eventDate ASC")
    .all(userId);

  let pushedCount = 0;
  let updatedCount = 0;

  for (const ev of events) {
    try {
      const timeParts = (ev.startTime || "09:00").split(":");
      const hh = timeParts[0].padStart(2, "0");
      const mm = (timeParts[1] || "00").padStart(2, "0");
      const startDateTimeStr = `${ev.eventDate}T${hh}:${mm}:00`;
      const startDateObj = new Date(startDateTimeStr);

      const durationMs = (ev.durationMinutes || 45) * 60 * 1000;
      const endDateObj = new Date(startDateObj.getTime() + durationMs);

      const payload = {
        summary: ev.title,
        description: `${ev.notes || ""}\nالمادة: ${ev.subject || "عام"}\nتمت المزامنة تلقائياً من منصة Seif Study OS`,
        start: {
          dateTime: startDateObj.toISOString(),
          timeZone: "Africa/Cairo",
        },
        end: {
          dateTime: endDateObj.toISOString(),
          timeZone: "Africa/Cairo",
        },
        location: ev.linkUrl || undefined,
      };

      if (ev.googleEventId) {
        const patchRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.googleEventId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (patchRes.ok) {
          updatedCount++;
        } else if (patchRes.status === 404) {
          const createRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            }
          );
          if (createRes.ok) {
            const data: any = await createRes.json();
            sqlite
              .prepare("UPDATE smartCalendarEvents SET googleEventId = ? WHERE id = ?")
              .run(data.id, ev.id);
            pushedCount++;
          }
        }
      } else {
        const createRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        if (createRes.ok) {
          const data: any = await createRes.json();
          sqlite
            .prepare("UPDATE smartCalendarEvents SET googleEventId = ? WHERE id = ?")
            .run(data.id, ev.id);
          pushedCount++;
        }
      }
    } catch (err) {
      console.error("Error pushing event to Google Calendar:", err);
    }
  }

  return { pushedCount, updatedCount };
}

export async function syncFromGoogleCalendar(userId: number, accessToken: string) {
  const sqlite = getSqlite();

  const now = new Date();
  const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const gCalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
    past30Days
  )}&singleEvents=true&orderBy=startTime&maxResults=250`;

  const res = await fetch(gCalUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`فشل الاتصال بـ Google Calendar API: ${res.statusText} - ${errorText}`);
  }

  const data: any = await res.json();
  const items = data.items || [];

  let importedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    if (item.status === "cancelled") continue;

    const gEventId = item.id;
    const title = item.summary || "حدث تقويم جوجل";
    const startObj = item.start?.dateTime || item.start?.date;
    const endObj = item.end?.dateTime || item.end?.date;

    if (!startObj) continue;

    let eventDate = "";
    let startTime = "09:00";
    let durationMinutes = 45;

    if (startObj.includes("T")) {
      eventDate = startObj.slice(0, 10);
      startTime = startObj.slice(11, 16);
      if (endObj && endObj.includes("T")) {
        const startMs = new Date(startObj).getTime();
        const endMs = new Date(endObj).getTime();
        const diffMin = Math.round((endMs - startMs) / 60000);
        if (diffMin > 0) durationMinutes = diffMin;
      }
    } else {
      eventDate = startObj;
    }

    const notes = item.description || "";
    const linkUrl = item.htmlLink || "";

    const existing: any = sqlite
      .prepare("SELECT id FROM smartCalendarEvents WHERE userId = ? AND googleEventId = ?")
      .get(userId, gEventId);

    if (existing) {
      sqlite
        .prepare(
          `UPDATE smartCalendarEvents 
           SET title = ?, eventDate = ?, startTime = ?, durationMinutes = ?, notes = ?, linkUrl = ?
           WHERE id = ? AND userId = ?`
        )
        .run(title, eventDate, startTime, durationMinutes, notes, linkUrl, existing.id, userId);
      updatedCount++;
    } else {
      sqlite
        .prepare(
          `INSERT INTO smartCalendarEvents 
           (userId, title, category, sourceType, googleEventId, eventDate, startTime, durationMinutes, subject, platform, linkUrl, isCompleted, notes, createdAt) 
           VALUES (?, ?, 'google_calendar', 'google_calendar', ?, ?, ?, ?, 'تقويم جوجل', 'Google Calendar', ?, 0, ?, ?)`
        )
        .run(userId, title, gEventId, eventDate, startTime, durationMinutes, linkUrl, notes, Date.now());
      importedCount++;
    }
  }

  return { importedCount, updatedCount, totalGoogleEvents: items.length };
}

export async function fullGoogleCalendarBiDirectionalSync(userId: number, accessToken: string) {
  const pushRes = await syncToGoogleCalendar(userId, accessToken);
  const pullRes = await syncFromGoogleCalendar(userId, accessToken);

  return {
    success: true,
    pushedCount: pushRes.pushedCount,
    pushedUpdates: pushRes.updatedCount,
    importedCount: pullRes.importedCount,
    importedUpdates: pullRes.updatedCount,
    totalGoogleEvents: pullRes.totalGoogleEvents,
  };
}

/* =========================================================================
   AI STUDY COACH (EGYPTIAN DIALECT PROACTIVE ANALYZER)
   ========================================================================= */

export async function getAIStudyCoachInsights(userId: number) {
  const db = await database();
  const cycle = await getActiveCycle(userId);

  // 1. Fetch Pomodoro Data
  const pomodoros = await db
    .select()
    .from(pomodoroSessions)
    .where(and(eq(pomodoroSessions.userId, userId), eq(pomodoroSessions.cycleId, cycle.id)))
    .orderBy(desc(pomodoroSessions.createdAt))
    .limit(50);

  const completedPomodoros = pomodoros.filter((p) => p.state === "completed");
  const totalPomoMinutes = completedPomodoros.reduce((acc, p) => acc + p.completedMinutes, 0);
  const totalPausedSeconds = pomodoros.reduce((acc, p) => acc + (p.pausedSeconds || 0), 0);
  const averagePomoDuration = completedPomodoros.length
    ? Math.round(totalPomoMinutes / completedPomodoros.length)
    : 0;

  // 2. Fetch Resource Bridge Data
  const resourcesStmt = _sqlite.prepare(
    "SELECT * FROM externalResources WHERE userId = ? ORDER BY updatedAt DESC LIMIT 30"
  );
  const resources: any[] = resourcesStmt.all(userId);

  const totalResources = resources.length;
  const completedResources = resources.filter((r) => r.progressPercent >= 100).length;
  const avgResourceProgress = totalResources
    ? Math.round(resources.reduce((acc, r) => acc + (r.progressPercent || 0), 0) / totalResources)
    : 0;

  const pdfsStmt = _sqlite.prepare("SELECT COUNT(*) as count FROM externalResourcePdfs WHERE userId = ?");
  const pdfCount = (pdfsStmt.get(userId) as any)?.count || 0;

  const resourceSessionsStmt = _sqlite.prepare(
    "SELECT * FROM resourceFocusSessions WHERE userId = ? ORDER BY createdAt DESC LIMIT 20"
  );
  const resourceSessions: any[] = resourceSessionsStmt.all(userId);
  const totalResourceFocusMins = resourceSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  // 3. Fetch Tasks
  const taskRows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.cycleId, cycle.id)));
  const completedTasks = taskRows.filter((t) => t.status === "completed").length;

  // Build Context for LLM
  const promptContext = `
بيانات ذاكرة وتفاعل الطالب كالتالي:
- جلسات البومودورو المكتملة: ${completedPomodoros.length} جلسة (${totalPomoMinutes} دقيقة إجمالية تركيز).
- متوسط طول جلسة البومودورو: ${averagePomoDuration} دقيقة.
- إجمالي وقت التوقف المؤقت (Pauses): ${Math.round(totalPausedSeconds / 60)} دقيقة.
- عدد مصادر التعلم في Resource Bridge: ${totalResources} مصدر (المكتمل منها: ${completedResources}).
- متوسط نسبة إنجاز المصادر: %${avgResourceProgress}.
- جلسات التركيز المباشرة على المصادر: ${resourceSessions.length} جلسة (${totalResourceFocusMins} دقيقة).
- عدد ملفات الـ PDF الدراسية المرفوعة: ${pdfCount} ملف.
- المهام المكتملة: ${completedTasks} من أصل ${taskRows.length} مهام.

المطلوب:
تقمص شخصية "كوتش المذاكرة الذكي" 🤖🇪🇬 — مدرب أكاديمي مصري ذكي وشغوف، يتحدث باللهجة المصرية المبهجة والمباشرة (مثل: "عاش يا بطل!"، "بص يا سيدي"، "جامد جداً"، "خد بالك من الحتة دي").

قم بالتحليل الدقيق وتقديم تقرير خبير مشجع يتضمن JSON حصراً بالشكل التالي:
{
  "overallRating": "بطل تركيز 🏆" (أو "محتاج ضبط بوصلة 🎯" أو "أسطورة مذاكرة ⚡"),
  "concentrationScore": 85 (درجة من 100 للتركيز والالتزام),
  "headline": "عاش يا بطل! أداؤك في البومودورو ممتاز جداً، لكن محتاجين نقفل المصادر المركونة في الريسورس بريدج!",
  "pomodoroAnalysis": "تحليل مشجع باللهجة المصرية لعادات البومودورو والتوقفات",
  "resourceBridgeAnalysis": "تحليل مشجع باللهجة المصرية لكيفية استغلاله لمصادر التعلم وفيديوهات يوتيوب والـ PDFs",
  "topDistractionFound": "أبرز مشتت لوحظ (مثال: التوقف المتكرر في منتصف البومودورو أو تراكم المذكرات غير المكتملة)",
  "actionableTips": [
    "نصيحة عمليّة أولى باللهجة المصرية لتفعيل التركيز العميق",
    "نصيحة عمليّة ثانية لتنظيم الوقت في الريسورس بريدج",
    "نصيحة عمليّة ثالثة لزيادة استمرارية الجلسات دون توقف"
  ],
  "quickChallengeToday": "تحدي اليوم السريع من الكوتش (مثال: كمل 30 دقيقة بومودورو من غير ما تلمس الموبايل!)"
}
`;

  try {
    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "أنت كوتش المذاكرة والتركيز الذكي باللهجة المصرية (AI Egyptian Study Coach). أخرج النتيجة بترميز JSON حصراً.",
        },
        { role: "user", content: promptContext },
      ],
      response_format: { type: "json_object" },
    });

    const rawJson = llmRes.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawJson);
    return {
      statsSummary: {
        completedPomodoros: completedPomodoros.length,
        totalPomoMinutes,
        totalResources,
        pdfCount,
        completedTasks,
      },
      coachReport: parsed,
    };
  } catch (err) {
    console.error("AI Study Coach error:", err);
    return {
      statsSummary: {
        completedPomodoros: completedPomodoros.length,
        totalPomoMinutes,
        totalResources,
        pdfCount,
        completedTasks,
      },
      coachReport: {
        overallRating: "بطل تحت التدريب 🎯",
        concentrationScore: 75,
        headline: "عاش يا بطل! يلا نبدأ مع بعض رحلة تركيز جديدة وننظم وقتنا بين البومودورو والمصادر!",
        pomodoroAnalysis: `أنزلت ${completedPomodoros.length} جلسة بومودورو بإجمالي ${totalPomoMinutes} دقيقة. أداء طيب وحلو جداً!`,
        resourceBridgeAnalysis: `عندك ${totalResources} مصدر في الريسورس بريدج، جرب ترتبهم وتبدأ بالمهام العاجلة.`,
        topDistractionFound: "التشتت والتنقل بين التطبيقات في وقت المذاكرة.",
        actionableTips: [
          "فعل حظر التشتت وشغل أصوات بيئية هادئة أثناء البومودورو 🎧",
          "حدد مصدر واحد بس من الريسورس بريدج تخلصه النهاردة 📚",
          "خد بريك 5 دقائق حقيقي بعيد عن الشاشات والموبايل ☕",
        ],
        quickChallengeToday: "كمل جلسة بومودورو واحدة 25 دقيقة من غير ما تفتح أي تبويب تاني!",
      },
    };
  }
}


export async function generatePdfFlashcardsAI(
  userId: number,
  input: {
    fileName: string;
    fileBase64?: string;
    rawText?: string;
    subject?: string;
    customPrompt?: string;
  }
) {
  let textContent = input.rawText || "";

  if (!textContent && input.fileBase64) {
    try {
      const messages: any[] = [
        {
          role: "system",
          content:
            "أنت خبير قراءة واستخراج النصوص التعليمية من المذكرات والكتب الدراسية بصيغة PDF. قم باستخراج أهم الأفكار والمعلومات العلمية بكل دقة.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `استخرج واقرأ المحتوى التعليمي للمستند المرفق ("${input.fileName}") بالتفصيل لمادة ${
                input.subject || "عام"
              }.`,
            },
            {
              type: "file_url",
              file_url: {
                url: `data:application/pdf;base64,${input.fileBase64}`,
                mime_type: "application/pdf",
              },
            },
          ],
        },
      ];
      const res = await invokeLLM({ messages });
      textContent = res.choices[0]?.message?.content || "";
    } catch (e) {
      console.error("PDF Base64 Extraction error:", e);
    }
  }

  const promptText = `أنت موجه واستشاري إعداد بطاقات التكرار المتباعد والـ Active Recall للطلاب والمذاكرة الذكية.
المستند الدراسي: "${input.fileName}" (المادة: ${input.subject || "عام"}).

محتوى المستند المعالج:
${(textContent || input.fileName).slice(0, 8000)}

${input.customPrompt ? `تعليمات إضافية من الطالب: ${input.customPrompt}` : ""}

المطلوب:
تحليل المستند واستخراج أهم 8 إلى 15 نقطة ومفهوم وقانون وسؤال متكرر وتحويلها إلى بطاقات استذكار (Flashcards) فائقة الجودة.

أعد النتيجة كـ JSON حصراً بالتنسيق التالي:
{
  "deckTitle": "اسم المجموعة التلقائي (مثال: بطاقات مراجعة - الفصل الأول)",
  "subject": "${input.subject || "عام"}",
  "summary": "ملخص تنفيذي سريع في سطرين عن المحتوى",
  "flashcards": [
    {
      "prompt": "السؤال / المفهوم أو الصيغة على الوجه الأول للبطاقة (Front)",
      "answer": "الإجابة النموذجية المباشرة والمفصلة على الوجه الثاني (Back)",
      "category": "تعريف",
      "importance": "عالية جداً"
    }
  ]
}`;

  const llmRes = await invokeLLM({
    messages: [
      { role: "system", content: "أنت محرك توليد بطاقات استذكار دراسية احترافية بالذكاء الاصطناعي." },
      { role: "user", content: promptText },
    ],
    response_format: { type: "json_object" },
  });

  const rawJson = llmRes.choices[0]?.message?.content || "{}";
  let parsed: any = {};
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    parsed = {
      deckTitle: `بطاقات مراجعة - ${input.fileName}`,
      subject: input.subject || "عام",
      summary: "بطاقات استذكار تم استخراجها من ملف PDF",
      flashcards: [
        {
          prompt: `ما الموضوع الرئيسي لملف ${input.fileName}؟`,
          answer: textContent.slice(0, 200) || "محتوى دراسي مهم للمراجعة.",
          category: "تعريف",
          importance: "عالية جداً",
        },
      ],
    };
  }

  return parsed;
}

export async function savePdfFlashcardsToDeck(
  userId: number,
  input: {
    deckTitle: string;
    description?: string;
    cards: Array<{ prompt: string; answer: string }>;
  }
) {
  const deck = await createFlashcardDeck(userId, {
    title: input.deckTitle || "بطاقات استذكار PDF",
    description: input.description || "تم توليدها تلقائياً بالذكاء الاصطناعي من ملف PDF دراسي.",
    color: "#0f766e",
  });

  for (const c of input.cards) {
    if (c.prompt && c.answer) {
      await createFlashcard(userId, {
        deckId: deck.id,
        prompt: c.prompt,
        answer: c.answer,
      });
    }
  }

  // Award coins
  const cycle = await getActiveCycle(userId);
  await awardCoins({
    userId,
    cycleId: cycle.id,
    amount: 30,
    reason: `إنشاء وحفظ مجموعة فلاش كاردز AI من PDF: ${deck.title}`,
    referenceKey: `deck:pdf:${deck.id}`,
  });

  return { success: true, deckId: deck.id, cardCount: input.cards.length };
}











