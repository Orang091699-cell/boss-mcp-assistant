# Boss MCP Assistant

**Assistant 1.1** — 基于 Chrome DevTools Protocol (CDP) 的 MCP 服务，用于 BOSS 直聘三大核心场景：**推荐页候选人筛选**、**即时通讯(IM)自动沟通**、**招聘渠道批量处理**。

---

## 功能概览

### 三大业务域

| 域 | 入口 | 核心能力 |
|----|------|----------|
| **推荐 (Recommend)** | `start_recommend_pipeline_run` | 无限列表滚动、候选人画像提取、LLM 加权维度筛选、自动打招呼、CSV 报告 |
| **通讯 (Chat)** | `prepare_boss_chat_run` → `start_boss_chat_run` | 聊天列表遍历、对话历史分析、LLM 筛选、自动打招呼/索要简历/拒绝、简历附件自动接受、实习岗位自动识别与回复 |
| **招聘 (Recruit)** | `run_recruit_pipeline` | 招聘渠道批量搜索、简历获取、维度筛选、CSV 报告 |

### 23 个 MCP 工具

| 工具 | 用途 |
|------|------|
| `start_recommend_pipeline_run` | 启动推荐页自动化流水线 |
| `get_recommend_pipeline_run` | 查询推荐流水线执行状态 |
| `cancel_recommend_pipeline_run` | 取消推荐流水线 |
| `pause_recommend_pipeline_run` | 暂停推荐流水线 |
| `resume_recommend_pipeline_run` | 恢复暂停的推荐流水线 |
| `list_recommend_jobs` | 列出 CDP 可用的推荐职位 |
| `run_featured_calibration` | 运行推荐页特征标定 |
| `get_featured_calibration_status` | 查询特征标定状态 |
| `run_recommend_self_heal` | 运行推荐页自愈检查 |
| `boss_chat_health_check` | 检测聊天页面 CDP 连接和 DOM 可用性 |
| `prepare_boss_chat_run` | 准备聊天流水线参数 |
| `start_boss_chat_run` | 启动聊天自动化流水线 |
| `get_boss_chat_run` | 查询聊天流水线执行状态 |
| `pause_boss_chat_run` | 暂停聊天流水线 |
| `resume_boss_chat_run` | 恢复聊天流水线 |
| `cancel_boss_chat_run` | 取消聊天流水线 |
| `run_recruit_pipeline` | 运行招聘渠道流水线 |
| `start_recruit_pipeline_run` | 启动招聘流水线（异步模式） |
| `get_recruit_pipeline_run` | 查询招聘流水线状态 |
| `cancel_recruit_pipeline_run` | 取消招聘流水线 |
| `pause_recruit_pipeline_run` | 暂停招聘流水线 |
| `resume_recruit_pipeline_run` | 恢复招聘流水线 |
| `set_screening_config` | 在线更新 LLM 筛选配置（apiKey/baseUrl/model） |

---

## 快速开始

### 前置条件

- Node.js >= 18
- Chrome/Chromium 已安装，并开启远程调试端口（默认 9222）
- BOSS 直聘已登录

### 安装

```bash
npm install -g boss-mcp-assistant
```

全局安装后，命令行提供 `boss-mcp-assistant` 命令。

也可通过 npx 直接运行：
```bash
npx boss-mcp-assistant start
```

### 配置

创建 `~/.boss-mcp-assistant/screening-config.json`：

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-your-key",
  "model": "gpt-4o",
  "criteria": [
    {
      "name": "学历",
      "weight": 20,
      "description": "本科及以上优先"
    },
    {
      "name": "工作年限",
      "weight": 30,
      "description": "3年以上相关经验"
    }
  ]
}
```

也可通过 `set_screening_config` 工具在线更新配置。

### 启动 MCP 服务

```bash
boss-mcp-assistant
```

或使用 CLI 管理：

```bash
boss-mcp-assistant start          # 启动 MCP 服务
boss-mcp-assistant install        # 安装到 Cursor/Trae 等 MCP 客户端
boss-mcp-assistant doctor         # 环境检查
boss-mcp-assistant list-jobs      # 列出推荐页职位
```

---

## 推荐页流水线 (Recommend)

自动滚动推荐列表 → 提取候选人画像 → LLM 多维度筛选 → 执行动作（忽略/打招呼/索要简历）。

```bash
boss-mcp-assistant "start_recommend_pipeline_run" \
  '{"job":"后端开发","target_count":20,"criteria":"本科以上，3年+ Go 经验"}'
```

### 筛选维度
- **学历匹配** — 解析教育背景中最高学历
- **工作年限** — 从简历文本提取总工作年限
- **技能匹配** — 关键词匹配（必需/加分/排除）
- **自定义维度** — 通过 `criteria` 参数或 `screening-config.json` 配置

输出 CSV 报告到 `output/` 目录。

---

## 聊天流水线 (Chat)

遍历候选人聊天列表 → 分析对话历史 → LLM 筛选 → 自动互动。

### 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `intern_mode` | 是否开启实习岗位模式 | `false` |
| `intern_period_question_text` | 实习周期询问话术 | "你好呀，请问实习周期和最快到岗时间是什么时候呢？" |
| `intern_resume_request_text` | 实习简历请求话术 | "同学你好呀，方便发送一份附件简历吗" |
| `attachment_resume_request_text` | 附件简历请求话术 | "您好，方便发送一份附件简历吗？" |
| `resume_accept_reply_text` | 接收简历后回复语 | "收到，稍后我会交给业务评估，如果通过的话会及时和您电话约面" |
| `auto_accept_resume` | 是否自动接受附件简历 | `false` |
| `min_resume_text_length` | 简历最小有意义文本长度（过短则跳过） | `30` |
| `rejection_text` | 淘汰回复话术 | "很抱歉，您过往经历与当前岗位不太匹配，祝您早日找到更合适的机会！" |

### 实习岗位自动识别

- 职位名称包含 `实习生` / `实习` / `intern` 时自动激活
- 自动扫描聊天记录中的实习周期和到岗时间
- 如缺少信息则主动询问
- 实习周期 ≥ 3个月且通过筛选 → 自动索要附件简历

### 简历过简跳过

- 对在线简历进行去噪（去除 markdown 格式头）
- 有效文本长度低于阈值时自动跳过（节省筛选成本）

### 附件简历自动处理

- 向候选人发送索要请求后，监听附件简历上传
- 自动点击"接受"按钮并回复预设文案

---

## 招聘流水线 (Recruit)

批量遍历招聘渠道搜索结果 → 抓取简历 → LLM 筛选 → CSV 输出。

---

## 核心架构

```
src/
├── index.js               # MCP 服务入口 (stdio)，注册所有工具
├── cli.js                 # CLI 入口
├── chat-mcp.js            # 聊天域 MCP 工具实现
├── chat-runtime-config.js # 运行时配置管理 (含 set_screening_config)
├── recommend-mcp.js       # 推荐域 MCP 工具实现
├── recruit-mcp.js         # 招聘域 MCP 工具实现
├── parser.js              # 通用解析工具
├── run-state.js           # 流水线状态管理
├── core/
│   ├── browser/           # CDP 浏览器连接、DOM 操作
│   ├── capture/           # 候选人信息抓取
│   ├── cv-acquisition/    # 简历获取策略
│   ├── greet-quota/       # 打招呼配额管理
│   ├── infinite-list/     # 无限列表滚动
│   ├── reporting/         # CSV 报告生成
│   ├── run/               # 流水线生命周期
│   ├── screening/         # LLM 筛选引擎、维度评分、简历简化检测
│   └── self-heal/         # 自愈检测
└── domains/
    ├── chat/              # 聊天域：常量、CDP 操作、流水线编排
    ├── recommend/         # 推荐域：常量、CDP 操作、流水线编排
    └── recruit/           # 招聘域：常量、CDP 操作、流水线编排
```

### 设计原则

- **CDP-only** — 所有浏览器自动化走 Chrome DevTools Protocol，禁止 `Runtime.evaluate`
- **无测试框架** — 每个测试文件是独立 Node.js 脚本，直接 `npm run test:<name>` 运行
- **运行时扫描** — `npm run scan:runtime:strict` 确保无遗留 forbidden CDP 调用进入生产代码

---

## 开发命令

```bash
# 静态检查
npm run scan:runtime:strict    # 严格运行时扫描（无违规则通过）
npm run gate:phase9-static     # 聚合静态门禁

# 单元测试
npm run test:parser
npm run test:core-screening
npm run test:recommend-domain
npm run test:chat-domain
npm run test:chat-run-service
npm run test:chat-mcp

# 端到端测试 (需 Chrome 9222)
npm run live:cdp-smoke
npm run live:recommend-mcp
npm run live:chat-mcp
npm run live:chat-phase10-full

# 完整门禁
npm run gate:phase10-complete
```

---

## 维护

### 一键更新

```bash
npm update -g boss-mcp-assistant
```

### 一键卸载（含配置清理）

```bash
npm uninstall -g boss-mcp-assistant && rm -rf ~/.boss-mcp-assistant
```

---

## 许可

MIT
