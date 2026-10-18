
Unicode true
!include "MUI2.nsh"

Name "鲸鱼记账"
OutFile "鲸鱼记账-1.0.0-安装版.exe"
InstallDir "$LOCALAPPDATA\鲸鱼记账"
InstallDirRegKey HKCU "Software\WhaleLedger" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
BrandingText "鲸鱼记账 · 数据只存本机"

!define MUI_ABORTWARNING
!define MUI_ICON "app\build\icon.ico"
!define MUI_UNICON "app\build\icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\鲸鱼记账.exe"
!define MUI_FINISHPAGE_RUN_TEXT "马上打开鲸鱼记账"
!define MUI_WELCOMEPAGE_TITLE "鲸鱼记账 1.0"
!define MUI_WELCOMEPAGE_TEXT "一个只在你电脑里运行的记账本。$\r$\n$\r$\n不注册、不联网、不偷看你的账单。$\r$\n$\r$\n点「下一步」开始安装。"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装" SecMain
  SetOutPath "$INSTDIR"
  File /r "release\鲸鱼记账\*.*"
  CreateDirectory "$SMPROGRAMS\鲸鱼记账"
  CreateShortcut "$SMPROGRAMS\鲸鱼记账\鲸鱼记账.lnk" "$INSTDIR\鲸鱼记账.exe" "" "$INSTDIR\鲸鱼记账.exe" 0
  CreateShortcut "$DESKTOP\鲸鱼记账.lnk" "$INSTDIR\鲸鱼记账.exe" "" "$INSTDIR\鲸鱼记账.exe" 0
  WriteUninstaller "$INSTDIR\卸载鲸鱼记账.exe"

  WriteRegStr HKCU "Software\WhaleLedger" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "DisplayName" "鲸鱼记账"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "Publisher" "鲸鱼记账"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "DisplayIcon" "$INSTDIR\鲸鱼记账.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "UninstallString" '"$INSTDIR\卸载鲸鱼记账.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger" "EstimatedSize" 330000
SectionEnd

Section "Uninstall"
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\鲸鱼记账.lnk"
  RMDir /r "$SMPROGRAMS\鲸鱼记账"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhaleLedger"
  DeleteRegKey HKCU "Software\WhaleLedger"

  MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "是否连同记账数据一起删除？$\r$\n$\r$\n数据位置：%APPDATA%\com.whaleledger.app$\r$\n$\r$\n建议选「否」：数据会保留，重装后可以接着用。" IDNO KeepData
  RMDir /r "$APPDATA\com.whaleledger.app"
  KeepData:
SectionEnd
