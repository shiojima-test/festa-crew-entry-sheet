/**
 * Code.gs — メニュー（onOpen）とメイン処理。
 *
 * フロー（方式A-2：Actions側にGoogle認証を持たせない）:
 *   アクティブタブ名 → gviz CSV URL 組み立て
 *   → GitHub workflow_dispatch（run_tag付き）
 *   → 起動した run を run_tag(display_title)で特定
 *   → 完了をポーリング
 *   → artifact(zip)をDL・解凍してPDFを取得
 *   → Driveフォルダに保存（同名上書き）
 *   → 共有リンクをアラート＋セルに表示
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📄 PDF生成')
    .addItem('このタブのPDFを作成', 'createPdfForActiveTab')
    .addToUi();
}

function createPdfForActiveTab() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const tabName = sheet.getName();

  // 系統マスタータブでの誤実行を防止
  if (tabName === CONFIG.MASTER_SHEET_NAME) {
    ui.alert('「系統マスター」タブではPDFを作成できません。\nデータタブ（例: 埼スタ天然芝フェスタ / カインズ各店）を開いてから実行してください。');
    return;
  }

  // 多重起動防止（ドキュメント単位のロック）。ボタン連打での二重dispatchを防ぐ。
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(2000)) {
    ui.alert('別のPDF生成処理が実行中です。完了までお待ちください。');
    return;
  }

  try {
    const pat = getProp_(CONFIG.PROP_PAT);
    if (!pat) {
      ui.alert('GITHUB_PAT が未設定です。Script Properties に登録してください（管理者作業）。');
      return;
    }

    ss.toast('「' + tabName + '」のPDF生成を開始しました。1〜2分後にDriveとURLで確認できます。', '📄 PDF生成', 15);

    // 1) gviz CSV URL を動的に組み立て（IDはハードコードしない）
    const spreadsheetId = ss.getId();
    const festaUrl = gvizUrl_(spreadsheetId, tabName);
    const masterUrl = gvizUrl_(spreadsheetId, CONFIG.MASTER_SHEET_NAME);

    // 2) 一意の run_tag を作り、workflow_dispatch をキック
    const runTag = makeRunTag_(tabName);
    dispatchWorkflow_(pat, festaUrl, masterUrl, runTag);

    // 3) run_tag(display_title)で対象 run を特定
    const runId = waitForRunByTag_(pat, runTag);
    if (!runId) {
      throw new Error('起動したワークフローを特定できませんでした。\nGitHub Actions を手動で確認してください。');
    }
    const runUrl = 'https://github.com/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/actions/runs/' + runId;

    // 4) run の完了を待つ
    const conclusion = waitForRunCompletion_(pat, runId);
    if (conclusion !== 'success') {
      throw new Error('ワークフローが正常終了しませんでした（conclusion=' + conclusion + '）。\n手動確認: ' + runUrl);
    }

    // 5) artifact(zip)をDL・解凍してPDF Blobを取得
    const pdfBlob = downloadArtifactPdf_(pat, runId);
    if (!pdfBlob) {
      throw new Error('成果物PDFを取得できませんでした。\n手動確認: ' + runUrl);
    }

    // 6) Driveに保存（同名上書き）＋リンク表示
    const file = saveToDrive_(pdfBlob);
    const link = file.getUrl();
    writeLinkCell_(sheet, link);

    ui.alert('✅ PDF生成が完了しました。\n\nファイル: ' + file.getName() + '\nリンク: ' + link +
             '\n\n（セル ' + CONFIG.LINK_CELL + ' にもリンクを記録しました）');

  } catch (e) {
    ui.alert('⚠ エラー: ' + (e && e.message ? e.message : e));
  } finally {
    lock.releaseLock();
  }
}

// ---- 補助 ----

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/** タブ名＋タイムスタンプの一意タグ。run-name(display_title)で照合する。 */
function makeRunTag_(tabName) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmmss');
  return tabName + '-' + ts;
}

/** 完了リンクをデータ列(A/B/C)を避けた安全なセルに記録。 */
function writeLinkCell_(sheet, link) {
  try {
    const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
    sheet.getRange(CONFIG.LINK_CELL).setValue('最新PDF (' + stamp + '): ' + link);
  } catch (e) {
    // セル書き込みは付帯機能。失敗してもアラートのリンクで完了は伝わる。
  }
}
