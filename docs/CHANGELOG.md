# 网站开发日志

## 2026-11-01

### schema.org 结构化数据

- 新增 `src/lib/structured-data.ts`：序列化 `@graph` 并用 `\u003c` 等转义防止脚本被正文提前闭合。
- 布局为所有可索引页面输出站点实体（`Organization` 为小组、`WebSite` 为站点）与页面实体 `WebPage`；
  `@id` 用绝对地址，`publisher`、`isPartOf` 以 `@id` 引用，单页抓取时也能解析发布者。
- 译文页输出 `ScholarlyArticle`：中文题名、原文题名、原文作者、`translationOfWork`（含原文发表年份）、
  原文出处 `isBasedOn` 与编辑分类 `about`；页首年份加 `<time datetime>`。
- 术语页输出 `DefinedTerm`（中文主译、原词 `termCode`、其他词形、译名说明、所属术语库），
  书籍页输出 `Book`（题名、原题名、封面），人物页输出 `Person`（生卒年、原文名、维基条目）。
- 面包屑页面在正文输出同序 `BreadcrumbList`，末项取当前页 canonical 地址。
- `noindex` 页面（404）不输出结构化数据；`docs/ARCHITECTURE.md` 补充结构化数据一节。
- `tests/discoverability.test.ts` 增加回归检查：每页站点实体与 `WebPage` 地址、各内容类型实体字段、
  面包屑顺序与末项地址、转义与 JSON 可解析性。


## 2026-10-11

状态：本地修改完成，未提交 Git，未部署到正式站点。

### 响应头与 sitemap 入口

- 在 `public/_headers` 为正式域名 `ilyenkov.cn` 配置 HSTS：`max-age=31536000`；不覆盖预览域名，未启用 `includeSubDomains` 或 `preload`。
- 配置 `X-Frame-Options: DENY`，并通过 `Permissions-Policy` 禁用摄像头、麦克风和地理位置权限。
- 在 `public/_redirects` 将 `/sitemap.xml` 以 301 重定向至 `/sitemap-index.xml`。
- 在 `docs/DEPLOYMENT.md` 补充响应头与兼容入口的配置及验收方法。

### 深色模式

- 按确认的中性炭灰方案实现深色模式，通过 `prefers-color-scheme` 跟随系统设置。
- 背景为 `#1c1d1f`，正文为 `#d8d9db`，辅助文字为 `#aaa6a0`，链接为 `#acb8f4`。
- 同步适配阅读页正文、导航悬停、SVG 字标、档案与术语搜索控件、占位文字、搜索高亮及浏览器主题颜色。
- 浅色模式保留现有颜色；书籍封面和正文图片保留原色。

### 术语页查询数据精简

- 浏览器查询记录仅保留搜索、排序、筛选与词条定位所需字段，移除空的 `notes` 及重复的类别、作者显示名称。
- 完整静态词条列表、详情内容、搜索排序、组合筛选和网址恢复保持原有行为。
- 为精简后的查询输入定义独立类型，搜索函数保留输入条目类型；增加构建产物查询结果与完整数据一致的回归检查。

本地构建体积测量：

| 项目 | 优化前 | 优化后 |
| --- | ---: | ---: |
| 查询 JSON | 96,490 字节 | 76,045 字节 |
| 整页 HTML | 245,589 字节 | 225,144 字节 |
| 整页 HTML（本地 gzip） | 31,762 字节 | 31,416 字节 |

查询数据减少约 21.2%，整页未压缩体积减少约 8.3%；gzip 后减少 346 字节，主要收益是减少重复查询数据的解析。

### 验证

- 最终 `npm run verify` 通过：公开内容同步、Astro 检查、静态构建、搜索索引及 29 个测试文件中的 849 项测试全部完成。Astro 为 0 错误、0 警告，保留 RSS 测试中已有的解析接口弃用提示。
- 本地 Pages 验收确认正式域名匹配时返回 HSTS，预览域名不返回 HSTS；常用页面及静态资产返回新增安全头，sitemap 别名返回 301，目标及子 sitemap 可访问。
- 浏览器检查浅色与深色样式的正文、字标、链接、输入框、高亮及键盘焦点；320px 窄屏无横向溢出。
- 术语页检查中文搜索、作者与名称类型筛选、重置和刷新后网址条件恢复；完整静态列表与优化前一致。
- `git diff --check` 通过。
