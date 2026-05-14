# Nexus Radio Updates

This app is configured for a static Electron update feed.

## Update Host

Replace this placeholder in `package.json` before distributing:

```json
"url": "https://example.com/nexus-radio/updates/"
```

Use the public HTTPS folder where you will upload update files.

## Build A Release

1. Bump `version` in `package.json`.
2. Run:

```powershell
npm.cmd run build
```

3. Upload these files from `dist` to the update host:

```text
latest.yml
Nexus Radio.exe
Nexus Radio.exe.blockmap
```

Users who installed Nexus Radio from the installer will check that folder and install newer versions when available.
