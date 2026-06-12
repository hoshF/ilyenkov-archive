---
title: "公开仓库历史暴露审计"
created: "2026-06-11"
updated: "2026-06-11"
type: "audit"
tags: ["publish", "copyright", "exposure", "repository"]
language: "zh"
collection: "project-documentation"
llm_wiki_eligible: "true"
---

# 公开仓库历史暴露审计

## 结论

公开仓库 [hoshF/ilyenkov-cn](https://github.com/hoshF/ilyenkov-cn) 曾从 2026-06-09 的初始提交开始公开包含未获再分发批准的正文、图片、PDF 和项目材料。该状态判定为“已暴露”，不能描述为从未公开。

项目所有者决定删除旧公开仓库并创建同名空公开仓库，以经过版权闸门的 `dist/public/` 重新发布。删除仓库可以移除 GitHub 托管的旧提交对象，但不能保证消除第三方缓存、下载、副本或存档。

## 审计基线

| 项目 | 结果 |
|---|---|
| 审计日期 | 2026-06-11 |
| 旧公开仓库 | `https://github.com/hoshF/ilyenkov-cn` |
| 可见性 | `PUBLIC` |
| 旧公开 HEAD | `3cc661b0baae7b9c279a9792a1bc4ad88f6ebe8c` |
| 初始提交时间范围起点 | 2026-06-09 |
| 文件数 | 283 |
| Git tree 文件字节合计 | 57,990,470 |
| 受限目录文件数 | 257 |
| forks / watchers / stars | 0 / 0 / 0 |
| 处置 | 建立私有备份后，由所有者删除旧仓库并重建同名空公开仓库 |
| 当前状态 | 旧公开仓库已于 2026-06-11 删除；同名空公开仓库已重建并完成首次版权闸门发布 |

“受限目录”统计包括 `caute_ru_markdown/`、`existing_translations/`、`dialectical_logic/`、`idols_ideals/` 等包含正文、译文、图片或 PDF 的路径。旧提交内的具体文件是否最终具备再分发资格，不能从其公开状态反推；现行政策在许可证据不足时统一拒绝公开导出。

## 后续限制

- 父工作树不得再配置指向公开仓库的 remote。
- 公开发布只能从独立的 `dist/public/` Git 工作树执行。
- 旧公开仓库删除前不得再向其推送。
- 权利与项目状态说明必须保留“曾公开”事实。
- 删除重建完成后，在本文件补记删除和新仓创建日期、新仓首次公开提交及远端树校验结果。

## 删除与重建记录（2026-06-11 回填）

| 项目 | 结果 |
|---|---|
| 旧公开仓库删除 | 2026-06-11，由所有者人工执行 |
| 新公开仓库创建时间 | 2026-06-11T15:39:31Z（GitHub API `createdAt`） |
| 新仓库名称 | `Ilyenkov-cn`（GitHub 显示名；Git URL 大小写不敏感，nested origin 配置为 `git@github.com:hoshF/ilyenkov-cn.git`） |
| 创建时状态 | `PUBLIC`，空仓库（`isEmpty: true`，无默认分支） |
| 首次公开提交 | `f17c1e1c233e7b89b67b802474ecacb633a966bf`（根提交，普通 push 创建 `main`） |
| 首次发布内容 | 79 个文件，全部为代码、说明、元数据和审计文档；获准再分发正文为 0 |
| 发布流水线 | `scripts/publish_public.sh "publish: initialize rights-gated public repository"`，Schema、manifest、18 项测试全部通过 |

远端树校验结果：

- `git diff --exit-code HEAD origin/main` 空差异，公开工作树 `status --porcelain` 为空。
- `git ls-remote origin` 显示 `refs/heads/main` 与本地 HEAD 同为 `f17c1e1c233e7b89b67b802474ecacb633a966bf`；提交对象内容寻址保证远端树与本地导出逐字一致。
- GitHub API：远端提交总数为 1；递归树 blob 计数 79，与本地导出 `included=79` 一致。
- 旧暴露 HEAD `3cc661b0baae7b9c279a9792a1bc4ad88f6ebe8c` 在新仓库查询返回 422 `No commit found`，不可达。

2026-06-12 追记：私有仓库由 `ilyenkov-cn-private` 改名为 `Ilyenkov-cn-private`；父仓库与 `dist/public` 的 `origin` URL 以及 `scripts/publish_public.sh` 中的仓库名统一为规范大小写（`hoshF/Ilyenkov-cn-private`、`hoshF/Ilyenkov-cn`），消除 push 时的仓库重定向提示。上表记录的小写 URL 为 2026-06-11 配置时的历史事实。

第三方缓存、下载、副本或存档仍可能存在；“曾公开”事实不因删除重建而消除。

## 旧公开提交完整路径清单

以下清单由 `git ls-tree -r --name-only 3cc661b0baae7b9c279a9792a1bc4ad88f6ebe8c` 生成，共 283 项。

- `.gitignore`
- `CONTRIBUTING.md`
- `README.md`
- `TRANSLATION_PLAN.md`
- `assets/images/ilyenkov-blog4.jpg`
- `caute_ru_markdown/README.md`
- `caute_ru_markdown/ilyenkov_md/already-done/dialectical_logic_ilyenkov_ru.md`
- `caute_ru_markdown/ilyenkov_md/already-done/dialectics_abstract_concrete_capital_ilyenkov_ru.md`
- `caute_ru_markdown/ilyenkov_md/already-done/lenin_and_dialectical_logic_ilyenkov_rosenthal_ru.md`
- `caute_ru_markdown/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-klub-filosofov-i-filosofy-v-klube.md`
- `caute_ru_markdown/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-muzhestvo-mysli.md`
- `caute_ru_markdown/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-pravo-na-tvorchestvo.md`
- `caute_ru_markdown/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-solo-dlya-aleshi.md`
- `caute_ru_markdown/ilyenkov_md/dialogi-i-intervyu/dialogi-i-intervyu-za-god-do-sovershennoletiya.md`
- `caute_ru_markdown/ilyenkov_md/dissertatsii-i-avtoreferaty/dissertatsii-i-avtoreferaty-avtoreferat-doktorskoi-dissertatsii.md`
- `caute_ru_markdown/ilyenkov_md/dissertatsii-i-avtoreferaty/dissertatsii-i-avtoreferaty-avtoreferat-kandidatskoi-dissertatsii.md`
- `caute_ru_markdown/ilyenkov_md/dissertatsii-i-avtoreferaty/dissertatsii-i-avtoreferaty-k-voprosu-o-prirode-myshleniya.md`
- `caute_ru_markdown/ilyenkov_md/dissertatsii-i-avtoreferaty/dissertatsii-i-avtoreferaty-nekotorye-voprosy-materialisticheskoi-dialektiki-v-rabote-k-ma.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-dialektika-esteticheskogo-kak-teoriya-chuvstvennogo-poznaniya.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-dialektika-i-germenevtika.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-dialektika-i-mirovozzrenie-2.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-dialektika-i-mirovozzrenie.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-dumat-myslit.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-gegel-i-problema-predmeta-logiki.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-k-otsenke-gegelevskoi-kontseptsii-otnosheniya-istiny-k-krasote.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-leninskaya-ideya-sovpadeniya-logiki-teorii-poznaniya-i-dialektiki.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-logicheskoe-i-istoricheskoe.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-mashina-i-chelovek-kibernetika-i-filosofiya.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-myshlenie-i-yazyk-u-gegelya-1974.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-o-materialnosti-soznaniya-i-o-transtsendentalnyh-koshkah.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-o-roli-protivorechiya-v-poznanii.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-o-vseobschem.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-ob-esteticheskoi-prirode-fantazii-2.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-ponyatie-abstraktnogo-idealnogo-obekta.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-problema-abstraktnogo-i-konkretnogo-v-svete-kapitala-marksa.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-problema-protivorechiya-v-logike.md`
- `caute_ru_markdown/ilyenkov_md/glavy-i-stati-v-knigah/glavy-i-stati-v-knigah-vopros-o-tozhdestve-myshleniya-i-bytiya-v-domarksistskoi-filosofii.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-dialekticheskaya-logika-ocherki-istorii-i-teorii-2.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-dialektika-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-myshlenii.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-filosofiya-i-kultura.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-iskusstvo-i-kommunisticheskii-ideal.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-leninskaya-dialektika-i-metafizika-pozitivizma.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-ob-idolah-i-idealah.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-shkola-dolzhna-uchit-myslit.md`
- `caute_ru_markdown/ilyenkov_md/knigi/knigi-uchites-myslit-smolodu.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-adskoe-plamya-i-ogon-mysli-otvet-ottsu-georgiyu.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-dumat.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-estetika-oruzhie-borby.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-gegel-i-sovremennost.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-gvardei-skie-minomety-vyhodyat-v-pole.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-mnogoznanie-umu-ne-nauchaet.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-moguchii-soyuznik-v-borbe-za-kommunizm.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-orudiya-proryva.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-u-miniatyur-poligona.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-v-shkole-serzhantov.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-velikii-gumanist.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-zanyatiya-po-strelkovo-artillerii-skoi-podgotovke.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/images/newspaper-znanie-i-myshlenie.jpg`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-adskoe-plamya-i-ogon-mysli-otvet-ottsu-georgiyu.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-dumat.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-estetika-oruzhie-borby.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-gegel-i-sovremennost.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-gvardei-skie-minomety-vyhodyat-v-pole.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-mnogoznanie-umu-ne-nauchaet.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-moguchii-soyuznik-v-borbe-za-kommunizm.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-orudiya-proryva.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-u-miniatyur-poligona.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-v-shkole-serzhantov.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-velikii-gumanist.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-zanyatiya-po-strelkovo-artillerii-skoi-podgotovke.md`
- `caute_ru_markdown/ilyenkov_md/newspaper/newspaper-znanie-i-myshlenie.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-g-lukach-ekonomicheskie-vzglyady-gegelya-v-ienskii-period.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-g-v-f-gegel-kto-myslit-abstraktno-2.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-g-v-f-gegel-kto-myslit-abstraktno.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-g-v-f-gegel-o-kartochnoi-igre.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-i-g-fihte-osnovy-estestvennogo-prava-soglasno-printsipam-naukoucheniya.md`
- `caute_ru_markdown/ilyenkov_md/perevody/perevody-k-marks-zametki-po-povodu-knigi-dzhemsa-millya.md`
- `caute_ru_markdown/ilyenkov_md/pisma/pisma-o-polozhenii-s-filosofiei-pismo-v-tsk-partii.md`
- `caute_ru_markdown/ilyenkov_md/pisma/pisma-pisma-s-fronta.md`
- `caute_ru_markdown/ilyenkov_md/pisma/pisma-yu-a-zhdanovu-2.md`
- `caute_ru_markdown/ilyenkov_md/pisma/pisma-yu-a-zhdanovu.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-dialekticheskaya-logika-v-ekonomicheskom-issledovanii.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-issledovanie-dialektiki-i-logiki-poznaniya.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-kniga-o-marksistskoi-estetike.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-mir-cheloveka.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-molodoi-gegel.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-obyknovennoe-chudo.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-pervyi-tom-istorii-filosofii.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-podlinnaya-populyarnost-soyuznitsa-strogoi-nauchnosti.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-predislovie-k-state-s-averintseva-pohvalnoe-slovo-filologii.md`
- `caute_ru_markdown/ilyenkov_md/retsenzii/retsenzii-vstupitelnoe-slovo-k-knige-p-s-zabotina-preodolenie-zabluzhdeniya-v-nauchnom-poz.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-chto-zhe-takoe-lichnost.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-k-dokladu-o-spinoze.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-k-dokladu-u-n-p-dubinina.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-k-ponyatiyu-telo-cheloveka-chelovecheskoe-telo.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-nauka-logiki.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-o-tak-nazyvaemoi-spetsifike-myshleniya-k-voprosu-o-pred.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-problema-edinstva-bytiya-i-myshleniya-v-antichnoi-filos.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-problema-predmetnosti-soznaniya.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-problema-protivorechiya-v-logike.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-psihika-i-mozg.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-psihologiya.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-spinoza-materialy-k-knige.md`
- `caute_ru_markdown/ilyenkov_md/rukopisi-i-stenogrammy-vystuplenii/rukopisi-i-stenogrammy-vystuplenii-u-istokov-filosofii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-abstraktsiya.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-dei-stvitelnost.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-edinichnoe.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-edinstvo.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-filosofiya.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-gegel-2.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-gegel.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-ideal-2.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-idealnoe.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-kapital-logika-kapitala.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-kolichestvo.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-konkretnoe.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-logicheskoe-i-istoricheskoe.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-subekt-i-obekt.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-vseobschee-2.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-vseobschee.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-vzaimodei-stvie.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-vzaimosvyaz.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-zabluzhdenie.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-aleksandr-ivanovich-mescheryakov-i-ego-pedagogika.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-dialektika-ili-eklektika-polemicheskie-zametki-o-maoistskom-ponimanii-i-.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-didaktika-i-dialektika.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-falsifikatsiya-marksistskoi-dialektiki-v-ugodu-maoistskoi-politike.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-gegel-i-germenevtika.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-k-istorii-voprosa-o-predmete-logiki-kak-nauki.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-k-voprosu-o-protivorechii-v-myshlenii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-materializm-voinstvuyuschii-znachit-dialekticheskii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-o-dialektike-abstraktnogo-i-konkretnogo-v-nauchno-teoreticheskom-poznani.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-o-voobrazhenii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-partii-naya-pozitsiya-teoretika.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-predmet-logiki-kak-nauki-v-novoi-filosofii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-problema-abstraktnogo-i-konkretnogo.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-problema-ideala-v-filosofii-i.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-problema-ideala-v-filosofii-ii.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-problema-idealnogo.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-psihika-cheloveka-pod-lupoi-vremeni.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-psihika-i-mozg-otvet-d-i-dubrovskomu.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-soobrazheniya-po-voprosu-ob-otnoshenii-myshleniya-i-yazyka-rechi.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-stanovlenie-lichnosti-k-itogam-nauchnogo-eksperimenta.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-tak-kto-zhe-myslit-abstraktno-neobrazovannyi-chelovek-a-vovse-ne-prosves.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-tri-veka-bessmertiya.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-truslivyi-nigilizm-geroicheskogo-pozitivista.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-tsentralnyi-vopros-dialektiki.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-v-i-lenin-i-aktualnye-problemy-dialekticheskoi-logiki.md`
- `caute_ru_markdown/ilyenkov_md/stati-v-zhurnalah/stati-v-zhurnalah-vydayuscheesya-dostizhenie-sovetskoi-nauki.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-istinna-li-klassicheskaya-definitsiya-istiny.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-kak-razlagalas-mysl.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-metamorfozy-idealnogo-i.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-metamorfozy-idealnogo-ii.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-o-dei-stvuyuschem-dele-i-protyazhennom-mestoimenii.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-o-myslyaschei-sebya-prirode-i-idealnoi-realnosti.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-o-myslyaschih-veschah-i-zharenyh-kvadratah.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-o-vulgarnyh-myslyah-tela.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-opredelit-cheloveka.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-polemika-o-kategorii-materialnogo.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-polemika-o-myslyaschem-tele.md`
- `caute_ru_markdown/maidansky_md/dialekticheskaya-logika/dialekticheskaya-logika-vesch-myslyaschaya-dusha-ili-prosto-telo.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-dekart-i-spinoza-o-prirode-dushi-myslyaschaya-substantsiya-ili-ideya-te.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-estetika-mihaila-lifshitsa-i-sovremennost.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-filosofskaya-antropologiya-strahova.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-geometricheskii-poryadok-dokazatelstva-i-logicheskii-metod-v-etike-spin.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-idealnoe-u-marksa-audit-prekrasnyh-tsitat.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-kategoriya-suschestvovaniya-v-etike-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-logicheskii-metod-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-o-deyatelnoi-storone-ucheniya-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-obektivnaya-teleologiya-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-ponyatie-istiny-v-dialekticheskoi-logike-ilenkova.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-ponyatie-myshleniya-u-ilenkova-i-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-principium-coexsistentiae-ili-istoriya-odnogo-snovideniya-magistra-imma.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-proishozhdenie-definitsii-u-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-realnost-kak-deyatelnost-ponyatie-praktiki-v-sovetskoi-filosofii.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-reforma-logiki-v-rabotah-r-dekarta-i-b-spinozy.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-russische-spinozisten-des-20-jahrhunderts.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-russkie-spinozisty.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-se-chelovek-odisseya-dvuh-definitsii.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-the-aesthetics-of-mikhail-lifshits-and-modernity.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-the-concept-of-truth-in-ilyenkov-s-dialectical-logic.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-the-reform-of-logic-in-descartes-s-and-spinoza-s-works.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-the-russian-spinozists.md`
- `caute_ru_markdown/maidansky_md/istoriya-filosofii/istoriya-filosofii-vygotskii-spinoza-dialog-skvoz-stoletiya.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-atomistika-i-problematika-chistogo-razuma-v-filosofii-anaksagora.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-dialektika-i-logika-geraklita.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-dve-kategorii-bytiya-v-srednevekovoi-filosofii.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-lektsiya-v-strukture-neyavnogo-znaniya.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-obschenie-opyt-logiko-semanticheskogo-analiza.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-uchenie-parmenida-o-bytii-v-istorii-logicheskogo-myshleniya.md`
- `caute_ru_markdown/maidansky_md/miniatyury/miniatyury-uchitsya-myslit.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-akademicheskii-plagiat.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-diagramma-filosofskoi-mysli.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-filosofskoe-rossievedenie-mysl-o-rossii-i-russkaya-mysl.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-illyuzii-osoznannogo-bytiya.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-problema-dokazatelstva-v-filosofii.md`
- `caute_ru_markdown/maidansky_md/retsenzii/retsenzii-razmyshleniya-o-naznachenii-filosofii.md`
- `caute_ru_markdown/maidansky_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-ilenkov-evald-vasilevich-novaya-rossii-skaya-entsiklopediya.md`
- `caute_ru_markdown/maidansky_md/stati-v-entsiklopediyah/stati-v-entsiklopediyah-ilenkov-evald-vasilevich-vikipediya.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-fenomenologiya-mirovoi-istorii-ot-gegelya-k-marksu.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-istoriya-i-obschestvennye-idealy.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-logika-i-fenomenologiya-vsemirnoi-istorii.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-logika-istoricheskoi-teorii-marksa-reformatsiya-formatsii.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-ne-otomre-t-s-sobaka-e-v-ilenkov-o-gosudarstve.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-prakticheskaya-istina-kommunisticheskih-utopii.md`
- `caute_ru_markdown/maidansky_md/teoriya-istorii/teoriya-istorii-vektory-i-kontury-obschestva-znanii.md`
- `caute_ru_markdown/metadata/ilyenkov_bulk_state.json`
- `caute_ru_markdown/metadata/ilyenkov_catalog_manifest.json`
- `caute_ru_markdown/metadata/ilyenkov_newspaper_ocr_state.json`
- `caute_ru_markdown/metadata/maidansky_bulk_state.json`
- `caute_ru_markdown/metadata/maidansky_catalog_manifest.json`
- `caute_ru_markdown/metadata/maidansky_pages_comparison.md`
- `caute_ru_markdown/scripts/audit_ilyenkov_directory_links.py`
- `caute_ru_markdown/scripts/audit_maidansky_links.py`
- `caute_ru_markdown/scripts/convert_ilyenkov_dla_to_md.py`
- `caute_ru_markdown/scripts/convert_ilyenkov_dmx_to_md.py`
- `caute_ru_markdown/scripts/convert_ilyenkov_leninacl_to_md.py`
- `caute_ru_markdown/scripts/ilyenkov_bulk_convert.py`
- `caute_ru_markdown/scripts/ilyenkov_common.py`
- `caute_ru_markdown/scripts/maidansky_bulk_convert.py`
- `caute_ru_markdown/scripts/ocr_ilyenkov_newspaper_images.py`
- `dialectical_logic/README.md`
- `dialectical_logic/dla/back.tex`
- `dialectical_logic/dla/front.tex`
- `dialectical_logic/dla/main.pdf`
- `dialectical_logic/dla/main.tex`
- `dialectical_logic/dla/part1/ch01.tex`
- `dialectical_logic/dla/part1/ch02.tex`
- `dialectical_logic/dla/part1/ch03.tex`
- `dialectical_logic/dla/part1/ch04.tex`
- `dialectical_logic/dla/part1/ch05.tex`
- `dialectical_logic/dla/part1/ch06.tex`
- `dialectical_logic/dla/part1/index.tex`
- `dialectical_logic/dla/part2/ch07.tex`
- `dialectical_logic/dla/part2/ch08.tex`
- `dialectical_logic/dla/part2/ch09.tex`
- `dialectical_logic/dla/part2/ch10.tex`
- `dialectical_logic/dla/part2/ch11.tex`
- `dialectical_logic/dla/part2/index.tex`
- `dialectical_logic/fetch_ilyenkov.py`
- `"dialectical_logic/ilyenkov_chapters/\345\274\225\350\250\200_\320\222\320\262\320\265\320\264\320\265\320\275\320\270\320\265.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25401\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\277\320\265\321\200\320\262\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25402\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\262\321\202\320\276\321\200\320\276\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25403\347\253\240_\320\236\321\207\320\265\321\200\320\272_\321\202\321\200\320\265\321\202\320\270\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25404\347\253\240_\320\236\321\207\320\265\321\200\320\272_\321\207\320\265\321\202\320\262\320\265\321\200\321\202\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25405\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\277\321\217\321\202\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25406\347\253\240_\320\236\321\207\320\265\321\200\320\272_\321\210\320\265\321\201\321\202\320\276\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25407\347\253\240_\320\236\321\207\320\265\321\200\320\272_\321\201\320\265\320\264\321\214\320\274\320\276\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25408\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\262\320\276\321\201\321\214\320\274\320\276\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25409\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\264\320\265\320\262\321\217\321\202\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25410\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\264\320\265\321\201\321\217\321\202\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\254\25411\347\253\240_\320\236\321\207\320\265\321\200\320\272_\320\276\320\264\320\270\320\275\320\275\320\260\320\264\321\206\320\260\321\202\321\213\320\271.txt"`
- `"dialectical_logic/ilyenkov_chapters/\347\273\223\350\257\255_\320\227\320\260\320\272\320\273\321\216\321\207\320\265\320\275\320\270\320\265.txt"`
- `existing_translations/README.md`
- `existing_translations/compiled_pdfs/dialectical_logic_1974_cn_project.pdf`
- `existing_translations/compiled_pdfs/idols_and_ideals_cn_project.pdf`
- `existing_translations/published_pdfs/abstract_and_concrete_in_marx_capital_alt_pdf.pdf`
- `existing_translations/published_pdfs/abstract_and_concrete_in_marx_capital_guo_tiemin_scan.pdf`
- `existing_translations/published_pdfs/dialectical_logic_history_and_theory_essays_cn_external.pdf`
- `existing_translations/published_pdfs/dialectical_logic_history_and_theory_review_cn.pdf`
- `existing_translations/published_pdfs/leninist_dialectics_and_empiricist_metaphysics_kong_luoto.pdf`
- `idols_ideals/README.md`
- `idols_ideals/ch01.tex`
- `idols_ideals/ch02.tex`
- `idols_ideals/ch03.tex`
- `idols_ideals/ch04.tex`
- `idols_ideals/ch05.tex`
- `idols_ideals/ch06.tex`
- `idols_ideals/ch07.tex`
- `idols_ideals/ch08.tex`
- `idols_ideals/ch09.tex`
- `idols_ideals/ch10.tex`
- `idols_ideals/ch11.tex`
- `idols_ideals/main.pdf`
- `idols_ideals/main.tex`
- `notes/READING_NOTES.md`
- `notes/STYLE_GUIDE.md`
- `notes/TERMS.md`
- `translation_workspace/README.md`
- `translation_workspace/drafts/README.md`
- `translation_workspace/latex_templates/README.md`
- `translation_workspace/planned/README.md`
- `translation_workspace/reviewed/README.md`

