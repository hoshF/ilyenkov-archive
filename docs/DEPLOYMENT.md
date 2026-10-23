# 静态部署

本文件负责构建环境、Cloudflare Direct Upload 与上线验收。公开权限见
[发布说明](PUBLICATION.md)，输入生成过程见[内容管线](CONTENT_PIPELINE.md)。

## 构建与托管边界

网站由 Astro 生成 `dist/` 静态文件，Cloudflare Pages 直接托管这些文件。

构建环境需要 Node 22.12 以上，并能读取 public 与获准的 private 输入：

```sh
npm ci
npm run verify
```

private 默认位于相邻 `Ilyenkov/`，其他位置用 `ILYENKOV_ROOT=/path/to/Ilyenkov` 指定。
所需发布选择与成稿见[发布接口](PUBLICATION.md#private-公开接口)，同步及验证顺序见
[命令顺序](CONTENT_PIPELINE.md#命令顺序)。本地绝对路径仅用于构建，不进入页面。

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

发布使用已有 Cloudflare Pages 项目；初始化不属于日常上传流程。

## 上线验收

- 确认部署环境为 `Production`、分支为 `main`、状态成功。可在控制台查看，或运行
  `npm exec wrangler -- pages deployment list --project-name=ilyenkov-archive`。
- 用上传返回的部署 URL 核对本次产物，并在正式站点确认涉及页面已更新。
- 检查本次涉及的页面、链接及桌面与手机布局；涉及 RSS 时确认 XML 与订阅链接正常。

以上检查完成后记为已上线；本地构建成功或上传命令完成均不替代正式站点验收。

## 响应头与兼容入口

`public/_headers` 配置 Cloudflare Pages 的静态响应头：正式域名 `ilyenkov.cn` 使用
`Strict-Transport-Security: max-age=31536000`，不包含 `includeSubDomains` 或 `preload`；
所有静态页面设置 `X-Frame-Options: DENY`，并通过 `Permissions-Policy` 禁用摄像头、麦克风和定位。

`public/_redirects` 将 `/sitemap.xml` 以 301 跳转到 `/sitemap-index.xml`。
两份配置随构建进入 `dist/`，由 Cloudflare Pages 应用；上线验收须检查正式域名的响应头、
兼容入口的跳转状态及目标网站地图。重定向先于响应头规则，安全头以目标页面响应为准。

## 站点基址与抓取声明

`astro.config.mjs` 的 `site` 使用生产地址 `https://ilyenkov.cn/`；RSS、canonical、分享元数据和 sitemap
共用这一项。`/llms.txt` 复用站点简介与导航，提供公开阅读入口及政策链接；页面 head 通过 `rel="describedby"` 指向它。
sitemap 在静态构建时生成，入口为 `/sitemap-index.xml`；`/robots.txt` 声明公开抓取与 sitemap 地址。
`Content-Signal` 声明 `search=yes, ai-input=yes, ai-train=no`；使用条件见 `/about`。
声明不替代作品授权或访问控制，部署后须检查 Cloudflare 返回的实际 robots 是否与本站政策一致。预览部署不改变订阅的生产基址。迁移域名时更新 `site`，并验证 feed
与订阅发现的绝对 URL。

抓取声明不代替发布权限；受限内容的渠道与访问要求见[三种网站状态](PUBLICATION.md#三种网站状态)。
