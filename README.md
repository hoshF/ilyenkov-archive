# 中文伊里因科夫 · 网站项目

本项目是中文伊里因科夫小组的公共网站与出版锚点，面向中文读者整理伊里因科夫及相关苏联哲学的
译文、文献信息、书籍记录与研究资料，并保存小组的公开工作记录。

GitHub 仓库为 `hoshF/ilyenkov-archive`；本地目录 `Ilyenkov-public` 与相邻的 private 研究仓库
`Ilyenkov` 分开维护。

## 仓库边界

- **public**：网站页面、组件、样式、公开编辑介绍、小组记录、成书身份与版本记录，以及静态构建和部署。
- **private**：canonical 研究事实、原文、翻译、审校、来源与权利证据；统一公开接口为根目录的
  `web/publication.json`，其中 `works` 选择译文，`records` 选择研究记录。事实与文本由清单引用，
  不复制到接口中。
- **生成输入**：`web/publication.json` 中 `website_public` 条目同步到 `.website-input/`；该目录与构建产物
  `dist/` 均不进入 Git。网页公开许可不等于公共 Git 仓库收录许可。

## 常用命令

```sh
npm ci
npm run dev                # 后台开发服务器；dev:status / dev:logs / dev:stop 管理它
npm run verify             # 同步与类型检查 → 静态构建 → 测试
npm run publication:check  # 比较生成输入，不改写
npm run deploy             # 完整验证通过后，Direct Upload 到 Production
```

private 默认位于相邻 `Ilyenkov/`，其他位置通过 `ILYENKOV_ROOT` 指定。部署环境必须能读取获准的
private 输入，并具有 Cloudflare 项目的发布权限。提交与推送代码不会更新正式站点，生产上传后才会更新。

## 项目文档

| 文档 | 职责 |
| --- | --- |
| [AGENTS](AGENTS.md) | 开发约束、命令和测试规范 |
| [架构](docs/ARCHITECTURE.md) | 栏目职责、布局原则与文件所有权 |
| [发布](docs/PUBLICATION.md) | 权限、公开字段、身份与日期契约 |
| [内容管线](docs/CONTENT_PIPELINE.md) | 输入输出、转换、关系解析与派生数据 |
| [部署](docs/DEPLOYMENT.md) | 环境、生产上传与上线验收 |

面向读者的项目说明见网站 `/about`；正式站点为[中文伊里因科夫](https://ilyenkov-archive.pages.dev/)。
