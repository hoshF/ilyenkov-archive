---
title: "Ilyenkov Biography And Memoirs Source Survey"
created: "2026-07-09"
updated: "2026-07-10"
type: "analysis"
tags: ["ilyenkov", "biography", "memoirs", "source-metadata"]
language: "en"
collection: "corpus-metadata"
llm_wiki_eligible: "true"
gbrain_source: "project-markdown"
---

# Ilyenkov Biography And Memoirs Source Survey

This file records the repository status of biographical writing, memoirs, archive leads, and
secondary research centered on Evald Ilyenkov. It supplements
`ilyenkov_markdown/README.md` without changing the admission rules for Ilyenkov's own writings.

## Admission Rules

- Ilyenkov's own works remain under `ilyenkov_markdown/ilyenkov_md/`.
- Memoirs, biography, archival commentary, and person-centered research belong under
  `ilyenkov_markdown/ilyenkov_biography_md/`.
- These texts use `text_role: "research"` and must not be marked `author_original`.
- HTML body text may be converted to Markdown. PDF, DjVu, and image scans remain governed by the
  scan policy: do not read embedded text layers and do not run OCR unless the project owner
  explicitly activates digitization for a specific work.
- Rights and public redistribution require separate review. The default is
  `redistribution_approved: "false"`.

## Admitted Records

| Work | Status | Local record | Source |
|---|---|---|---|
| `Эвальд Васильевич Ильенков в воспоминаниях` | 24 HTML chapters converted to research Markdown | `ilyenkov_markdown/metadata/ilyenkov_biography_manifest.json` | [filorus contents](https://filorus.ru/ilyenkov/biog/rem/content.html) |
| Sergei Mareyev, `A philosopher under suspicion` | A World to Win HTML body converted to research Markdown; source chain reviewed, rights still unreviewed | `ilyenkov_markdown/metadata/ilyenkov_biography_manifest.json` | [A World to Win](https://www.aworldtowin.net/resources/Ilyenkov.html) |
| International Friends of Ilyenkov | Organization and project entry created; site articles were not batch-ingested | `ilyenkov_markdown/ilyenkov_biography_md/organizations/international-friends-of-ilyenkov.md` | [International Friends of Ilyenkov](https://ilyenkovfriends.org/) |

Bibliographic details for the 2004 memoir volume are recorded from the `filorus` landing page:
`М.: РГГУ, 2004`; editor-compiler Г.В. Лобастов; prepared by Философское общество
«Диалектика и культура». Listed contributors include Мареев С.Н., Майданский А.Д.,
Мареева Е.В., Сорокин А.А., and Новохатько А.Г.

## 2004 Memoir Contents

Item-level bibliography, review notes, controlled sensitive-topic flags, and local cross-references
are recorded in `ilyenkov_markdown/metadata/ilyenkov_memoir_annotations.json`. The memoir directory
also has a local `README.md` index for navigation; it is an index layer, not source text.

| No. | Author | Title | Pages |
|---:|---|---|---:|
| 1 | Лобастов Г.В. | О воспоминаниях (предисловие) | 3-6 |
| 2 | Салимова О.И. | Письмо Игорю Мануйлову | 7-10 |
| 3 | Суворов А.В. | Средоточие боли | 11-51 |
| 4 | Михайлов Ф.Т. | Опять о нем и про него | 52-79 |
| 5 | Науменко Л.К. | Об Эвальде Ильенкове, о времени и немного о себе | 80-112 |
| 6 | Зайдель Г. | Тридцать пять лет назад – воспоминания | 113-119 |
| 7 | Водолазов Г.Г. | Эвальд (штрихи к портрету) | 120-131 |
| 8 | Лифшиц М.А. | Памяти Эвальда Ильенкова | 132-135 |
| 9 | Лобастов Г.В. | На пути к Ильенкову | 136-164 |
| 10 | Полищук В. | Страждущий демон философа | 165-171 |
| 11 | Хамидов А. | Из памяти об Э.В. Ильенкове | 172-188 |
| 12 | Мареев С.М. | Начало и конец | 189-206 |
| 13 | Шимина А.Н. | Мои встречи с Э.В. Ильенковым | 207-210 |
| 14 | Косолапов Р.И. | Об Ильенкове: почти мемуары | 211-215 |
| 15 | Коровиков В.И. | Начало и первый погром | 216-223 |
| 16 | Потемкин А.В. | О «тайне черного ящика» | 224-228 |
| 17 | Левитин К. | Лучший путь к человеку | 229-239 |
| 18 | Ананченко А.Б. | Философия настоящего и будущего | 240-248 |
| 19 | Ванслов В.В. | О философе Э.В. Ильенкове | 249-260 |
| 20 | Лобастов Г.В. | Ильенков как философ | 261-274 |
| 21 | Межуев В.М. | Эвальд Ильенков и конец в России классической марксистской философии | 275-284 |
| 22 | Рихтер Г. | Несколько замечаний о восприятии философии Э.В. Ильенкова и культурно-исторической школы советской психологии в Германии | 285-296 |
| 23 | Никаноров С.П. | Носить подмышкой «Капитал»? | 297-301 |
| 24 | Лобастов Г.В. | Из истории Ильенковских чтений | 302-307 |

## 2024 Memoir Volume Bibliography-Only Record

On 2026-07-10, external metadata was checked for the later memoir anthology
`Образ Эвальда Ильенкова в воспоминаниях`. This is a bibliography-only lead. The project has not
admitted a local scan or full text for this volume, and no OCR or PDF text-layer extraction has
been performed.

| Field | Current record |
|---|---|
| Title | `Образ Эвальда Ильенкова в воспоминаниях` |
| Editor/compiler | Г.В. Лобастов is listed as author-compiler and responsible editor; WorldCat also records Философское общество "Диалектика и культура" as issuing body |
| Publication | Москва: `Русская панорама`, 2024 |
| Bibliographic details | 448 pages; hardback; print run 500; ISBN `978-5-93165-506-2`; Moscowbooks says the item has been listed for sale since 2023-12-28 |
| Availability | Print/bookstore, library-catalog, and review records located; the Moscowbooks record currently says the book is out of stock |
| Contents status | Review metadata describes a photo-album section, memoir and research materials, literary texts by Ilyenkov, and draft notes/fragments; exact item-level table of contents remains unverified |
| Review-identified names to verify | М.А. Лифшиц, Ф.Т. Михайлов, В.М. Межуев, Г. Зайдель, О.И. Салимова, Н.Н. Розанов, А.Г. Новохатько, А.А. Хамидов, А.В. Потёмкин, А.В. Суворов, Н.М. Гусева, Г.Г. Водолазов, Грета Соловьёва, С.Ю. Курганов, В.И. Коровиков, Р.И. Косолапов, А.В. Босенко, Г.В. Лобастов, Л.К. Науменко, С.Н. Мареев, А.Б. Ананченко, М.А. Предеина, М.М. Морозов |
| Rights status | No redistribution license or lawful complete digital text located; keep `redistribution_approved: "false"` and `rights_review_status: "unreviewed"` |
| Repository status | Track as `bibliography_only`; do not add to `ilyenkov_biography_manifest.json` unless an admissible source text is later found |

Checked sources: [Moscowbooks](https://www.moscowbooks.ru/book/1178423/),
[WorldCat](https://search.worldcat.org/title/Obraz-Evalda-Ilenkova-v-vospominaniyah/oclc/1506397168),
[Marxism & Sciences review](https://marxismandsciences.org/ilyenkovs-image-in-memoirs/), and
[Вопросы философии issue record](https://pq.iphras.ru/issue/view/546).

## Mareev, `Встреча с философом Э. Ильенковым`

On 2026-07-10, external bibliography and source leads were checked for S. N. Mareev's memoir
`Встреча с философом Э. Ильенковым`. This pass verifies bibliographic identity and source
availability only. The local PDF scan remains unprocessed; no OCR or PDF text-layer extraction has
been performed.

| Field | Current record |
|---|---|
| Author | Сергей Николаевич Мареев / S. N. Mareev |
| Author relation | Hrono identifies Mareev as a philosopher, doctor of philosophical sciences, professor, and student/associate of E. V. Ilyenkov |
| Work identity | Memoir and student account of Ilyenkov; title `Встреча с философом Э. Ильенковым` |
| First edition | Google Books records a 1994 edition by Tip. "Znanie"; Hrono also lists the 1994 edition |
| Second edition | Google Books records a 1997 version; journal references cite `2-е изд., доп. М.: Эребус, 1997` |
| Local scan status | Owner-provided 1997 PDF preserved as `source_scan_unprocessed`; its actual external source URL is still unverified |
| Public download leads | Koob/Klex pages list PDF/ZIP download routes via `phantastike.com`, but no authorization or redistribution license was found |
| Lawful-source status | No lawful complete digital source located; keep as `scan_only_unprocessed` and do not admit body text |
| Rights status | No redistribution license identified; keep `redistribution_approved: "false"` and `rights_review_status: "unreviewed"` |
| Next action | Locate a library/publisher record or rights-cleared source; if digitization is later activated, start from the registered scan workflow |

Checked sources: [Google Books 1994 record](https://books.google.com/books?id=A7kA0AEACAAJ),
[Google Books 1997 record](https://books.google.com/books?id=HtMxAAAAMAAJ),
[Hrono Mareev biography](https://hrono.ru/biograf/bio_m/mareevseni.php),
[RCSI journal article references](https://journals.rcsi.science/0869-5377/article/view/290216),
[Koob page](https://www.koob.ru/mareyev/vstrecha_s_filosofom_eh_v_ilenkovym), and
[Klex page](https://www.klex.ru/255n).

## Sergei Mareyev, `A philosopher under suspicion`

On 2026-07-10, the source chain and rights status were rechecked for the converted English profile
`A philosopher under suspicion`. The body text is already admitted as biography/research Markdown,
but this pass did not change source text and did not alter the manifest.

| Field | Current record |
|---|---|
| Author | Sergei Mareyev |
| Local path | `ilyenkov_markdown/ilyenkov_biography_md/research/sergei-mareyev/a-philosopher-under-suspicion.md` |
| Web source | A World to Win HTML page at `https://www.aworldtowin.net/resources/Ilyenkov.html` |
| Original publication claim | The A World to Win page says the profile first appeared in `Journal of Moscow State University`, Volume 7, No. 1, 1990; International Friends of Ilyenkov corroborates that Mareev gave the UK editors a photocopy of the 1990 article |
| English publication claim | The A World to Win page states first publication in `Socialist Future`, Summer 1996, Vol. 5 No. 1 |
| Translator | Angela Landon |
| Cross-posts and references | Marxismo Crítico reposts the same English text and repeats the A World to Win source claim; International Friends of Ilyenkov records the translation commission context |
| Rights status | No explicit reuse, redistribution, or translation license was found on the A World to Win page, the A World to Win site pages checked, or the repost; keep `rights_review_status: "unreviewed"` and `redistribution_approved: "false"` |
| Next action | Verify the exact Russian journal title and article title in the 1990 Moscow State University issue, and locate permission or rights-holder evidence for the English translation before any public redistribution |

Checked sources: [A World to Win page](https://www.aworldtowin.net/resources/Ilyenkov.html),
[International Friends of Ilyenkov tribute](https://ilyenkovfriends.org/2019/10/31/sergei-mareev-champion-of-ilyenkov-and-thinker-in-his-own-right/), and
[Marxismo Crítico repost](https://marxismocritico.com/2013/01/28/a-philosopher-under-suspicion/).

## Mareev Research Scans, 2008 And 2015

On 2026-07-10, two owner-provided Mareev research scans were checked at metadata level only. This
pass used external bibliographic and public-discovery pages; it did not read local PDF/DjVu text
layers, did not run OCR, did not change scan manifests, and did not admit body text to the
biography corpus.

| Work | Metadata-only result | Source and rights note |
|---|---|---|
| Мареев С.Н., `Э. В. Ильенков: жить философией` | Labirint verifies author Мареев Сергей Николаевич, publisher `Академический проект`, 2015, series `Технологии философии`, ISBNs `978-5-8291-1718-4` and `978-5-9049-5432-1`, and 327 printed pages. The local manifest keeps the owner-provided DjVu as 326 scan pages, which can remain a scan/page-count difference until separate visual review. | Klex lists public ZIP/DjVu/online routes via `phantastike.com`, but no authorization or redistribution license was found. Keep the local file as `source_scan_unprocessed`, with `rights_review_status: "unreviewed"` and `redistribution_approved: "false"`. |
| Мареев С.Н., `Из истории советской философии: Лукач, Выготский, Ильенков` | RSL verifies the title, author, Москва: `Культурная революция`, 2008, series `Æstetica`, ISBN `978-5-250-06035-6`, and 447 printed pages; the RSL record also marks a full online reading resource. The local manifest keeps the owner-provided PDF as 444 scan pages, which remains a page-count mismatch to verify later. | Klex lists public ZIP/DOC/HTML routes via `phantastike.com`. RSL access is an important official reading lead, but the repository still has no evidence that the owner-provided local PDF may be redistributed or converted. Keep as secondary research scan, not author-original corpus. |

Checked sources: [Labirint, `Э.В. Ильенков. Жить философией`](https://www.labirint.ru/books/465865/),
[Klex, `Э.В. Ильенков. Жить философией`](https://www.klex.ru/hwf),
[RSL, `Из истории советской философии`](https://search.rsl.ru/ru/record/01003816129), and
[Klex, `Из истории советской философии`](https://www.klex.ru/a9l).

## Mareev And Mareeva Research Scans, 2017 And Manifest-2020

On 2026-07-10, two additional Mareev/Mareeva research scans were checked at metadata level only.
This pass did not read local PDF text layers, did not run OCR, did not change scan manifests, and
did not admit body text to the biography corpus.

| Work | Metadata-only result | Source and rights note |
|---|---|---|
| Мареев С.Н., `Л. С. Выготский: философия, психология, искусство` | LiveLib and review/bibliography leads verify a 2017 `Академический проект` edition with ISBN `978-5-8291-1956-0`. Public repost/download leads also point to a 2020 `Академический проект`/`Философские технологии` version with 227 pages and ISBN `978-5-8291-3371-9`. The local manifest currently records publication year 2017 and 232 PDF pages, so the exact local edition and page-count relationship remain unresolved. | Klex lists public ZIP/DjVu/online routes via `phantastike.com`; the Phantastike DjVu response reports a 3,788,882-byte file, which does not match the local 32,116,538-byte PDF. No authorization or redistribution license was found. Keep the local PDF as `source_scan_unprocessed`, with `rights_review_status: "unreviewed"` and `redistribution_approved: "false"`. |
| Мареева Е.В.; Мареев С.Н., `Проблема мышления: созерцательный и деятельностный подход` | IPR SMART and Labirint verify a 2013 `Академический Проект` monograph with ISBN `978-5-8291-1455-8`; IPR records 281 pages and Labirint records the same ISBN for the bookstore item. The local manifest currently records publication year 2020 and 280 PDF pages, so the manifest year and exact local edition need later bibliographic review. | IPR records access for authorized users and a platform placement term, not a redistribution license. Klex lists public ZIP/PDF routes via `phantastike.com`; the Phantastike PDF response reports a 9,317,864-byte file, which does not match the local 2,024,874-byte PDF. Keep the local PDF as `source_scan_unprocessed`; do not treat the download route or IPR entry as permission to redistribute or convert. |

Checked sources: [LiveLib, `Л. С. Выготский`](https://www.livelib.ru/book/1002072620-l-s-vygotskij-filosofiya-psihologiya-iskusstvo-sergej-mareev),
[Klex, `Л.С. Выготский`](https://www.klex.ru/nw3),
[IPR SMART, `Проблема мышления`](https://www.iprbookshop.ru/36503.html),
[Labirint, `Проблема мышления`](https://www.labirint.ru/books/383144/), and
[Klex, `Проблема мышления`](https://www.klex.ru/hwg).

## English-Language Research Scans, 1991-2023

On 2026-07-10, the remaining owner-provided English-language Ilyenkov research scans were checked
at metadata level only. This pass used publisher, series, catalog, and rights-discovery pages; it
did not read local PDF text layers, did not run OCR, did not change scan manifests, and did not
admit body text to the biography corpus.

| Work | Metadata-only result | Source and rights note |
|---|---|---|
| David Bakhurst, `Consciousness and Revolution in Soviet Philosophy: From the Bolsheviks to Evald Ilyenkov` | Cambridge Core verifies Cambridge University Press, the `Modern European Philosophy` series, digital ISBN `9780511608940`, hardback ISBN `9780521385343`, paperback ISBN `9780521407106`, DOI `10.1017/CBO9780511608940`, and 1991/2009 print/digital publication context. The local manifest records 304 PDF scan pages; keep this as a scan count until a visual page-count review is activated. | Cambridge Core offers priced digital access and institutional login, not an open redistribution license. Public third-party PDF leads exist on the web but are not accepted as lawful sources. Keep the local file as `source_scan_unprocessed`, with `rights_review_status: "unreviewed"` and `redistribution_approved: "false"`. |
| Alex Levant and Vesa Oittinen, eds., `Dialectics of the Ideal: Evald Ilyenkov and Creative Soviet Marxism` | Brill verifies `Historical Materialism Book Series`, volume 60; copyright year 2014; PDF ISBN `978-90-04-24692-8`; hardback ISBN `978-90-04-23097-2`; DOI `10.1163/9789004246928`; and product pages `xii, 221 pp.`. The manifest records publication year 2014 and 236 PDF scan pages, so the page-count relationship remains a later review item. | Brill lists purchase/login/permissions routes and prices, not open access. Keep the local file as `source_scan_unprocessed`; do not infer redistribution permission from preview, catalog, or book-series pages. |
| Evald Ilyenkov, ed./trans. Evgeni V. Pavlov, `Intelligent Materialism: Essays on Hegel and Dialectics` | Historical Materialism verifies the book-series record, publication in November 2018, Evald Ilyenkov as author, and Evgeni V. Pavlov as editor/translator. Google Books verifies Brill, 26 November 2018, ISBN `9789004388253`, and 268 pages. The local manifest records 265 PDF scan pages, leaving the page-count relationship unresolved. | Marxists.org has individual translated article pages with permission notes from Brill/editor/translator, but those are item-level leads, not a blanket full-volume redistribution license. Keep the local PDF as `source_scan_unprocessed`; compare individual translated essays to Russian source paths and rights later. |
| David Bakhurst, `The Heart of the Matter: Ilyenkov, Vygotsky and the Courage of Thought` | Brill verifies `Historical Materialism Book Series`, volume 286; author David Bakhurst; copyright year 2023; PDF ISBN `978-90-04-54425-3`; hardback ISBN `978-90-04-32243-1`; DOI `10.1163/9789004544253`; and product pages `XII, 401 pp.`. The local manifest records 416 PDF scan pages, so the page-count relationship remains unresolved. | Brill lists purchase/login/permissions routes and prices, not open access. Keep as secondary biography/philosophy research scan, not admitted text. |
| Andrey Maidansky and Vesa Oittinen, eds., `The Practical Essence of Man: The Activity Approach in Late Soviet Philosophy` | Brill verifies `Historical Materialism Book Series`, volume 108; PDF ISBN `978-90-04-27314-6`; hardback ISBN `978-90-04-27313-9`; DOI `10.1163/9789004273146`; and product pages `vi, 204 pp.`. The local manifest records 210 PDF scan pages, which is broadly consistent with front matter plus numbered pages but still remains a scan count. | Brill lists purchase/login/permissions routes and prices, not open access. Keep as secondary research scan and activity-approach context; do not admit body text without a separate source and rights decision. |

Checked sources: [Cambridge Core, `Consciousness and Revolution in Soviet Philosophy`](https://www.cambridge.org/core/books/consciousness-and-revolution-in-soviet-philosophy/1607382A7DDF0D19069E4B9A351242CD),
[Brill, `Dialectics of the Ideal`](https://brill.com/abstract/title/21786),
[Historical Materialism, `Intelligent Materialism`](https://www.historicalmaterialism.org/book-series/intelligent-materialism-essays-on-hegel-and-dialectics/),
[Google Books, `Intelligent Materialism`](https://books.google.com/books/about/Intelligent_Materialism.html?id=_2d9DwAAQBAJ),
[Marxists.org example article from `Intelligent Materialism`](https://www.marxists.org/archive/ilyenkov/works/articles/subject-matter.htm),
[Brill, `The Heart of the Matter`](https://brill.com/abstract/title/33499), and
[Brill, `The Practical Essence of Man`](https://brill.com/abstract/title/25456).

## International Friends Of Ilyenkov Item-Level Discovery Leads

On 2026-07-10, the International Friends of Ilyenkov document archive and two closely related IFI
pages were checked at discovery level only. This pass records item-level leads and repository
handling decisions. It did not batch-ingest site text, did not change corpus source records, did
not run OCR, and did not admit any PDF body text to Markdown.

The IFI site is useful as a navigation and discovery hub, but it is not treated as a source of
record for the repository. Each item still needs separate source, version, role, and rights review
before any conversion or corpus admission.

| Item | Type | Current source facts | Repository handling |
|---|---|---|---|
| `Extracts from Idols and Ideals` | IFI-hosted translated PDF | IFI lists the work as written by Evald Ilyenkov in 1968, translated by Trevor Wilson, and published on the IFI site with Wilson's permission; the linked PDF has 44 pages | Treat as a translation lead, not an admitted source text. Verify the Russian base text, translation rights, and whether this duplicates or diverges from existing Ilyenkov records before any use. |
| `AI summary of On Idols and Ideals` | IFI-hosted AI summary PDF | IFI links a 6-page AI-generated summary beside the Trevor Wilson translation | Exclude from source corpus and bibliography of Ilyenkov writings. It may be cited only as a modern AI/reception artifact if a future research note needs it. |
| E. V. Ilyenkov and V. I. Korovikov, 1954 `Theses on the Question of the Interconnection of Philosophy and Knowledge of Nature and Society in the Process of their Historical Development` | Marxists.org PDF linked from IFI | IFI presents the theses as a 1954 Ilyenkov-Korovikov text, states that Elena Illesh discovered them in 2016, and links the Marxists.org English PDF. The PDF metadata says the translation is by David Bakhurst and notes first Russian publication in `Вопросы философии`, no. 4, 2020, pp. 97-115, with A. G. Novokhatko commentaries | High-priority archival text lead. Compare against the 2020 Russian publication and any local Ilyenkov/Korovikov records before admission; record political-sanction context separately from source-text metadata. |
| `Dialectical Logic` PDF | IFI-hosted study PDF | IFI links a 121-page PDF under texts being studied | Likely duplicates existing Ilyenkov work records. Do not ingest from IFI unless a later source comparison shows a corrected or distinct version worth recording. |
| `The Dialectics of the Abstract and the Concrete in Marx's Capital`, chapter 1 PDF | IFI-hosted study PDF | IFI links a corrected chapter PDF; the linked file has 48 pages | Treat as a study-group/version lead. Compare against existing local `Dialectics of the Abstract and the Concrete` records before any action. |
| `The Dialectics of the Abstract and the Concrete in Marx's Capital`, chapter 2 PDF | IFI-hosted study PDF | IFI links a corrected chapter PDF; the linked file has 27 pages | Treat as a study-group/version lead. Compare against existing local source records rather than creating a duplicate corpus path. |
| `The Dialectics of the Abstract and the Concrete in Marx's Capital`, chapter 3 PDF | IFI-hosted study PDF | IFI links a chapter PDF; the linked file has 44 pages | Treat as a study-group/version lead. Compare against existing local source records rather than creating a duplicate corpus path. |
| `The Dialectics of the Abstract and the Concrete in Marx's Capital`, chapter 4 PDF | IFI-hosted study PDF | IFI links a chapter PDF; the linked file has 18 pages | Treat as a study-group/version lead. Compare against existing local source records rather than creating a duplicate corpus path. |
| `The Dialectics of the Abstract and the Concrete in Marx's Capital`, chapter 5 PDF | IFI-hosted study PDF | IFI links a corrected chapter PDF; the linked file has 58 pages | Treat as a study-group/version lead. Compare against existing local source records rather than creating a duplicate corpus path. |
| `Discoveries in the Ilyenkov archive` | IFI post and transcript PDF | IFI records this as a Q&A with Andrey Maidansky from the 13 January 2022 IFI webinar, focused on discoveries in the archive belonging to Ilyenkov's daughter Elena Illesh; the transcript PDF has 6 pages | Keep as archive-discovery and Elena Illesh/Maidansky lead. Do not treat the post as source text for Ilyenkov's works; use it to identify items needing publication and rights checks. |
| Corinna Lotz, `Finding Evald Ilyenkov` | IFI booklet page and downloadable PDF | IFI records ISBN `978-1-916031-81-4`, 64 pages, 2019, and links a downloadable PDF | Treat as a secondary biography/reception-history lead. Verify author, publisher, rights, and whether a local bibliography-only record should be added before any conversion. |

Checked sources: [IFI Ilyenkov Texts](https://ilyenkovfriends.org/document-archive/),
[IFI, `Discoveries in the Ilyenkov archive`](https://ilyenkovfriends.org/2022/01/27/discoveries-in-the-ilyenkov-archive/),
[Marxists.org 1954 theses PDF](https://www.marxists.org/archive/ilyenkov/works/articles/Theses.pdf), and
[IFI, `Finding Evald Ilyenkov`](https://ilyenkovfriends.org/finding-evald-ilyenkov/).

## Follow-up Leads

| Work or source | Current status | Next action |
|---|---|---|
| `Образ Эвальда Ильенкова в воспоминаниях` (2024) | Bibliography-level metadata recorded; no acceptable full text or rights license located; exact item-level contents still unverified | Locate a table of contents, library copy, or publisher record; verify contributors and lawful digital availability |
| Мареев С.Н., `Встреча с философом Э. Ильенковым` | 1994 and 1997 editions bibliographically verified; public PDF/ZIP download leads found but rights unclear; no lawful complete digital source located | Keep as a corpus gap; locate a rights-cleared source or a library/publisher record before any digitization decision |
| Мареев С.Н., `Э. В. Ильенков: жить философией` | 2015 publication metadata verified; local DjVu remains an owner-provided unprocessed scan; public Klex/Phantastike routes found but rights unclear | Keep as a metadata-only scan lead until source, page count, and rights can be verified |
| Мареев С.Н., `Из истории советской философии: Лукач, Выготский, Ильенков` | 2008 RSL bibliographic record and full-reading lead located; local PDF remains owner-provided and unprocessed; Klex/Phantastike routes found but rights unclear | Use as a secondary research scan lead; verify page-count mismatch and do not admit body text without a separate source decision |
| Мареев С.Н., `Л. С. Выготский: философия, психология, искусство` | 2017 and 2020 edition/version leads found; local PDF source, exact edition, and page count remain unresolved; Klex/Phantastike routes found but rights unclear | Keep as a metadata-only Vygotsky/Ilyenkov context lead; verify exact local edition before any digitization decision |
| Мареева Е.В.; Мареев С.Н., `Проблема мышления: созерцательный и деятельностный подход` | 2013 publication metadata verified from IPR/Labirint, but manifest currently records 2020; local PDF source and edition remain unresolved; Klex/Phantastike routes found but rights unclear | Review manifest year/edition metadata later; do not admit body text without a separate source and rights decision |
| David Bakhurst, `Consciousness and Revolution in Soviet Philosophy` | Cambridge metadata verified; local PDF remains owner-provided and unprocessed; no redistribution license located | Keep as secondary research scan; do not use public third-party PDFs as accepted source records |
| Levant/Oittinen, `Dialectics of the Ideal` | Brill metadata verified; local PDF remains owner-provided and unprocessed; no open access or redistribution license located | Keep as Ilyenkov research/context scan; verify page-count relationship later |
| Ilyenkov/Pavlov, `Intelligent Materialism` | Historical Materialism and Google Books metadata verified; local PDF remains owner-provided and unprocessed; individual Marxists.org permission notes are item-level leads only | Compare individual translated essays to Russian source paths and rights; do not batch-ingest the full volume |
| David Bakhurst, `The Heart of the Matter` | Brill metadata verified; local PDF remains owner-provided and unprocessed; no open access or redistribution license located | Keep as secondary biography/philosophy scan; verify page-count relationship later |
| Maidansky/Oittinen, `The Practical Essence of Man` | Brill metadata verified; local PDF remains owner-provided and unprocessed; no open access or redistribution license located | Keep as activity-approach context scan; do not admit body text without a separate source and rights decision |
| Sergei Mareyev, `A philosopher under suspicion` | Converted to biography/research Markdown; 1990/1996 publication chain reviewed; translation and redistribution rights remain unreviewed | Verify exact Russian journal citation and locate translation/reuse permission evidence |
| Иллеш Е.Э. materials on `Дело Ильенкова` and related archive topics | Cited through external articles and secondary literature; the IFI 1954 theses lead now records Elena Illesh's archive-discovery role | Verify URLs, rights, versions, and build an item-level bibliography queue for Illesh-authored or Illesh-edited materials |
| International Friends of Ilyenkov document archive | Registered as a contemporary research and archive-discovery hub; item-level discovery table added for the main document archive and two related IFI pages | Continue item-by-item verification; do not batch-ingest site text and do not override repository source records |
| PsyJournals texts such as `К работе Мещерякова` | Already represented in `maidansky_markdown/metadata/psyjournals_manifest.json` | Distinguish Ilyenkov source text, Maidansky commentary, journal rights, and HTML/PDF provenance |

## Owner-provided Private Scans

On 2026-07-10, a set of owner-provided PDF/DjVu files related to Ilyenkov research,
Mareev/Mareeva, Vygotsky, and Maidansky/Oittinen was preserved as private unprocessed scans. They
are registered in `ilyenkov_markdown/metadata/source_scans_manifest.json`. The repository does not
read PDF/DjVu text layers, does not run OCR, does not send these files to GBrain, and does not treat
them as redistributable text. Project metadata records only repository-relative paths,
bibliographic data, page counts, byte counts, and SHA-256 hashes; original machine-local
acquisition paths are intentionally not recorded.

Metadata-only review status, 2026-07-10:

- Registered scan records: 10.
- Registered storage root: `source_scans/local_acquisitions/ilyenkov_research/`.
- Acquisition status: owner-provided local acquisitions.
- External source status: all records still use `owner_provided_external_source_unverified`.
- Processing status: no OCR, no PDF/DjVu embedded text-layer extraction, and no promotion to
  searchable Markdown.
- Duplicate cleanup: the 927,801-byte Mareev 2012 PDF copy was removed; the 1997 PDF scan remains.

| Item | Type | Current note | Next action |
|---|---|---|---|
| `Встреча с философом Э. Ильенковым`, Мареев С.Н., 1997 PDF | memoir/book scan | Preserved as `source_scan_unprocessed`; duplicate 2012 PDF removed; bibliographic identity verified, but the actual scan source and redistribution rights remain unverified | Find a lawful complete source or use only as a registered private scan pending separate digitization activation |
| `Э. В. Ильенков: жить философией`, Мареев С.Н., 2015 DjVu | biography/research scan | Preserved as `source_scan_unprocessed`; Labirint publication metadata checked; Klex/Phantastike routes found but rights unclear; local scan source remains unverified | Verify lawful source, contents, page-count difference, and rights |
| `Из истории советской философии: Лукач, Выготский, Ильенков`, Мареев С.Н., 2008 PDF | Soviet philosophy context scan | Preserved as `source_scan_unprocessed`; RSL bibliographic and reading-resource record checked; Klex/Phantastike routes found but rights unclear; local scan source remains unverified | Keep as secondary research scan, verify page-count mismatch, and do not treat as author-original corpus |
| `Dialectics of the Ideal: Evald Ilyenkov and Creative Soviet Marxism`, Levant/Oittinen eds., PDF | edited secondary research scan | Preserved as `source_scan_unprocessed`; Brill metadata checked; no open access or redistribution license located; page-count relationship remains unresolved | Keep as Ilyenkov research/context scan; verify page-count relationship later |
| `Intelligent Materialism`, Ilyenkov/Pavlov, 2018 PDF | translated Ilyenkov/research volume scan | Preserved as `source_scan_unprocessed`; Historical Materialism and Google Books metadata checked; individual Marxists.org permission notes found only as item-level leads; page-count relationship remains unresolved | Compare item-by-item against Russian sources and translation rights; do not batch-ingest |
| `The Heart of the Matter`, David Bakhurst, 2023 PDF | biography/philosophical study scan | Preserved as `source_scan_unprocessed`; Brill metadata checked; no open access or redistribution license located; page-count relationship remains unresolved | Use as secondary bibliography and later review candidate |
| `Consciousness and Revolution in Soviet Philosophy`, David Bakhurst, PDF | Soviet philosophy study scan | Preserved as `source_scan_unprocessed`; Cambridge metadata checked; no open redistribution license located | Use as Ilyenkov/Vygotsky/Soviet philosophy context; do not use third-party public PDFs as accepted source records |
| `The Practical Essence of Man`, Maidansky/Oittinen eds., PDF | edited secondary research scan | Preserved as `source_scan_unprocessed`; Brill metadata checked; no open access or redistribution license located; manifest scan pages broadly match front matter plus numbered pages | Use as activity-approach and Ilyenkov-network context |
| `Л. С. Выготский: философия, психология, искусство`, Мареев С.Н., PDF | Vygotsky/Mareev research scan | Preserved as `source_scan_unprocessed`; 2017 and 2020 edition/version leads found; Klex/Phantastike routes found but rights unclear; local PDF does not match the checked Phantastike DjVu size | Use as Vygotsky and Ilyenkov-adjacent intellectual context; verify exact local edition and page count before any digitization decision |
| `Проблема мышления: созерцательный и деятельностный подход`, Мареева Е.В. and Мареев С.Н., PDF | Mareeva/Mareev research scan | Preserved as `source_scan_unprocessed`; IPR/Labirint point to 2013 publication metadata, while manifest currently records 2020; Klex/Phantastike routes found but rights unclear; local PDF does not match the checked Phantastike PDF size | Use as activity-approach and theory-of-thinking context; review manifest year/edition metadata later |

## Next Work

- Continue external bibliography and rights verification for the 2024 memoir volume, Mareev books,
  Elena Illesh archive-related materials, and International Friends of Ilyenkov item-level leads.
- Link new external memoir, biography, and archive leads back to existing Ilyenkov source paths
  without duplicating Ilyenkov's own writings.
- Continue targeted human review of the 2004 memoir conversion. The first discovered ch004
  footnote/page-break issue was repaired on 2026-07-10, but the volume is still marked
  `html_conversion_unverified` until a fuller review pass is completed.
