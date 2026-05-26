/**
 * Setup.gs — Script Properties 登録用（PATをコードに残さない）。
 *
 * 使い方（どちらか）:
 *  (A) clasp 経由（推奨・自動）:
 *      clasp run setupProperties --params '["<GITHUB_PAT>","<DRIVE_FOLDER_ID>"]'
 *      ※ Apps Script API 実行可能デプロイ＋clasp認証が必要。
 *  (B) エディタから手動:
 *      下の TMP_* に一時的に値を入れて1回実行 → 実行後すぐ TMP_* を空に戻す（PATを残さない）。
 *
 * 登録後は getPropStatus() で「値が入っているか」だけ確認できる（値自体は出力しない）。
 */
function setupProperties(pat, folderId) {
  var TMP_PAT = '';        // (B)手動時のみ一時的に入れる。終わったら必ず空に戻す。
  var TMP_FOLDER = '';     // 空なら Config.DEFAULT_FOLDER_ID を使うので未設定でも可。

  var p = pat || TMP_PAT;
  var f = folderId || TMP_FOLDER;
  if (!p) throw new Error('PATが渡されていません（引数 or TMP_PAT）。');

  var props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.PROP_PAT, p);
  if (f) props.setProperty(CONFIG.PROP_FOLDER, f);
  return getPropStatus();
}

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
