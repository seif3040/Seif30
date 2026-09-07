import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import * as personalAssistant from "./personalAssistant";
import { safeStudyUrl } from "../client/src/lib/videoSources";

const id = z.number().int().positive();
const date = z.coerce.date();
const priority = z.enum(["urgent", "medium", "low"]);
const difficulty = z.enum(["easy", "medium", "hard"]);
const lessonSourceInput = z.object({
  subject: z.string().trim().min(1).max(80),
  platform: z.string().trim().min(1).max(180),
  teacherName: z.string().trim().min(1).max(180),
  delivery: z.enum(["online", "in_person", "hybrid"]),
  role: z.enum(["primary", "review", "support"]),
  url: z.string().url().max(768).optional(),
  location: z.string().trim().max(255).optional(),
  weeklyPlan: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  dashboard: router({ summary: protectedProcedure.query(({ ctx }) => db.dashboard(ctx.user.id)) }),
  studyPlan: router({
    list: protectedProcedure.query(({ ctx }) => db.listStudyPlan(ctx.user.id)),
    createSubject: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(160), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() })).mutation(({ ctx, input }) => db.createSubject(ctx.user.id, input)),
    updateSubject: protectedProcedure.input(z.object({ subjectId: id, title: z.string().trim().min(1).max(160), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() })).mutation(({ ctx, input }) => db.updateSubject(ctx.user.id, input.subjectId, input)),
    deleteSubject: protectedProcedure.input(z.object({ subjectId: id })).mutation(({ ctx, input }) => db.deleteSubject(ctx.user.id, input.subjectId)),
    createChapter: protectedProcedure.input(z.object({ subjectId: id, title: z.string().trim().min(1).max(180) })).mutation(({ ctx, input }) => db.createChapter(ctx.user.id, input)),
    updateChapter: protectedProcedure.input(z.object({ chapterId: id, title: z.string().trim().min(1).max(180) })).mutation(({ ctx, input }) => db.updateChapter(ctx.user.id, input.chapterId, input.title)),
    deleteChapter: protectedProcedure.input(z.object({ chapterId: id })).mutation(({ ctx, input }) => db.deleteChapter(ctx.user.id, input.chapterId)),
    createLesson: protectedProcedure.input(z.object({ chapterId: id, title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), estimatedMinutes: z.number().int().min(5).max(600), notes: z.string().max(8000).optional() })).mutation(({ ctx, input }) => db.createLesson(ctx.user.id, input)),
    updateLesson: protectedProcedure.input(z.object({ lessonId: id, title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), estimatedMinutes: z.number().int().min(5).max(600), notes: z.string().max(8000).optional() })).mutation(({ ctx, input }) => db.updateLesson(ctx.user.id, input.lessonId, input)),
    deleteLesson: protectedProcedure.input(z.object({ lessonId: id })).mutation(({ ctx, input }) => db.deleteLesson(ctx.user.id, input.lessonId)),
    updateProgress: protectedProcedure.input(z.object({ lessonId: id, progress: z.number().int().min(0).max(99) })).mutation(({ ctx, input }) => db.updateLessonProgress(ctx.user.id, input.lessonId, input.progress)),
    complete: protectedProcedure.input(z.object({ lessonId: id })).mutation(({ ctx, input }) => db.completeLesson(ctx.user.id, input.lessonId)),
    review: protectedProcedure.input(z.object({ lessonId: id })).mutation(({ ctx, input }) => db.reviewLesson(ctx.user.id, input.lessonId)),
  }),
  tasks: router({
    list: protectedProcedure.query(({ ctx }) => db.listTasks(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), scheduledFor: z.string().date().optional(), deadline: date.optional(), priority, category: z.string().trim().min(1).max(80).optional() })).mutation(({ ctx, input }) => db.createTask(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ taskId: id, title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), scheduledFor: z.string().date().optional(), deadline: date.optional(), priority, category: z.string().trim().min(1).max(80).optional() })).mutation(({ ctx, input }) => db.updateTask(ctx.user.id, input.taskId, input)),
    delete: protectedProcedure.input(z.object({ taskId: id })).mutation(({ ctx, input }) => db.deleteTask(ctx.user.id, input.taskId)),
    complete: protectedProcedure.input(z.object({ taskId: id })).mutation(({ ctx, input }) => db.completeTask(ctx.user.id, input.taskId)),
  }),
  lessonSources: router({
    list: protectedProcedure.query(({ ctx }) => db.listLessonSources(ctx.user.id)),
    seedDefaults: protectedProcedure.mutation(({ ctx }) => db.seedSeifLessonSources(ctx.user.id)),
    create: protectedProcedure.input(lessonSourceInput).mutation(({ ctx, input }) => db.createLessonSource(ctx.user.id, input)),
    update: protectedProcedure.input(lessonSourceInput.extend({ sourceId: id, active: z.boolean() })).mutation(({ ctx, input }) => db.updateLessonSource(ctx.user.id, input.sourceId, input)),
    delete: protectedProcedure.input(z.object({ sourceId: id })).mutation(({ ctx, input }) => db.deleteLessonSource(ctx.user.id, input.sourceId)),
  }),
  habits: router({
    list: protectedProcedure.query(({ ctx }) => db.listHabits(ctx.user.id)),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(160), frequency: z.enum(["daily", "weekly"]), target: z.number().int().min(1).max(7) })).mutation(({ ctx, input }) => db.createHabit(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ habitId: id, name: z.string().trim().min(1).max(160), frequency: z.enum(["daily", "weekly"]), target: z.number().int().min(1).max(7) })).mutation(({ ctx, input }) => db.updateHabit(ctx.user.id, input.habitId, input)),
    delete: protectedProcedure.input(z.object({ habitId: id })).mutation(({ ctx, input }) => db.deleteHabit(ctx.user.id, input.habitId)),
    complete: protectedProcedure.input(z.object({ habitId: id, completedOn: z.string().date().optional() })).mutation(({ ctx, input }) => db.completeHabit(ctx.user.id, input.habitId, input.completedOn)),
  }),
  goals: router({
    list: protectedProcedure.query(({ ctx }) => db.listGoals(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), deadline: date.optional(), milestones: z.array(z.object({ title: z.string().trim().min(1).max(180), targetPercent: z.number().int().min(1).max(100) })).max(8).optional() })).mutation(({ ctx, input }) => db.createGoal(ctx.user.id, input)),
    update: protectedProcedure.input(z.object({ goalId: id, title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), deadline: date.optional() })).mutation(({ ctx, input }) => db.updateGoal(ctx.user.id, input.goalId, input)),
    delete: protectedProcedure.input(z.object({ goalId: id })).mutation(({ ctx, input }) => db.deleteGoal(ctx.user.id, input.goalId)),
    updateProgress: protectedProcedure.input(z.object({ goalId: id, progress: z.number().int().min(0).max(100) })).mutation(({ ctx, input }) => db.updateGoalProgress(ctx.user.id, input.goalId, input.progress)),
  }),
  pomodoro: router({
    list: protectedProcedure.query(({ ctx }) => db.listPomodoros(ctx.user.id)),
    start: protectedProcedure.input(z.object({ plannedMinutes: z.union([z.literal(15), z.literal(25), z.literal(45), z.literal(60)]), subjectId: id.optional() })).mutation(({ ctx, input }) => db.startPomodoro(ctx.user.id, { plannedMinutes: input.plannedMinutes as 15 | 25 | 45 | 60, subjectId: input.subjectId })),
    setPaused: protectedProcedure.input(z.object({ sessionId: id, paused: z.boolean() })).mutation(({ ctx, input }) => db.pausePomodoro(ctx.user.id, input.sessionId, input.paused)),
    complete: protectedProcedure.input(z.object({ sessionId: id })).mutation(({ ctx, input }) => db.completePomodoro(ctx.user.id, input.sessionId)),
  }),
  studySearch: router({ query: protectedProcedure.input(z.object({ query: z.string().trim().min(1).max(120) })).query(({ ctx, input }) => db.searchStudyWorkspace(ctx.user.id, input.query)) }),
  studyCoach: router({
    getInsights: protectedProcedure.query(({ ctx }) => db.getAIStudyCoachInsights(ctx.user.id)),
  }),
  flashcards: router({
    list: protectedProcedure.query(({ ctx }) => db.listFlashcardDecks(ctx.user.id)),
    createDeck: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(180), description: z.string().max(4000).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() })).mutation(({ ctx, input }) => db.createFlashcardDeck(ctx.user.id, input)),
    create: protectedProcedure.input(z.object({ deckId: id, prompt: z.string().trim().min(1).max(10000), answer: z.string().trim().min(1).max(10000) })).mutation(({ ctx, input }) => db.createFlashcard(ctx.user.id, input)),
    review: protectedProcedure.input(z.object({ cardId: id, result: z.enum(["again", "good", "mastered"]) })).mutation(({ ctx, input }) => db.reviewFlashcard(ctx.user.id, input.cardId, input.result)),
    delete: protectedProcedure.input(z.object({ cardId: id })).mutation(({ ctx, input }) => db.deleteFlashcard(ctx.user.id, input.cardId)),
    generatePdfFlashcards: protectedProcedure
      .input(
        z.object({
          fileName: z.string().trim().min(1).max(320),
          fileBase64: z.string().optional(),
          rawText: z.string().optional(),
          subject: z.string().optional(),
          customPrompt: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.generatePdfFlashcardsAI(ctx.user.id, input)),
    savePdfFlashcards: protectedProcedure
      .input(
        z.object({
          deckTitle: z.string().trim().min(1).max(180),
          description: z.string().optional(),
          cards: z.array(z.object({ prompt: z.string(), answer: z.string() })).min(1).max(50),
        })
      )
      .mutation(({ ctx, input }) => db.savePdfFlashcardsToDeck(ctx.user.id, input)),
  }),
  video: router({
    current: protectedProcedure.query(({ ctx }) => db.currentVideoSession(ctx.user.id)),
    history: protectedProcedure.query(({ ctx }) => db.listVideoSessions(ctx.user.id)),
    createNote: protectedProcedure.input(z.object({ sessionId: id, title: z.string().trim().min(1).max(220), content: z.string().trim().min(1).max(30000), timestampSeconds: z.number().int().min(0).max(172800).optional() })).mutation(({ ctx, input }) => db.createVideoNote(ctx.user.id, input)),
    updateNote: protectedProcedure.input(z.object({ noteId: id, title: z.string().trim().min(1).max(220), content: z.string().trim().min(1).max(30000), timestampSeconds: z.number().int().min(0).max(172800).optional() })).mutation(({ ctx, input }) => db.updateVideoNote(ctx.user.id, input.noteId, input)),
    deleteNote: protectedProcedure.input(z.object({ noteId: id })).mutation(({ ctx, input }) => db.deleteVideoNote(ctx.user.id, input.noteId)),
    start: protectedProcedure.input(z.object({ videoUrl: z.string().trim().min(1).max(2000), lessonTitle: z.string().trim().max(220).optional(), subject: z.enum(["arabic", "history", "english", "programming_ai", "german", "other"]).default("other"), requestedMode: z.enum(["auto", "embedded", "external"]).default("auto") })).mutation(({ ctx, input }) => { const videoUrl = safeStudyUrl(input.videoUrl); if (!videoUrl) throw new Error("استخدم رابطًا صالحًا يبدأ بـ http:// أو https:// فقط."); return db.startVideoSession(ctx.user.id, { ...input, videoUrl }); }),
    end: protectedProcedure.input(z.object({ sessionId: id })).mutation(({ ctx, input }) => db.endVideoSession(ctx.user.id, input.sessionId)),
    triggerBreak: protectedProcedure.input(z.object({ sessionId: id })).mutation(({ ctx, input }) => db.triggerVideoBreak(ctx.user.id, input.sessionId)),
    heartbeat: protectedProcedure.input(z.object({ sessionId: id, active: z.boolean(), playbackPosition: z.number().min(0).max(172800).optional() })).mutation(({ ctx, input }) => db.trackVideoPlayback(ctx.user.id, input.sessionId, input)),
    resume: protectedProcedure.input(z.object({ sessionId: id, force: z.boolean().optional() })).mutation(({ ctx, input }) => db.resumeVideoSession(ctx.user.id, input.sessionId, input.force)),
    setTimer: protectedProcedure.input(z.object({ sessionId: id, running: z.boolean() })).mutation(({ ctx, input }) => db.setVideoTimer(ctx.user.id, input.sessionId, input.running)),
    setExternalTimer: protectedProcedure.input(z.object({ sessionId: id, running: z.boolean() })).mutation(({ ctx, input }) => db.setExternalVideoTimer(ctx.user.id, input.sessionId, input.running)),
    setProgress: protectedProcedure.input(z.object({ sessionId: id, progress: z.enum(["started", "middle", "finished", "reviewed"]) })).mutation(({ ctx, input }) => db.setVideoManualProgress(ctx.user.id, input.sessionId, input.progress)),
  }),
  exams: router({
    list: protectedProcedure.query(({ ctx }) => db.listExams(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), subjectId: id.optional(), chapterId: id.optional(), lessonId: id.optional(), lessonIds: z.array(id).max(250).optional(), scheduledAt: date.optional() })).mutation(({ ctx, input }) => db.createExam(ctx.user.id, input)),
    completeAttempt: protectedProcedure.input(z.object({ examId: id, totalQuestions: z.number().int().min(1).max(500), correctAnswers: z.number().int().min(0).max(500), difficulty, missedTopics: z.array(z.string().trim().min(1).max(120)).max(40) })).mutation(({ ctx, input }) => db.completeExamAttempt(ctx.user.id, input)),
  }),
  ai: router({
    chat: protectedProcedure.input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(5000) })).min(1).max(12) })).mutation(({ ctx, input }) => db.chatWithAssistant(ctx.user.id, input.messages)),
  }),
  personalAssistant: router({
    plan: protectedProcedure.input(z.object({ request: z.string().trim().min(1).max(1200) })).mutation(({ ctx, input }) => personalAssistant.planPersonalAssistantAction(ctx.user.id, input.request)),
    memory: protectedProcedure.query(({ ctx }) => db.listAssistantMessages(ctx.user.id)),
    dailySummary: protectedProcedure.mutation(({ ctx }) => db.getDailyStudySummary(ctx.user.id)),
    execute: protectedProcedure.input(z.object({ plan: z.object({ reply: z.string().max(1200), actionType: z.enum(personalAssistant.personalAssistantActionTypes), title: z.string().max(200), targetTitle: z.string().max(200), priority: z.enum(["urgent", "medium", "low"]), scheduledFor: z.string().max(10), frequency: z.enum(["daily", "weekly"]), target: z.number().int().min(1).max(7), route: z.enum(["", "/tasks", "/habits", "/goals", "/study-plan", "/exams", "/pomodoro", "/notebooks", "/analytics"]), requiresConfirmation: z.boolean() }), confirmed: z.literal(true) })).mutation(async ({ ctx, input }) => { const result = await personalAssistant.executePersonalAssistantAction(ctx.user.id, input.plan, input.confirmed); await db.saveAssistantMessage(ctx.user.id, "assistant", result.message); return result; }),
  }),
  notebooks: router({
    list: protectedProcedure.query(({ ctx }) => db.listNotebooks(ctx.user.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(180) })).mutation(({ ctx, input }) => db.createNotebook(ctx.user.id, input.title)),
    notes: protectedProcedure.input(z.object({ notebookId: id })).query(({ ctx, input }) => db.listNotes(ctx.user.id, input.notebookId)),
    createNote: protectedProcedure.input(z.object({ notebookId: id, title: z.string().trim().min(1).max(220), content: z.string().max(30000) })).mutation(({ ctx, input }) => db.createNote(ctx.user.id, input)),
    sources: protectedProcedure.input(z.object({ notebookId: id })).query(({ ctx, input }) => db.listNotebookSources(ctx.user.id, input.notebookId)),
    uploadSource: protectedProcedure.input(z.object({ notebookId: id, fileName: z.string().trim().min(1).max(320), mimeType: z.enum(["text/plain", "text/markdown", "application/pdf"]), contentBase64: z.string().min(1).max(7_000_000) })).mutation(({ ctx, input }) => db.uploadNotebookSource(ctx.user.id, input)),
    createQuiz: protectedProcedure.input(z.object({ notebookId: id })).mutation(({ ctx, input }) => db.createNotebookQuiz(ctx.user.id, input.notebookId)),
    markQuizReviewed: protectedProcedure.input(z.object({ examId: id })).mutation(({ ctx, input }) => db.markNotebookQuizReviewed(ctx.user.id, input.examId)),
    ai: protectedProcedure.input(z.object({ notebookId: id, mode: z.enum(["question", "summary", "quiz", "explain"]), prompt: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => db.notebookAI(ctx.user.id, input)),
    exportAllNotes: protectedProcedure.query(({ ctx }) => db.exportAllUserNotes(ctx.user.id)),
  }),
  calendar: router({
    list: protectedProcedure.input(z.object({ from: date, to: date })).query(({ ctx, input }) => db.listCalendar(ctx.user.id, input.from, input.to)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), startsAt: date, endsAt: date.optional(), eventType: z.enum(["important_date", "custom"]) })).mutation(({ ctx, input }) => db.createCalendarEvent(ctx.user.id, input)),
  }),
  rewards: router({ list: protectedProcedure.query(({ ctx }) => db.listRewards(ctx.user.id)), purchase: protectedProcedure.input(z.object({ rewardId: id, referenceKey: z.string().uuid() })).mutation(({ ctx, input }) => db.purchaseReward(ctx.user.id, input.rewardId, input.referenceKey)) }),
  achievements: router({ list: protectedProcedure.query(({ ctx }) => db.listAchievements(ctx.user.id)) }),
  coins: router({ ledger: protectedProcedure.query(({ ctx }) => db.coinLedger(ctx.user.id)) }),
  analytics: router({ overview: protectedProcedure.query(({ ctx }) => db.analytics(ctx.user.id)) }),
  mistakes: router({
    list: protectedProcedure.query(({ ctx }) => db.listMistakes(ctx.user.id)),
    create: protectedProcedure.input(z.object({ subject: z.string().trim().min(1).max(80), topic: z.string().trim().max(180).optional(), errorType: z.string().trim().min(1).max(80), question: z.string().trim().min(1).max(5000), wrongAnswer: z.string().trim().max(5000).optional(), correctAnswer: z.string().trim().min(1).max(5000), explanation: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.createMistake(ctx.user.id, input)),
    updateStatus: protectedProcedure.input(z.object({ mistakeId: id, status: z.enum(["needs_review", "reviewed", "mastered"]) })).mutation(({ ctx, input }) => db.updateMistakeStatus(ctx.user.id, input.mistakeId, input.status)),
    delete: protectedProcedure.input(z.object({ mistakeId: id })).mutation(({ ctx, input }) => db.deleteMistake(ctx.user.id, input.mistakeId)),
    analyzeAI: protectedProcedure.mutation(({ ctx }) => db.analyzeMistakesAI(ctx.user.id)),
  }),
  feynman: router({
    list: protectedProcedure.query(({ ctx }) => db.listFeynmanSessions(ctx.user.id)),
    evaluateAI: protectedProcedure.input(z.object({ topic: z.string().trim().min(1).max(200), subject: z.string().trim().min(1).max(80), userExplanation: z.string().trim().min(5).max(10000) })).mutation(({ ctx, input }) => db.evaluateFeynmanAI(ctx.user.id, input)),
  }),
  quizGenerator: router({
    generate: protectedProcedure.input(z.object({ subject: z.string().trim().min(1).max(80), topicText: z.string().trim().min(10).max(15000), difficulty: z.enum(["easy", "medium", "hard"]), questionCount: z.number().int().min(3).max(20) })).mutation(({ ctx, input }) => db.generateQuizAI(ctx.user.id, input)),
    submit: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), totalQuestions: z.number().int().min(1).max(100), correctAnswers: z.number().int().min(0).max(100), difficulty: z.enum(["easy", "medium", "hard"]) })).mutation(({ ctx, input }) => db.submitQuizResults(ctx.user.id, input)),
  }),
  summarizer: router({
    summarizeAI: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(200), contentText: z.string().trim().max(20000), imageBase64: z.string().optional() })).mutation(({ ctx, input }) => db.summarizePageAI(ctx.user.id, input)),
  }),
  dailyChallenge: router({
    get: protectedProcedure.query(({ ctx }) => db.getDailyChallenge(ctx.user.id)),
  }),
  mindMap: router({
    generateAI: protectedProcedure.input(z.object({ topic: z.string().trim().min(1).max(200), subject: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => db.generateMindMapAI(ctx.user.id, input)),
  }),
  decomposer: router({
    decomposeAI: protectedProcedure.input(z.object({ bigTaskTitle: z.string().trim().min(1).max(200), detailsText: z.string().trim().max(5000).optional() })).mutation(({ ctx, input }) => db.decomposeTaskAI(ctx.user.id, input)),
  }),
  hybridHub: router({
    list: protectedProcedure.query(({ ctx }) => db.listHybridLessons(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          subject: z.string().trim().min(1).max(80),
          teacherName: z.string().trim().min(1).max(100),
          mode: z.enum(["online", "center", "hybrid"]),
          platformOrCenter: z.string().trim().min(1).max(120),
          lectureTitle: z.string().trim().min(1).max(200),
          onlineUrl: z.string().trim().max(1000).optional(),
          accessCode: z.string().trim().max(100).optional(),
          expiryDate: z.string().trim().max(50).optional(),
          centerTime: z.string().trim().max(100).optional(),
          notes: z.string().trim().max(2000).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.createHybridLesson(ctx.user.id, input)),
    updateStatus: protectedProcedure
      .input(
        z.object({
          lessonId: z.number().int(),
          status: z.enum(["pending", "watched", "attended", "completed"]).optional(),
          sheetStatus: z.enum(["pending", "submitted", "corrected"]).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.updateHybridLessonStatus(ctx.user.id, input.lessonId, input)),
    delete: protectedProcedure
      .input(z.object({ lessonId: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteHybridLesson(ctx.user.id, input.lessonId)),
  }),
  deepWork: router({
    completeSession: protectedProcedure
      .input(z.object({ durationMinutes: z.number().min(1).max(300), subject: z.string().optional() }))
      .mutation(({ ctx, input }) => db.completeDeepWorkSession(ctx.user.id, input)),
  }),
  mistakeQuiz: router({
    generateAI: protectedProcedure
      .input(z.object({ subject: z.string().optional() }))
      .mutation(({ ctx, input }) => db.generateMistakeQuizAI(ctx.user.id, input)),
  }),
  customRewards: router({
    list: protectedProcedure.query(({ ctx }) => db.listCustomRewards(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ title: z.string().trim().min(1).max(100), cost: z.number().int().min(1).max(10000), icon: z.string().optional() }))
      .mutation(({ ctx, input }) => db.createCustomReward(ctx.user.id, input)),
    delete: protectedProcedure
      .input(z.object({ rewardId: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteCustomReward(ctx.user.id, input.rewardId)),
  }),
  smartDayPlanner: router({
    generateAI: protectedProcedure
      .input(
        z.object({
          wakeTime: z.string(),
          centerDetails: z.string().optional(),
          travelMinutes: z.number().optional(),
          onlinePlatformsList: z.string().optional(),
          targetSubjects: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.generateSmartDayPlanAI(ctx.user.id, input)),
  }),
  resourceBridge: router({
    list: protectedProcedure.query(({ ctx }) => db.listExternalResources(ctx.user.id)),
    addAI: protectedProcedure
      .input(
        z.object({
          url: z.string().trim().min(1).max(2000),
          customTitle: z.string().trim().max(200).optional(),
          subject: z.string().trim().max(100).optional(),
          totalMinutes: z.number().int().min(1).max(10000).optional(),
          platform: z.string().trim().max(100).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.addExternalResourceAI(ctx.user.id, input)),
    updateProgress: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int(),
          completedMinutes: z.number().int().min(0),
          notes: z.string().trim().max(2000).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.updateResourceProgress(ctx.user.id, input.resourceId, input)),
    delete: protectedProcedure
      .input(z.object({ resourceId: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteExternalResource(ctx.user.id, input.resourceId)),
    addBookmark: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int(),
          timestampStr: z.string().trim().min(1).max(50),
          title: z.string().trim().min(1).max(200),
          note: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.addResourceBookmark(ctx.user.id, input.resourceId, input)),
    deleteBookmark: protectedProcedure
      .input(z.object({ bookmarkId: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteResourceBookmark(ctx.user.id, input.bookmarkId)),
    logFocusSession: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int(),
          durationMinutes: z.number().int().min(1).max(1000),
          sessionNotes: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.logResourceFocusSession(ctx.user.id, input)),
    listFocusSessions: protectedProcedure.query(({ ctx }) => db.listResourceFocusSessions(ctx.user.id)),
    uploadPdf: protectedProcedure
      .input(
        z.object({
          resourceId: z.number().int().optional(),
          fileName: z.string().trim().min(1).max(300),
          fileUrl: z.string().trim().optional(),
          subject: z.string().trim().optional(),
          fileBase64: z.string().optional(),
          rawText: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.processAndAddPdfResource(ctx.user.id, input)),
    listPdfs: protectedProcedure
      .input(z.object({ resourceId: z.number().int().optional() }).optional())
      .query(({ ctx, input }) => db.listResourcePdfs(ctx.user.id, input?.resourceId)),
    searchPdfs: protectedProcedure
      .input(z.object({ query: z.string().trim() }))
      .query(({ ctx, input }) => db.searchResourcePdfs(ctx.user.id, input.query)),
    summarizePdf: protectedProcedure
      .input(
        z.object({
          pdfId: z.number().int(),
          customPrompt: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.summarizePdfAI(ctx.user.id, input.pdfId, input.customPrompt)),
    deletePdf: protectedProcedure
      .input(z.object({ pdfId: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteResourcePdf(ctx.user.id, input.pdfId)),
  }),
  smartCalendar: router({
    getData: protectedProcedure
      .input(z.object({ dateStr: z.string().optional() }).optional())
      .query(({ ctx, input }) => db.getSmartCalendarData(ctx.user.id, input?.dateStr)),
    addEvent: protectedProcedure
      .input(
        z.object({
          title: z.string().trim().min(1).max(300),
          category: z.string().default("lesson"),
          sourceType: z.string().optional(),
          sourceId: z.number().int().optional(),
          eventDate: z.string(),
          startTime: z.string(),
          durationMinutes: z.number().int().optional(),
          subject: z.string().optional(),
          platform: z.string().optional(),
          linkUrl: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.addSmartCalendarEvent(ctx.user.id, input)),
    toggleEvent: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ ctx, input }) => db.toggleSmartCalendarEvent(ctx.user.id, input.id)),
    deleteEvent: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(({ ctx, input }) => db.deleteSmartCalendarEvent(ctx.user.id, input.id)),
    generateAIRoadmap: protectedProcedure
      .input(
        z.object({
          eventDate: z.string(),
          availableMinutes: z.number().int().optional(),
          preferences: z.string().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.generateSmartCalendarRoadmapAI(ctx.user.id, input)),
    syncToGoogle: protectedProcedure
      .input(z.object({ accessToken: z.string() }))
      .mutation(({ ctx, input }) => db.syncToGoogleCalendar(ctx.user.id, input.accessToken)),
    syncFromGoogle: protectedProcedure
      .input(z.object({ accessToken: z.string() }))
      .mutation(({ ctx, input }) => db.syncFromGoogleCalendar(ctx.user.id, input.accessToken)),
    fullBiDirectionalSync: protectedProcedure
      .input(z.object({ accessToken: z.string() }))
      .mutation(({ ctx, input }) => db.fullGoogleCalendarBiDirectionalSync(ctx.user.id, input.accessToken)),
  }),
  studyRooms: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(200),
          description: z.string().trim().max(1000).optional(),
          customCode: z.string().trim().max(50).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.createStudyRoom(ctx.user.id, ctx.user.name || "سيف", input)),
    join: protectedProcedure
      .input(z.object({ roomCode: z.string().trim().min(1) }))
      .mutation(({ ctx, input }) => db.joinStudyRoom(ctx.user.id, ctx.user.name || "سيف", input.roomCode)),
    listUserRooms: protectedProcedure.query(({ ctx }) => db.listUserStudyRooms(ctx.user.id)),
    getDetails: protectedProcedure
      .input(z.object({ roomId: z.number().int() }))
      .query(({ ctx, input }) => db.getStudyRoomDetails(ctx.user.id, input.roomId)),
    addResource: protectedProcedure
      .input(
        z.object({
          roomId: z.number().int(),
          title: z.string().trim().min(1).max(300),
          platform: z.string().trim().min(1).max(100),
          url: z.string().trim().url(),
          subject: z.string().trim().max(100).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.addStudyRoomResource(ctx.user.id, ctx.user.name || "سيف", input)),
    updateProgress: protectedProcedure
      .input(
        z.object({
          roomId: z.number().int(),
          roomResourceId: z.number().int(),
          progressPercent: z.number().int().min(0).max(100),
          completedMinutes: z.number().int().min(0).optional(),
        })
      )
      .mutation(({ ctx, input }) => db.updateStudyRoomProgress(ctx.user.id, ctx.user.name || "سيف", input)),
    importToBridge: protectedProcedure
      .input(z.object({ roomResourceId: z.number().int() }))
      .mutation(({ ctx, input }) => db.importStudyRoomResourceToBridge(ctx.user.id, input.roomResourceId)),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => db.getPersonalizedNotifications(ctx.user.id)),
    dismiss: protectedProcedure
      .input(z.object({ key: z.string() }))
      .mutation(({ ctx, input }) => db.dismissNotification(ctx.user.id, input.key)),
    getSettings: protectedProcedure.query(({ ctx }) => db.getNotificationSettings(ctx.user.id)),
    updateSettings: protectedProcedure
      .input(
        z.object({
          leadMinutes: z.number().int().optional(),
          soundEnabled: z.boolean().optional(),
          browserPushEnabled: z.boolean().optional(),
          antiProcrastinationMode: z.boolean().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.updateNotificationSettings(ctx.user.id, input)),
    getAiCoachNudge: protectedProcedure.mutation(({ ctx }) => db.generateAIProcrastinationCoachMessage(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
