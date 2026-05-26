# FESTA CREW ENTRY SHEET — CSV → PDF 自動生成

Google スプレッドシート（gviz CSV）から、A4・1ページの募集フライヤーPDFを生成する仕組み。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | デザインの唯一の正（プレビュー用に保持） |
| `template.html` | `index.html` の差し込み箇所を `{{key}}` 化したテンプレート |
| `build.py` | CSVを読み、`template.html` → `rendered.html` を生成 |
| `make_pdf.py` | `rendered.html` → PDF（フォント埋め込み・A4検証） |
| `.github/workflows/generate-pdf.yml` | 手動実行（workflow_dispatch）でPDFを成果物化 |

## ローカル実行

```bash
pip install -r requirements.txt
python -m playwright install chromium
npm install                       # @fontsource フォント

python build.py "<festa_csv_url>" "<master_csv_url>"
python make_pdf.py                # → FESTA_CREW_ENTRY_SHEET_<version>.pdf
```

## GitHub Actions

Actions → **Generate FESTA PDF** → Run workflow で `festa_csv_url` と
`master_csv_url` を入力。生成PDFは成果物（Artifacts）からダウンロード。

## CSV URL の作り方（重要）

gviz の `sheet=` は **タブ名と完全一致**する必要がある（部分一致しない）。一致しないと
**先頭タブにフォールバック**して別データになるので注意。タブ名に全角・スペースを含む場合は
URLエンコードする。

```
https://docs.google.com/spreadsheets/d/<KEY>/gviz/tq?tqx=out:csv&sheet=<URLエンコードしたタブ名>
```

現スプレッドシートの実タブ名:
`① 埼スタ天然芝フェスタ` / `カインズ東大阪店` / `カインズ交野店` / `系統マスター`

## 仕様メモ

- 値内の改行は `<br>`、`「…」` は自動でピンクハイライト（`.hl`）。
  それ以外の素の太字（例: 「修了書を発行」）は現状プレーン表示。
- 写真URL（会場/本番）は空ならプレースホルダー、Driveの共有URLなら
  `drive.google.com/thumbnail` 画像に差し替え。
- 本番日2行目が空なら1日開催として1行表示（レイアウト維持）。
- 系統カードは入力された系統だけ生成。色は系統マスター準拠、未登録/空はデフォルト灰色。
- **QRコード**（`QRコードURL`）: 右下のQRをこのURLから毎回動的生成（`qrcode`、誤り訂正M、border=2）。
  空欄なら既定URL `https://fox.schoomy.com/` のQRを表示。`template.html` の `{{qr_image}}` に差し込む。
- **主催企業**（`主催企業`）: CONTACT行の上に「主催 〇〇」の帯を表示（CONTACT行と同じ右寄せ体裁）。
  複数なら「・」区切り。空欄なら帯ごと非表示（`{{HOST_BLOCK}}` を build.py が丸ごと削除）。
