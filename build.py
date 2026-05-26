#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py — FESTA CREW ENTRY SHEET のCSVから rendered.html を生成する。

使い方:
    python build.py <festa_csv_url> <master_csv_url>

- 縦持ちCSV（A列=キー / B列=値 / C列=ヒント）を読み、template.html の {{key}} を置換する。
- 値内の改行は <br> に、「…」は <span class="hl"> で自動強調する。
- 系統カードは系統マスターの色で COURSES_START〜END 内にループ生成する。
"""
import csv
import io
import os
import re
import sys

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, "template.html")
OUTPUT = os.path.join(HERE, "rendered.html")

DEFAULT_COURSE_COLOR = "#6b7280"  # 系統マスターに色が無い場合のデフォルト灰色

# 日本語キー → テンプレートのプレースホルダー名
KEY_MAP = {
    "メインタイトル1行目": "main_title_1",
    "メインタイトル2行目": "main_title_2",
    "リード文": "lead_text",
    "プログラム見出し": "program_heading",
    "プログラム本文": "program_body",
    "ポイント1": "point_1",
    "ポイント2": "point_2",
    "参加特典本文": "benefit_body",
    "会場写真URL": "venue_photo_url",
    "フロー概要": "flow_overview",
    "STEP1タイトル": "step1_title",
    "STEP1日付": "step1_date",
    "STEP1本文": "step1_body",
    "STEP1注記": "step1_note",
    "STEP2締切": "step2_deadline",
    "STEP2本文": "step2_body",
    "STEP3サブ": "step3_sub",
    "STEP3本文": "step3_body",
    "STEP4時期": "step4_period",
    "STEP4本文": "step4_body",
    "STEP5日時": "step5_datetime",
    "STEP5タイトル": "step5_title",
    "STEP5本文": "step5_body",
    "オンライン部室ラベル": "online_label",
    "オンライン部室タイトル": "online_title",
    "オンライン部室本文": "online_body",
    "本番日1行目": "final_date_1",
    "本番日2行目": "final_date_2",
    "本番見出し": "final_heading",
    "本番本文": "final_body",
    "STEP6写真URL": "final_photo_url",
    "進路セクションサブ": "course_overview",
    "おすすめ本文": "recommend_body",
    "参加方法本文": "join_method_body",
    "担当者名": "contact_name",
    "連絡先メール": "contact_email",
    "バージョン": "version",
}

COURSE_HEADER = "系統名（系統マスターから選択）"


# ---------------------------------------------------------------- CSV 取得
def fetch_csv(url):
    """URL から CSV を取得して行リスト（各行はセルのリスト）を返す。"""
    resp = requests.get(url, headers={"User-Agent": "festa-build/1.0"}, timeout=60)
    resp.raise_for_status()
    resp.encoding = "utf-8"
    text = resp.text
    text = text.lstrip("﻿").replace("\x00", "")  # BOM と 紛れ込んだNUL を除去
    head = text.lstrip()[:200].lower()
    if head.startswith("<!doctype html") or head.startswith("<html"):
        raise SystemExit(
            "ERROR: CSVではなくHTMLが返されました（共有設定やシート名を確認）: %s" % url
        )
    return list(csv.reader(io.StringIO(text)))


# ------------------------------------------------------------- パース処理
def parse_festa(rows):
    """フェスタCSVを (dict, courses) に分解する。courses は (系統名, 見出し, 説明文)。"""
    data = {}
    courses = []
    in_courses = False
    for row in rows:
        if not row:
            continue
        key = (row[0] if len(row) > 0 else "").strip()
        val = row[1] if len(row) > 1 else ""
        if key == COURSE_HEADER:        # ここから下は系統カード
            in_courses = True
            continue
        if in_courses:
            if not key or key.startswith("■"):
                continue
            ct = row[1] if len(row) > 1 else ""
            cd = row[2] if len(row) > 2 else ""
            courses.append((key, ct, cd))
            continue
        # 見出し・注釈・タイトル行はスキップ
        if (not key or key.startswith("■") or key.startswith("※")
                or key == "項目（キー）" or key.startswith("FESTA CREW ENTRY SHEET")):
            continue
        data[key] = val
    return data, courses


def parse_master(rows):
    """系統マスターCSVを 系統名→色コード のdictにする。"""
    colors = {}
    for row in rows:
        if not row:
            continue
        name = (row[0] if len(row) > 0 else "").strip()
        code = (row[2] if len(row) > 2 else "").strip()
        if (not name or name.startswith("※") or name == "系統名"
                or name.startswith("系統マスター")):
            continue
        colors[name] = code
    return colors


# ------------------------------------------------------------- 値の整形
def render_text(value):
    """プレーンテキストをHTML化: エスケープ → 改行を<br> → 「…」をハイライト。"""
    if value is None:
        return ""
    s = value.strip()
    if not s:
        return ""
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")
    s = re.sub(r"「([^」]*)」", r'<span class="hl">「\1」</span>', s)
    return s


def extract_drive_id(url):
    """Googleドライブ共有URLからファイルIDを抽出。/file/d/ID/ と ?id=ID の両形式。"""
    if not url:
        return None
    url = url.strip()
    m = re.search(r"/file/d/([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"[?&]id=([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    return None


def drive_thumb_url(file_id):
    return "https://drive.google.com/thumbnail?id=%s&sz=w1000" % file_id


def photo_html(url):
    """写真プレースホルダーの中身: 空ならヒント文、URLありなら画像。
    （.photo-placeholder の中に入る。サイズは index.html のCSSが面倒を見る）"""
    fid = extract_drive_id(url)
    if not fid:
        return '<span class="ph-hint">写真がここに入ります</span>'
    return ('<img src="%s" alt="" '
            'style="width:100%%;height:100%%;object-fit:cover;display:block">'
            % drive_thumb_url(fid))


def build_course_cards(courses, colors):
    """系統カードのHTMLを生成。A列が空の行はスキップ済み。"""
    cards = []
    for name, ct, cd in courses:
        color = colors.get(name) or DEFAULT_COURSE_COLOR
        cards.append(
            '      <div class="career-card">\n'
            '        <div class="tg" style="background:%s">%s</div>\n'
            '        <div class="ct">%s</div>\n'
            '        <div class="cd">%s</div>\n'
            '      </div>'
            % (color, render_text(name), render_text(ct), render_text(cd))
        )
    return "\n".join(cards)


# ------------------------------------------------------------------- main
def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: python build.py <festa_csv_url> <master_csv_url>")
    festa_url, master_url = sys.argv[1], sys.argv[2]

    data, courses = parse_festa(fetch_csv(festa_url))
    colors = parse_master(fetch_csv(master_url))

    html = open(TEMPLATE, encoding="utf-8").read()

    for jp_key, marker in KEY_MAP.items():
        value = data.get(jp_key, "")
        if marker in ("venue_photo_url", "final_photo_url"):
            rendered = photo_html(value)
        elif marker == "final_date_2":
            # 本番日2行目: 値があれば改行付き、空なら何も出さない（1日開催対応）
            r = render_text(value)
            rendered = ("<br>" + r) if r else ""
        elif marker == "version":
            rendered = render_text(value)
        else:
            rendered = render_text(value)
        html = html.replace("{{%s}}" % marker, rendered)

    cards = build_course_cards(courses, colors)
    html = html.replace(
        "<!--COURSES_START--><!--COURSES_END-->",
        "<!--COURSES_START-->\n%s\n      <!--COURSES_END-->" % cards,
    )

    leftover = re.findall(r"\{\{[a-z0-9_]+\}\}", html)
    if leftover:
        print("WARNING: 未置換のプレースホルダー: %s" % sorted(set(leftover)))

    open(OUTPUT, "w", encoding="utf-8").write(html)
    ver = data.get("バージョン", "").strip() or "(なし)"
    print("OK rendered.html を生成: version=%s, 系統カード=%d枚" % (ver, len(courses)))


if __name__ == "__main__":
    main()
