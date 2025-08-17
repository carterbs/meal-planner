@echo off
setlocal
set HERE=%~dp0
set BIN=%HERE%validate.exe
if not exist "%BIN%" (
  echo Building validate...
  go build -o "%BIN%" ./tools/validate
)
"%BIN%" %*