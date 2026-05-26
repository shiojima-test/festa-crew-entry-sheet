#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_pdf.py — rendered.html を A4・1ページのPDFに変換する。

- @fontsource の Noto Sans JP / M PLUS 1p（npm install 済み）の @font-face を
  page.add_style_tag で注入する。url() はローカルファイルを指すので、Chromium が
  実際に使うグリフだけを読み込み、PDFへ埋め込む（＝自己完結したPDFになる）。
- @page{size:210mm 297mm;margin:0} で出力し、pypdf でA4・1ページを検証する。
- 出力ファイル名は rendered.html 内の version を含む（例 FESTA_CREW_ENTRY_SHEET_v6.2.pdf）。
"""
import os
import re
import sys

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = os.path.join(HERE, "node_modules", "@fontsource")

# CSSで使われている重み。@fontsource にあるものだけ注入する。
FONTS = [
    ("noto-sans-jp", [400, 500, 700, 800, 900]),
    ("m-plus-1p", [400, 500, 700, 800, 900]),
]

A4_W_PT = 210 / 25.4 * 72   # 595.276
A4_H_PT = 297 / 25.4 * 72   # 841.890
TOL_PT = 3.0


def build_font_css():
    """@fontsource の各重みCSSを読み、url(./files/...) を絶対file://に書き換えて結合。"""
    blocks = ["@page { size: 210mm 297mm; margin: 0; }"]
    found = 0
    for pkg, weights in FONTS:
        files_dir = os.path.join(NODE_MODULES, pkg, "files")
        for w in weights:
            css_path = os.path.join(NODE_MODULES, pkg, "%d.css" % w)
            if not os.path.exists(css_path):
                continue
            css = open(css_path, encoding="utf-8").read()
            css = css.replace("url(./files/", "url(file://%s/" % files_dir)
            blocks.append(css)
            found += 1
    if found == 0:
        raise SystemExit(
            "ERROR: @fontsource のフォントCSSが見つかりません。`npm install` を実行してください。"
        )
    return "\n".join(blocks)


def extract_version(html):
    m = re.search(r'<div class="version">(.*?)</div>', html, re.S)
    ver = (m.group(1).strip() if m else "")
    return ver


def safe_version(ver):
    if not ver:
        return "v_draft"
    # ファイル名に使えない文字を除去
    s = re.sub(r'[\\/:*?"<>|\s]+', "_", ver.strip())
    return s or "v_draft"


def main():
    rendered = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "rendered.html")
    out_dir = sys.argv[2] if len(sys.argv) > 2 else HERE
    rendered = os.path.abspath(rendered)
    if not os.path.exists(rendered):
        raise SystemExit("ERROR: rendered.html がありません: %s" % rendered)

    html = open(rendered, encoding="utf-8").read()
    version = extract_version(html)
    out_name = "FESTA_CREW_ENTRY_SHEET_%s.pdf" % safe_version(version)
    out_path = os.path.join(out_dir, out_name)

    font_css = build_font_css()

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("file://" + rendered, wait_until="networkidle")
        page.add_style_tag(content=font_css)
        # フォントの読み込み完了を待つ
        page.evaluate("() => document.fonts.ready")
        page.emulate_media(media="print")
        page.pdf(
            path=out_path,
            width="210mm",
            height="297mm",
            margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            print_background=True,
            prefer_css_page_size=True,
        )
        browser.close()

    # --- pypdf で検証 ---
    reader = PdfReader(out_path)
    n = len(reader.pages)
    box = reader.pages[0].mediabox
    w_pt, h_pt = float(box.width), float(box.height)
    ok_size = abs(w_pt - A4_W_PT) <= TOL_PT and abs(h_pt - A4_H_PT) <= TOL_PT
    ok_pages = (n == 1)

    print("OK PDF: %s" % out_path)
    print("  version=%s, pages=%d, size=%.1f x %.1f pt (%.1f x %.1f mm)"
          % (version or "(なし)", n, w_pt, h_pt, w_pt / 72 * 25.4, h_pt / 72 * 25.4))
    if not ok_size:
        print("  WARNING: A4(595.3x841.9pt)から外れています")
    if not ok_pages:
        print("  WARNING: 1ページではありません（%dページ）" % n)
    if not (ok_size and ok_pages):
        sys.exit(2)


if __name__ == "__main__":
    main()
