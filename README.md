# Ilyenkov Archive Public

中文伊里因科夫是中文伊里因科夫小组的公共网站与出版锚点。项目面向中文世界系统介绍
埃瓦尔德·伊里因科夫的思想、著作和国际研究，并记录小组的翻译、出版、活动与交流。

GitHub 仓库身份为 `hoshF/ilyenkov-archive`；本地目录可以继续使用 `Ilyenkov-public`，以便与
private 研究仓库区分。

## 仓库职责

本仓库负责：

- 网站的信息架构、页面、组件、样式和静态部署；
- 面向公众的编辑导引、项目说明和小组记录；
- 以本项目名义发行的书籍和专题成果的公开身份、版本与勘误记录。

private 仓库负责研究资料、原文、翻译、审校、来源证据和发布判断。public 只读取
`translation/publication.json` 与 `research/publication.json` 中标记为 `website_public` 的条目。

网站的长期结构见[架构说明](docs/ARCHITECTURE.md)，发布范围与内部研读边界见
[发布说明](docs/PUBLICATION.md)。

## 开发

```sh
npm ci
npm run dev          # 后台开发服务器；dev:status / dev:logs / dev:stop 管理它
npm run verify       # 类型检查、测试、构建，一次跑完
```

`npm run publication:sync` 把 private 的两个公开通道同步为 `.website-input/` 下的构建输入，
`publication:check` 只比较不改写；`check`、`test` 与 `build` 都会先同步。private 默认位于本仓库
旁边的 `Ilyenkov/`，位置不同时用 `ILYENKOV_ROOT` 指定。

生产构建使用 `npm run build`，输出到 `dist/`。部署边界见[部署说明](docs/DEPLOYMENT.md)；
从 private 公开选择到静态页面的完整过程见[内容流水线](docs/CONTENT_PIPELINE.md)。
