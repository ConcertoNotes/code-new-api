# 国庆中秋充值抽奖 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有钱包页面加入可配置的双节充值抽奖，支持无限个人次数、145张奖池、预算熔断、动态概率和审计。

**Architecture:** 新增独立活动模型与 service，充值成功后幂等发放机会；抽奖在数据库事务中扣机会、锁库存并入账。新增认证 API 与钱包内嵌抽奖卡片，活动配置由管理员 API 管理。

**Tech Stack:** Go/Gin/GORM、React/TypeScript、React Query、i18next。

## Global Constraints

- 保留现有 new-api 与 QuantumNous 标识。
- 所有数据库行为兼容 SQLite、MySQL、PostgreSQL。
- 所有用户界面文案使用 i18n。
- 先写失败测试并观察失败，再写生产代码。
- 不修改现有充值金额或模型价格逻辑。

---

### Task 1: 活动领域模型和抽奖算法

**Files:** Create \`model/lottery.go\`, \`service/lottery.go\`; tests \`model/lottery_test.go\`, \`service/lottery_test.go\`.

- [ ] 定义活动、奖池批次、奖项库存、用户机会、抽奖记录模型。
- [ ] 实现 145 张首池配置、库存占比和期望值计算。
- [ ] 实现 userFactor、budgetFactor 与库存约束权重。
- [ ] 先写测试覆盖权重归一化、库存耗尽、预算档位和无限次数。
- [ ] 运行 \`go test ./model ./service -run Lottery -count=1\`，先确认测试失败，再实现并重跑。

### Task 2: 充值事件和抽奖 API

**Files:** Modify \`router/\`; Create \`controller/lottery.go\`; tests \`controller/lottery_test.go\`.

- [ ] 增加 GET 活动状态、POST 抽奖、GET 我的记录接口。
- [ ] 在所有充值成功结算路径调用统一的幂等机会发放函数。
- [ ] 为订单唯一键、请求幂等键和事务回滚写失败测试。
- [ ] 运行对应 Go controller/model/service 测试。

### Task 3: 管理端配置和预算熔断

**Files:** Create \`controller/admin_lottery.go\`; modify admin router and settings registry; tests \`controller/admin_lottery_test.go\`.

- [ ] 增加活动启停、奖池初始化、预算上限、补池和审计查询。
- [ ] 实现 ¥300 服务器费和 20% 安全储备参数化，不写死在抽奖请求中。
- [ ] 初始化只能创建一次相同批次，管理员补池保留操作记录。
- [ ] 运行管理员接口测试和 \`git diff --check\`。

### Task 4: 钱包抽奖卡片和国际化

**Files:** Modify \`web/src/features/wallet/index.tsx\`, \`web/src/features/wallet/api.ts\`, \`web/src/features/wallet/types.ts\`; create wallet lottery components and tests; modify all seven locale JSON files.

- [ ] 增加倒计时、累计充值、可抽次数、奖池进度、翻牌/转盘动画和记录列表。
- [ ] 请求完成前锁按钮，使用 React Query 失效活动状态与用户钱包缓存。
- [ ] 所有文案通过 \`t()\`，覆盖 en、zh、zh-TW、fr、ru、ja、vi。
- [ ] 运行 \`bun run typecheck\`、涉及文件 lint 和目标 Vitest。

### Task 5: 集成验证

- [ ] 运行 \`go test ./controller ./model ./service\`。
- [ ] 运行 \`cd web && bun run typecheck\` 与目标测试。
- [ ] 使用真实 SQLite 测试活动初始化、充值幂等和并发抽奖。
- [ ] 若可用，使用 TEST_MYSQL_DSN、TEST_POSTGRES_DSN 重跑活动持久化测试。
- [ ] 运行 \`git diff --check\` 并进行浏览器钱包流程验证。

