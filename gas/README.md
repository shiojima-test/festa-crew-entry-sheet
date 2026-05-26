# GAS連携：スプレッドシートのボタンからPDF生成（方式A-2）

スプレッドシートのメニュー **「📄 PDF生成」→「このタブのPDFを作成」** で、アクティブタブの
PDFを生成し、Driveフォルダに保存する。Actions側にGoogle認証は持たせない（A-2）。

## フロー
1. GAS がアクティブタブ名から gviz CSV URL（festa/master）を組み立てる
2. GitHub `workflow_dispatch`（`generate-pdf.yml`）を `run_tag` 付きでキック
3. `run-name`（= `PDF: <run_tag>`）で起動した run を特定 → 完了をポーリング
4. artifact（固定名 `festa-pdf`）の zip を取得（**302→Locationを認証ヘッダ無しで再取得**）
5. `Utilities.unzip` でPDFを取り出し、Driveフォルダに保存（**同名は上書き入れ替え**）
6. 共有リンクをアラート表示＋セル `E1` に記録

## ファイル
| ファイル | 役割 |
|---|---|
| `Code.gs` | `onOpen`（メニュー）＋メイン `createPdfForActiveTab` |
| `GitHub.gs` | dispatch / run特定 / 完了待ち / artifact DL・解凍 |
| `Drive.gs` | Drive保存（同名上書き） |
| `Setup.gs` | Script Properties 登録（`setupProperties` / `getPropStatus`） |
| `Config.gs` | 定数（リポジトリ・ポーリング・セル等） |
| `appsscript.json` | OAuthスコープ（drive / external_request / spreadsheets.currentonly） |

## Script Properties（PATは直書き禁止）
- `GITHUB_PAT` … GitHub PAT（workflow_dispatch + artifact取得に使用）
- `DRIVE_FOLDER_ID` …（任意）保存先フォルダ。未設定なら `Config.DEFAULT_FOLDER_ID` を使用

## デプロイ手順（clasp）
このGASは**スプレッドシートにバインド**する必要がある（`onOpen` のカスタムメニューを出すため）。

```bash
npm i -g @google/clasp
clasp login                      # 初回ブラウザ認証（Apps Script API を有効化しておく）
# スプレッドシートにバインドした新規プロジェクトを作成（または既存をclone）
clasp create --type sheets --parentId 1GLLuH06TVwPLiaDFd9CBSEr8-eLfzzWaPXxaEmFTbQw --rootDir .
clasp push                       # gas/ の内容をアップロード
# Script Properties を登録（PATはコミットせず実行時に渡す）
clasp run setupProperties --params '["<GITHUB_PAT>","1-X74lXKOkm6cQj1NcYprfn95HvEGVZsO"]'
clasp run getPropStatus          # 値の存在のみ確認（値は出さない）
```

## Ryosukeの手順（ターミナル・PAT手入力は不要）
1. スプレッドシートを開き直し、メニュー **「📄 PDF生成」** が出ることを確認
2. データタブ（例: 埼スタ天然芝フェスタ）を開いて「このタブのPDFを作成」を初回実行
3. ブラウザで権限承認（DriveApp / UrlFetchApp / SpreadsheetApp）
4. 1〜2分後、Driveフォルダ と アラートのリンクでPDFを確認

## 注意
- `系統マスター` タブで実行するとブロックされる（誤実行防止）。
- 多重起動は `LockService`（ドキュメントロック）で防止。
- 同名上書きは「既存をゴミ箱→新規作成」方式（DriveのファイルIDは毎回変わる）。
  ID不変で中身だけ更新したい場合は Drive API(高度なサービス)の `Files.update` に変更可能。
