#!/usr/bin/env python3
"""把西里尔字形（及底体缺失的拉丁字母与标点）并入正文字体，生成成书用的字库。

**为什么需要：中文字体的西里尔通常是全角的。** 实测 1.000 em，与汉字等宽，而同一字体的
拉丁 n 不到 0.5 em。直接排会把 «ценность» 拉成「ц е н н о с т ь」。只改字符类无用——
字形本身就那么宽。

排版时用 `\\cyr{…}` 临时换字体也能解决，但那要求转换器逐处包裹；并进字库后，字体在正文、
书眉、目录、脚注里行为一致，转换器不必再管。

除西里尔外，本脚本还补入底体**缺失**的拉丁字母与通用标点（只补缺的，不动它本来就有的）。
现用底体缺 ä、Ö（德文书名与人名用得到）与 –（构建时用来替换底本的不折行连字符 U+2011），
不补就会缺字形。

**缩放系数是这件事唯一容易做错的地方。** fontspec 的 `Scale=MatchLowercase` 做的不是 upm
换算，而是把来源字体的 x 高压到与目标字体相等。本脚本照此计算（目标 x 高 ÷ 来源 x 高，
两者都按各自 upm 归一化），所以并入后的渲染结果与 `\\cyr{…}` 方案逐像素相同。
若误按 upm 归一化，**差额可达两成以上**（现用底体 upm 只有 256，两种算法相差 21%）——
不报错、不缺字，只是某天翻到会觉得俄文偏大。

换底体后必须重跑本脚本，并核一遍全书字符覆盖：脚本会报补入了多少、还缺什么。

许可提醒：合并产物同时含有商业中文字体与来源字体的字形，**通常不可再分发**。
`scripts/export_public.py` 已把字体后缀列为受控类。本脚本只生成本地构建用的文件。

用法（底体是所有者提供的商业中文字体，产物即模板要用的那个字库）：
    python3 scripts/merge_cyrillic_font.py \\
        --base /path/to/中文底体.ttf \\
        --donor "$(fc-match -f '%{file}' 'PT Serif:style=Regular')" \\
        --out book/template/book-font.ttf
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    from fontTools.misc.transform import Scale
except ImportError:  # pragma: no cover
    sys.exit("需要 fontTools：python3 -m venv env && env/bin/pip install fonttools")

CYRILLIC = range(0x0400, 0x0500)
# 底体若缺这些字符，一并从来源字体补入（**只补缺的，不动它本来就有的**）：
#   00C0–017F 带附加符的拉丁——方正书宋简体缺 ä、Ö，德文书名 Beiträge 与
#             人名 Schottländer 用得到；
#   2000–206F 通用标点——该体缺 –（U+2013），而 build_book.py 正是用它替换
#             底本里的不折行连字符 U+2011。
LATIN_FILL = list(range(0x00C0, 0x0180)) + list(range(0x2000, 0x2070))


def x_height(path: str, index: int) -> tuple[float, int]:
    """'x' 字形的实测高度（绝对单位）与 upm。不取 OS/2.sxHeight——它常缺或为 0。

    **必须另开一个 TTFont 实例来量。** 在待改的那个实例上调用 getGlyphSet()
    会留下缓存，保存时 hmtx 认不出后来并入的字形（KeyError）。
    """
    font = TTFont(path, fontNumber=index)
    upm = font["head"].unitsPerEm
    glyphs = font.getGlyphSet()
    pen = BoundsPen(glyphs)
    glyphs[font.getBestCmap()[ord("x")]].draw(pen)
    return pen.bounds[3], upm


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True, help="正文混合字体（被改的那个）")
    ap.add_argument("--donor", required=True, help="西里尔来源字体")
    ap.add_argument("--out", required=True)
    ap.add_argument("--base-index", type=int, default=0)
    ap.add_argument("--donor-index", type=int, default=0)
    ap.add_argument("--scale", type=float, default=None,
                    help="覆盖自动算出的缩放系数（默认按 x 高对齐）")
    args = ap.parse_args()

    base_xh, base_upm = x_height(args.base, args.base_index)
    donor_xh, donor_upm = x_height(args.donor, args.donor_index)
    # 来源字形放大 scale 倍后，x 高应正好等于目标字体的 x 高（都用绝对单位）
    scale = args.scale if args.scale is not None else base_xh / donor_xh
    print(f"base  upm={base_upm}  x 高={base_xh} ({base_xh/base_upm:.4f} em)")
    print(f"donor upm={donor_upm}  x 高={donor_xh} ({donor_xh/donor_upm:.4f} em)")
    print(f"缩放系数 = {scale:.4f}"
          f"（按 upm 归一化会是 {base_upm/donor_upm:.4f}，相差 "
          f"{abs(scale-base_upm/donor_upm)/(base_upm/donor_upm)*100:.1f}%）")

    base = TTFont(args.base, fontNumber=args.base_index)
    donor = TTFont(args.donor, fontNumber=args.donor_index)
    if "glyf" not in base or "glyf" not in donor:
        return print("两款字体都必须是 TrueType 轮廓（glyf）") or 1

    donor_cmap = donor.getBestCmap()
    donor_glyphs = donor.getGlyphSet()
    base_cmap = base.getBestCmap()
    base_cmap_tables = [t for t in base["cmap"].tables if t.isUnicode()]
    glyf, hmtx = base["glyf"], base["hmtx"]
    # 中文字体带竖排度量；新字形若不补 vmtx，保存出的表会短一截，
    # 再打开就报「not enough 'vmtx' table data」。本书不竖排，取值只需合法：
    # 沿用该码位原有字形的竖排度量，没有就用拉丁 'n' 的。
    vmtx = base["vmtx"] if "vmtx" in base else None
    vmtx_fallback = vmtx[base_cmap[ord("n")]] if vmtx else None
    # 必须取副本：getGlyphOrder() 返回的是字体自己那个列表，就地追加再交回
    # setGlyphOrder()，hmtx 在保存时会认不出新字形（KeyError）。
    order = list(base.getGlyphOrder())

    added = replaced = 0
    # 西里尔一律替换（底体的是全角）；拉丁只补底体没有的，不动它本来就有的。
    # **这份名单必须在循环前定下**：getBestCmap() 返回的就是 cmap 表本身，
    # 循环里改 table.cmap 会把它一起改掉，事后再数就成了 0。
    latin_todo = [cp for cp in LATIN_FILL if cp not in base_cmap and cp in donor_cmap]
    targets = list(CYRILLIC) + latin_todo
    for cp in targets:
        name = donor_cmap.get(cp)
        if name is None:
            continue
        new_name = f"cyrmerge.uni{cp:04X}"
        # ё、й 一类是复合字形，直接搬会引用来源字体里的部件名——先分解成轮廓
        record = DecomposingRecordingPen(donor_glyphs)
        donor_glyphs[name].draw(record)
        pen = TTGlyphPen(None)
        record.replay(TransformPen(pen, Scale(scale, scale)))
        glyf[new_name] = pen.glyph()
        hmtx[new_name] = (round(donor["hmtx"][name][0] * scale),
                          round(donor["hmtx"][name][1] * scale))
        if vmtx is not None:
            old = base_cmap.get(cp)
            vmtx[new_name] = vmtx[old] if old in vmtx.metrics else vmtx_fallback
        if new_name not in order:
            order.append(new_name)
            added += 1
        for table in base_cmap_tables:
            if cp in table.cmap:
                replaced += 1
            table.cmap[cp] = new_name

    base.setGlyphOrder(order)
    base["maxp"].numGlyphs = len(order)
    base.save(args.out)
    print(f"并入 {added} 个字形（西里尔 {added - len(latin_todo)}，"
          f"补缺的拉丁 {len(latin_todo)}）→ {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
