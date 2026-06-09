# Boss MCP Assistant

**推荐/聊天/招聘一键自动化筛选工具** — 自动在 BOSS 直聘上帮你筛选候选人、发送消息、批量处理招聘流程。

> 你只需要：打开 Chrome 浏览器 → 打开 BOSS 直聘 → 在聊天框里说"帮我筛选推荐页的人" → 它自动完成剩下的工作。

---

## 一分钟快速上手

保证能跑通的最短步骤，先试起来，再慢慢看详细说明。

### 第 1 步：安装 Node.js（只需做一次）

如果你电脑上已经有 Node.js，跳过这一步。

**Windows 用户**：
1. 打开 https://nodejs.org
2. 下载左边绿色的 **LTS** 版本（推荐）
3. 双击安装包，一路点"下一步"直到完成
4. 安装完成后，打开"命令提示符"（按 `Win + R`，输入 `cmd`，回车）

**Mac 用户**：
1. 打开 https://nodejs.org
2. 下载左边绿色的 **LTS** 版本（推荐）
3. 双击安装包，一路点"继续"直到完成
4. 安装完成后，打开"终端"（按 `Cmd + 空格`，搜索"终端"）

### 第 2 步：复制粘贴以下命令（一次性安装）

打开命令提示符（Windows）或终端（Mac），复制粘贴以下命令，按回车：

```bash
npm install -g boss-mcp-assistant
```

看到一堆文字滚动，最后出现 ✅ 或版本号就表示安装成功。

### 第 3 步：配置你的 AI 密钥（必须）

这个工具需要接入 AI 来帮你筛选候选人。你需要一个 API Key（可以理解成 AI 的"密码"）。

**拿到 API Key 后**，复制粘贴以下命令（把里面的内容换成你自己的）：

```bash
boss-mcp-assistant config set --base-url https://api.openai.com/v1 --api-key 你的API密钥 --model gpt-4o
```

> ⚠️ 请把 `你的API密钥` 替换成真实的密钥，例如 `sk-xxxxxxxxxxxxxxxxxxxx`

### 第 4 步：启动 Chrome 调试模式

运行以下命令，工具会自动找到 Chrome 并以调试模式启动：

```bash
boss-mcp-assistant launch-chrome --port 9222
```

Chrome 会打开 BOSS 直聘推荐页，**登录 BOSS 直聘**（重要！）。

> ❓ 如果提示 `Chrome executable not found`，说明没有自动找到 Chrome 安装路径，可以手动指定：
> ```bash
> BOSS_RECOMMEND_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" boss-mcp-assistant launch-chrome --port 9222
> ```
> Windows 则用：
> ```bash
> set BOSS_RECOMMEND_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe" && boss-mcp-assistant launch-chrome --port 9222
> ```

### 第 5 步：启动服务

复制粘贴以下命令：

```bash
boss-mcp-assistant start
```

看到 `MCP server running` 就成功了。保持这个窗口开着，不要关闭。

### 第 6 步：在 AI 编辑器里使用

在 Cursor / Trae / Claude Code 等 AI 编辑器里，直接告诉 AI：

> "帮我运行 BOSS 直聘推荐页的自动化筛选，职位是后端开发，筛选 20 个候选人"

AI 会自动调用工具完成剩下的工作。

---

## 口令模板大全（复制即用）

以下所有命令，直接复制粘贴到终端即可。

### 安装与更新

```bash
# 首次安装
npm install -g boss-mcp-assistant

# 查看当前版本
boss-mcp-assistant --version

# 升级到最新版
npm update -g boss-mcp-assistant

# 完全卸载（同时删除所有配置）
npm uninstall -g boss-mcp-assistant && rm -rf ~/.boss-mcp-assistant
```

### 配置 API（选一个就行）

**OpenAI（海外用户推荐）**：
```bash
boss-mcp-assistant config set --base-url https://api.openai.com/v1 --api-key sk-你的密钥 --model gpt-4o
```

**DeepSeek（国内用户推荐）**：
```bash
boss-mcp-assistant config set --base-url https://api.deepseek.com --api-key 你的密钥 --model deepseek-chat
```

**通义千问（阿里云）**：
```bash
boss-mcp-assistant config set --base-url https://dashscope.aliyuncs.com/compatible-mode/v1 --api-key 你的密钥 --model qwen-plus
```

**硅基流动**：
```bash
boss-mcp-assistant config set --base-url https://api.siliconflow.cn/v1 --api-key 你的密钥 --model Qwen/Qwen2-7B-Instruct
```

**自定义模型（任何兼容 OpenAI 格式的 API）**：
```bash
boss-mcp-assistant config set --base-url 你的API地址 --api-key 你的密钥 --model 模型名称
```

### 启动 Chrome 调试模式（每次使用前都要做）

```bash
# ✅ 推荐：一行命令自动启动（工具会自动找到 Chrome）
boss-mcp-assistant launch-chrome --port 9222
```

如果自动查找失败，再试手动方式：

**Windows**：
```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**Mac**：
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

> ⚠️ 如果 Chrome 安装路径不同，请在文件管理器里找到 `chrome.exe`（Windows）或 `Google Chrome`（Mac），右键 → 属性，复制完整路径替换上面的路径。

### 启动服务

```bash
boss-mcp-assistant start
```

### 检查环境

```bash
# 全面检查（推荐第一次用之前运行）
boss-mcp-assistant doctor

# 查看安装位置和配置路径
boss-mcp-assistant where

# 创建配置模板（如果配置丢了）
boss-mcp-assistant init-config
```

---

## 详细安装指南（有图有步骤）

### 什么是 Node.js？为什么要装它？

Node.js 是这个工具的运行环境。就像看电影需要播放器一样，运行这个工具需要 Node.js。

**怎么检查有没有装 Node.js？**
在终端里复制粘贴这个命令：
```bash
node --version
```
如果显示 `v18.x.x` 或更高的版本号（比如 `v20.x.x`、`v22.x.x`），说明已经有了，跳过安装步骤。

如果显示 `'node' 不是内部或外部命令` 或 `command not found`，说明没有装，按下面步骤安装。

**安装 Node.js（Windows）**：
1. 打开浏览器，访问 https://nodejs.org
2. 页面左边显示的是 **LTS（长期支持版）**，点击下载
3. 下载完成后，双击安装包（`node-vxx.x.x-x64.msi`）
4. 安装向导里全部选默认选项，一路点"Next"（下一步）
5. 最后点"Install"（安装），等待完成
6. 安装完成后点"Finish"（完成）
7. 按 `Win + R`，输入 `cmd`，回车
8. 输入 `node --version`，确认显示版本号

**安装 Node.js（Mac）**：
1. 打开浏览器，访问 https://nodejs.org
2. 页面左边显示的是 **LTS（长期支持版）**，点击下载
3. 下载完成后，双击安装包（`node-vxx.x.x.pkg`）
4. 安装向导里全部选默认选项，一路点"继续"
5. 输入你的 Mac 密码
6. 安装完成后，打开"终端"（按 `Cmd + 空格`，搜索"终端"）
7. 输入 `node --version`，确认显示版本号

### 什么是 npm？为什么要装 npm？

npm 是 Node.js 自带的"软件商店"。安装 Node.js 时 npm 会自动装好。

检查 npm 是否正常：
```bash
npm --version
```
显示版本号（比如 `10.x.x`）就是正常的。

如果显示 `'npm' 不是内部或外部命令`，说明 Node.js 没有安装成功，重新安装 Node.js。

### 什么是 API Key？从哪里获得？

API Key 是 AI 服务的"密码"。这个工具使用 AI 来分析候选人简历，所以需要一个 API Key。

**方式一：使用 DeepSeek（国内用户，便宜）**
1. 打开 https://platform.deepseek.com
2. 注册账号 → 登录
3. 点左边的"API Keys"
4. 点"创建 API Key"，复制并保存好

**方式二：使用通义千问（阿里云，国内用户）**
1. 打开 https://dashscope.console.aliyun.com
2. 用阿里云账号登录
3. 点"API-KEY 管理"
4. 创建新的 API Key

**方式三：使用 OpenAI（海外用户，功能最强）**
1. 打开 https://platform.openai.com
2. 注册账号 → 登录
3. 点右上角头像 → "API keys"
4. 点"Create new secret key"，复制并保存好

### 什么是 Chrome 远程调试模式？

这个工具需要通过 Chrome 浏览器来控制 BOSS 直聘网页。远程调试模式就是让 Chrome 打开一个"控制端口"，让工具可以操作浏览器。

**每次使用前都要打开这个模式**。

最简单的方法是用工具自动启动：

```bash
boss-mcp-assistant launch-chrome --port 9222
```

工具会自动找到 Chrome 安装路径、以调试模式启动、并打开 BOSS 直聘推荐页。

如果自动启动失败（提示 `Chrome executable not found`），可以手动指定 Chrome 路径：

**Mac**：
```bash
BOSS_RECOMMEND_CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" boss-mcp-assistant launch-chrome --port 9222
```

**Windows（命令提示符 cmd）**：
```cmd
set BOSS_RECOMMEND_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
boss-mcp-assistant launch-chrome --port 9222
```

**Windows（PowerShell）**：
```powershell
$env:BOSS_RECOMMEND_CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
boss-mcp-assistant launch-chrome --port 9222
```

> 💡 Chrome 路径确认方法：在文件管理器找到 `chrome.exe`（Windows）或 `Google Chrome`（Mac），右键 → 属性 → 复制完整路径。

**检验是否开启成功**：
在浏览器地址栏输入 `http://localhost:9222/json/version`
- 如果显示一段 JSON 数据（一堆花括号和文字），说明开启成功
- 如果打不开或显示"无法访问"，说明没有开启成功

### 第一次启动完整流程

按顺序执行以下命令：

```bash
# 1. 安装工具（只需做一次）
npm install -g boss-mcp-assistant

# 2. 配置 API（只需做一次）
boss-mcp-assistant config set --base-url https://api.deepseek.com --api-key sk-你的密钥 --model deepseek-chat

# 3. 打开 Chrome 调试模式（每次都要做）
boss-mcp-assistant launch-chrome --port 9222

# 4. 在打开的 Chrome 里登录 BOSS 直聘

# 5. 启动服务
boss-mcp-assistant start
```

---

## 如何更新 API / URL / Model

### 方法一：命令行直接改（推荐）

```bash
# 只修改 API Key
boss-mcp-assistant config set --api-key 你的新密钥

# 同时修改 baseUrl 和 model
boss-mcp-assistant config set --base-url https://api.deepseek.com --model deepseek-chat

# 查看当前的配置
boss-mcp-assistant doctor
```

### 方法二：在 AI 编辑器里面改

在 Cursor/Trae/Claude Code 里，告诉 AI：

> "帮我更新筛选配置，baseUrl 改成 xxx，apiKey 改成 xxx，model 改成 xxx"

AI 会自动调用 `set_screening_config` 工具帮你更新，**不需要重启服务**。

### 方法三：手动改配置文件

用记事本/文本编辑打开这个文件：

**Windows**：
```
C:\Users\你的用户名\.boss-mcp-assistant\screening-config.json
```

**Mac**：
```
~/.boss-mcp-assistant/screening-config.json
```

找到这三行，改成你的值：
```json
{
  "baseUrl": "https://api.deepseek.com",
  "apiKey": "sk-你的密钥",
  "model": "deepseek-chat"
}
```

保存文件后，**重新启动服务**（关掉当前窗口，重新运行 `boss-mcp-assistant start`）。

---

## 常见问题

### 安装时报错

| 错误提示 | 原因 | 怎么办 |
|----------|------|--------|
| `'npm' 不是内部或外部命令` | 没有安装 Node.js | 按上面的步骤安装 Node.js |
| `permission denied` / `EACCES` | Mac 上没有权限 | 命令前面加 `sudo`，即 `sudo npm install -g boss-mcp-assistant` |
| `ENEEDAUTH` / `need auth` | npm 镜像源有问题 | 运行 `npm config set registry https://registry.npmjs.org` 后再试 |

### 运行时报错

| 错误现象 | 原因 | 解决办法 |
|----------|------|----------|
| `screening-config.json 缺失` | 忘记配置 API | 运行 `boss-mcp-assistant config set ...` 配置 API |
| `apiKey 仍是模板占位符` | API Key 还是模板值没改 | 重新配置：`boss-mcp-assistant config set --api-key 真实的密钥` |
| `connect ECONNREFUSED 127.0.0.1:9222` | Chrome 没有开启调试端口 | 运行 `boss-mcp-assistant launch-chrome --port 9222` 重新启动 |
| 工具返回超时/没反应 | Chrome 没登录 BOSS 直聘 | 确认 Chrome 里打开了 BOSS 直聘并且已登录 |
| `MODULE_NOT_FOUND` | 安装不完整 | 重新安装：`npm install -g boss-mcp-assistant` |
| `Chrome executable not found` | 工具没找到 Chrome 安装路径 | 设置环境变量 `BOSS_RECOMMEND_CHROME_PATH` 指定 Chrome 路径 |

### 配置相关问题

| 问题 | 答案 |
|------|------|
| 配置保存在哪里？ | `~/.boss-mcp-assistant/screening-config.json`（`~` 表示用户目录） |
| 换了一个 API 需要重启吗？ | 如果用 `boss-mcp-assistant config set` 命令或 MCP 工具更新的，**不需要重启**；手动编辑文件的需要重启 |
| 可以同时配置多个 API 吗？ | 只能配置一个，切换时需要重新运行 `config set` |
| 配置丢了怎么办？ | 运行 `boss-mcp-assistant init-config` 重新创建模板 |

### Chrome 问题

| 问题 | 答案 |
|------|------|
| 必须用 Chrome 吗？ | 也可以用 Edge、Chromium 等基于 Chromium 的浏览器，但需要找到对应的路径 |
| 每次都用 `launch-chrome` 吗？ | 是的，运行 `boss-mcp-assistant launch-chrome --port 9222` 即可。如果 Chrome 已经在调试模式运行，它会自动复用 |
| 可以用已经打开的 Chrome 吗？ | 不可以，必须用 `launch-chrome` 或以 `--remote-debugging-port=9222` 参数启动 Chrome |
| 可以用已经打开的 Chrome 吗？ | 不可以，必须关闭所有 Chrome 窗口后重新以调试模式打开 |
| 打开的 Chrome 和平时用的不一样？ | 正常，调试模式会启动一个新的 Chrome 实例，你的书签和插件可能不在里面，登录 BOSS 直聘即可 |

---

## 功能一览

### 三大核心功能

| 功能 | 用来做什么 | 举个栗子 |
|------|-----------|----------|
| **推荐页筛选** | 自动扫描推荐页的候选人，按你的要求筛选 | "帮我筛选推荐页上学历本科以上、3年+ Go 经验的候选人" |
| **聊天自动沟通** | 自动和候选人聊天、发消息、收简历 | "帮我给所有匹配的候选人打个招呼，问问有没有兴趣" |
| **招聘渠道批量处理** | 在招聘搜索页批量处理和筛选 | "帮我在招聘页上搜索前端开发，筛选出符合条件的" |

### 23 个自动化工具

| 工具名称 | 作用 |
|----------|------|
| `start_recommend_pipeline_run` | 开始自动筛选推荐页 |
| `get_recommend_pipeline_run` | 查看筛选进度 |
| `cancel_recommend_pipeline_run` | 取消正在进行的筛选 |
| `pause_recommend_pipeline_run` | 暂停筛选 |
| `resume_recommend_pipeline_run` | 恢复暂停的筛选 |
| `list_recommend_jobs` | 列出可以筛选的职位 |
| `run_featured_calibration` | 运行推荐页位置标定 |
| `get_featured_calibration_status` | 查看标定状态 |
| `run_recommend_self_heal` | 运行页面自愈检查 |
| `boss_chat_health_check` | 检查聊天页面是否正常 |
| `prepare_boss_chat_run` | 准备聊天自动化的参数 |
| `start_boss_chat_run` | 开始自动聊天沟通 |
| `get_boss_chat_run` | 查看聊天进度 |
| `pause_boss_chat_run` | 暂停聊天 |
| `resume_boss_chat_run` | 恢复聊天 |
| `cancel_boss_chat_run` | 取消聊天 |
| `run_recruit_pipeline` | 运行招聘渠道流程 |
| `start_recruit_pipeline_run` | 启动招聘流程（异步） |
| `get_recruit_pipeline_run` | 查看招聘进度 |
| `cancel_recruit_pipeline_run` | 取消招聘 |
| `pause_recruit_pipeline_run` | 暂停招聘 |
| `resume_recruit_pipeline_run` | 恢复招聘 |
| `set_screening_config` | 在线更新配置（API Key / 模型等） |

---

## 在 AI 编辑器中使用（MCP 配置）

### 如果你用 Cursor

1. 打开 Cursor → Settings → Features → MCP Servers
2. 点 "+ Add New MCP Server"
3. 类型选 `command`
4. Name 填 `boss-mcp-assistant`
5. Command 填：
```
boss-mcp-assistant start
```
6. 点 "Save"

然后在聊天框里告诉 Cursor：
> "帮我用 BOSS 直聘推荐页筛选一下后端开发的候选人，目标 20 个"
> "帮我运行聊天自动化，给匹配的候选人打招呼"

### 如果你用 Claude Code

```bash
claude mcp add boss-mcp-assistant -- npx -y boss-mcp-assistant start
```

### 如果你用 Trae（含 trae-cn）

```bash
boss-mcp-assistant install --agent trae-cn
```

---

## 许可

MIT
