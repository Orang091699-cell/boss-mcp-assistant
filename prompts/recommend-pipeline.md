# 推荐页筛选 MCP Prompt 模版

> 调用 boss-mcp-assistant 的推荐页筛选工具，筛选 BOSS 直聘推荐页的候选人。

## 执行流程

```
步骤1: list_recommend_jobs → 读取岗位列表，获取准确的岗位名称
步骤2: start_recommend_pipeline_run(含 instruction/overrides) → 可能返回 NEED_CONFIRMATION
步骤3: start_recommend_pipeline_run(补齐 confirmation 字段) → 获取 ACCEPTED + run_id
步骤4: get_recommend_run(run_id) → 按需轮询结果
```

## 完整调用模版

复制以下内容，替换 `<>` 中的占位值后直接发送给 MCP：

```
请调用 boss-mcp-assistant 的推荐页筛选工具，帮我筛选 BOSS 直聘推荐页的候选人，端口 9222。

请先调用 list_recommend_jobs 读取岗位列表，然后使用我指定的岗位。

页面范围：<recommend|featured|latest>
岗位：<完整岗位名称，如：海外众筹运营专员（内容/社群方向） _ 北京 25-40K>
学校标签：<不限|985|211|双一流院校|留学|国内外名校|公办本科>
学历：<不限|本科|硕士|博士>
性别：<不限|男|女>
近14天没有：<不限|近14天没有>
筛选标准：
<多行自然语言筛选标准>

目标数量：<正整数>
通过后动作：<favorite|greet|none>
打招呼上限：<正整数，post_action=greet 时必填>

我已经确认以上所有条件。
请调用 start_recommend_pipeline_run 启动任务。
如果返回 NEED_CONFIRMATION，请根据 pending_questions 补齐确认字段后再调用一次。
返回 ACCEPTED 和 run_id 后停止，不要自动轮询。
```

## 参数说明

| 参数 | 字段名 | 说明 |
|------|--------|------|
| 页面范围 | `page_scope` | `recommend` / `featured` / `latest` |
| 岗位 | `job` | 从 `list_recommend_jobs` 读取的完整名称 |
| 学校标签 | `school_tag` | 可传单个字符串或数组 `["不限"]` |
| 学历 | `degree` | 可传单个字符串或数组 `["本科", "硕士"]` |
| 性别 | `gender` | `不限` / `男` / `女` |
| 近14天没有 | `recent_not_view` | `不限` / `近14天没有` |
| 筛选标准 | `criteria` | 自然语言描述 |
| 目标数量 | `target_count` | 正整数 |
| 通过后动作 | `post_action` | `favorite` / `greet` / `none` |
| 打招呼上限 | `max_greet_count` | 正整数，post_action=greet 时生效 |

## 真实示例

```
请调用 boss-mcp-assistant 的推荐页筛选工具，帮我筛选 BOSS 直聘推荐页的候选人，端口 9222。

请先调用 list_recommend_jobs 读取岗位列表，然后使用我指定的岗位。

页面范围：recommend
岗位：海外众筹运营专员（内容/社群方向） _ 北京 25-40K
学校标签：不限
学历：本科、硕士、博士
性别：不限
近14天没有：近14天没有
筛选标准：
科技产品的内容运营/市场运营/产品营销经验；
具备海外内容运营、英文内容撰写、海外社媒运营或跨文化传播经验；
有社群运营经验，海外社群运营经验优先；
有 Kickstarter、Indiegogo、Crowdfunding、Product Hunt、众筹预热、众筹页面内容、众筹更新、Backer 沟通经验者优先；
排除仅有国内公众号、小红书、抖音、私域、电商直播经验且无海外内容/英文/科技产品经验的候选人。

目标数量：20
通过后动作：greet
打招呼上限：20

我已经确认以上所有条件。
请先调用 list_recommend_jobs 读取岗位列表。
如果成功获取岗位列表后，调用 start_recommend_pipeline_run 启动任务。
如果返回 NEED_CONFIRMATION，请根据 pending_questions 补齐确认字段后再调用一次。
返回 ACCEPTED 和 run_id 后停止，不要自动轮询。
```

## 注意事项

- `start_recommend_pipeline_run` 是异步工具，返回 `ACCEPTED` + `run_id` 后即表示已启动，不需要等待完成
- 使用 `get_recommend_run` 传入 `run_id` 可以查看运行状态
- 先调用 `list_recommend_jobs` 获取准确岗位名称，避免 job 参数不匹配
- 如果 `start_recommend_pipeline_run` 返回 `NEED_CONFIRMATION`，按 `pending_questions` 中缺失字段补齐后再调用
