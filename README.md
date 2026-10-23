# LifeOS

面向个人的本地生活管理工作台：把目标拆成项目与每日行动，把联系人、记录和复盘连接起来。

当前定位是 **本机、单用户、中文优先的开发预览**。已有完整的日常工作流，但还不是可直接部署到公网的多用户产品。以 [MIT 许可证](LICENSE) 发布。

## 从哪里开始

| 入口 | 用途 |
| --- | --- |
| 现在 | 今日安排、本周时间块、习惯、提醒 |
| 事件流 | 汇总任务、会议、记录与本地 Agent 活动 |
| 推进 | 项目步骤、里程碑、目标、KR、任务与长期时间线 |
| 关系 | 联系人、圈子、维护节奏、会议与机会 |
| 复盘 | 周/月/季/年回顾、趋势与个人策略 |
| 库 | 健康、冲动记录、SOP、厨艺、旅行、笔记、阅读、文献、财务 |

建议先建立一个目标、一个项目和一个今日任务，再启用自己需要的辅助模块。策略、远景、作息规则等模块自带的是虚构示例，按自己的情况改写即可。

## 全新安装

需要 Node.js 22.13+（建议 Node 22 LTS）、npm，以及能写入的本地磁盘。已在 macOS 验证；Linux 配置了 CI，尚未验证 Windows。

```bash
cp .env.example .env
npm ci
npx prisma generate
npm run db:init
npm run db:seed  # 可选：只向空数据库添加虚构演示数据
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。`dev` 和 `start` 默认仅监听 `127.0.0.1`。无需账户，也没有身份认证；不要直接暴露到公网。修改端口可用 `npm run dev -- -p 4000`，并同步设置 `LIFEOS_URL`。

- `DATABASE_URL="file:./dev.db?connection_limit=1"` 对应 `prisma/dev.db`。
- `db:init` 对空库执行 `prisma migrate deploy`；若数据库已有内容会拒绝执行。
- `db:seed` 检查全部业务表，只允许空库，不会清空已有数据。
- **已有安装不要覆盖 `.env`，也不要执行初始化或重置命令。** 先备份，再在数据库副本中验证升级。
- 升级到新版本时先备份，再执行 `npx prisma migrate deploy` 应用新增的迁移。

生产模式本机运行：

```bash
npm run build
npm start
```

构建使用系统字体，不需要访问 Google Fonts。依赖安装仍需要 npm registry 或已有缓存。

## 可选集成

在 `.env` 中设置，修改后重启服务：

| 配置 | 默认 / 行为 |
| --- | --- |
| `LIFEOS_AGENT_ACTIVITY` | 示例配置为 `0`；设为 `1` 才启用本地 Agent 读取 |
| `LIFEOS_CODEX_HOME` | 默认当前用户的 `.codex` |
| `LIFEOS_CURSOR_HOME` | 默认当前用户的 `.cursor` |
| `LIFEOS_CURSOR_STATE_DB` | 可覆盖 Cursor 状态库路径；默认适用于 macOS |
| `READING_LIBRARY_ROOT` | 默认 `data/library`，用于文献文件 |
| `OBSIDIAN_VAULT` | 默认 `data/obsidian`，也可通过导入命令传入 |
| `LIFE_RECORDS_ROOT` | 默认 `data/life-records`，用于记录照片 |
| `LIFEOS_POMODORO_HABIT_IDS` | 留空时显示全部活跃习惯；可用逗号分隔 ID 限制列表 |
| `EMAIL_DRY_RUN` | 示例配置为 `1`；即使有 API key 也不会发信 |

未设置 `LIFEOS_AGENT_ACTIVITY` 时保留已有安装的启用行为；新安装请使用示例配置。Agent 信息来自本机文件，不是云端任务管理接口，也不会自动操纵 Agent。

### Agent 与项目匹配

「事件流」右侧可以按日期、来源和项目查看 Cursor / Codex 活动：

- workspace 与项目名唯一匹配时自动关联，忽略大小写、空格、下划线和连字符，并支持常见目录后缀。
- 相似名称或重名只给候选；手动关联优先，保存为项目的 `workspace:目录名` 标签。
- 标签会随 JSON 备份保留。移除手动关联可恢复自动匹配。
- 活跃状态根据本地更新时间推测，不代表任务完成。标签绑定按 workspace 名称作用；不同路径的同名仓库仍需进一步区分。

### 事件并行计时

「事件流」每条事件都可启动定时番茄钟（1–240 分钟，默认 25）或自由计时。顶部轨道展示各自起点、暂停空隙和共同的当前时间线；可同时计时、暂停、继续、结束。刷新或切页不会丢失计时，定时到点按实际截止时间结束；自由计时需要手动结束。结束计时不会自动完成原事件。

分类先按事件名称给建议，启动前与历史记录中都可修改。勾选「分配时间块」后，今日时间块自动按实际时段填色：同一时间多个事件均分有效秒数，多分类显示分色，暂停不计入；手动填色始终优先，再次清除手动色后恢复自动分配。自动色由持久化计时记录计算，不会覆盖手动记录。旧的习惯番茄钟保持原有功能，不纳入新事件计时的自动分配。

计时记录随 JSON 2.0 备份一起导出和恢复。

### Obsidian

```bash
npm run import:obsidian -- "/absolute/path/to/vault"
```

导入器会写入数据库并记录已导入文件。先备份并在副本中试运行；当前支持特定目录约定，并非任意 Obsidian 库的无损同步器。

### 邮件

界面的今日计划中可配置提醒邮箱和提前天数。发信需要主动设置 `RESEND_API_KEY`、`RESEND_FROM`，并将 `EMAIL_DRY_RUN` 设为 `0`。自动化接口应设置 `REMINDER_SECRET`。默认安装不创建任何系统定时任务，也不发送邮件。

## 备份与恢复

展开侧边栏「库」，使用「导出数据备份 / 从备份恢复」。

- 新版 **LifeOS JSON 2.0** 导出全部 58 张业务表，包括计划、设置、关联关系、健康、文献、菜谱与 SOP。
- **不包含**文献文件、照片二进制、Obsidian 原文件、Agent 会话日志或 `.env`。完整迁移还需复制 `data/` 及自定义文件目录；配置中的路径也需调整。
- 恢复会覆盖全部业务数据。选择文件后会显示表数和记录数供确认；请先导出当前备份，停止其他窗口的编辑。
- 服务器先校验版本、表、字段、类型和重复 ID，再使用事务恢复。关联损坏会回滚。成功后清除页面数据缓存。
- **旧版 1.x 备份不能直接覆盖恢复**：它们缺少部分模块的数据。请保留原备份和数据库，在副本中通过对应旧版本导入、迁移并核对后再生成 2.0 备份；目前没有自动转换器。
- JSON 不加密，包含私人生活与财务数据；不要提交到仓库或 issue。

需要数据库原始备份时，使用 SQLite backup API 或停止服务后复制数据库；运行期间不要仅复制 `.db` 而漏掉 WAL 数据。

## 开发与检查

```bash
npm run check        # 类型检查、单元测试、lint 增量检查
npm run test:backup  # 临时 SQLite 数据库中的全表恢复与回滚验证
npm run build
npm run lint         # 完整 lint；当前历史问题仍会使它失败
npm run privacy:scan # 检查将被提交的文件里有没有数据库、密钥、本机路径或个人词条
```

`lint:baseline` 是临时的技术债门禁：现有问题公开记录在 [基线](docs/lint-baseline.json)，新增问题会失败。它不代表 lint 已清零，不应为了让 PR 通过而抬高基线。

技术栈：Next.js 16.4、React 19、TypeScript、Prisma 6、SQLite、Tailwind CSS 4。业务 API 在 `src/app/api/`，领域逻辑在 `src/lib/`，界面在 `src/app/` 与 `src/components/`。

开发约定见 [CONTRIBUTING](CONTRIBUTING.md)，安全边界见 [SECURITY](SECURITY.md)。

## 许可证

[MIT](LICENSE)
