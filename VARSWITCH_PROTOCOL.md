# VarSwitch 自定义协议接入说明

当前网页端采用“兼容 CC Switch v1 Provider 导入格式，仅修改协议名称”的方案：

```text
CC Switch:
ccswitch://v1/import?...参数...

VarSwitch:
varswitch://v1/import?...相同参数...
```

VarSwitch 需要完成两部分：

1. 向操作系统注册 `varswitch://` 自定义协议。
2. 收到 URL 后，解析 `/v1/import` 和查询参数，创建 Provider 配置。

## 1. 完整协议格式

基本结构：

```text
varswitch://v1/import?resource=provider&app=claude&name=My+Claude&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-xxx&model=claude-sonnet-4&homepage=https%3A%2F%2Fapi.example.com&enabled=true
```

使用标准 URL 解析器解析后：

```text
协议 scheme: varswitch
主机 hostname: v1
路径 pathname: /import
```

不要把它解析成 `/v1/import` 路径。标准 URL 解析器得到的是：

```ts
const url = new URL(rawUrl);

url.protocol; // "varswitch:"
url.hostname; // "v1"
url.pathname; // "/import"
```

## 2. 参数兼容格式

目前网页发送的参数如下：

| 参数          | 是否必填 | 说明                                  |
| ------------- | -------: | ------------------------------------- |
| `resource`    |       是 | 固定为 `provider`                     |
| `app`         |       是 | `claude`、`codex`、`gemini` 或 `grok` |
| `name`        |       是 | 用户给这个 Provider 填写的名称        |
| `endpoint`    |       是 | API 服务地址                          |
| `apiKey`      |       是 | 完整 API 密钥，一般以 `sk-` 开头      |
| `model`       |       是 | 主模型                                |
| `haikuModel`  |       否 | Claude Haiku 模型                     |
| `sonnetModel` |       否 | Claude Sonnet 模型                    |
| `opusModel`   |       否 | Claude Opus 模型                      |
| `homepage`    |       是 | 服务主页，目前等于服务器基础地址      |
| `enabled`     |       是 | 字符串 `"true"`                       |

### 2.1 Claude

```text
app=claude
endpoint=https://api.example.com
model=claude-sonnet-4
haikuModel=claude-haiku-4
sonnetModel=claude-sonnet-4
opusModel=claude-opus-4
```

其中 `model` 必填，其他三个模型字段可选。

### 2.2 Codex

```text
app=codex
endpoint=https://api.example.com/v1
model=gpt-5-codex
```

Codex 的 `endpoint` 会自动添加 `/v1`。

### 2.3 Gemini

```text
app=gemini
endpoint=https://api.example.com
model=gemini-2.5-pro
```

Gemini 只有 `model` 必填。

### 2.4 Grok

```text
app=grok
endpoint=https://api.example.com
model=grok-4
```

Grok 只有 `model` 必填。当前 VarSwitch 导入对话框支持 Claude、Codex、Gemini 和 Grok；CC Switch 导入对话框继续保持 Claude、Codex 和 Gemini 三项。

网页端协议生成逻辑位于：

```text
web/src/features/keys/lib/switch-import.ts
```

## 3. VarSwitch 内部数据映射

VarSwitch 收到协议后，可以转换成类似下面的数据结构：

```ts
type ImportedProvider = {
  type: "claude" | "codex" | "gemini" | "grok";
  name: string;
  endpoint: string;
  apiKey: string;
  enabled: boolean;
  homepage?: string;
  models: {
    primary: string;
    haiku?: string;
    sonnet?: string;
    opus?: string;
  };
};
```

推荐的解析代码：

```ts
function parseVarSwitchImport(rawUrl: string): ImportedProvider {
  const url = new URL(rawUrl);

  if (url.protocol !== "varswitch:") {
    throw new Error("Unsupported protocol");
  }

  if (url.hostname !== "v1" || url.pathname !== "/import") {
    throw new Error("Unsupported VarSwitch import version or action");
  }

  const resource = url.searchParams.get("resource");
  if (resource !== "provider") {
    throw new Error("Unsupported import resource");
  }

  const app = url.searchParams.get("app");
  if (app !== "claude" && app !== "codex" && app !== "gemini" && app !== "grok") {
    throw new Error("Unsupported application type");
  }

  const name = url.searchParams.get("name")?.trim();
  const endpoint = url.searchParams.get("endpoint")?.trim();
  const apiKey = url.searchParams.get("apiKey")?.trim();
  const model = url.searchParams.get("model")?.trim();

  if (!name) {
    throw new Error("Provider name is required");
  }

  if (!endpoint) {
    throw new Error("Provider endpoint is required");
  }

  if (!apiKey) {
    throw new Error("API key is required");
  }

  if (!model) {
    throw new Error("Primary model is required");
  }

  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== "https:" && endpointUrl.protocol !== "http:") {
    throw new Error("Provider endpoint must use HTTP or HTTPS");
  }

  return {
    type: app,
    name,
    endpoint: endpointUrl.toString(),
    apiKey,
    enabled: url.searchParams.get("enabled") === "true",
    homepage: url.searchParams.get("homepage") ?? undefined,
    models: {
      primary: model,
      haiku: url.searchParams.get("haikuModel") || undefined,
      sonnet: url.searchParams.get("sonnetModel") || undefined,
      opus: url.searchParams.get("opusModel") || undefined,
    },
  };
}
```

`URL` 和 `URLSearchParams` 会自动处理：

- `%3A` → `:`
- `%2F` → `/`
- `+` → 空格
- 中文名称
- 特殊字符

不要再手动执行第二次 `decodeURIComponent()`，否则包含 `%` 的数据可能被错误解码。

## 4. 推荐导入流程

VarSwitch 收到 URL 后，不建议直接静默保存。推荐流程如下：

```text
网站打开 varswitch:// URL
        ↓
操作系统启动或唤醒 VarSwitch
        ↓
VarSwitch 接收完整 URL
        ↓
验证协议版本、resource、app、endpoint
        ↓
显示“确认导入 Provider”窗口
        ↓
用户检查名称、地址、模型
        ↓
用户点击确认
        ↓
API Key 保存到系统安全存储
        ↓
显示导入成功
```

确认窗口建议做到：

- API Key 只显示类似 `sk-****abcd` 的脱敏内容。
- 显示 Provider 名称。
- 显示 API Endpoint。
- 显示主模型和可选模型。
- 如果同名 Provider 已存在，让用户选择覆盖、重命名或取消。
- 不要自动覆盖已有配置。

## 5. Windows 注册方式

Windows 自定义协议一般注册在注册表中。推荐使用当前用户级注册，不需要管理员权限：

```text
HKEY_CURRENT_USER\Software\Classes\varswitch
```

注册表结构：

```text
HKEY_CURRENT_USER
└── Software
    └── Classes
        └── varswitch
            ├── (Default) = "URL:VarSwitch Protocol"
            ├── "URL Protocol" = ""
            └── shell
                └── open
                    └── command
                        └── (Default) = "\"C:\Program Files\VarSwitch\VarSwitch.exe\" \"%1\""
```

`.reg` 示例：

```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\varswitch]
@="URL:VarSwitch Protocol"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\varswitch\DefaultIcon]
@="\"C:\\Program Files\\VarSwitch\\VarSwitch.exe\",0"

[HKEY_CURRENT_USER\Software\Classes\varswitch\shell]

[HKEY_CURRENT_USER\Software\Classes\varswitch\shell\open]

[HKEY_CURRENT_USER\Software\Classes\varswitch\shell\open\command]
@="\"C:\\Program Files\\VarSwitch\\VarSwitch.exe\" \"%1\""
```

其中 `%1` 是完整协议 URL：

```text
varswitch://v1/import?resource=provider&...
```

程序启动后，从命令行参数中读取它：

```ts
const protocolUrl = process.argv.find((argument) => argument.startsWith("varswitch://"));

if (protocolUrl) {
  handleVarSwitchUrl(protocolUrl);
}
```

命令中的 `"%1"` 必须包含双引号，否则 URL 中出现特殊字符时可能被错误拆分。

## 6. macOS 注册方式

macOS 应用需要在 `Info.plist` 中注册 URL Scheme：

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.yourcompany.varswitch</string>

    <key>CFBundleURLSchemes</key>
    <array>
      <string>varswitch</string>
    </array>

    <key>CFBundleTypeRole</key>
    <string>Editor</string>
  </dict>
</array>
```

原生 Swift 应用可以在 AppDelegate 中接收：

```swift
func application(
    _ application: NSApplication,
    open urls: [URL]
) {
    for url in urls {
        guard url.scheme == "varswitch" else {
            continue
        }

        handleVarSwitchImport(url)
    }
}
```

如果应用未启动，macOS 会先启动应用，再把 URL 交给应用。如果应用已经启动，系统会直接触发 URL 打开事件。

## 7. Linux 注册方式

创建 Desktop Entry：

```ini
[Desktop Entry]
Name=VarSwitch
Comment=VarSwitch Provider Manager
Exec=/opt/varswitch/varswitch %u
Icon=varswitch
Terminal=false
Type=Application
Categories=Development;
MimeType=x-scheme-handler/varswitch;
```

保存为：

```text
~/.local/share/applications/varswitch.desktop
```

设置默认处理程序：

```bash
xdg-mime default varswitch.desktop x-scheme-handler/varswitch
```

更新应用数据库：

```bash
update-desktop-database ~/.local/share/applications
```

应用通过命令行参数接收 URL：

```ts
const protocolUrl = process.argv.find((argument) => argument.startsWith("varswitch://"));
```

## 8. Electron 注册和接收示例

如果 VarSwitch 是 Electron 应用，可以参考这一节。

### 8.1 注册协议

```ts
import { app } from "electron";
import path from "node:path";

function registerVarSwitchProtocol(): void {
  if (process.defaultApp) {
    const entryFile = process.argv[1];

    if (entryFile) {
      app.setAsDefaultProtocolClient("varswitch", process.execPath, [path.resolve(entryFile)]);
    }

    return;
  }

  app.setAsDefaultProtocolClient("varswitch");
}
```

应在应用准备阶段调用：

```ts
registerVarSwitchProtocol();
```

开发环境需要额外传入入口脚本；打包环境只需要：

```ts
app.setAsDefaultProtocolClient("varswitch");
```

### 8.2 确保只有一个实例

```ts
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}
```

### 8.3 Windows/Linux：应用已经运行

```ts
app.on("second-instance", (_event, argv) => {
  const protocolUrl = argv.find((argument) => argument.startsWith("varswitch://"));

  if (!protocolUrl) {
    return;
  }

  showMainWindow();
  handleVarSwitchUrl(protocolUrl);
});
```

### 8.4 Windows/Linux：冷启动

```ts
app.whenReady().then(() => {
  const protocolUrl = process.argv.find((argument) => argument.startsWith("varswitch://"));

  if (protocolUrl) {
    handleVarSwitchUrl(protocolUrl);
  }

  createMainWindow();
});
```

### 8.5 macOS

`open-url` 事件可能在 `ready` 之前到达，因此需要先暂存：

```ts
let pendingProtocolUrl: string | null = null;

app.on("open-url", (event, url) => {
  event.preventDefault();

  if (!app.isReady()) {
    pendingProtocolUrl = url;
    return;
  }

  showMainWindow();
  handleVarSwitchUrl(url);
});

app.whenReady().then(() => {
  createMainWindow();

  if (pendingProtocolUrl) {
    handleVarSwitchUrl(pendingProtocolUrl);
    pendingProtocolUrl = null;
  }
});
```

### 8.6 主进程解析后发送给界面

```ts
function handleVarSwitchUrl(rawUrl: string): void {
  try {
    const provider = parseVarSwitchImport(rawUrl);

    mainWindow?.show();
    mainWindow?.focus();

    mainWindow?.webContents.send("provider-import-requested", {
      ...provider,
      apiKeyMasked: maskApiKey(provider.apiKey),
    });

    pendingImportedProvider = provider;
  } catch {
    console.error("Invalid VarSwitch import URL");
  }
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "********";
  }

  return `${apiKey.slice(0, 3)}****${apiKey.slice(-4)}`;
}
```

不要将包含真实 API Key 的完整 URL 输出到日志。

## 9. 浏览器如何触发协议

网页端执行：

```ts
window.open(varSwitchUrl, "_blank");
```

例如：

```ts
window.open("varswitch://v1/import?resource=provider&app=claude&...", "_blank");
```

浏览器通常会提示：

```text
是否允许此网站打开 VarSwitch？
```

用户允许后，操作系统查找 `varswitch` 协议处理程序并启动 VarSwitch。

如果协议没有注册，浏览器可能：

- 什么也不做。
- 显示“找不到处理此协议的应用”。
- 显示外部协议错误。

网页无法可靠判断 VarSwitch 是否成功启动，这是自定义协议本身的限制。

## 10. 手动测试协议注册

测试时先使用假的 `sk-test` 密钥。

### 10.1 Windows PowerShell

```powershell
Start-Process 'varswitch://v1/import?resource=provider&app=claude&name=Test&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-test&model=claude-sonnet-4&homepage=https%3A%2F%2Fapi.example.com&enabled=true'
```

### 10.2 macOS

```bash
open 'varswitch://v1/import?resource=provider&app=claude&name=Test&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-test&model=claude-sonnet-4&homepage=https%3A%2F%2Fapi.example.com&enabled=true'
```

### 10.3 Linux

```bash
xdg-open 'varswitch://v1/import?resource=provider&app=claude&name=Test&endpoint=https%3A%2F%2Fapi.example.com&apiKey=sk-test&model=claude-sonnet-4&homepage=https%3A%2F%2Fapi.example.com&enabled=true'
```

测试时确认：

1. VarSwitch 能启动。
2. VarSwitch 已启动时不会再打开第二个实例。
3. 能正确解析 `hostname=v1` 和 `pathname=/import`。
4. 中文名称不会乱码。
5. Endpoint 能正确还原。
6. 导入确认窗口能正常显示。
7. 取消时不保存任何配置。
8. 确认后 Provider 能正常使用。

## 11. 安全注意事项

当前格式与 CC Switch 一样，会直接把 API Key 放到 URL 查询参数中：

```text
apiKey=sk-xxx
```

因此需要注意：

- 不要记录完整启动参数。
- 不要把完整 URL 写入日志、崩溃报告或分析系统。
- 确认窗口必须隐藏大部分密钥。
- 保存后应立即清除内存中的原始协议 URL。
- API Key 最好保存到 Windows Credential Manager、macOS Keychain 或 Linux Secret Service。
- 不要将 API Key 明文写入普通配置文件。
- 任意网站都可以尝试打开 `varswitch://`，所以必须显示确认窗口。
- 必须校验 `resource`、`app`、`endpoint` 和协议版本。
- 不要因为收到协议 URL 就自动覆盖同名 Provider。
- 对未知参数建议忽略，以便以后向前兼容。
- 对未知 `app`、未知版本和未知 `resource` 必须拒绝。

更高安全级别的方案是传递一次性导入码，而不是直接传递 API Key，但这需要额外增加后端接口。当前实现为了兼容 CC Switch，使用的是直接传递 API Key 的方式。

## 12. 协议合同总结

VarSwitch 当前需要实现的协议合同是：

```text
Scheme: varswitch
Version: v1
Action: import
Resource: provider
Format: 与 CC Switch v1 Provider Import 查询参数兼容
```

核心判断条件：

```ts
url.protocol === "varswitch:";
url.hostname === "v1";
url.pathname === "/import";
url.searchParams.get("resource") === "provider";
```

满足这些条件后，再按照本文中的参数表创建 Provider 即可。
