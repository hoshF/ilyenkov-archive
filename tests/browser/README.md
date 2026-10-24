# Chromium 浏览器冒烟测试

安装项目开发依赖后，安装配套浏览器并运行：

```sh
npx playwright install chromium
npm run test:browser
```

测试只读取已有 `dist/`，不运行私有内容同步、网站构建或生成输入更新。产物缺失或不完整时，
须先在具备获准发布输入的环境中执行 `npm run build`。缺少 Chromium 时测试失败并提示安装，
不会静默跳过。Linux 主机可能还需系统依赖，可使用 `npx playwright install --with-deps chromium`。

每个用例启动无界面 Chromium 和只读静态服务，使用系统分配的本地端口，阻止外部请求，
结束时自动关闭浏览器与服务；不占用开发服务器或固定端口。`.browser.ts` 文件通过独立 Vitest
配置运行，`npm run verify` 保持原有测试范围，不启动浏览器。本批不增加 CI 工作流。

现有产物须含可搜索词条，且档案查询“思维”须有超过一批的结果以验证分页；总数从页面读取，
不固定为当前发布数量。本批只覆盖正常搜索、分页、清空、URL 状态与术语页刷新；输入法、
历史恢复、故障、重试和异步竞态留待后续批次。
