# 噜噜岛 UI 命名替换实施清单

本次按现有方案完成站点名、顶部导航、侧栏、核心页面标题、密钥表单和表格、钱包、泡澡签到、日志、管理入口及相关提示文案替换。范围仅为 UI；原有未提交页面样式保留。

## 修改文件

共 35 个前端文件（包含 7 个语言文件及 3 个测试文件），另新增本实施清单。

- web/src/components/search.tsx
- web/src/features/channels/components/channels-columns.tsx
- web/src/features/dashboard/hooks/use-dashboard-config.tsx
- web/src/features/dashboard/index.tsx
- web/src/features/keys/components/__tests__/api-keys-mutate-drawer.test.tsx
- web/src/features/keys/components/api-keys-columns.tsx
- web/src/features/keys/components/api-keys-mutate-drawer.tsx
- web/src/features/keys/components/api-keys-table.tsx
- web/src/features/keys/index.tsx
- web/src/features/models/components/models-columns.tsx
- web/src/features/models/index.tsx
- web/src/features/playground/components/input/playground-input-controls.tsx
- web/src/features/profile/components/checkin-calendar-card.tsx
- web/src/features/profile/index.tsx
- web/src/features/redemption-codes/components/redemptions-columns.tsx
- web/src/features/subscriptions/index.tsx
- web/src/features/usage-logs/components/columns/common-logs-columns.tsx
- web/src/features/usage-logs/components/columns/task-logs-columns.tsx
- web/src/features/usage-logs/constants.ts
- web/src/features/usage-logs/index.tsx
- web/src/features/users/components/users-columns.tsx
- web/src/features/users/index.tsx
- web/src/hooks/__tests__/lulu-navigation.test.tsx
- web/src/hooks/__tests__/site-branding.test.tsx
- web/src/hooks/use-sidebar-data.ts
- web/src/i18n/locales/en.json
- web/src/i18n/locales/fr.json
- web/src/i18n/locales/ja.json
- web/src/i18n/locales/ru.json
- web/src/i18n/locales/vi.json
- web/src/i18n/locales/zh-TW.json
- web/src/i18n/locales/zh.json
- web/src/i18n/static-keys.ts
- web/src/lib/site-brand.ts
- web/src/lib/theme-customization.ts

## 全部简体中文文案映射

站点默认显示名及主题显示名：噜噜云 → 噜噜岛。以下 211 项为本次新增或变更的简体中文语言条目；作用于相应显示位置。

| 原显示文案 / 原用途 | 新显示文案 | 翻译键 |
|---|---|---|
| 集中展示密钥、余额、路由和服务健康状态。 | 今天也和噜噜一起看看岛上的情况吧。 | A focused home for keys, balance, routing, and service health. |
| 用更轻松、更可爱的方式连接你的 AI 工作流、模型与知识能力。 | 聊天、绘画、编程、创作，让每一次 AI 使用都轻松一点。 | A lighter, friendlier way to connect your AI workflows, models and knowledge. |
| API 密钥 | 通行徽章 | API Key |
| API 密钥（生产） | 通行徽章（生产） | API Key (Production) |
| API 密钥（沙盒） | 通行徽章（沙盒） | API Key (Sandbox) |
| API 密钥（批量模式下每行一个） | 通行徽章（批量模式下每行一个） | API Key (one per line for batch mode) |
| API 密钥 * | 通行徽章 * | API Key * |
| API 密钥创建成功 | 通行徽章创建成功 | API Key created successfully |
| API 密钥删除成功 | 通行徽章删除成功 | API Key deleted successfully |
| API 密钥禁用成功 | 通行徽章禁用成功 | API Key disabled successfully |
| API 密钥启用成功 | 通行徽章启用成功 | API Key enabled successfully |
| API 密钥更新成功 | 通行徽章更新成功 | API Key updated successfully |
| API 密钥 | 通行徽章 | API Keys |
| API 请求 | 出勤次数 | API Requests |
| API 密钥 | 通行徽章 | API key |
| 来自提供商的 API 密钥 | 来自提供商的 通行徽章 | API key from the provider |
| API 密钥正在加载，请稍后再试 | 通行徽章正在加载，请稍后再试 | API key is loading, please try again in a moment |
| 需要 API 密钥 | 需要通行徽章 | API key is required |
| 关于 | 关于噜噜 | About |
| API 密钥（表格） | 通行密钥 | Access Key |
| 添加资金 | 补充柚子 | Add Funds |
| 添加模型 | 添加伙伴 | Add Model |
| 通过提供必要信息添加新的 API 密钥。 | 设置徽章信息，用于访问噜噜岛中的模型服务。 | Add a new API key by providing necessary info. |
| 添加额度 | 补充柚子 | Add credits |
| 添加 API 密钥，设置渠道并配置访问权限 | 添加 通行徽章，设置渠道并配置访问权限 | Add your API keys, set up channels and configure access permissions |
| 成功（任务） | 顺利完成 | Adventure Complete |
| 失败（任务） | 遇到问题 | Adventure Encountered a Problem |
| 允许用户每日签到获取随机额度奖励 | 允许用户每日泡澡获取随机额度奖励 | Allow users to check in daily for random quota rewards |
| 公告详情 | 岛屿公告详情 | Announcement Details |
| 公告 | 岛屿公告 | Announcements |
| 分组 | 所属小队 | Assigned Team |
| 模型（密钥） | 可用伙伴 | Available Companions |
| 额度（密钥） | 可用柚子 | Available Yuzu |
| 返回控制台 | 返回噜噜小屋 | Back to Dashboard |
| 兜底分组 | 备用小队 | Backup Teams |
| 名称（密钥） | 徽章名称 | Badge Name |
| 数量（创建密钥） | 领取数量 | Badge Quantity |
| 状态（密钥） | 徽章状态 | Badge Status |
| 余额已耗尽 | 柚子口袋空空啦 | Balance depleted |
| 已签到（历史日期提示） | 泡过澡啦 | Bath Completed |
| 计费历史 | 柚子补给记录 | Billing History |
| 调用次数排行 | 伙伴出勤排行 | Call Count Ranking |
| 调用趋势 | 出勤趋势 | Call Trend |
| 用户（日志） | 豚友 | Capybara Friend |
| 用户（管理入口） | 豚友名册 | Capybara Friends |
| 渠道 | 补给渠道 | Channels |
| 每日签到可获得随机额度奖励 | 今天噜噜已经准备好啦，泡个澡就可以领取今日奖励。 | Check in daily to receive random quota rewards |
| 立即签到 | 领取今日柚子 | Check in now |
| 签到奖励 | 泡澡奖励 | Check-in Rewards |
| 签到设置 | 泡澡设置 | Check-in Settings |
| 签到失败 | 泡澡遇到一点问题，请稍后再试 | Check-in failed |
| 签到成功！获得 | 泡澡完成！柚子已放进口袋，获得 | Check-in successful! Received |
| 已签到 | 今天泡过啦 | Checked in |
| 选择并排列此 API 密钥将依次尝试的分组。 | 选择并排列此通行徽章将依次尝试的分组。 | Choose and order the groups this API key will try. |
| 保存更改（新建密钥） | 领取徽章 | Claim Badge |
| 状态（兑换码） | 领取状态 | Claim Status |
| 创建 API 密钥（抽屉标题） | 领取一枚新的通行徽章 | Claim a New Access Badge |
| 创建时间（密钥） | 领取时间 | Claimed At |
| 清空聊天历史 | 收起这段冒险 | Clear chat history |
| 清空聊天历史？ | 确认收起这段冒险？ | Clear chat history? |
| 模型（管理入口） | 伙伴图鉴 | Companion Catalog |
| 配置用户在创建 API 密钥时可以选择的分组。 | 配置用户在领取通行徽章时可以选择的分组。 | Configure a group that users can select when creating API keys. |
| 控制台 | 噜噜小屋 | Console |
| 对话已清空 | 这段冒险已经收起来啦 | Conversation cleared |
| 复制 API 密钥 | 复制 通行徽章 | Copy API key |
| 创建 API 密钥 | 领取新徽章 | Create API Key |
| 创建渠道 | 创建补给站 | Create Channel |
| 为你的应用或服务创建密钥 | 为你的应用或服务领取通行徽章 | Create a key for your app or service |
| 创建 API 密钥以解锁真实请求 | 领取通行徽章以解锁真实请求 | Create an API key to unlock the real request |
| 一次性创建多个 API 密钥（名称将添加随机后缀） | 一次领取多枚通行徽章（名称将添加随机后缀） | Create multiple API keys at once (random suffix will be added to names) |
| 剩余额度 | 柚子库存 | Credit remaining |
| Creem API 密钥（除非更新，否则留空） | Creem 通行徽章（除非更新，否则留空） | Creem API key (leave blank unless updating) |
| 当前余额 | 口袋里的柚子 | Current Balance |
| 每日签到 | 今日泡澡 | Daily Check-in |
| 过去 24 小时（消耗卡片） | 今日投喂 | Daily Feeding |
| 通用（导航分组） | 日常 | Daily Life |
| 数据看板 | 水豚看板 | Dashboard |
| 删除选定的 API 密钥 | 删除选定的 通行徽章 | Delete selected API keys |
| 删除 {{count}} 个 API 密钥？ | 删除 {{count}} 个 通行徽章？ | Delete {{count}} API key(s)? |
| 时间（日志） | 出发时间 | Departure Time |
| 探索精选 AI 模型，清晰比较价格与能力，为不同场景选择合适的模型。 | 认识噜噜岛上的 AI 伙伴，找到最适合你的那一个。 | Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario. |
| 请勿重复签到；每天仅一次 | 请勿重复领取泡澡奖励，每天仅一次 | Do not repeat check-in; only once per day |
| 画图工作台 | 涂鸦小屋 | Drawing Workbench |
| 启用签到功能 | 启用泡澡功能 | Enable check-in feature |
| 启用任务插件 | 启用噜噜工具箱 | Enable task plugins |
| 为此 API 密钥启用无限配额 | 为此通行徽章启用无限配额 | Enable unlimited quota for this API key |
| 输入此渠道的 API 密钥 | 输入此渠道的 通行徽章 | Enter API key for this channel |
| 输入 Creem API 密钥 | 输入 Creem 通行徽章 | Enter Creem API key |
| 每行输入一个 API 密钥进行批量创建 | 每行输入一个 通行徽章进行批量创建 | Enter one API key per line for batch creation |
| 管理员（导航分组） | 庄园管理 | Estate Management |
| 创建API密钥失败 | 创建通行徽章失败 | Failed to create API key |
| 删除API密钥失败 | 删除通行徽章失败 | Failed to delete API key |
| 删除API密钥失败 | 删除通行徽章失败 | Failed to delete API keys |
| 加载 API 密钥失败 | 加载 通行徽章失败 | Failed to load API keys |
| 搜索 API 密钥失败 | 搜索 通行徽章失败 | Failed to search API keys |
| 更新 API 密钥失败 | 更新 通行徽章失败 | Failed to update API key |
| 更新 API 密钥状态失败 | 更新 通行徽章状态失败 | Failed to update API key status |
| Tokens（日志列标题） | 投喂量 (Tokens) | Feeding Amount (Tokens) |
| 按 API 密钥筛选... | 按 通行徽章筛选... | Filter by API key... |
| 搜索（顶栏） | 找一找 | Find Something |
| 用户名（用户管理） | 豚友昵称 | Friend Nickname |
| 完整 API 密钥 | 完整 通行徽章 | Full API Key |
| 前往仪表板 | 进入噜噜小屋 | Go to Dashboard |
| 前往 io.net API 密钥 | 前往 io.net 通行徽章 | Go to io.net API Keys |
| 用户在创建 API 密钥时可以选择的分组。 | 用户在领取通行徽章时可以选择的分组。 | Groups that users can select when creating API keys. |
| 隐藏 API 密钥 | 隐藏 通行徽章 | Hide API key |
| 历史使用情况 | 累计投喂 | Historical Usage |
| 主页 | 噜噜岛 | Home |
| 如何获取 io.net API 密钥 | 如何获取 io.net 通行徽章 | How to get an io.net API Key |
| 余额不足 | 柚子不够啦 | Insufficient balance |
| 状态（用户管理） | 岛上状态 | Island Status |
| 分组 → 描述的 JSON 映射，在用户创建 API 密钥时公开。 | 分组 → 描述的 JSON 映射，在用户领取通行徽章时公开。 | JSON map of group → description exposed when users create API keys. |
| 分组（创建密钥） | 加入小队 | Join a Team |
| 耗时（日志） | 同行耗时 | Journey Duration |
| 状态（任务日志） | 旅途状态 | Journey Status |
| 近 24 小时消耗 | 今日投喂 | Last 24h usage |
| 正在加载对话... | 噜噜正在翻找冒险足迹… | Loading conversation... |
| 概览（页面标题） | 噜噜小屋 | Lulu Cottage |
| 概览（侧栏） | 今日噜噜 | Lulu Today |
| 新增说明文案 | 管理用于调用服务的 API 密钥。 | Manage API keys used to access the service. |
| 签到最大额度 | 泡澡最大额度 | Maximum check-in quota |
| 签到奖励的最大额度 | 泡澡奖励的最大额度 | Maximum quota amount awarded for check-in |
| 萌系直达。 | 欢迎来到噜噜岛。 | Meet the softer side. |
| 签到最小额度 | 泡澡最小额度 | Minimum check-in quota |
| 签到奖励的最小额度 | 泡澡奖励的最小额度 | Minimum quota amount awarded for check-in |
| 模型广场 | 伙伴乐园 | Model Square |
| 高级设置（密钥） | 更多设置 | More Settings |
| 更多模型 | 逛逛伙伴乐园 | More models |
| 个人（导航分组） | 我的 | My Island |
| 需要 API 密钥 | 需要通行徽章 | Needs API key |
| 未找到 API 密钥 | 还没有通行徽章 | No API Keys Found |
| 暂无 API 密钥 | 暂无 通行徽章 | No API key yet |
| 没有可用的 API 密钥。创建您的第一个 API 密钥即可开始使用。 | 领取一枚徽章，就可以带着 AI 伙伴一起出发啦。 | No API keys available. Create your first API key to get started. |
| 未找到日志 | 这里还没有足迹 | No Logs Found |
| 未找到模型 | 伙伴们还在赶来的路上 | No Models Found |
| 目前暂无公告 | 岛屿暂时没有新公告 | No announcements at this time |
| 没有可用的模型。创建您的第一个模型即可开始使用。 | 还没有可用的 AI 伙伴，添加第一位伙伴开始使用。 | No models available. Create your first model to get started. |
| 未找到模型 | 伙伴们还在赶来的路上 | No models found |
| 没有模型匹配您当前的筛选条件。 | 没有伙伴符合当前筛选条件。 | No models match your current filters. |
| 暂无系统公告 | 岛屿暂时没有新公告 | No system announcements |
| 未找到任务插件 | 工具箱暂时空空的 | No task plugins found |
| 暂无使用日志。发起 API 调用后日志将显示在此处。 | 还没有冒险足迹，调用 AI 伙伴后会在这里留下记录。 | No usage logs available. Logs will appear here once API calls are made. |
| 要创建的密钥数量 | 要领取的徽章数量 | Number of keys to create |
| 请在 Waffo 后台获取 API 密钥、商户 ID 以及 RSA 密钥对，并配置回调地址。 | 请在 Waffo 后台获取 通行徽章、商户 ID 以及 RSA 密钥对，并配置回调地址。 | Obtain the API key, merchant ID, and RSA key pair from the Waffo dashboard, and configure the callback URL. |
| 模型名称（模型管理） | 官方模型 | Official Model |
| 进行中（任务） | 冒险中 | On an Adventure |
| 一个入口， | 和噜噜一起， | One gateway, |
| 打开 io.net 控制台 API 密钥页面 | 打开 io.net 控制台 通行徽章页面 | Open the io.net console API Keys page |
| 订单历史 | 柚子补给记录 | Order History |
| 聊天（导航分组） | 玩耍 | Play Time |
| 游乐场 | 噜噜乐园 | Playground |
| 请先输入 API 密钥 | 请先输入 通行徽章 | Please enter API key first |
| 未开始 / 排队中（任务） | 准备出发 | Preparing to Depart |
| 个人资料 | 我的小屋 | Profile |
| 模型（渠道） | 提供伙伴 | Provided Companions |
| 兑换码 | 柚子兑换 | Redemption Codes |
| 兑换码 | 兑换凭证 | Redemption Voucher |
| 请求计数 | 噜噜出勤 | Request Count |
| 显示 API 密钥 | 显示 通行徽章 | Reveal API key |
| 奖励将直接添加到您的余额 | 奖励会直接放进你的柚子口袋 | Rewards will be added directly to your balance |
| 可用时长 | 可玩时长 | Runway |
| 保存签到设置 | 保存泡澡设置 | Save check-in settings |
| 搜索模型 | 找一找 | Search models |
| 选择模型 | 选择伙伴 | Select Model |
| API 密钥已发送至 FluentRead。 | 通行徽章已发送至 FluentRead。 | Sent the API key to FluentRead. |
| 设置令牌的访问限制 | 设置通行徽章的访问限制 | Set API key access restrictions |
| 设置令牌的基本信息 | 设置通行徽章的基本信息 | Set API key basic information |
| 开始一场游乐场对话 | 开始新的冒险 | Start a playground chat |
| Stripe API 密钥（除非更新，否则留空） | Stripe 通行徽章（除非更新，否则留空） | Stripe API key (leave blank unless updating) |
| 订阅 | 订阅计划 | Subscriptions |
| 成功创建了 {{count}} 个 API 密钥 | 成功领取了 {{count}} 枚通行徽章 | Successfully created {{count}} API Key(s) |
| 成功删除了 {{count}} 个 API 密钥 | 成功删除了 {{count}} 个 通行徽章 | Successfully deleted {{count}} API key(s) |
| 优先级（渠道） | 补给优先级 | Supply Priority |
| 名称（渠道） | 补给站名称 | Supply Station Name |
| 状态（渠道） | 补给状态 | Supply Status |
| 类型（渠道） | 补给类型 | Supply Type |
| 权重（渠道） | 补给权重 | Supply Weight |
| 系统信息 | 岛屿状态 | System Info |
| 系统设置 | 庄园设置 | System Settings |
| 系统版本 | 岛屿版本 | System Version |
| 任务日志 | 冒险记录 | Task Logs |
| 任务插件 | 噜噜工具箱 | Task Plugins |
| 发送 | 告诉噜噜 | Tell Lulu |
| 使用入门提示词测试模型，或在下方编写自己的请求。 | 和不同的 AI 伙伴一起聊天、创作和探索。 | Test a model with a starter prompt, or write your own request below. |
| 请求所使用的 API 密钥 | 请求所使用的 通行徽章 | The API key used for the requests |
| 本站当前已启用模型，总计 {{count}} 个 | 岛上当前共有 {{count}} 位 AI 伙伴 | This site currently has {{count}} models enabled |
| 这将永久删除 API 密钥 | 这将永久删除 通行徽章 | This will permanently delete API key |
| 充值 | 补充柚子 | Top-up |
| 充值金额 | 补给数量 | Topup Amount |
| 总用量 | 累计投喂 | Total Usage |
| 累计签到 | 泡澡天数 | Total check-ins |
| 模型（日志） | 同行伙伴 | Travel Companion |
| 无法准备聊天链接。请确保您有一个已启用的 API 密钥。 | 无法准备聊天链接。请确保您有一个已启用的 通行徽章。 | Unable to prepare chat link. Please ensure you have an enabled API key. |
| 无限配额 | 不限柚子 | Unlimited Yuzu |
| 更新 API 密钥 | 编辑通行徽章 | Update API Key |
| 上传任务插件以添加平台。 | 添加任务工具，为岛屿解锁更多能力。 | Upload a task plugin to add a platform. |
| 上传插件 | 添加工具 | Upload plugin |
| 运行时间 | 营业时间 | Uptime |
| 使用日志 | 足迹册 | Usage Logs |
| 用量概览 | 今日消耗 | Usage at a glance |
| 过期时间 | 有效期限 | Valid Until |
| 钱包 | 柚子口袋 | Wallet |
| 您即将删除 {{count}} 个 API 密钥。 | 您即将删除 {{count}} 个 通行徽章。 | You are about to delete {{count}} API key(s). |
| 每日仅可签到一次，请勿重复签到 | 每天只能泡澡领取一次奖励 | You can only check in once per day |
| 额度（兑换码） | 柚子数量 | Yuzu Amount |
| 额度设置 | 柚子额度 | Yuzu Quota |
| 额度（用户管理） | 柚子库存 | Yuzu Stock |
| 万种智能， | 探索 AI 的小岛 | a world of AI. |
| io.net API 密钥 | io.net 通行徽章 | io.net API Key |
| 在外部客户端中打开。从侧边栏或 API 密钥操作中触发，以启动配置的应用。 | 在外部客户端中打开。从侧边栏或 通行徽章操作中触发，以启动配置的应用。 | opens in an external client. Trigger it from the sidebar or API key actions to launch the configured application. |
| 噜噜云 | 噜噜岛 | preset.lulu |

## 旧名称检查与保留范围

- 顶部与侧栏入口已采用方案中的名称，页面标题同步处理；控制台概览入口显示“今日噜噜”，页面标题显示“噜噜小屋”。
- 源码中的旧英文翻译键保留，它们是稳定的 i18n 标识，并不等于仍显示旧中文名称。
- “管理员 / 超级管理员”等权限角色、“模型 / 分组 / Token”等技术说明继续保留；API 密钥说明保留于通行徽章页，官方模型名称及计费单位未改。
- 项目来源 New API / QuantumNous、许可说明、相关元数据和链接均保留；保留含上游项目名称的原说明。
- “系统信息”在庄园设置中的基础配置分区仍为技术配置名称，与“岛屿状态”运行状态页面区分。
- 画图工作台指向外部站点 https://draw.strova.top/，本仓库仅将其导航入口替换为“涂鸦小屋”；外部站点内部文案不在本次修改范围。
- 方案中模型昵称、随机加载提示、新套餐示例、额外功能及不存在的字段属于建议，本次没有新增这些功能或修改用户实际数据。

## 验证

- typecheck：通过。
- 受影响测试：4 个测试文件、7 个用例通过，包含密钥提交参数、导航路由、语言切换和站点名称。
- 改动文件 lint：0 error；兑换码表格存在 1 条原有 self-closing-comp warning。
- 28 个 TS/TSX 文件已用项目 oxfmt 配置格式化并保留版权头。
- 生产构建：通过。
- i18n:sync：通过；7 个语言文件的原条目、插值变量及受保护来源说明校验通过。
- Playwright：复用本地 5175 预览与隔离 API fixture，检查 18 个页面；其中首页、两个看板、密钥、订阅、钱包、资料、伙伴乐园另检查 1440px / 390px 两种宽度，未见横向溢出，最终检查未捕获页面异常或 console.error。
- 密钥创建抽屉可打开、关闭，手机按钮未截断；签到模块显示“今日泡澡”，金额继续显示真实 $ 单位。
- 预览中原有 favicon.ico 无法被浏览器解码，直接回放本地原文件后仍复现；本次未改动图标文件。截图会显示浏览器的图片加载失败占位。
- 浏览器验证使用本地模拟账户及数据；未执行生产登录、充值、创建真实密钥或后端业务验证。系统信息预览的实例接口无完整 fixture，存在无法加载状态，不作为后端运行状态验证。

## 预览截图

- [电脑端通行徽章](../output/playwright/lulu-naming-desktop.png)
- [手机端通行徽章](../output/playwright/lulu-naming-mobile.png)
- [手机端创建抽屉](../output/playwright/lulu-naming-mobile-drawer.png)
