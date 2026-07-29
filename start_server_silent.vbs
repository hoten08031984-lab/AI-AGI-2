Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Tim pythonw.exe tu PATH
Set env = WshShell.Environment("Process")
pythonw = "pythonw.exe"

' Dung duong dan tuyet doi
serverScript = fso.BuildPath(strPath, "server.py")

WshShell.Run """" & pythonw & """ """ & serverScript & """", 0, False
