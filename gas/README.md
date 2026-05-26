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
| `Setup.gs` | Script Properties の確認ヘルパー（`getPropStatus`・任意） |
| `Config.gs` | 定数（リポジトリ・ポーリング・セル等） |
| `appsscript.json` | OAuthスコープ（drive / external_request / spreadsheets.currentonly） |

## Script Properties（PATは直書き禁止）
- `GITHUB_PAT` … GitHub PAT（workflow_dispatch + artifact取得に使用）
- `DRIVE_FOLDER_ID` …（任意）保存先フォルダ。未設定なら `Config.DEFAULT_FOLDER_ID` を使用

## デプロイ手順（手貼り・claspなし）
このGASは**スプレッドシートにバインド**する必要がある（`onOpen` のカスタムメニューを出すため）。
そのため、スプレッドシートの **拡張機能 → Apps Script** から作成・貼り付ける。

1. 対象スプレッドシートを開く → **拡張機能 → Apps Script**（バインド型プロジェクトが開く）
2. `gas/` の各 `.gs`（Config / Code / GitHub / Drive / Setup）をエディタにファイルとして貼る
   - `appsscript.json` は貼らなくてよい（必要なスコープはコードから自動検出される）
3. **プロジェクトの設定（⚙）→ スクリプト プロパティ** で2件を登録:
   - `GITHUB_PAT` = `<PAT>`
   - `DRIVE_FOLDER_ID` = `1-X74lXKOkm6cQj1NcYprfn95HvEGVZsO`
4. 保存 → 関数 `getPropStatus` を一度実行して権限承認＋プロパティ登録を確認
5. **Apps Script API の有効化は不要**（claspを使わないため）

## Ryosukeの手順（ターミナル・PAT手入力は不要 … PATはプロパティに1回貼るだけ）
1. スプレッドシートを開き直し、メニュー **「📄 PDF生成」** が出ることを確認
2. データタブ（例: 埼スタ天然芝フェスタ）を開いて「このタブのPDFを作成」を初回実行
3. ブラウザで権限承認（DriveApp / UrlFetchApp / SpreadsheetApp）
4. 1〜2分後、Driveフォルダ と アラートのリンクでPDFを確認

## 注意
- `系統マスター` タブで実行するとブロックされる（誤実行防止）。
- 多重起動は `LockService`（ドキュメントロック）で防止。
- 同名上書きは「既存をゴミ箱→新規作成」方式（DriveのファイルIDは毎回変わる）。
  ID不変で中身だけ更新したい場合は Drive API(高度なサービス)の `Files.update` に変更可能。
