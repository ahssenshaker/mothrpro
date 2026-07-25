# Mobile App Assets

Add these files before building:

- `icon.png` — 1024×1024 app icon (used for iOS App Store + Android)
- `adaptive-icon.png` — 1024×1024 foreground for Android adaptive icon
- `splash.png` — 1284×2778 splash screen (iPhone 14 Pro Max size)

Design: use the star logo (gold #f6c74d on dark #07090f background).

To generate from the SVG in the parent `assets/` folder, run:
```
npx sharp-cli resize 1024 1024 --input ../assets/icon.svg --output icon.png
```
Or use any image editor / Figma.
