!macro customInit
  !insertmacro setInstallModePerUser
!macroend

!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend
