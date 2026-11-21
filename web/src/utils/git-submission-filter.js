export function filterGitSubmissions(items, userQuery = '', branchQuery = '') {
  const list = items ?? [];
  const u = String(userQuery ?? '').trim().toLowerCase();
  const b = String(branchQuery ?? '').trim().toLowerCase();
  if (!u && !b) return list;
  return list.filter((row) => {
    if (u) {
      const hay = [row.authorName, row.authorEmail, row.gitAccount, row.repoLabel, row.repoKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(u)) return false;
    }
    if (b) {
      const hay = [row.branch, row.mergeFrom, row.mergeInto, row.message]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(b)) return false;
    }
    return true;
  });
}

export function branchOptionsFromItems(items) {
  const set = new Set();
  for (const row of items ?? []) {
    for (const v of [row.branch, row.mergeFrom, row.mergeInto]) {
      const s = String(v ?? '').trim();
      if (s) set.add(s);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function userOptionsFromItems(items) {
  const set = new Set();
  for (const row of items ?? []) {
    for (const v of [row.authorName, row.gitAccount, row.authorEmail]) {
      const s = String(v ?? '').trim();
      if (s) set.add(s);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}