# InventoryPro Scanner - Zebra TC510k Handheld App

A lightweight, high-performance native Android application designed specifically for the Zebra TC510k barcode scanner and mobile computer (running Android 6.0 Marshmallow and above). 

It connects to your main `inventorypro` instance via a secure REST API (with HTTP Basic Auth) to lookup parts and perform instant stock level adjustments (+/-).

---

## 🚀 Step 1: Compile & Install the App

Since you are running this on a Zebra handheld device, you can import this project directly into Android Studio to compile and deploy the APK.

1. Copy the `inventory-pro-scanner` directory to your local development machine where Android Studio is installed.
2. Open **Android Studio** and click **File > Open**, then select this directory.
3. Android Studio will automatically resolve Gradle dependencies and download target SDK configurations.
4. Connect your Zebra TC510k via USB (ensure USB debugging is enabled in Developer Options).
5. Click the **Run** button (green play icon) or run the command:
   ```bash
   ./gradlew installDebug
   ```
6. The app will install on your handheld device as **IP Scanner**.

---

## ⚙️ Step 2: Configure Zebra DataWedge (Crucial)

To use the TC510k's hardware laser scanner to trigger queries automatically, you must configure a profile in Zebra's built-in **DataWedge** utility:

1. Open the **DataWedge** application on your Zebra TC510k.
2. Tap the menu (three dots) in the top-right and select **New Profile**.
3. Name the profile **`InventoryPro`** and tap OK.
4. Tap the **`InventoryPro`** profile to edit it.
5. Tap **Associated Apps > Menu (three dots) > New App/Activity**:
   - Select **`com.inventorypro.scanner`**.
   - Select `*` (which associates it with all activities within the app).
   - Tap back to save.
6. Scroll down to **Keystroke Output** and uncheck **Enabled**. (This prevents typing barcode text into background fields).
7. Scroll down to **Intent Output**:
   - Check **Enabled**.
   - Tap **Intent Action** and enter: `com.inventorypro.scanner.ACTION`
   - Tap **Intent Delivery** and select: **`Broadcast Intent`**
8. Exit DataWedge. It is now fully configured to send scanned barcodes directly to the application in the background!

---

## 💻 Step 3: Server Configuration

When you launch the app for the first time, you will see a configuration prompt:

1. Tap the **Gear Icon** in the top-right corner to open Settings.
2. Enter your credentials:
   - **Server URL**: The address of your `inventorypro` instance (e.g. `http://192.168.1.100:3000`). Make sure your device is on the same local network (Wi-Fi).
   - **Username**: Your `inventorypro` username (e.g. `admin`).
   - **Password**: Your login password (e.g. `password123`).
3. Tap **Save & Test Connection**.
4. The app will make a test request. On success, it will save the settings, show a green checkmark, and return you to the scanner screen.

---

## 🛠️ Step 4: Scan and Adjust Inventory

* **Scanning**: Pull the Zebra TC510k's physical yellow/green hardware triggers on the sides of the device. Aim the laser at a barcode.
* **Audio Cues**: 
  - A short **high-pitched beep** indicates a successful scan or stock level update.
  - A double **low-pitched beep** indicates a network error, missing part, or database validation failure.
* **Adjustment**: 
  - Once a part is matched, it displays its category, name, location, and current stock level.
  - Adjust the quantity in the text field (defaults to 1).
  - Tap the big green **`+`** button to add stock, or the big amber **`-`** button to deduct stock.
  - Your changes sync instantly and generate detailed Audit/Activity logs on the main dashboard labeled: `via Zebra scanner`.

---

## 📸 Step 5: Capture & Update Part Photos Directly

* **Direct Camera Capture**: Scan any part (or select one from the Search tab), and tap **Take Photo** (or **Update Photo** or the thumbnail container).
* **Seamless Workflow**: The camera opens immediately without prompting you to browse files or navigate the gallery.
* **Auto-Optimization**: The app handles EXIF orientation rotation, resizes the photo to a lightweight web-friendly resolution (max 1200x1200px), compresses to optimized JPEG, and uploads it via the secure `/api/scanner/part/photo` endpoint.
* **Instant Sync & Feedback**: Upon upload, the app immediately refreshes the preview thumbnail, plays a success tone, and updates the part's photo across the InventoryPro dashboard.

