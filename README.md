# Ilyenkov Archive Public

中文伊里因科夫是中文伊里因科夫小组的公共网站与出版锚点。项目面向中文世界系统介绍
埃瓦尔德·伊里因科夫的思想、著作和国际研究，并记录小组的翻译、出版、活动与交流。

GitHub 仓库身份为 `hoshF/ilyenkov-archive`；本地目录可以继续使用 `Ilyenkov-public`，以便与
private 研究仓库区分。

## 仓库职责

本仓库负责：

- 网站的信息架构、页面、组件、样式和静态部署；
- 面向公众的编辑导引、项目说明和小组记录；
- 以本项目名义发行的书籍和专题成果的公开身份、版本与勘误记录；
- 获得精确版本授权后可以进入 Git 的公开成果。

private 仓库负责研究资料、原文、翻译、审校、来源证据和发布判断。public 只读取
`translation/publication.json` 与 `research/publication.json` 中明确标记为 `website_public` 的条目，
不从其他文件的存在推断“允许发布”。

网站的长期结构见 [架构说明](docs/ARCHITECTURE.md)，发布范围与内部研读边界见
[发布说明](docs/PUBLICATION.md)。

## 网站构建输入同步

`npm run publication:sync` 同步两个公开通道：译文通道读取 `translation/publication.json`，将选定的
`work.json` 与同目录 Markdown 生成到 `.website-input/articles/<work_id>.md`；研究资料通道读取
`research/publication.json`，将逐项批准的最小公共字段生成到 `.website-input/research-records.json`。
`npm run publication:prepare` 复用这条完整同步命令，供开发、检查、测试和构建调用。

private 仓库默认是本仓库旁边的 `Ilyenkov/`。位置不同时使用 `ILYENKOV_ROOT` 指定。生成的译文与
研究资料输入都不进入本仓库 Git；Astro 只在构建时读取它们并生成静态 HTML。

## 开发

```sh
npm ci
npm run publication:prepare
npm run check
npm test
npm run dev
```

查看或停止后台开发服务器：

```sh
npm run dev:status
npm run dev:logs
npm run dev:stop
```

单独同步或检查全部生成输入：

```sh
npm run publication:sync
npm run publication:check
```

生产构建使用 `npm run build`，输出到 `dist/`。推荐的 Cloudflare 部署边界见
[部署说明](docs/DEPLOYMENT.md)。
从 private 公开选择到静态页面的完整过程见 [内容流水线](docs/CONTENT_PIPELINE.md)。
