---
title: "项目标准出版模板"
created: "2026-07-30"
updated: "2026-07-30"
type: "project"
tags: ["book", "template", "typesetting"]
language: "zh"
collection: "book-template"
llm_wiki_eligible: "false"
gbrain_source: "project-markdown"
---
# 项目标准出版模板

本目录是项目出版书籍系列的**唯一版式权威**。三个文件：

| 文件 | 作用 |
|---|---|
| `main.tex` | 主文件：开本、节标题、目录、版本页、正文装配。含占位符。 |
| `preamble.tex` | 公共导言：字体、强调、脚注、书眉、章题命令。与具体书目无关。 |
| `book-font.ttf` | 正文字体（合并产物，见下）。 |

系列里**每本书各有一份校阅记录**（本书是 [`../REVIEW_LOG.md`](../REVIEW_LOG.md)）：
成书后发现的问题记在那里，攒够一批再改再编译，定位用锚点而非页码。

配套读物：[TYPESETTING.md](TYPESETTING.md)——成书时会踩的坑与验证办法，**动版式之前先读**。

## 不要做的事

- **不要把版式设置复制到别处。** 此前版式同时存在于 `scripts/build_book.py` 的内嵌常量、
  `book/sample/preamble.tex`、以及两个 `book/template/*/` 副本里，四处互相走样：模板那份
  缺了半年的修正，谁都不知道哪份是真的。现在只有本目录这两个 `.tex`。
- **不要改 `book/build/`。** 那是生成物，每次构建覆盖。
- **不要在 `preamble.tex` 里写书名、作者、版次。** 那些是单本书的信息，见下。

## 单本书的信息怎么给

`main.tex` 里形如 `百分号百分号NAME百分号百分号` 的记号是占位符，由
`scripts/build_book.py` 顶部的 `BOOK` 表填入：

| 占位符 | 内容 | 例 |
|---|---|---|
| `PDFTITLE` | PDF 元数据标题，纯文本 | `科学理论思维中抽象与具体的辩证法` |
| `PDFAUTHOR` | PDF 元数据作者，纯文本 | `埃·瓦·伊里因科夫` |
| `BOOKTITLE` | 版本页书名，可含换行命令 | `科学理论思维中\\[0.5ex]抽象与具体的辩证法` |
| `BOOKAUTHOR` | 版本页作者行 | `〔苏〕埃·瓦·伊里因科夫\quad 著` |
| `BOOKEDITION` | 版次说明，可为空 | `据 1997 年俄文完整版译出` |
| `BOOKSTATUS` | 校订状态，可为空 | `（草稿本：底本尚未与纸本核对）` |
| `APPARATUS` `FRONT` `BODY` | 前后材料与正文的 `\input` 序列，由脚本装配 | — |

版本号、commit、日期由脚本从 git 刻进 `version.tex`，覆盖 `preamble.tex` 末尾的兜底宏。
`preamble.tex` 里那几个默认值只在单独试排一章、没有 `version.tex` 时起作用。

## 版式参数

各项均以所有者提供的参考页实测对齐，改动前请先读 TYPESETTING.md 的量法一节。

| 项 | 值 | 出处 |
|---|---|---|
| 开本 | 130×184mm（小 32 开） | `main.tex` `\geometry` |
| 版心 | 宽 101.9mm、高 148.6mm，满行 28 字 | 同上；**宽度直接给定**，不靠 inner/outer 相减 |
| 正文 | 五号（10.5pt） | `documentclass` 的 `zihao=5` |
| 行距 | 1.225 倍（≈1.47×字号） | `main.tex` `\linespread` |
| 汉字字距 | −0.015em（自然字距 0.985em） | `main.tex` 的 `CJKglue`，**必须在 `\begin{document}` 之后** |
| 段距 | 刚性 0pt，配 `\raggedbottom` | `main.tex`；弹性段距会浮动，见 TYPESETTING.md |
| 脚注 | 六号，每页重编；**两处都用圈数字**——正文标记作上标，脚注行标号落基线、与注文同字号（照参考本） | `preamble.tex` |
| 节标题 | 黑体小四居中，行宽收窄至版心 0.80 | `main.tex` `\booksectionformat` |
| 强调 | 黑体中黑（Heiti SC **Medium**） | `preamble.tex` `\bookemphfont` |
| 署名与著录 | 楷体，**不加粗** | `preamble.tex` `\footnoteemph`／`\bookapparatus`；判据在 `md_to_latex.is_apparatus` |
| 拉丁与数字 | Times New Roman | `preamble.tex` `\setmainfont` |
| 书眉 | 单线，章名居偶数页、节名居奇数页 | `preamble.tex` |

## 字体

`book-font.ttf` 由 `scripts/merge_cyrillic_font.py` 生成：以商业中文字体为底，并入
PT Serif 的西里尔字形与底体缺失的拉丁字母及标点。

为什么必须合并：中文字体的西里尔通常是**全角**的（1.000 em，与汉字等宽），直接排会把
«ценность» 拉成「ц е н н о с т ь」。只改字符类无用——字形本身就那么宽。

**缩放系数按 x 高对齐算，不是按 upm 归一化。** 两者可能相差两成以上；取错不报错、
不缺字，只是俄文明显偏大。换底体后须重跑该脚本，并核一遍全书字符覆盖（脚本会报缺什么）。

**这个文件不可对外分发**：它含有商业中文字体的字形。`scripts/export_public.py` 已把字体
后缀列为受控类，未在权利登记里批准的字体不会进入公开导出。

## 编译

```bash
python3 scripts/build_book.py
```

脚本会把本目录的字体与导言复制进 `book/build/`，读 `main.tex` 填占位符，逐单元生成 tex，
跑两遍 xelatex，并报告页数与缺字形数。缺字形必须是 0。
