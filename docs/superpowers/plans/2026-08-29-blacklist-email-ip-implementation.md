# 注册与访问黑名单功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在系统设置中维护邮箱/IP 黑名单，并拦截黑名单邮箱的认证请求及黑名单 IP 的全站访问。

**Architecture:** 复用 `Option` 表保存 `BlacklistEmails` 与 `BlacklistIPs` 两个换行文本配置项。`common` 持有线程安全的规范化集合，`model` 负责选项解析和并发安全的自动 IP 持久化，Gin 全局中间件负责全站 IP 拦截，认证控制器负责邮箱命中与自动封禁，React 基础认证表单负责配置编辑。

**Tech Stack:** Go 1.22、Gin、GORM v2、testify、React 19、TypeScript、React Hook Form、Zod、i18next、Bun。

## Global Constraints

- 邮箱按完整地址精确匹配，比较前去除首尾空格并转换为小写。
- IP 仅接受 `net.ParseIP` 可解析的 IPv4/IPv6 文本，不支持网段或通配符。
- 复用现有 `Option` 表和 `/api/option/`，不新增数据库迁移。
- 所有 JSON marshal/unmarshal 使用 `common.*` 包装函数。
- 保留现有登录/注册限流、Turnstile、邮箱验证及 OAuth 逻辑。
- 前端用户可见文字使用 i18next，英文 key 作为源 key，并同步 `en/zh/zh-TW/fr/ru/ja/vi` locale。

---

### Task 1: 黑名单规范化与内存集合

**Files:**
- Create: `common/blacklist.go`
- Test: `common/blacklist_test.go`

**Interfaces:**
- Produces `common.NormalizeBlacklistEmail(string) string`、`common.NormalizeBlacklistIP(string) (string, bool)`、`common.ParseBlacklistEmails(string) []string`、`common.ParseBlacklistIPs(string) ([]string, error)`、`common.IsBlacklistedEmail(string) bool`、`common.IsBlacklistedIP(string) bool`、`common.SetBlacklistEmails([]string)`、`common.SetBlacklistIPs([]string)`。

- [ ] **Step 1: Write failing tests** for lowercase/trim email matching, IPv4/IPv6 normalization, duplicate/empty line removal, invalid IP rejection, and read/write collection replacement.
- [ ] **Step 2: Run `go test ./common -run Blacklist -count=1`** and confirm failure because the functions do not exist.
- [ ] **Step 3: Implement `common/blacklist.go`** with package-level RWMutex, immutable replacement of maps under write lock, and parser helpers that never call `encoding/json`.
- [ ] **Step 4: Run the same test command** and confirm all blacklist tests pass.
- [ ] **Step 5: Commit** with `git add common/blacklist.go common/blacklist_test.go && git commit -m "feat: add blacklist normalization and state"`.

### Task 2: 系统选项加载与自动 IP 持久化

**Files:**
- Create: `model/blacklist.go`
- Test: `model/blacklist_test.go`
- Modify: `model/option.go` (default option registration and `updateOptionMap` dispatch)

**Interfaces:**
- Produces `model.AddBlacklistIP(string) error`, which normalizes, deduplicates, persists `BlacklistIPs`, and refreshes `common` state under a process mutex.

- [ ] **Step 1: Write failing model tests** covering option-map loading for both keys, invalid `BlacklistIPs` update rejection, and concurrent duplicate `AddBlacklistIP` calls preserving one entry.
- [ ] **Step 2: Run `go test ./model -run Blacklist -count=1`** and confirm failure on missing option integration/function.
- [ ] **Step 3: Add `BlacklistEmails` and `BlacklistIPs` defaults in `InitOptionMap`; route updates through parsers; implement `AddBlacklistIP` with a mutex, current option read, append, `UpdateOption`, and error logging. Ensure DB errors are returned while callers can still reject the request.
- [ ] **Step 4: Run the model blacklist tests** and confirm pass; run `go test ./model -run 'Option|Blacklist' -count=1` for adjacent option behavior.
- [ ] **Step 5: Commit** with `git add model/blacklist.go model/blacklist_test.go model/option.go && git commit -m "feat: persist blacklist options"`.

### Task 3: 全局 IP 黑名单中间件

**Files:**
- Create: `middleware/blacklist.go`
- Test: `middleware/blacklist_test.go`
- Modify: `main.go` (register middleware after request ID/version/i18n setup and before `router.SetRouter`)

**Interfaces:**
- Produces `middleware.BlacklistIP() gin.HandlerFunc`.

- [ ] **Step 1: Write failing middleware tests** with a Gin engine and test handler, asserting a blacklisted IP receives 403 and the handler is not called, while an unlisted IP passes through; cover `/api/...` JSON and web text responses.
- [ ] **Step 2: Run `go test ./middleware -run Blacklist -count=1`** and confirm failure because the middleware is absent.
- [ ] **Step 3: Implement middleware using `c.ClientIP()`, `common.IsBlacklistedIP`, `c.Abort`, and status-specific JSON/text responses. Register it on the root engine before route groups are mounted.
- [ ] **Step 4: Run middleware tests and `go test ./router ./middleware -run 'Blacklist|TrustedProxy' -count=1`**.
- [ ] **Step 5: Commit** with `git add middleware/blacklist.go middleware/blacklist_test.go main.go && git commit -m "feat: block blacklisted IPs globally"`.

### Task 4: 密码与 OAuth 认证拦截

**Files:**
- Modify: `controller/user.go` (`Register`, `Login`)
- Modify: `controller/oauth.go` (`findOrCreateOAuthUser`, error mapping)
- Modify: `i18n/keys.go`, `i18n/locales/en.yaml`, `i18n/locales/zh.yaml`
- Test: `controller/blacklist_auth_test.go`

**Interfaces:**
- Consumes `common.IsBlacklistedEmail` and `model.AddBlacklistIP`.
- Produces the i18n key `user.blacklisted` with message “你已被拉黑” in Chinese and equivalent English text.

- [ ] **Step 1: Write failing controller tests** for password registration with blacklisted email, password login by email and by username whose account email is blacklisted, and OAuth existing-user/new-user paths; assert the response message, no user creation/login, and IP append call behavior through the real model/common state.
- [ ] **Step 2: Run `go test ./controller -run Blacklist -count=1`** and confirm failure because no blacklist checks/message exist.
- [ ] **Step 3: Add a small controller-local rejection path that calls `model.AddBlacklistIP(c.ClientIP())` before returning `common.ApiErrorI18n(c, i18n.MsgUserBlacklisted)`. In `Login`, resolve an email candidate from direct email input or a username lookup before password validation, without changing ordinary invalid-credential responses. In OAuth, add a dedicated error type and map it in the existing handler.
- [ ] **Step 4: Run targeted controller tests plus existing auth tests: `go test ./controller -run '(Blacklist|Auth|OAuth)' -count=1`**.
- [ ] **Step 5: Commit** with `git add controller/user.go controller/oauth.go controller/blacklist_auth_test.go i18n/keys.go i18n/locales/en.yaml i18n/locales/zh.yaml && git commit -m "feat: reject blacklisted authentication attempts"`.

### Task 5: 系统设置页面与多语言

**Files:**
- Modify: `web/src/features/system-settings/types.ts` (`AuthSettings`)
- Modify: `web/src/features/system-settings/auth/index.tsx` (defaults)
- Modify: `web/src/features/system-settings/auth/section-registry.tsx` (pass values)
- Modify: `web/src/features/system-settings/auth/basic-auth-section.tsx` (schema, fields, submit normalization)
- Modify: `web/src/i18n/locales/{en,zh,zh-TW,fr,ru,ja,vi}.json`
- Test: `web/src/features/system-settings/auth/__tests__/basic-auth-blacklist.test.tsx`

**Interfaces:**
- Consumes existing `useSystemOptions`, `useUpdateOption`, and `SettingsPage` option parsing.
- Produces editable `BlacklistEmails` and `BlacklistIPs` fields submitted as newline-separated, trimmed, deduplicated strings.

- [ ] **Step 1: Write failing component tests** asserting defaults render both textareas, line normalization removes blanks/duplicates, and changed values submit the two exact option keys.
- [ ] **Step 2: Run `bun test web/src/features/system-settings/auth/__tests__/basic-auth-blacklist.test.tsx`** from `web/` and confirm failure on missing fields.
- [ ] **Step 3: Extend `AuthSettings`/defaults/registry props, add Zod string fields and two labeled textareas with descriptions, and normalize each list to trimmed unique lines before calling `updateOption.mutateAsync`.
- [ ] **Step 4: Add all locale translations for labels, descriptions, and the “You are blacklisted” message; run the component test and `bun run i18n:sync` if required by the repository scripts.
- [ ] **Step 5: Run `bun run typecheck` and `bun run build` from `web/`.
- [ ] **Step 6: Commit** with `git add web/src/features/system-settings web/src/i18n/locales && git commit -m "feat: add blacklist settings controls"`.

### Task 6: 集成验证与回归检查

**Files:**
- No source changes expected; inspect all task diffs and generated artifacts.

- [ ] **Step 1: Run `git diff --check` and `git status --short`; verify unrelated worktree changes are untouched and protected project identifiers remain unchanged.**
- [ ] **Step 2: Run targeted backend suites: `go test ./common ./model ./middleware ./controller -count=1`.**
- [ ] **Step 3: Run frontend checks: `cd web; bun run typecheck; bun run build`.**
- [ ] **Step 4: If all checks pass, review the final diff for route ordering, error semantics, option key names, and all seven locale files; record any unrun checks explicitly.**
- [ ] **Step 5: Commit any verification-only fixes separately with a focused message.**
