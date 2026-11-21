/**
 * 自动部署在 git 提交/推送完成后调用，写入提交记录。
 * 示例：import { logDeployGit } from './deploy-git-record.js';
 * await logDeployGit(db, { repoKey, message, authorName, ... });
 */
import { recordDeployGitSubmission } from './git-submissions.js';

export function logDeployGit(db, payload) {
  return recordDeployGitSubmission(db, { ...payload, source: 'deploy' });
}