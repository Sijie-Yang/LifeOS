# Bot ↔ LifeOS 集成

所有写库都走"先预览、确认后应用"：`dryRun` 默认 `true`，只有显式 `"dryRun": false` 才写。
没有改数据库 schema（无迁移）。永远不写 `Project.description`。

## 1. `/api/plan/align` 新增操作

`POST /api/plan/align { date?, ops | text, dryRun?, source? }` → `{ preview, errors, applied }`
核心逻辑在 `src/lib/align-apply.ts`（`runAlign`），route 只是薄包装。

| op | 字段 | 说明 |
|---|---|---|
| `create_project` | `name`（必填）, `category?`（必须是已有分类）, `power?`（九力 key / null）, `planActive?`（默认 false）, `workdays?`（0–6，默认 1–5）, `tags?` | 同名未归档项目已存在 → 报错不建。带 `description` 直接拒绝。 |
| `create_habit` | `name`（必填）, `schedule?`（`anytime` 默认 / `weekly`）, `daysOfWeek?`, `projectName?`（已有或同批新建的项目）, `power?`（九力 key / base；不给按名字推断）, `minimumVersion?`, `cue?` | anytime = `scheduleMode:"none"`、每天、无时段。同名习惯已存在 → 报错。 |

- 同一批里先执行 `create_project`，再 `create_habit`，再其余操作。
- `source`（bot 名）：新项目 tags 里加 `bot:<source>`；`log_work` 的步骤 detail 写 `补记 · bot:<source>`。
- SQLite 被锁（`database is locked` / `SQLITE_BUSY` / P1008）时每个写操作指数退避重试最多 5 次。

## 2. `/api/plan/ingest` — bot 日报汇总

- `GET ?date=YYYY-MM-DD` → 读日报目录，返回合并预览（永远 dryRun）。
- `POST { date?, reports?, dryRun? }` → `{ date, dryRun, bots, summary, needsUser, preview, perBot[], errors, applied }`
  - 不给 `reports` 时读 `$LIFEOS_BOT_REPORTS_DIR/<date>/*.json`（默认 `<项目根>/data/bot-reports/<date>/`）。
  - 每个 bot 的 `proposed_ops` 单独过一次 `runAlign`（`source` = bot 名）。日期不是 `date` 的日报跳过。
  - 注意：bot 之间不能互相引用同批新建的项目（每个 bot 单独校验）。

### 日报 schema（每个 bot 每天一个文件，例如 `learning.json`）

```json
{
  "bot": "learning",
  "date": "2026-10-17",
  "done": ["读完第 2 章 §1–§5"],
  "habits": ["阅读 · 每日 20 分钟"],
  "proposed_ops": [{ "op": "check_habit", "habitId": "…" }],
  "blockers": ["第 3 章示例代码缺失"],
  "needs_user": ["确认小测改到 17:15"],
  "tomorrow": ["第 3 章"]
}
```

`bot` 必填；其余字符串数组可省略（非字符串项会被丢掉）。`proposed_ops` 照原样写库；`habits[]` 自动转 `check_habit`，其余文字存进当天的 Bot 日报 Note（见 §6）。

## 3. 流程

1. 各 bot 晚间把日报写进日报目录。
2. 负责每日的 bot（下文称 `daily`）晚上 `GET /api/plan/ingest` → 给用户看 `summary` + `preview` + `needsUser`。
3. 用户确认后：`POST /api/plan/ingest { "dryRun": false }`。

## 4. 示例：一次创建项目和习惯（需用户确认）

```bash
curl -s -X POST "${LIFEOS_URL:-http://127.0.0.1:3000}/api/plan/align" -H 'Content-Type: application/json' -d '{
  "source": "setup", "dryRun": false,
  "ops": [
    { "op": "create_project", "name": "Side Project" },
    { "op": "create_project", "name": "Reading", "power": "learning" },
    { "op": "create_habit", "name": "阅读 · 每日 20 分钟", "schedule": "anytime", "projectName": "Reading", "power": "learning" }
  ]}'
```

## 5. 读写全域（所有 bot 都能读写全部 LifeOS）

**没有按 bot 的权限门**：任何 bot 都能调用下面所有端点和操作。下面的分工只是各 bot 的**关注点（focus）**。
每次写都带 `source`（bot 名）：预览前缀 `[bot]`；新建的项目 / 联系人 tags 加 `bot:<name>`；新机会无 source 时写 `bot:<name>`；`log_contact` 内容前缀 `[bot:<name>]`、`log_work` detail 写 `补记 · bot:<name>`。
（update_* 不改 tags，来源只体现在调用方的预览/日报里——无审计表，未改 schema。）

### 只读快照

| 端点 | 内容 |
|---|---|
| `GET /api/bot/research[?category=Research&all=1]` | 分类 = Research 的项目（默认排除已归档），含 steps、power、rhythm、status、tags |
| `GET /api/bot/contacts[?logs=3]` | 全部联系人 + 圈子名 + 最近 N 条联系记录 |
| `GET /api/bot/jobs[?lane=career]` | 全部 Opportunity |
| `GET /api/bot/daily` | 重定向到 `GET /api/plan/align`（今日步骤、习惯、项目） |

### 新增编辑操作（都走 `POST /api/plan/align` 或日报 `proposed_ops`，dryRun 默认）

| op | 字段 | 可改字段（白名单，其他一律拒绝） |
|---|---|---|
| `update_project` | `projectId`, `set` | name, status（IDEA/PLANNING/IN_PROGRESS/ON_HOLD/COMPLETED/CANCELLED）, priority（LOW/MEDIUM/HIGH/URGENT）, tags[], power, planActive, workdays[0–6], pinned, targetDate, wishFinishTime。**description 永不可写** |
| `create_contact` | `set`（name 必填） | name, email, phone, company, position, institution, city, notes, tags[], importance, contactFrequencyDays, responseLevel, category（已有圈子名）, lastContactAt |
| `update_contact` | `contactId`, `set` | 同上 |
| `log_contact` | `contactId`, `type?`, `content?` | 新建 ContactLog（日期 = 对齐日 12:00）并更新 lastContactAt |
| `create_opportunity` | `set`（title 必填） | title, lane（career/life）, category, status（Watching/Active/Passed/Won/Archived）, priority, deadline, source, nextAction, notes, projectId |
| `update_opportunity` | `opportunityId`, `set` | 同上 |

步骤类仍用原有 `complete_step` / `add_step` / `log_work` / `remove_step`；节奏也可用 `set_rhythm`。

### 各 bot 关注点（示例分工）

bot 名字随意，下面用 `research` / `network` / `jobs` / `daily` 举例。示例里 `$LIFEOS` 指 `${LIFEOS_URL:-http://127.0.0.1:3000}`。

**research（科研）** — 关注 Research 分类的项目。
```bash
curl -s "$LIFEOS/api/bot/research"
curl -s -X POST "$LIFEOS/api/plan/align" -H 'Content-Type: application/json' -d '{"source":"research","ops":[
  {"op":"update_project","projectId":"<id>","set":{"status":"IN_PROGRESS","workdays":[1,3,5]}},
  {"op":"add_step","projectId":"<id>","title":"写完 related work 初稿"}]}'
```

**network（人脉）** — 关注联系人与圈子（圈子名是你在联系人页里建的分类，例如家人、朋友、同事、客户）。
```bash
curl -s "$LIFEOS/api/bot/contacts"
curl -s -X POST "$LIFEOS/api/plan/align" -H 'Content-Type: application/json' -d '{"source":"network","ops":[
  {"op":"log_contact","contactId":"<id>","type":"wechat","content":"约了下周咖啡"},
  {"op":"update_contact","contactId":"<id>","set":{"importance":4,"city":"Singapore"}}]}'
```

**jobs（求职）** — 关注 Opportunity（career lane）。与外部 tracker CSV 对账：
`POST /api/bot/jobs/tracker-sync { csvPath?, csv?, dryRun?, source? }`（默认读 `$LIFEOS_JOB_TRACKER_CSV`，未设置时为 `data/job-tracker.csv`；dryRun 默认）
→ `{ counts, matched[{row,title,opportunityId,diff}], created[], ambiguous[{row,candidates,reason}], align }`。
CSV 表头：`Priority,Track,Institution/Company,Position,Location,Deadline,Required materials,Fit notes,URL,Status,Referees needed,Notes`。
匹配顺序：URL 出现在 source → 同标题 → 机构名（含少量内置别名，见 `src/lib/tracker-sync.ts`）+ 部门/岗位关键词。
映射：Status → Submitted/Pending = Active，Rejected/Skipped = Passed，Offer = Won，其余（To review / Next up / Planned / On hold）= Watching；
Priority 1→HIGH，2→MEDIUM，3→LOW；Track Academic→Research，其余→Industry；只认 YYYY-MM-DD 的 deadline（tracker 无日期不覆盖）。
ambiguous 行不生成操作，需人工决定。

**daily（每日）** — 关注每日计划、习惯、项目对齐：`GET /api/plan/align?mode=daily|projects`、`GET/POST /api/plan/ingest`，原有全部 ops。

## 6. 早上计划 → 晚上关账

### 读：`GET /api/bot/daily[?date=&mode=daily|projects]`
一次拿到：`dayPlan`（意图 + ≤3 优先级）、`dayLog`（是否已关账、必做、反思、记录批注 / 计划外、完成度、作息与精力）、
`align`（今日步骤 + 习惯 + 项目，即 `/api/plan/align` 的 context）、`tasks`（未完成 + 今天完成的）、
`week`（本周 WeeklyPlan / WeeklyReview）、`reportsToday`（今天已交日报的 bot）、`yesterdayTomorrow`（昨晚各 bot 日报的 tomorrow[]，给早上排计划）。

### 写：新增操作（都走 align / 日报 proposed_ops，dryRun 默认）

| op | 字段 | 写到 |
|---|---|---|
| `set_day_plan` | `intention?`, `priorities?`（≤3，字符串或 `{title, projectId?, completed?}`） | DailyPlan（同标题保留原 id / 完成状态） |
| `set_must_do` | `items`（≤3：`{type:"habit"|"task", id}` 或 `{type:"priority", title}`） | DailyLog.mustDo（覆盖） |
| `update_day_log` | `set`：reflection, energyMorning, drainMorning, urgeMorning, energyEvening, drainEvening（1–5）, wakeTime, plannedSleepTime, sleepTime, exerciseStartTime（HH:mm）, weightKg, waistCm, exerciseMinutes, exerciseCalories, bodyNote | DailyLog（wakeTime / sleepTime 会像 UI 一样重算睡眠时长） |
| `record_note` | `kind`（step/task/habit）, `id`, `text`（空 = 删） | DailyLog.recordNotes（没做的写原因） |
| `add_extra` | `title` | DailyLog.recordExtras（计划外、不挂项目；挂项目用 `log_work`） |
| `close_day` | `note?` | DailyLog.closedAt = 现在、closeNote（反思为空时 note 也写进反思）。可重关 |
| `set_day_score` | `score` 0–100, `note?` | DailyLog.planScore / planScoreNote（原有） |
| `create_task` | `set`：title（必填）, dueDate, scheduledDate（YYYY-MM-DD）, priority, projectId, contactId, emailRemind | TaskItem（source = `bot:<name>`） |
| `complete_task` | `taskId` | TaskItem.completed |
| `set_week_plan` | `weekStart?`（周一）, `intention?`, `priorities?` | WeeklyPlan |
| `set_week_review` | `weekStart?`, `set`：wins, improvements, nextFocus | WeeklyReview（周日复盘） |
| `save_bot_digest` | `content` | Note「Bot 日报 · <date>」（type `bot-digest`，覆盖；挂到当天 DailyLog.noteId 若为空） |

### ingest 自动映射（不再静默丢）
- `habits[]`：**写今天已完成的习惯名**（不是相关习惯）→ 自动生成 `check_habit`（宽松匹配名字；对不上进 `errors`）。
- `done / habits / blockers / needs_user / tomorrow` → 全部合并进 `save_bot_digest`（一条预览）。
- 返回新增 `files`、`missingBots`（按 `LIFEOS_EXPECTED_BOTS` 今天应交但没交的；格式 `research,learning,writer@135`，`@` 后每位数字是一个星期几，0=周日；未设置则为空）、`tomorrow`（结构化，给第二天早上）、`perBot[].autoOps`。

### 日流程
1. 早上 daily bot：`GET /api/bot/daily` → 用 `yesterdayTomorrow` + 今日步骤排计划 → `set_day_plan` + `set_must_do`（+ 可选 `update_day_log` 起床 / 早上精力）。
2. 白天各 bot：项目工作 `complete_step` / `log_work`，任务 `create_task` / `complete_task`。
3. 晚上各 bot 写日报；daily bot `GET /api/plan/ingest` 预览。
4. 用户确认后 daily bot 发 close 批：`update_day_log`（晚间精力 / 内耗 / 就寝 / 反思）、`record_note`（没做的原因）、`add_extra`、`set_day_score`、`check_habit 日关账`、`close_day`；然后 `POST /api/plan/ingest {"dryRun":false}`。周日加 `set_week_review` + `set_week_plan`。
