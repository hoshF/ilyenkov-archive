# 静态部署

本文件负责构建环境、Cloudflare Direct Upload 与上线验收。公开权限见
[发布说明](PUBLICATION.md)，输入生成过程见[内容管线](CONTENT_PIPELINE.md)。

## 构建与托管边界

网站保持 Astro 纯静态输出，不配置 adapter、SSR 或 Workers 运行时。生产结果为 `dist/` 下的
静态文件，站点运行时不依赖 Node.js、数据库或 private 研究仓库。

构建环境需要 Node 22.12 以上，并能读取 public 与获准的 private 输入：

```sh
npm ci
npm run verify
```

private 默认位于相邻 `Ilyenkov/`，其他布局用 `ILYENKOV_ROOT=/path/to/Ilyenkov` 指定。构建准备
阶段从 private `web/publication.json` 读取发布选择并解析获准事实、文本与选定成稿；年表、作品
目录、生平与交往根选择及成稿必须可用。同步生成 `.website-input/`，页面不直接读取 private 文件。绝对路径
仅用于构建，不进入页面。verify 依次完成公开内容同步与类型检查、静态构建、文章搜索索引生成、测试。

Cloudflare Pages 项目为 `ilyenkov-archive`，生产分支为 `main`，
[正式站点](https://ilyenkov.cn/)由 Direct Upload 更新。
Cloudflare 不使用 Git 集成或构建命令，只接收受控环境生成的静态产物，不读取 private 或参与构建。

## 账号准备

Wrangler 为项目固定版本开发依赖，由 `npm ci` 安装。新环境发布前确认当前账号具有项目发布权限：

```sh
npm exec wrangler -- whoami
```

尚未登录时使用 `npm exec wrangler -- login`，随后重新确认账号。凭据由 Wrangler 管理，不写入
项目文件。

## 生产发布

```sh
npm run deploy
```

此命令先执行完整 verify；任一步失败都会停止上传。全部通过后，项目内 Wrangler 上传刚生成的
`dist/`，参数固定为 `--project-name=ilyenkov-archive --branch=main`。

这里的 `main` 是 Cloudflare 生产分支，不要求本地 Git 分支同名。提交与推送更新 GitHub，build
或 verify 更新本地产物；只有生产上传成功才更新正式站点。

预览上传应显式指定非 `main` 分支；省略 `--branch` 时 Wrangler 会读取当前 Git 分支。
分支行为见 [Cloudflare Direct Upload 说明](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

已有项目不重新运行 `wrangler pages project create` 或其他初始化流程，不引入 adapter、SSR 或
运行时配置。新增部署配置不得越过“Cloudflare 仅接收静态产物”的边界。

## 上线验收

- 确认部署环境为 `Production`、分支为 `main`、状态成功。可在控制台查看，或运行
  `npm exec wrangler -- pages deployment list --project-name=ilyenkov-archive`。
- 打开正式站点，确认涉及页面的实际内容更新，不能只依据本地构建或上传命令完成判断。
- 检查本次涉及的页面、链接及桌面与手机布局；涉及 RSS 时确认 XML 与订阅链接正常。

上传命令返回的部署专用 URL 用于核对该次产物，仍需确认正式地址更新。验收完成后才记为已上线。

## 订阅基址与受限内容

`astro.config.mjs` 的 `site` 使用生产地址 `https://ilyenkov.cn/`；RSS、canonical、分享元数据和 sitemap
共用这一项。`/llms.txt` 复用站点简介与导航，提供公开阅读入口及政策链接；页面 head 通过 `rel="describedby"` 指向它。
sitemap 在静态构建时生成，入口为 `/sitemap-index.xml`；`/robots.txt` 声明公开抓取与 sitemap 地址。
`Content-Signal` 声明 `search=yes, ai-input=yes, ai-train=no`；使用条件见 `/about`。
声明不替代作品授权或访问控制，部署后须检查 Cloudflare 返回的实际 robots 是否与本站政策一致。预览部署不改变订阅的生产基址。迁移域名时更新 `site`，并验证 feed
与订阅发现的绝对 URL。

受限研读正文不进入公开构建。若另设研读站点，应使用独立受保护部署，并在访问静态资源前进行
身份验证；公开网站中的隐藏界面不构成访问控制。
