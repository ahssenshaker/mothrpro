#!/bin/bash
set -e

echo "=== بناء APK مؤثر برو ==="

# تثبيت الحزم (مطلوب لـ autolinking يشوف expo-linking)
echo "📦 تثبيت node_modules..."
npm install --silent

# البحث عن Android SDK
ANDROID_SDK="$HOME/Library/Android/sdk"
if [ ! -d "$ANDROID_SDK" ]; then
  echo "❌ ما لقينا Android SDK في: $ANDROID_SDK"
  echo "   تأكد إن Android Studio مثبّت"
  exit 1
fi

echo "✅ Android SDK: $ANDROID_SDK"
echo "sdk.dir=$ANDROID_SDK" > android/local.properties

echo "🔨 بناء release APK..."
cd android
chmod +x gradlew
./gradlew assembleRelease --no-daemon

for APK in \
  "app/build/outputs/apk/release/app-release.apk" \
  "app/build/outputs/apk/release/app-release-unsigned.apk"; do
  if [ -f "$APK" ]; then
    echo ""
    echo "✅ APK جاهز!"
    FULL_PATH="$(cd "$(dirname "$APK")" && pwd)/$(basename "$APK")"
    echo "📍 المسار: $FULL_PATH"
    open "$(dirname "$FULL_PATH")" 2>/dev/null || true
    break
  fi
done
