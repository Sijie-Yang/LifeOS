-- CreateTable
CREATE TABLE "ContactCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "position" TEXT,
    "categoryId" TEXT,
    "lastContactAt" DATETIME,
    "contactFrequencyDays" INTEGER NOT NULL DEFAULT 30,
    "birthday" DATETIME,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "importance" INTEGER NOT NULL DEFAULT 3,
    "institution" TEXT,
    "city" TEXT,
    "responseLevel" INTEGER,
    "partnerProfile" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContactCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'message',
    "content" TEXT,
    "contactedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "completedAt" DATETIME,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "categoryId" TEXT,
    "ideaDate" DATETIME,
    "archiveDate" DATETIME,
    "wishFinishTime" TEXT,
    "goalId" TEXT,
    "power" TEXT,
    "planActive" BOOLEAN NOT NULL DEFAULT false,
    "planWorkdays" TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    "planAnchorDate" TEXT,
    "planSkipDates" TEXT NOT NULL DEFAULT '[]',
    "planExtraDates" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProjectCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectPlanStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "estMinutes" INTEGER,
    "milestoneId" TEXT,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneDate" TEXT,
    "scheduledDate" TEXT,
    "feedback" TEXT,
    "correction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectPlanStep_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATETIME,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "childProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMilestone_childProjectId_fkey" FOREIGN KEY ("childProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "ProjectContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "scheduleMode" TEXT NOT NULL DEFAULT 'none',
    "daysOfWeek" TEXT NOT NULL DEFAULT '[1,2,3,4,5,6,0]',
    "monthDays" TEXT NOT NULL DEFAULT '[1]',
    "startTime" TEXT,
    "endTime" TEXT,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "minimumVersion" TEXT,
    "cue" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "power" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Habit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PomodoroSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 25,
    "actualMinutes" INTEGER,
    "distractions" INTEGER NOT NULL DEFAULT 0,
    "breakQuality" INTEGER,
    "preEnergy" INTEGER,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PomodoroSession_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HabitCheckIn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "level" TEXT,
    "note" TEXT,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitCheckIn_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "habitId" TEXT,
    "goalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ScheduleBlock_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScheduleBlock_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayScheduleBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "taskId" TEXT,
    "goalId" TEXT,
    "habitId" TEXT,
    "scheduleBlockId" TEXT,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DayScheduleBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TaskItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DayScheduleBlock_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DayScheduleBlock_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "type" TEXT NOT NULL DEFAULT 'note',
    "readingTag" TEXT,
    "projectId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "year" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'paper',
    "status" TEXT NOT NULL DEFAULT 'to_read',
    "relativePath" TEXT,
    "sourceUrl" TEXT,
    "doi" TEXT,
    "whySelected" TEXT,
    "notes" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LibraryDocumentProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "LibraryDocumentProject_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LibraryDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LibraryDocumentProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LifeGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" TEXT NOT NULL DEFAULT 'career',
    "horizon" TEXT NOT NULL DEFAULT '1y',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "targetDate" DATETIME,
    "budgetAmount" REAL,
    "budgetCurrency" TEXT,
    "whyItMatters" TEXT,
    "resourceNote" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GoalContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "GoalContact_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoalKeyResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GoalKeyResult_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoalKeyResultProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyResultId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "GoalKeyResultProject_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "GoalKeyResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GoalKeyResultProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏆',
    "category" TEXT NOT NULL DEFAULT 'general',
    "unlockedAt" DATETIME
);

-- CreateTable
CREATE TABLE "TimelineOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT,
    "detail" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'cash',
    "balance" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "baseCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "investmentPolicy" TEXT,
    "financeAccessLimit" INTEGER NOT NULL DEFAULT 7,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "bedtimeTarget" TEXT,
    "windDownChecklist" TEXT NOT NULL DEFAULT '["收衣服","放下手机","调暗灯光"]',
    "reminderEmail" TEXT,
    "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailRemindDays" TEXT NOT NULL DEFAULT '[14,7,3,1,0]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FinanceAccessLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "currency" TEXT NOT NULL,
    "rateToBase" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InvestmentHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    "avgCost" REAL NOT NULL,
    "currentPrice" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "priceUpdatedAt" DATETIME,
    "accountId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvestmentHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestmentAdjustment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    "price" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "date" TEXT NOT NULL,
    "note" TEXT,
    "reason" TEXT,
    "emotion" TEXT,
    "accountId" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAdjustment_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "InvestmentHolding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestmentPriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "holdingId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "price" REAL NOT NULL,
    CONSTRAINT "InvestmentPriceHistory_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "InvestmentHolding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WealthSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "netWorth" REAL NOT NULL,
    "cashTotal" REAL NOT NULL,
    "investmentTotal" REAL NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "breakdown" TEXT NOT NULL DEFAULT '{}',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "budget" REAL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "categoryId" TEXT,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinanceAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "wins" TEXT,
    "improvements" TEXT,
    "nextFocus" TEXT,
    "goalReflections" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PeriodReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodType" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "wins" TEXT,
    "improvements" TEXT,
    "nextFocus" TEXT,
    "goalReflections" TEXT NOT NULL DEFAULT '[]',
    "statsSnapshot" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "lane" TEXT NOT NULL DEFAULT 'career',
    "category" TEXT NOT NULL DEFAULT 'Other',
    "status" TEXT NOT NULL DEFAULT 'Watching',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "deadline" TEXT,
    "source" TEXT,
    "nextAction" TEXT,
    "pushedDate" TEXT,
    "notes" TEXT,
    "emailRemind" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "goalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Opportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpportunityContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    CONSTRAINT "OpportunityContact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpportunityContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "meetingDate" TEXT NOT NULL,
    "meetingTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'GMT+8',
    "durationMin" TEXT,
    "meetingFormat" TEXT,
    "location" TEXT,
    "purpose" TEXT,
    "content" TEXT,
    "logDate" TEXT,
    "projectId" TEXT,
    "referrerId" TEXT,
    "obsidianPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Meeting_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingAttendee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Travel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Leisure',
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "destination" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'GMT+8',
    "purpose" TEXT,
    "content" TEXT,
    "projectId" TEXT,
    "obsidianPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Travel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TravelCompanion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "travelId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    CONSTRAINT "TravelCompanion_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TravelCompanion_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TEXT,
    "scheduledDate" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "emailRemind" BOOLEAN NOT NULL DEFAULT true,
    "projectId" TEXT,
    "goalId" TEXT,
    "contactId" TEXT,
    "meetingId" TEXT,
    "noteId" TEXT,
    "completedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaskItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskItem_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LifeGoal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskItem_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TaskItem_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "content" TEXT,
    "noteId" TEXT,
    "obsidianPath" TEXT,
    "mustDo" TEXT NOT NULL DEFAULT '[]',
    "closedAt" DATETIME,
    "closeNote" TEXT,
    "energy" INTEGER,
    "mood" INTEGER,
    "sleepHours" REAL,
    "energyMorning" INTEGER,
    "drainMorning" INTEGER,
    "sleepScore" INTEGER,
    "wakeTime" TEXT,
    "plannedSleepTime" TEXT,
    "sleepTime" TEXT,
    "timeFills" TEXT NOT NULL DEFAULT '{}',
    "urgeMorning" INTEGER,
    "energyEvening" INTEGER,
    "drainEvening" INTEGER,
    "reflection" TEXT,
    "recordNotes" TEXT NOT NULL DEFAULT '{}',
    "recordExtras" TEXT NOT NULL DEFAULT '[]',
    "planScore" INTEGER,
    "planScoreNote" TEXT,
    "weightKg" REAL,
    "exerciseStartTime" TEXT,
    "exerciseMinutes" INTEGER,
    "exerciseCalories" INTEGER,
    "waistCm" REAL,
    "bodyNote" TEXT,
    "roomZones" TEXT NOT NULL DEFAULT '{}',
    "roomDone" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyLog_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" TEXT NOT NULL,
    "intention" TEXT,
    "priorities" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "intention" TEXT,
    "priorities" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NudgeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UrgeCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f97316',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "goal" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UrgeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intensity" INTEGER NOT NULL DEFAULT 3,
    "trigger" TEXT,
    "outcome" TEXT NOT NULL,
    "redirect" TEXT,
    "note" TEXT,
    "date" TEXT NOT NULL,
    CONSTRAINT "UrgeEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "UrgeCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ObsidianImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LifeStrategyMeta" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "northStar" TEXT,
    "decisionFilter" TEXT,
    "operatingSystem" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LifeStrategyPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "startDate" TEXT,
    "endDate" TEXT,
    "timeSplit" TEXT NOT NULL DEFAULT '{}',
    "priorities" TEXT NOT NULL DEFAULT '[]',
    "doList" TEXT NOT NULL DEFAULT '[]',
    "dontList" TEXT NOT NULL DEFAULT '[]',
    "content" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LifeStrategyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LifeStrategyEntry_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "LifeStrategyPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthTip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'body',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LifeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "photoPath" TEXT,
    "photoMime" TEXT,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scene" TEXT NOT NULL DEFAULT 'weekday',
    "durationMinutes" INTEGER,
    "servings" INTEGER,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "ingredients" TEXT NOT NULL DEFAULT '',
    "steps" TEXT NOT NULL DEFAULT '',
    "review" TEXT NOT NULL DEFAULT '',
    "inRotation" BOOLEAN NOT NULL DEFAULT false,
    "rotationDay" INTEGER,
    "wantToLearn" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "items" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "items" TEXT NOT NULL DEFAULT '[]',
    "projectId" TEXT,
    "travelId" TEXT,
    "contactId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_travelId_fkey" FOREIGN KEY ("travelId") REFERENCES "Travel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChecklistRun_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventTimer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "projectName" TEXT,
    "category" TEXT NOT NULL,
    "autoAllocate" BOOLEAN NOT NULL DEFAULT true,
    "mode" TEXT NOT NULL DEFAULT 'fixed',
    "durationSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'running',
    "activeKey" TEXT,
    "startedAt" DATETIME NOT NULL,
    "runningSince" DATETIME,
    "endedAt" DATETIME,
    "segments" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCategory_name_key" ON "ProjectCategory"("name");

-- CreateIndex
CREATE INDEX "ProjectPlanStep_projectId_sortOrder_idx" ON "ProjectPlanStep"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectPlanStep_scheduledDate_idx" ON "ProjectPlanStep"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMilestone_childProjectId_key" ON "ProjectMilestone"("childProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMilestone_projectId_childProjectId_key" ON "ProjectMilestone"("projectId", "childProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectContact_projectId_contactId_key" ON "ProjectContact"("projectId", "contactId");

-- CreateIndex
CREATE INDEX "PomodoroSession_habitId_date_idx" ON "PomodoroSession"("habitId", "date");

-- CreateIndex
CREATE INDEX "PomodoroSession_date_idx" ON "PomodoroSession"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCheckIn_habitId_date_key" ON "HabitCheckIn"("habitId", "date");

-- CreateIndex
CREATE INDEX "DayScheduleBlock_date_startTime_idx" ON "DayScheduleBlock"("date", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "DayScheduleBlock_date_scheduleBlockId_key" ON "DayScheduleBlock"("date", "scheduleBlockId");

-- CreateIndex
CREATE INDEX "LibraryDocument_status_idx" ON "LibraryDocument"("status");

-- CreateIndex
CREATE INDEX "LibraryDocument_relativePath_idx" ON "LibraryDocument"("relativePath");

-- CreateIndex
CREATE INDEX "LibraryDocumentProject_projectId_idx" ON "LibraryDocumentProject"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryDocumentProject_documentId_projectId_key" ON "LibraryDocumentProject"("documentId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalContact_goalId_contactId_key" ON "GoalContact"("goalId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalKeyResultProject_keyResultId_projectId_key" ON "GoalKeyResultProject"("keyResultId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineOverride_source_sourceId_key" ON "TimelineOverride"("source", "sourceId");

-- CreateIndex
CREATE INDEX "FinanceAccessLog_date_idx" ON "FinanceAccessLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_currency_key" ON "ExchangeRate"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentAdjustment_transactionId_key" ON "InvestmentAdjustment"("transactionId");

-- CreateIndex
CREATE INDEX "InvestmentAdjustment_holdingId_date_idx" ON "InvestmentAdjustment"("holdingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentPriceHistory_holdingId_date_key" ON "InvestmentPriceHistory"("holdingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WealthSnapshot_date_key" ON "WealthSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_weekStart_key" ON "WeeklyReview"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodReview_periodType_periodKey_key" ON "PeriodReview"("periodType", "periodKey");

-- CreateIndex
CREATE INDEX "Opportunity_deadline_idx" ON "Opportunity"("deadline");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE INDEX "Opportunity_lane_idx" ON "Opportunity"("lane");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityContact_opportunityId_contactId_key" ON "OpportunityContact"("opportunityId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_obsidianPath_key" ON "Meeting"("obsidianPath");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendee_meetingId_contactId_key" ON "MeetingAttendee"("meetingId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Travel_obsidianPath_key" ON "Travel"("obsidianPath");

-- CreateIndex
CREATE UNIQUE INDEX "TravelCompanion_travelId_contactId_key" ON "TravelCompanion"("travelId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_date_key" ON "DailyLog"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_obsidianPath_key" ON "DailyLog"("obsidianPath");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlan_weekStart_key" ON "WeeklyPlan"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_date_key" ON "DailyPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "NudgeLog_key_date_key" ON "NudgeLog"("key", "date");

-- CreateIndex
CREATE INDEX "UrgeEvent_categoryId_date_idx" ON "UrgeEvent"("categoryId", "date");

-- CreateIndex
CREATE INDEX "UrgeEvent_date_idx" ON "UrgeEvent"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ObsidianImport_path_key" ON "ObsidianImport"("path");

-- CreateIndex
CREATE INDEX "LifeStrategyEntry_date_idx" ON "LifeStrategyEntry"("date");

-- CreateIndex
CREATE INDEX "HealthTip_category_sortOrder_idx" ON "HealthTip"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "LifeRecord_date_domain_idx" ON "LifeRecord"("date", "domain");

-- CreateIndex
CREATE INDEX "LifeRecord_domain_createdAt_idx" ON "LifeRecord"("domain", "createdAt");

-- CreateIndex
CREATE INDEX "LifeRecord_pinned_date_idx" ON "LifeRecord"("pinned", "date");

-- CreateIndex
CREATE INDEX "Recipe_inRotation_rotationDay_idx" ON "Recipe"("inRotation", "rotationDay");

-- CreateIndex
CREATE INDEX "Recipe_wantToLearn_sortOrder_idx" ON "Recipe"("wantToLearn", "sortOrder");

-- CreateIndex
CREATE INDEX "Recipe_scene_sortOrder_idx" ON "Recipe"("scene", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_category_sortOrder_idx" ON "ChecklistTemplate"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRun_templateId_createdAt_idx" ON "ChecklistRun"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "ChecklistRun_status_updatedAt_idx" ON "ChecklistRun"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventTimer_activeKey_key" ON "EventTimer"("activeKey");

-- CreateIndex
CREATE INDEX "EventTimer_startedAt_idx" ON "EventTimer"("startedAt");

-- CreateIndex
CREATE INDEX "EventTimer_status_idx" ON "EventTimer"("status");

