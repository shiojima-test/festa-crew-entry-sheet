/**
 * Config.gs — 定数とScript Properties定義
 *
 * PAT（GITHUB_PAT）は絶対にここへ直書きしない。PropertiesService から読む。
 * Script Properties は clasp 経由で Claude Code が登録する（GITHUB_PAT / DRIVE_FOLDER_ID）。
 */
const CONFIG = {
  // GitHub リポジトリ情報
  OWNER: 'shiojima-test',
  REPO: 'festa-crew-entry-sheet',
  WORKFLOW_FILE: 'generate-pdf.yml',
  REF: 'main',

  // シート
  MASTER_SHEET_NAME: '系統マスター',   // このタブで実行されたら中断

  // Script Property キー（値は Properties に格納。コード直書き禁止）
  PROP_PAT: 'GITHUB_PAT',
  PROP_FOLDER: 'DRIVE_FOLDER_ID',
  // DRIVE_FOLDER_ID が未設定の場合のフォールバック（Ryosuke指定の保存先）
  DEFAULT_FOLDER_ID: '1-X74lXKOkm6cQj1NcYprfn95HvEGVZsO',

  // 完了リンクを書き込むセル（A/B/C のデータ列を避けた安全なセル）
  LINK_CELL: 'E1',

  // ポーリング設計（GASの実行上限6分以内に収める）
  // 新run検出: 最大 15回 × 4秒 = 60秒
  NEWRUN_POLL_INTERVAL_MS: 4000,
  NEWRUN_POLL_MAX: 15,
  // run完了待ち: 最大 35回 × 6秒 = 210秒
  RUN_POLL_INTERVAL_MS: 6000,
  RUN_POLL_MAX: 35,
};
