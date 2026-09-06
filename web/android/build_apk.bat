@echo off
set JAVA_HOME=D:\Java
set ANDROID_HOME=C:\Users\Fish\AppData\Local\Android
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
cd /d D:\Mindd\Work\sparkflow\web\android
call gradlew.bat assembleDebug
