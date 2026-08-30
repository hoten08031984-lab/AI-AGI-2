Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath

' Tim pythonw.exe tu venv hoac PATH
venvPythonw = fso.BuildPath(strPath, "venv\Scripts\pythonw.exe")
If fso.FileExists(venvPythonw) Then
    pythonw = venvPythonw
Else
    pythonw = "pythonw.exe"
End If

' Dung duong dan tuyet doi
serverScript = fso.BuildPath(strPath, "server.py")

WshShell.Run """" & pythonw & """ """ & serverScript & """", 0, False
