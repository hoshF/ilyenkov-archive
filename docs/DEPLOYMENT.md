# 静态部署

## 目标

网站保持 Astro 静态输出，生产结果位于 `dist/`，适合部署到 Cloudflare Pages。公开站点运行时不依赖
Node.js、数据库或 private 研究仓库。

## 构建边界

生产构建环境必须同时能读取 public 仓库和 private 研究仓库，再运行：

```sh
npm ci
npm run verify
```

private 默认位于 public 的相邻 `Ilyenkov/` 目录。其他布局设置：

```sh
ILYENKOV_ROOT=/path/to/Ilyenkov
```

该绝对路径只用于构建，不写入生成页面；生成的译文与研究资料输入也不会进入 public Git 历史。

## Cloudflare 建议

推荐由能安全读取 private 仓库的受控 CI 或本地环境完成构建，再把 `dist/` 部署到 Cloudflare
Pages。Cloudflare 只接收静态产物，不需要在网站运行时访问 private。

主站保持完全静态。若将来提供小组研读网页，应使用独立受保护部署，并在请求到达静态资源前通过
Cloudflare Access 执行身份验证；不能把受限文件混入主站 `dist/`。

在正式域名确定前，不在代码中写入临时 canonical URL。购买域名后，再统一配置站点 URL、重定向、
安全响应头、搜索引擎站点地图和分析策略。
