// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

import { browserStore } from "../settings";
import {
  type Backup,
  backupFileName,
  backupText,
  canRestore,
  collectBackup,
  readBackup,
  restoreBackup,
} from "./backup";

/**
 * Handing a file to whatever the device does with files, and taking one back.
 *
 * The only part of a backup that touches the browser, kept apart from
 * `backup.ts` so that what a save *is* can be tested without one.
 *
 * **Two ways out, and the order matters.** This game is played on an iPad,
 * and on iOS a link with `download` on it has historically opened the JSON
 * in a tab rather than saving it — which looks to a parent exactly like the
 * button not working. The share sheet is the idiom that device actually
 * has: it offers Files, Mail, AirDrop, whatever is installed. So the share
 * sheet is tried first and the link is the fallback, which is the right way
 * round on a laptop too — a desktop browser has no `canShare` for files and
 * goes straight to the download it is good at.
 */

interface Sharer {
  share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
}

/** Everything on this device, in a file, wherever the parent puts it. */
export async function exportSaves(when: Date = new Date()): Promise<boolean> {
  const backup = collectBackup(browserStore(), when.getTime());
  return handOver(backup, backupFileName(when));
}

async function handOver(backup: Backup, name: string): Promise<boolean> {
  const text = backupText(backup);
  if (await shareIt(text, name)) return true;
  return downloadIt(text, name);
}

/**
 * The share sheet, if this device has one that takes files.
 *
 * `canShare` with the actual file rather than merely checking that `share`
 * exists: a browser can have the API and refuse files, and calling it then
 * throws where the fallback would have worked.
 *
 * A parent who opens the sheet and taps cancel gets a rejection, and that
 * comes back as `false` — nothing was saved, and the button says so. It is
 * indistinguishable from a real failure and does not need to be
 * distinguishable: in both cases there is no backup.
 */
async function shareIt(text: string, name: string): Promise<boolean> {
  const sharer = navigator as unknown as Sharer;
  if (typeof sharer.share !== "function" || typeof sharer.canShare !== "function") return false;
  if (typeof File !== "function") return false;
  const file = new File([text], name, { type: "application/json" });
  if (!sharer.canShare({ files: [file] })) return false;
  try {
    await sharer.share({ files: [file], title: name });
    return true;
  } catch {
    return false;
  }
}

/** And otherwise the plain download every desktop browser is good at. */
function downloadIt(text: string, name: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Let the click get out of the door before the URL stops meaning
    // anything. Revoked synchronously, Safari has been seen to save an
    // empty file.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** How an import ended, in the one word the screen has to say about it. */
export const ImportResult = {
  Done: "done",
  /** Nothing was chosen. Not a failure and not worth saying anything about. */
  Cancelled: "cancelled",
  /** Chosen, and not one of ours. */
  NotASave: "not-a-save",
} as const;

export type ImportResult = (typeof ImportResult)[keyof typeof ImportResult];

/**
 * Read a chosen file, without touching anything.
 *
 * Split from putting it back on purpose. A parent is about to be asked to
 * agree to their tablet being emptied, and being asked that *before* the
 * file has been read means being asked to authorise something that may
 * never happen — a wipe confirmed and then a "that is not a save file" is
 * the worst order these two steps can come in.
 *
 * The file arrives rather than being asked for: the picker is opened by a
 * real input element the player's finger actually lands on, because a
 * browser will not open one for a script. See `showImportBox`.
 */
export async function readBackupFile(file: File): Promise<{
  readonly result: ImportResult;
  readonly backup?: Backup;
}> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { result: ImportResult.Cancelled };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { result: ImportResult.NotASave };
  }
  const backup = readBackup(parsed);
  if (!backup) return { result: ImportResult.NotASave };
  return { result: ImportResult.Done, backup };
}

/** And then, once somebody has said yes, put it on. */
export function takeBackup(backup: Backup): boolean {
  return restoreBackup(browserStore(), backup);
}

/** Whether this device can be imported onto at all. See `canRestore`. */
export function canTakeBackup(): boolean {
  return canRestore(browserStore());
}
