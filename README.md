# Ilyenkov Philosophy Text Archive

![Portrait of Evald Ilyenkov](assets/images/ilyenkov-portrait.jpg)

The Ilyenkov Philosophy Text Archive is a global, source-traceable project for collecting,
verifying, structuring, and digitizing original-language philosophical texts centered on Evald
Ilyenkov and his intellectual context.

The project has two mutually supporting long-term programs:

1. **Source-text digitization and research platform**: auditable, reproducible philosophical texts
   and metadata for preservation, search, digital humanities, multilingual study, and carefully
   bounded AI/LLM-assisted research.
2. **Chinese translation and close-reading program**: sustained translation, terminology research,
   and close reading focused first on Ilyenkov.

Related Soviet philosophers are translated selectively when required by that research. Source
figures such as Spinoza are developed primarily as original-language collections rather than being
promised comprehensive Chinese translation.

Markdown, manifests, and Git history are the textual facts of record. Scans, translations, research
materials, and derived indexes remain separate layers.

## Collections

| Person or collection | Current material | Role in the archive |
|---|---|---|
| Evald Ilyenkov / 伊里因科夫 | Russian books, articles, letters, interviews, manuscripts, and verified historical newspaper texts; Markdown is the main corpus format | Central collection |
| Andrey Maidansky / 迈丹斯基 | Research articles, source records, and files concerning Ilyenkov, Spinoza, and dialectics | Research and interpretation |
| Bonifaty Kedrov / 凯德洛夫 | Russian Markdown converted from genuine HTML plus unprocessed PDF/DjVu scans | Soviet dialectics and philosophy of science |
| Teodor Oizerman / 奥伊泽尔曼 | Bibliography, works registry, and unprocessed scans, including the four-volume *Теория познания* edited with Vladislav Lektorsky | Soviet history of philosophy and epistemology |
| Pavel Kopnin / 科普宁 | Works registry, source survey, and unprocessed scans | Dialectical logic, epistemology, and methodology |
| Baruch Spinoza / 斯宾诺莎 | Latin originals, historical translations, and textual witnesses | Major intellectual source for Ilyenkov |

Research entry points:

- [Collection status](COLLECTION_STATUS.md)
- [Ilyenkov and Maidansky Markdown archive](caute_ru_markdown/README.md)
- [Maidansky source archive](maidansky_markdown/README.md)
- [Spinoza text archive](spinoza_markdown/README.md)
- [Kedrov text archive](kedrov_markdown/README.md)
- [Oizerman archive](oizerman_markdown/README.md)
- [Kopnin archive](kopnin_markdown/README.md)

## How To Use The Archive

Files with similar extensions can have different scholarly roles:

- **Searchable Markdown text** lives under the registered corpus paths. For a long work, read its
  `README.md` and `work_manifest.json` before opening the required `*-chNNN.md` chapters.
- **Unprocessed scans** live under `source_scans/` or a documented historical scan path. A scan is
  evidence for an edition; it is not verified digital text.
- **Bibliographic and provenance metadata** lives under `metadata/`, `bibliography/`, and `notes/`.
- **Chinese translations and translation projects** live under `existing_translations/`,
  `dialectical_logic/`, `idols_ideals/`, and `translation_workspace/`.
- **LLM Wiki indexes** are reproducible derivatives. They do not replace Markdown, manifests, or
  Git history.

Before reading or citing a text, inspect its source URL, edition statement, `text_role`,
`text_status`, and rights fields. See [Corpus Resolver](RESOLVER.md) for routing rules and
[Collection Architecture](notes/COLLECTION_ARCHITECTURE.md) for adding a new person.

## Text And Source Principles

- Authorial originals, historical translations, modern translations, research, textual witnesses,
  AI references, and source scans must remain explicitly distinguished.
- The core corpus prefers the language in which the author wrote; translations do not replace it.
- Genuine HTML and structurally native EPUB may be converted to Markdown with provenance preserved.
- Freely downloadable PDF/DjVu files are stored first as unprocessed scans.
- The project does not currently initiate new OCR. OCR can enter the core corpus only after the
  approved page-level human verification process and manifest validation.
- Availability on the web does not imply permission to redistribute.

The authoritative rules are in
[Source, OCR Admission, and Publication Policy](notes/PHILOSOPHY_SOURCE_FORMAT_POLICY.md) and
[Scan Digitization Workflow](notes/SCAN_DIGITIZATION_WORKFLOW.md).

## Chinese Translation And Close Reading

Chinese translation, terminology research, and close reading are a long-term program built on the
source-text archive. Ilyenkov is the continuing priority. Translations must remain traceable to a
specific original-language file, version, source URL, and review status.

- `dialectical_logic/`: Chinese LaTeX project for the 1974 first edition of *Dialectical Logic*.
- `idols_ideals/`: Chinese LaTeX project for *On Idols and Ideals*.
- [`existing_translations/`](existing_translations/README.md): existing Chinese PDFs and project
  builds with differing source and review status.
- [`translation_workspace/`](translation_workspace/README.md): planned, draft, and reviewed work.
- [TRANSLATION_PLAN.md](TRANSLATION_PLAN.md): Chinese translation priorities and principles.

Bulk machine translation without human review is not accepted as a formal translation.

## Contributing

Global collaborators are welcome through issues, pull requests, and
[Discussions](https://github.com/hoshF/Ilyenkov-cn/discussions). Useful contributions include:

- bibliographic and edition verification;
- source discovery and rights evidence;
- collation, missing-page reports, and transcription corrections;
- multilingual terminology comparison and Chinese translation review;
- metadata, validation, search, and digital-humanities tooling.

Read [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md), and
[RIGHTS.md](RIGHTS.md) before submitting material.

## Sources And Acknowledgements

Much of the historical Ilyenkov collection originated from a `caute.ru` mirror. Andrey Maidansky
confirmed on June 17, 2026 that he no longer owns `caute.ru`. Current references to texts from his
website should use [filorus.ru/ilyenkov](http://filorus.ru/ilyenkov/) and add
`(at the website by Andrey Maidansky)` after the URL. The directory name `caute_ru_markdown/`
remains for path stability.

The archive is indebted to Andrey D. Maidansky's long-term work collecting, publishing, and
studying Ilyenkov and related philosophy. Each collection retains its own source URLs, manifests,
and attribution records.

## Citation

Use [`CITATION.cff`](CITATION.cff) for the archive-level citation. When citing a specific text, also
cite its original source, edition, provenance metadata, and applicable rights record. The citation
file does not replace the layered license boundaries in `LICENSE` and `RIGHTS.md`.

## Rights And Public Release

Project infrastructure, original documentation, and factual metadata are open by default:

- software and tooling: MIT;
- project-authored documentation: CC BY-SA 4.0;
- project-created factual metadata: CC0 1.0.

Third-party texts, translations, scans, and media retain their own rights status. Controlled files
are published only after an exact-path and SHA-256 review in `metadata/rights_registry.json`.
Public release occurs only through `scripts/publish_public.sh`; `llm_wiki_eligible` does not imply
redistribution or model-training permission.

See [LICENSE](LICENSE) and [RIGHTS.md](RIGHTS.md). Rightsholders may open an issue to request review
or removal.

## 中文摘要

本项目以伊里因科夫哲学为中心，面向全球建设可追溯的哲学原典数字化与研究平台，同时长期
推进以伊里因科夫为优先对象的中文翻译、术语研究和精读。公共协作入口以英文为主，但中文
翻译计划、术语表、阅读笔记和译文工程继续使用中文。

项目基础设施、原创文档和事实性元数据默认开放；第三方全文、译文、扫描件和媒体按具体文件
逐项审核权利状态与 SHA-256 后开放。公开不等于完成校勘，也不自动授予模型训练许可。
