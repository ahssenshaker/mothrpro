#!/bin/bash
set -e

echo "🔍 البحث عن Android SDK..."
ANDROID_SDK="$HOME/Library/Android/sdk"
if [ ! -d "$ANDROID_SDK" ]; then
  echo "❌ ما لقينا Android SDK في: $ANDROID_SDK"
  echo "   تأكد إن Android Studio مثبّت"
  exit 1
fi

echo "✅ Android SDK: $ANDROID_SDK"
echo "sdk.dir=$ANDROID_SDK" > android/local.properties

echo "📦 بناء الـ APK..."
cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon 2>&1

APK="app/build/outputs/apk/release/app-release-unsigned.apk"
APK2="app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK" ]; then
  echo "✅ APK جاهز: android/$APK"
elif [ -f "$APK2" ]; then
  echo "✅ APK جاهز: android/$APK2"
else
  echo "❌ ما اكتمل البيلد، راجع الأخطاء فوق"
fi
