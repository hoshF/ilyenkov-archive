# 静态部署

## 目标

网站保持 Astro 纯静态输出：`astro.config.mjs` 不配置任何 adapter，生产结果是 `dist/` 下的一批
静态文件，用 Cloudflare Pages 的 Direct Upload 托管。公开站点运行时不依赖 Node.js、数据库或
private 研究仓库。

## 构建边界

生产构建环境需要 Node 22.12 以上，并且必须同时能读取 public 仓库和 private 研究仓库，再运行：

```sh
npm ci
npm run verify
```

private 默认位于 public 的相邻 `Ilyenkov/` 目录，其他布局用 `ILYENKOV_ROOT=/path/to/Ilyenkov`
指定。该绝对路径只用于构建，不写入生成页面。

## Cloudflare Pages

项目名 `ilyenkov-archive`，生产分支 `main`，
站点地址 [https://ilyenkov-archive.pages.dev/](https://ilyenkov-archive.pages.dev/)。

Cloudflare 一侧没有 Git 集成，也不配置构建命令：它只接收本地或其他能安全读取 private 的受控
环境生成好的 `dist/`，既不读取 private 仓库，也不参与构建。

代码提交和 Git 推送更新 GitHub 仓库；`npm run build` 和 `npm run verify` 生成本地 `dist/`。
正式站点在成功上传生产产物后更新。

### 账号准备

Wrangler 已作为固定版本的开发依赖随 `npm ci` 安装。首次在新环境发布前，确认当前登录账号
具有该 Pages 项目的发布权限：

```sh
npm exec wrangler -- whoami
```

尚未登录时运行 `npm exec wrangler -- login`，再确认账号。登录凭据由 Wrangler 在本地管理，
不写入项目文件。

### 生产发布

日常发布使用统一入口：

```sh
npm run deploy
```

该命令先运行 `npm run verify`，依次完成公开内容同步、类型检查、测试与静态构建；全部通过后，
才调用项目内的 Wrangler 上传刚生成的 `dist/`。任一步检查或构建失败都会停止上传。

上传参数固定为 `--project-name=ilyenkov-archive --branch=main`，始终把当前本地代码生成的
产物发布到正式站点。这里的 `main` 指定 Cloudflare 的生产部署分支，不要求本地 Git 分支同名。

省略 `--branch` 时，Wrangler 在 Git 目录下会自动读取当前分支，再根据项目的生产分支判断部署
环境。预览上传应显式指定与 `main` 不同的分支。分支行为见
[Cloudflare Direct Upload 说明](https://developers.cloudflare.com/pages/get-started/direct-upload/)。

### 上线验收

上传结束后检查：

- 本次部署的环境为 `Production`、分支为 `main`，部署状态成功。可在 Cloudflare 控制台查看，
  或运行 `npm exec wrangler -- pages deployment list --project-name=ilyenkov-archive`。
- 打开[正式站点](https://ilyenkov-archive.pages.dev/)，确认本次更新的标志、文章或页面内容已出现。
- 打开本次涉及的文章，确认标题、正文、图片和脚注在桌面与手机宽度下正常显示。

上传命令输出的部署专用网址可用于核对该次产物；上线验收需要同时确认正式站点更新。
检查、构建、生产上传和正式站点验收全部完成后，才将发布记为已上线。

## 不要重新初始化项目

Cloudflare 上的项目已经存在，此后不要再运行 `wrangler pages project create`，也不要运行任何
其他 Cloudflare 项目初始化流程。首次创建项目时，该命令被委派给新版 Cloudflare Pages（已并入
Cloudflare Workers）的初始化流程，它直接改写了仓库：装入 `@astrojs/cloudflare`、给
`astro.config.mjs` 加 adapter、改写 `package.json` 脚本与 `tsconfig.json`、新增 `wrangler.jsonc`
与 `public/.assetsignore`。这些都属于 Workers 运行时部署，不属于本项目的部署架构，当时已全部
撤销。（绕开委派的办法是给 `wrangler pages project create` 加 `--force`；项目建成后不再需要它，
其余命令也不应该带这个标志。）

同样不要引入 Cloudflare adapter、SSR 或任何 runtime 配置。站点是纯静态的，加入 adapter 会把
部署变成 Workers 运行时，越过“Cloudflare 只接收静态产物”这条边界。

## 受保护部署与域名

主站保持完全静态。若将来提供小组研读网页，应使用独立受保护部署，并在请求到达静态资源前通过
Cloudflare Access 执行身份验证。

在正式域名确定前，不在代码中写入临时 canonical URL。购买域名后，再统一配置站点 URL、重定向、
安全响应头、搜索引擎站点地图和分析策略。
