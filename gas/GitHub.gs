/**
 * GitHub.gs — GitHub REST API 呼び出し（UrlFetchApp）。
 * 認証は Script Properties の PAT（token <PAT>）。
 */

function ghApi_(path) {
  return 'https://api.github.com/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + path;
}

function ghHeaders_(pat) {
  return {
    Authorization: 'token ' + pat,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function gvizUrl_(spreadsheetId, sheetName) {
  // sheet= はタブ名と完全一致が必要（不一致だと先頭タブにフォールバックする既知の罠）。
  return 'https://docs.google.com/spreadsheets/d/' + spreadsheetId +
         '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheetName);
}

/** workflow_dispatch をキック。成功すると 204。 */
function dispatchWorkflow_(pat, festaUrl, masterUrl, runTag) {
  const url = ghApi_('/actions/workflows/' + CONFIG.WORKFLOW_FILE + '/dispatches');
  const payload = JSON.stringify({
    ref: CONFIG.REF,
    inputs: { festa_csv_url: festaUrl, master_csv_url: masterUrl, run_tag: runTag }
  });
  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: ghHeaders_(pat),
    payload: payload,
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code !== 204) {
    throw new Error('workflow_dispatch に失敗しました (HTTP ' + code + ')。\n' +
                    'PATの権限/有効期限を確認してください。\n' + resp.getContentText());
  }
}

/**
 * run_tag に一致する run を、run-name(display_title)で特定する。
 * 同時実行があっても自分が起動した run を正しく選べる。
 */
function waitForRunByTag_(pat, runTag) {
  const wantName = 'PDF: ' + runTag;
  const url = ghApi_('/actions/workflows/' + CONFIG.WORKFLOW_FILE +
                     '/runs?event=workflow_dispatch&per_page=20');
  for (var i = 0; i < CONFIG.NEWRUN_POLL_MAX; i++) {
    Utilities.sleep(CONFIG.NEWRUN_POLL_INTERVAL_MS);
    const resp = UrlFetchApp.fetch(url, { headers: ghHeaders_(pat), muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const runs = JSON.parse(resp.getContentText()).workflow_runs || [];
      for (var j = 0; j < runs.length; j++) {
        if (runs[j].display_title === wantName || runs[j].name === wantName) {
          return runs[j].id;
        }
      }
    }
  }
  return null;
}

/** run の完了を待ち、conclusion（success/failure/...）を返す。未完了なら 'timeout'。 */
function waitForRunCompletion_(pat, runId) {
  const url = ghApi_('/actions/runs/' + runId);
  for (var i = 0; i < CONFIG.RUN_POLL_MAX; i++) {
    Utilities.sleep(CONFIG.RUN_POLL_INTERVAL_MS);
    const resp = UrlFetchApp.fetch(url, { headers: ghHeaders_(pat), muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      const r = JSON.parse(resp.getContentText());
      if (r.status === 'completed') return r.conclusion;
    }
  }
  return 'timeout';
}

/**
 * run の artifact(zip) をDLし、解凍して中のPDFを Blob で返す。
 *
 * 重要: archive_download_url は 302 で署名付きストレージURLにリダイレクトする。
 * UrlFetchApp は followRedirects 時に Authorization をリダイレクト先へ転送してしまい
 * ストレージ側で認証衝突エラーになるため、followRedirects:false で Location を取り出し、
 * 認証ヘッダ無しで取得し直す（curl が自動でやってくれる挙動を手動で再現）。
 */
function downloadArtifactPdf_(pat, runId) {
  // artifact 一覧
  const listResp = UrlFetchApp.fetch(ghApi_('/actions/runs/' + runId + '/artifacts'),
    { headers: ghHeaders_(pat), muteHttpExceptions: true });
  if (listResp.getResponseCode() !== 200) {
    throw new Error('artifact一覧の取得に失敗 (HTTP ' + listResp.getResponseCode() + ')');
  }
  const artifacts = JSON.parse(listResp.getContentText()).artifacts || [];
  if (artifacts.length === 0) throw new Error('成果物(artifact)が見つかりません。');
  const dlUrl = artifacts[0].archive_download_url;

  // step1: 302を取得（リダイレクトを追わない）
  const r1 = UrlFetchApp.fetch(dlUrl, {
    headers: ghHeaders_(pat), followRedirects: false, muteHttpExceptions: true
  });
  const code1 = r1.getResponseCode();
  var zipBlob;
  if (code1 === 302 || code1 === 307) {
    const headers = r1.getHeaders();
    const loc = headers['Location'] || headers['location'];
    if (!loc) throw new Error('リダイレクト先(Location)を取得できませんでした。');
    // step2: 署名付きURLを認証ヘッダ無しで取得
    const r2 = UrlFetchApp.fetch(loc, { muteHttpExceptions: true });
    if (r2.getResponseCode() !== 200) {
      throw new Error('zipのダウンロードに失敗 (HTTP ' + r2.getResponseCode() + ')');
    }
    zipBlob = r2.getBlob();
  } else if (code1 === 200) {
    zipBlob = r1.getBlob();
  } else {
    throw new Error('artifactのダウンロードに失敗 (HTTP ' + code1 + ')');
  }

  // 解凍してPDFを取り出す
  zipBlob.setContentType('application/zip');
  const files = Utilities.unzip(zipBlob);
  for (var i = 0; i < files.length; i++) {
    var name = files[i].getName();
    if (name && name.toLowerCase().slice(-4) === '.pdf') {
      return files[i].setContentType('application/pdf');
    }
  }
  throw new Error('zip内にPDFが見つかりませんでした。');
}
