import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);

/** Windows 系统文件夹选择对话框 */
export async function pickFolderDialog(initialPath = '') {
  if (process.platform !== 'win32') {
    throw new Error('当前仅支持 Windows 文件夹选择');
  }
  let init = '';
  if (initialPath) {
    const resolved = path.resolve(initialPath);
    if (fs.existsSync(resolved)) init = resolved.replace(/'/g, "''");
  }
  const ps = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = '选择要监听的文件夹'
$f.ShowNewFolderButton = $true
${init ? `$f.SelectedPath = '${init}'` : ''}
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }
`;
  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-STA', '-Command', ps],
    { timeout: 300000, windowsHide: false },
  );
  const selected = stdout.trim();
  return selected || null;
}

export async function openFolderInExplorer(folderPath) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('路径不存在');
  }
  if (process.platform === 'win32') {
    await execFileAsync('explorer.exe', [resolved]);
    return;
  }
  throw new Error('当前系统未实现打开文件夹');
}

/** 打开文件或目录；文件在资源管理器中选中 */
export async function openPathInExplorer(fileOrFolderPath) {
  const resolved = path.resolve(fileOrFolderPath);
  if (process.platform === 'win32') {
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      await execFileAsync('explorer.exe', ['/select,', resolved]);
      return;
    }
    const dir = fs.existsSync(resolved) ? resolved : path.dirname(resolved);
    if (!fs.existsSync(dir)) throw new Error('路径不存在');
    await execFileAsync('explorer.exe', [dir]);
    return;
  }
  throw new Error('当前系统未实现打开路径');
}

export async function openFileWithDefaultApp(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('文件不存在，请先保存配置');
  if (process.platform === 'win32') {
    await execFileAsync('cmd.exe', ['/c', 'start', '', resolved], { windowsHide: true });
    return;
  }
  throw new Error('当前系统未实现打开文件');
}