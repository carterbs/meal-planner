@echo off
setlocal
set HERE=%~dp0
set ROOT=%HERE%..
set BIN=%HERE%validate-bin.exe
if not exist "%BIN%" (
  echo Building validate...
  cd "%ROOT%\tools\validate" && go build -o "%BIN%" .
)
cd "%ROOT%" && "%BIN%" %*