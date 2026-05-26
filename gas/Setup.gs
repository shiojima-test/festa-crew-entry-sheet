/**
 * Setup.gs — Script Properties の確認用ヘルパー（任意）。
 *
 * 本番の登録は「プロジェクトの設定 → スクリプト プロパティ」から手動で行う:
 *   GITHUB_PAT      = <PAT>
 *   DRIVE_FOLDER_ID = 1-X74lXKOkm6cQj1NcYprfn95HvEGVZsO
 *
 * 登録後、getPropStatus() を実行すると「値が入っているか」だけ確認できる
 * （値そのものはログに出さない）。実行ログ（表示 → ログ）で結果を見る。
 */

/** 値の存在のみ確認（値そのものは返さない）。 */
function getPropStatus() {
  var props = PropertiesService.getScriptProperties();
  var pat = props.getProperty(CONFIG.PROP_PAT);
  var folder = props.getProperty(CONFIG.PROP_FOLDER);
  var status = {
    GITHUB_PAT: pat ? ('set (len=' + pat.length + ')') : 'MISSING',
    DRIVE_FOLDER_ID: folder ? ('set: ' + folder) : '(未設定 → DEFAULT_FOLDER_ID を使用)'
  };
  Logger.log(JSON.stringify(status));
  return status;
}
