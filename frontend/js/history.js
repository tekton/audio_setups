/**
 * Undo/redo as a list of snapshots (JSON strings). The app pushes a snapshot after each finished edit;
 * undo and redo move along the list and hand back the snapshot to restore.
 */
export function createHistory(limit = 100) {
  let list = [];
  let at = -1;
  return {
    // Start over from `json` (a new layout was loaded): nothing to undo or redo.
    reset(json) {
      list = [json];
      at = 0;
    },
    // Record `json` as the newest state. Returns false (and records nothing) if it equals the current one.
    push(json) {
      if (list[at] === json) return false;
      list = list.slice(0, at + 1);
      list.push(json);
      if (list.length > limit) list.shift();
      at = list.length - 1;
      return true;
    },
    // Swap the current snapshot for `json` without adding a step (the app re-reads its state in normalised form after a restore).
    replaceCurrent(json) {
      if (at >= 0) list[at] = json;
    },
    canUndo: () => at > 0,
    canRedo: () => at >= 0 && at < list.length - 1,
    // The snapshot to restore, or null if there is nothing to go back to.
    undo() {
      if (at <= 0) return null;
      at -= 1;
      return list[at];
    },
    redo() {
      if (at < 0 || at >= list.length - 1) return null;
      at += 1;
      return list[at];
    },
  };
}
