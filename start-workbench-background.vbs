' 无黑窗口后台启动（仍会占用 4177/5178 端口）
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c npm run dev", 0, False
WScript.Sleep 2500
sh.Run "http://127.0.0.1:5178", 1, False