@echo off
cd /d "%~dp0"
"C:\Users\bearf\.northstar-tools\pyenv\Scripts\python.exe" -m unittest discover -s tests -t . %*
