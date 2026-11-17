/**
 * Vídeos guardados no Google Drive: o painel salva só o link (em block_media.path, como "drive:<id>")
 * e mostra o vídeo pelo player do próprio Drive. O arquivo precisa estar compartilhado como
 * "Qualquer pessoa com o link pode ver".
 */

export const DRIVE_PREFIX = "drive:";

/** Extrai o id do arquivo de um link do Drive (…/file/d/<id>/view, …open?id=<id>, …uc?id=<id>). */
export function driveFileId(link: string): string | null {
  const s = link.trim();
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (!/(^|\.)(drive|docs)\.google\.com$/.test(url.hostname)) return null;
  const fromPath = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/)?.[1];
  const id = fromPath ?? url.searchParams.get("id");
  return id && /^[a-zA-Z0-9_-]{10,}$/.test(id) ? id : null;
}

export const isDrivePath = (path: string) => path.startsWith(DRIVE_PREFIX);
export const drivePath = (id: string) => `${DRIVE_PREFIX}${id}`;
export const driveIdOf = (path: string) => path.slice(DRIVE_PREFIX.length);

export const drivePreviewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`;
export const driveViewUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${id}`;
