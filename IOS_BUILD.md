# RingIn — iOS Build Guide (Capacitor)

This wraps the existing RingIn web app (CRA `build/`) in a native iOS shell so
the speaker toggle does **true earpiece ↔ loudspeaker** routing via
`AVAudioSession` — the same mechanism WhatsApp/Telegram use — and so lock-screen
push notifications can wake the app for incoming calls.

> **Why this can't be generated in CI / on Linux:** `npx cap add ios` and the
> CocoaPods/Xcode toolchain are macOS-only. The repo ships everything that *can*
> be prepared cross-platform (the Swift plugin, the Info.plist auto-patcher in
> `tools/install-native-plugins.mjs`, this guide). The steps below run on your
> Mac.

---

## Prerequisites (one-time, on a Mac)

1. **Xcode** (free, App Store). Open it once, accept the license, let it install
   the iOS platform components.
2. **Command Line Tools**: `xcode-select --install`
3. **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`)
4. **Node 20+**: `node -v` (use nvm/brew if missing)
5. **Apple Developer account** — required to run on a *physical* iPhone. The free
   tier works for 7-day sideload builds; the paid tier ($99/yr) is needed for
   APNs **push notifications** (incoming-call pushes) and TestFlight.

---

## Build steps

```bash
cd /path/to/RingIn          # the repo root (where capacitor.config.json lives)

# One-time after pulling Capacitor deps:
npm install

# Every build:
npm run build               # produces the CRA build/ folder Capacitor wraps

npx cap add ios             # ONE-TIME: scaffolds the ios/ Xcode project
node tools/install-native-plugins.mjs   # copies the Swift plugin + patches Info.plist
npx cap sync ios            # syncs build/ → ios/ and installs Pods
npx cap open ios            # opens ios/App/App.xcworkspace in Xcode
```

`node tools/install-native-plugins.mjs` is **idempotent** — safe to re-run. It:

- copies `capacitor-plugin/ios/RingInAudioPlugin.swift` → `ios/App/App/`
- patches `ios/App/App/Info.plist` with the required usage strings + background
  modes (see below).

---

## What the install script writes into Info.plist (automatic)

| Key | Why |
|-----|-----|
| `NSMicrophoneUsageDescription` | Agora voice calls. **App crashes without it.** |
| `NSCameraUsageDescription` | Camera capture for posts / avatar. |
| `NSPhotoLibraryUsageDescription` | Photo & video attachment pickers. |
| `NSPhotoLibraryAddUsageDescription` | Saving media to the library. |
| `UIBackgroundModes` → `audio` | Keeps call audio alive when backgrounded. |
| `UIBackgroundModes` → `remote-notification` | Lets a push wake the app for incoming calls. |

---

## What you still must do in Xcode (needs your signing team — can't be scripted)

In Xcode, select the **App** target → **Signing & Capabilities**:

1. **Team**: pick your Apple Developer team. Set a unique **Bundle Identifier**
   if `app.ringin.mobile` is taken (matches `appId` in `capacitor.config.json`).
2. **+ Capability → Push Notifications** (adds the `aps-environment` entitlement).
   Requires the **paid** Apple Developer account.
3. **+ Capability → Background Modes** → tick **Audio, AirPlay, and Picture in
   Picture** and **Remote notifications**.

Then plug in your iPhone, select it as the run target, and press **Run (⌘R)**.

---

## Push notifications (incoming-call pushes) — extra one-time setup

Lock-screen call pushes on iOS need APNs wired into Firebase (Android already
works without this — see `CLAUDE.md`):

1. Apple Developer → **Keys** → create an **APNs Auth Key** (`.p8`). Note the
   **Key ID** and your **Team ID**.
2. Firebase Console → Project Settings → **Cloud Messaging** → Apple app →
   upload the `.p8`, enter Key ID + Team ID.
3. Confirm the iOS bundle id registered in Firebase matches your Xcode bundle id.

The JS side (`src/utils/firebase.js`, `src/utils/pushNotifications.js`) already
uses `@capacitor/push-notifications` and writes the token to `profiles.fcm_token`
on native — no app-code change needed once APNs is configured.

---

## Troubleshooting

- **`pod install` fails / Ruby errors** → `sudo gem install cocoapods` then
  `cd ios/App && pod install`.
- **"Microphone permission" crash on first call** → re-run
  `node tools/install-native-plugins.mjs` and confirm
  `NSMicrophoneUsageDescription` is present in `ios/App/App/Info.plist`.
- **White screen on launch** → you forgot `npm run build` before `npx cap sync`.
- **Plugin not found (`RingInAudio` is null in console)** → the Swift file isn't
  in the App target; drag `RingInAudioPlugin.swift` into the App group in Xcode.
- **Re-scaffold from scratch** → delete the `ios/` folder and re-run the build
  steps; `ios/` is generated and should not be committed (see `.gitignore`).
