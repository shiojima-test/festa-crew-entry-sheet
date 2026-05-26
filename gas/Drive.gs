/**
 * Drive.gs — 生成PDFをDriveフォルダに保存（同名は上書き入れ替え）。
 *
 * 既定動作: 同名ファイルがあればゴミ箱に送り、新規作成する（フォルダに最新版だけ残る）。
 *   → この方式だとDriveのファイルIDは毎回変わる。
 *   ID不変で中身だけ更新したい場合は Drive API(高度なサービス)の Files.update に変更可能。
 */
function saveToDrive_(pdfBlob) {
  const folderId = getProp_(CONFIG.PROP_FOLDER) || CONFIG.DEFAULT_FOLDER_ID;
  const folder = DriveApp.getFolderById(folderId);
  const name = pdfBlob.getName(); // 例: FESTA_CREW_ENTRY_SHEET_v6.2.pdf

  // 同名を上書き入れ替え（重複も一掃）
  const it = folder.getFilesByName(name);
  while (it.hasNext()) {
    it.next().setTrashed(true);
  }
  const file = folder.createFile(pdfBlob);
  file.setName(name);
  // 共有設定はフォルダの既存設定を継承する（ここで意図せず公開共有はしない）。
  return file;
}
