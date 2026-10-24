# Chromium 浏览器测试

安装项目开发依赖后，安装配套浏览器并运行：

```sh
npx playwright install chromium
npm run test:browser
```

冒烟测试只读取已有 `dist/`，不运行私有内容同步、网站构建或生成输入更新。产物缺失或不完整时，
须先在具备获准发布输入的环境中执行 `npm run build`。缺少 Chromium 时测试失败并提示安装，
不会静默跳过。Linux 主机可能还需系统依赖，可使用 `npx playwright install --with-deps chromium`。

每个用例启动无界面 Chromium 和只读静态服务，使用系统分配的本地端口，阻止外部请求，
结束时自动关闭浏览器与服务；不占用开发服务器或固定端口。`.browser.ts` 文件通过独立 Vitest
配置运行，`npm run verify` 保持原有测试范围，不启动浏览器。没有配置浏览器 CI 工作流。

现有产物须含可搜索词条，且档案查询“思维”须有超过一批的结果以验证分页；总数从页面读取，
不固定为当前发布数量。

`glossary-state.browser.ts` 在临时目录中复制未修改的生产术语页面及其直接依赖，用六条虚构
词条和虚构站点信息构建独立页面。它复用生产 Schema、数据读取、查询及浏览器脚本，不运行
同步器、不读取私有仓库、不修改正式 `.website-input/` 或 `dist/`，结束后删除临时项目。
这些用例覆盖筛选交集、URL 与刷新恢复、真实前进后退、无结果、清空及重置。历史用例显式
建立第二个历史项，再操作控件；不假定筛选所用的 `replaceState` 会创建历史项。

组合输入测试使用合成 `CompositionEvent`、带 `isComposing` 的 `InputEvent`，验证输入期间
结果与 URL 不提前更新，结束后应用最终文本。另用 `requestSubmit()` 显式提交表单，记录
当前行为：提交会应用尚在组合中的文本，阻止页面导航，随后组合结束仍能应用最终文本。
这不能证明真实中文输入法确认键会触发表单提交，也不能替代系统中文输入法的人工验收。

档案测试在临时目录构建生产 `ArchiveSearch.astro` 和十四篇虚构文章的真实 Pagefind 索引，
使用生产补丁脚本修补生成的运行时，不读取私有来源或正式生成输入。可单独运行：

```sh
npm run test:browser -- tests/browser/archive-async.browser.ts
```

正常路径与真实网络失败使用 Pagefind；可控竞态使用实现 `init()`、`destroy()`、`search()` 和
`result.data()` 的最小接口替身。替身只控制外部接口与响应，不复制页面的版本、分页或恢复逻辑。
网络拦截在导航前安装；通过请求到达、接口完成、DOM 状态和绘制同步，不使用固定休眠。

| 文件 | 验证范围 |
| --- | --- |
| `archive-async.browser.ts` | 正常分页、查询与详情乱序、旧分页成功或失败的状态隔离、清空 |
| `archive-runtime-recovery.browser.ts` | 模块、清单与片段失败后的同页重试，共享销毁、重置期间改词或清空、重试从第一页开始 |
| `archive-recovery.browser.ts` | 真实清单与索引分块失败的错误反馈、无未处理拒绝及同页恢复 |
| `pagefind-runtime.browser.ts` | 主线程与 Worker 的公开 API 错误传播、后台初始化与预取、合法零结果、共享请求及销毁后恢复 |
| `section-layout.browser.ts` | 正文与侧栏不重叠、窄屏无横向溢出、目录断点切换及键盘操作、无目录阅读页单列布局 |

运行时补丁的构建阶段、版本与支持环境见[内容管线](../../docs/CONTENT_PIPELINE.md#文章搜索)。
浏览器用例均应通过；不以跳过或预期失败掩盖依赖故障。上述测试仅覆盖配套 Chromium，
不替代其他浏览器、实际读屏软件和系统中文输入法的人工验收。
