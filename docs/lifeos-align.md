# LifeOS 对齐 · Agent 接口

项目步骤由系统自动排：没做完的会自动顺延到该项目的下一个工作日。人只做两件事，都可以**直接和 Claude（或 Cursor / Codex）对话**完成；逐项目对齐也可以在今日页「开工」里点「开始对齐」，弹窗一个个过项目（走同一个接口）：

| 什么时候 | 用户怎么说 | mode | 做什么 |
|---|---|---|---|
| 开工 | 「逐项目对齐」「开工对齐」 | `projects` | 逐个过项目（今天排到的先过）：节奏、暂停 / 恢复、归哪一力、补下一步；建议限时（例如 15 分钟），过不完就停 |
| 任何时候 / 晚上 | 「记一下今天做了…」「今天做了什么」 | `daily` | 把做了的事对到步骤、项目、习惯上 |
| 晚上复盘 | 贴来「# LifeOS 今日复盘 · 日期」（记录段「复制今日总结」） | — | 按里面「要做的事」：调项目进度、审查记录和九力、`set_day_score` 打计划完成度分、提改进 |

今日页的三段：① 开工（状态 · 九力 · 逐项目对齐）→ ② 执行（自动排程）→ ③ 记录（只读：做了什么 / 没做什么）。

接口在 LifeOS 服务器上：`$LIFEOS_URL/api/plan/align`（本机开发默认 `http://127.0.0.1:3000`）。下面的例子先设好：

```bash
LIFEOS=${LIFEOS_URL:-http://127.0.0.1:3000}
```

用这个接口完成对齐，不要为某一天写一次性的脚本直接改数据库。

## 流程

```bash
# 1. 取上下文（mode=daily | projects，date 默认今天）。prompt 字段是给自己的工作说明 + 所有 id
curl -s "$LIFEOS/api/plan/align?mode=projects" | jq -r .prompt

# 2. 和用户对话，确认要做的操作

# 3. 预览（dryRun 默认 true，不写库），把 preview 念给用户确认
curl -s -X POST "$LIFEOS/api/plan/align" \
  -H 'Content-Type: application/json' \
  -d '{"ops":[{"op":"complete_step","stepId":"…","note":"…"}]}'

# 4. 用户确认后应用
curl -s -X POST "$LIFEOS/api/plan/align" \
  -H 'Content-Type: application/json' \
  -d '{"dryRun":false,"ops":[…]}'
```

返回 `{ preview, errors, applied }`。`errors` 里的操作不会执行（未知 id、非执行日的习惯、未来日期等）。如果用户有一个「对齐」习惯，做完后可以用 `check_habit` 给它打卡。

## 操作

| op | 字段 | 作用 |
|---|---|---|
| `complete_step` | `stepId`, `note?` | 已有步骤记为当天完成；`note` 写进步骤反馈 |
| `log_work` | `projectId`, `title`, `note?` | 计划外的工作：在项目下新建一条当天已完成的步骤 |
| `check_habit` | `habitId`, `level?`（`full` / `minimum`） | 习惯打卡（必须是当天的执行日） |
| `set_rhythm` | `projectId`, `workdays`（0=周日 … 6=周六） | 项目哪几天推进 |
| `pause_project` / `resume_project` | `projectId` | 暂停 / 恢复自动排程 |
| `set_power` | `projectId`, `power`（九力 key 或 `null`） | 项目归哪一力 |
| `add_step` | `projectId`, `title`, `detail?` | 追加一个待办步骤（排到队尾，自动排程） |
| `uncomplete_step` | `stepId` | 撤销完成：步骤改回未完成，重新进入自动排程 |
| `uncheck_habit` | `habitId` | 取消当天的习惯打卡 |
| `remove_step` | `stepId` | 删掉不再需要的待办步骤（已完成的要先 `uncomplete_step`） |
| `set_day_score` | `score`（0–100）, `note?` | 计划完成度，写回记录段；note 三行：分数理由 / 审查改了什么 / 明天的一条改进 |
| `set_habit_power` | `habitId`, `power`（九力 key 或 `base`） | 习惯归哪一力（base = 生活底盘） |

九力 key：`clean` 清洁力 · `vitality` 活力 · `calm` 定力 · `learning` 学习力 · `influence` 网红力 · `action` 行动力 · `social` 链接力 · `link` 机会力 · `organize` 组织力。

## 约定

- 只用上下文里出现过的 id；对不上的事先问用户，或 `log_work` 记到最相关的项目。
- 没做完的步骤不用处理，系统会自动顺延。
- 先预览、得到用户确认再 `dryRun:false`。
- 一天里全部项目步骤最好不超过 6 个；超了就帮用户调节奏或暂停项目。
- 项目说明写在项目置顶的「项目概览」笔记（`PATCH /api/notes/[id]`，没有就 `POST /api/projects/[id]/notes`，type `overview`）。**不要写 `Project.description`**：项目页不显示它，编辑保存时还会清空。

## 晚上复盘

记录段里每个没做的写完原因后，「复制今日总结」会生成一段 prompt（模板在 `src/lib/day-review.ts`），里面有状态、做了 / 多做了、没做和原因、九力，以及所有 id。收到后：

1. 先列判断和 ops，POST 预览（`date` 填复盘那天），用户确认后 `dryRun:false`。
2. 九力分数是自动算的，不能直接改，只能改输入：补记 / 撤销 / 改归属。
3. 一定要 `set_day_score`，页面的计划完成度和变化图读的就是它。
4. 如果复盘流程本身该改，指出 `src/lib/day-review.ts` 里要改的那一条。
