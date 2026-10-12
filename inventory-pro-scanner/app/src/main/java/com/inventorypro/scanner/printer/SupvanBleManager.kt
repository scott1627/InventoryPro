package com.inventorypro.scanner.printer

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.util.UUID

/**
 * Manages Bluetooth Low Energy discovery, GATT connection, and transmission
 * to Katasymbol / Supvan E11 and E10 label printers.
 */
class SupvanBleManager(private val context: Context) {

    companion object {
        private const val TAG = "SupvanBleManager"
        private const val PREFS_NAME = "scanner_prefs"
        private const val KEY_PRINTER_MAC = "pref_printer_mac"
        private const val KEY_PRINTER_NAME = "pref_printer_name"

        fun getSavedPrinterMac(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_PRINTER_MAC, null)
        }

        fun getSavedPrinterName(context: Context): String? {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getString(KEY_PRINTER_NAME, null)
        }

        fun savePrinter(context: Context, name: String?, mac: String?) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putString(KEY_PRINTER_NAME, name)
                .putString(KEY_PRINTER_MAC, mac)
                .apply()
        }

        fun clearSavedPrinter(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .remove(KEY_PRINTER_NAME)
                .remove(KEY_PRINTER_MAC)
                .apply()
        }

        fun hasPermissions(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED
            }
        }

        fun getRequiredPermissions(): Array<String> {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.BLUETOOTH, Manifest.permission.BLUETOOTH_ADMIN)
            }
        }
    }

    data class DiscoveredPrinter(
        val name: String,
        val address: String,
        val rssi: Int
    )

    private val bluetoothManager: BluetoothManager? by lazy {
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        bluetoothManager?.adapter
    }

    private var activeScanCallback: ScanCallback? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    fun isBluetoothEnabled(): Boolean {
        return bluetoothAdapter?.isEnabled == true
    }

    /**
     * Scans for nearby BLE label printers.
     */
    @SuppressLint("MissingPermission")
    fun startScan(
        onDeviceFound: (DiscoveredPrinter) -> Unit,
        onScanFinished: () -> Unit,
        scanDurationMs: Long = 10000
    ) {
        if (!hasPermissions(context) || bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            onScanFinished()
            return
        }

        stopScan()

        val scanner = bluetoothAdapter?.bluetoothLeScanner
        if (scanner == null) {
            onScanFinished()
            return
        }

        val discoveredAddresses = HashSet<String>()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                result?.device?.let { device ->
                    val address = device.address ?: return
                    val name = device.name ?: result.scanRecord?.deviceName ?: "Unknown BLE Device"

                    // Match Katasymbol / Supvan patterns or accept if service matches
                    val isKatasymbol = name.contains("E11", ignoreCase = true) ||
                            name.contains("E10", ignoreCase = true) ||
                            name.contains("Kata", ignoreCase = true) ||
                            name.contains("Supvan", ignoreCase = true) ||
                            name.startsWith("T00", ignoreCase = true) ||
                            name.startsWith("T01", ignoreCase = true) ||
                            name.startsWith("T02", ignoreCase = true)

                    val hasSupvanService = result.scanRecord?.serviceUuids?.any {
                        it.uuid.toString().equals(SupvanProtocol.SERVICE_UUID_FEE7, ignoreCase = true)
                    } == true

                    if ((isKatasymbol || hasSupvanService || discoveredAddresses.isEmpty()) && !discoveredAddresses.contains(address)) {
                        discoveredAddresses.add(address)
                        mainHandler.post {
                            onDeviceFound(DiscoveredPrinter(name, address, result.rssi))
                        }
                    }
                }
            }

            override fun onScanFailed(errorCode: Int) {
                Log.w(TAG, "BLE scan failed: $errorCode")
                mainHandler.post { onScanFinished() }
            }
        }

        activeScanCallback = callback

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        try {
            scanner.startScan(null, settings, callback)
            mainHandler.postDelayed({
                stopScan()
                onScanFinished()
            }, scanDurationMs)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting BLE scan", e)
            onScanFinished()
        }
    }

    @SuppressLint("MissingPermission")
    fun stopScan() {
        activeScanCallback?.let { callback ->
            try {
                bluetoothAdapter?.bluetoothLeScanner?.stopScan(callback)
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping scan", e)
            }
            activeScanCallback = null
        }
    }

    /**
     * Connects to printer, prepares data pipeline, transmits raster, and prints.
     */
    @SuppressLint("MissingPermission")
    fun printBitmap(
        deviceAddress: String,
        bitmap: Bitmap,
        density: Int = 4,
        copies: Int = 1,
        onProgress: (String) -> Unit,
        onComplete: (Boolean, String?) -> Unit
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            var gatt: BluetoothGatt? = null
            try {
                if (!hasPermissions(context)) {
                    withContext(Dispatchers.Main) { onComplete(false, "Bluetooth permissions not granted") }
                    return@launch
                }
                if (!isBluetoothEnabled()) {
                    withContext(Dispatchers.Main) { onComplete(false, "Bluetooth is disabled") }
                    return@launch
                }

                val device = bluetoothAdapter?.getRemoteDevice(deviceAddress)
                if (device == null) {
                    withContext(Dispatchers.Main) { onComplete(false, "Printer device not found ($deviceAddress)") }
                    return@launch
                }

                withContext(Dispatchers.Main) { onProgress("Connecting to printer...") }

                val connectedDeferred = CompletableDeferred<Boolean>()
                val servicesDeferred = CompletableDeferred<Boolean>()
                val mtuDeferred = CompletableDeferred<Int>()

                var writeCharacteristic: BluetoothGattCharacteristic? = null

                @SuppressLint("MissingPermission")
                val callback = object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(g: BluetoothGatt?, status: Int, newState: Int) {
                        if (newState == BluetoothProfile.STATE_CONNECTED) {
                            connectedDeferred.complete(true)
                            g?.discoverServices()
                        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                            connectedDeferred.complete(false)
                        }
                    }

                    override fun onServicesDiscovered(g: BluetoothGatt?, status: Int) {
                        if (status == BluetoothGatt.GATT_SUCCESS) {
                            servicesDeferred.complete(true)
                        } else {
                            servicesDeferred.complete(false)
                        }
                    }

                    override fun onMtuChanged(g: BluetoothGatt?, mtu: Int, status: Int) {
                        Log.i(TAG, "onMtuChanged: mtu=$mtu, status=$status")
                        if (status == BluetoothGatt.GATT_SUCCESS) {
                            mtuDeferred.complete(mtu)
                        } else {
                            mtuDeferred.complete(23)
                        }
                    }
                }

                @SuppressLint("MissingPermission")
                val localGatt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
                } else {
                    device.connectGatt(context, false, callback)
                }
                gatt = localGatt

                // Wait for connection with timeout
                val connected = withTimeoutOrNull(8000) { connectedDeferred.await() } ?: false
                if (!connected) {
                    withContext(Dispatchers.Main) { onComplete(false, "Failed to connect to printer") }
                    return@launch
                }

                withContext(Dispatchers.Main) { onProgress("Discovering printer services...") }
                val discovered = withTimeoutOrNull(6000) { servicesDeferred.await() } ?: false
                if (!discovered) {
                    withContext(Dispatchers.Main) { onComplete(false, "Could not discover printer services") }
                    return@launch
                }

                // Locate write characteristic (FEC1 under FEE7 or fallback)
                val targetServiceUuid = UUID.fromString(SupvanProtocol.SERVICE_UUID_FEE7)
                val targetCharUuid = UUID.fromString(SupvanProtocol.CHAR_UUID_FEC1)

                val service = localGatt.getService(targetServiceUuid)
                if (service != null) {
                    writeCharacteristic = service.getCharacteristic(targetCharUuid)
                }

                // Fallback scan if primary not located
                if (writeCharacteristic == null) {
                    for (srv in localGatt.services) {
                        for (ch in srv.characteristics) {
                            val props = ch.properties
                            if ((props and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) ||
                                (props and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0)) {
                                writeCharacteristic = ch
                                break
                            }
                        }
                        if (writeCharacteristic != null) break
                    }
                }

                if (writeCharacteristic == null) {
                    withContext(Dispatchers.Main) { onComplete(false, "Printer characteristic not supported") }
                    return@launch
                }

                // Configure notifications and negotiate MTU
                var negotiatedMtu = 23
                try {
                    localGatt.setCharacteristicNotification(writeCharacteristic, true)
                    val cccd = writeCharacteristic.getDescriptor(UUID.fromString(SupvanProtocol.CCCD_UUID))
                    if (cccd != null) {
                        cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        localGatt.writeDescriptor(cccd)
                        delay(60)
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        localGatt.requestMtu(200)
                        negotiatedMtu = withTimeoutOrNull(1500) { mtuDeferred.await() } ?: 23
                        Log.i(TAG, "Negotiated MTU: $negotiatedMtu")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Notification or MTU setup warning: ${e.message}")
                }

                val sliceSize = if (negotiatedMtu >= 131) 128 else (negotiatedMtu - 3).coerceIn(20, 128)

                withContext(Dispatchers.Main) { onProgress("Encoding label & compressing...") }

                // 1. Pack bitmap to column-major raster
                val raster = LabelBitmapGenerator.bitmapToColumnMajorRaster(bitmap)
                // 2. Wrap into pre-LZMA page buffer
                val preLzma = SupvanProtocol.buildPreLzmaBuffer(raster, bitmap.width, density)
                // 3. Compress using LZMA-Alone
                val compressed = SupvanProtocol.compressLzmaAlone(preLzma)
                // 4. Slice into 506-byte DMA chunks
                val dmaChunks = SupvanProtocol.splitIntoDmaChunks(compressed)

                withContext(Dispatchers.Main) { onProgress("Configuring printer...") }

                // Helper write function with pacing and retry mechanism
                suspend fun writeData(packet: ByteArray, retries: Int = 5, retryDelayMs: Long = 25): Boolean {
                    writeCharacteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                    writeCharacteristic.value = packet
                    for (attempt in 0..retries) {
                        val success = localGatt.writeCharacteristic(writeCharacteristic)
                        if (success) return true
                        delay(retryDelayMs)
                    }
                    Log.w(TAG, "writeCharacteristic failed after $retries retries")
                    return false
                }

                // 1. Set Density (headrate)
                val headrate = SupvanProtocol.computeHeadrate(density)
                val cmdDensity = SupvanProtocol.buildCommandFrameIntParam(SupvanProtocol.CMD_BLTCMD_SET_HEADRATE, headrate)
                writeData(cmdDensity)
                delay(60)

                // 2. Start Print Job
                val cmdStart = SupvanProtocol.buildCommandFrameIntParam(SupvanProtocol.CMD_START_PRINT, 0)
                writeData(cmdStart)
                delay(120)

                // 3. Stream DMA Chunks per copy
                val totalCopies = copies.coerceAtLeast(1)
                for (c in 1..totalCopies) {
                    withContext(Dispatchers.Main) {
                        onProgress("Sending copy $c of $totalCopies...")
                    }

                    // Bulk Init frame for this page
                    val cmdBulk = SupvanProtocol.buildNextZippedBulkFrame(dmaChunks.size)
                    writeData(cmdBulk)
                    delay(60)

                    for (chunk in dmaChunks) {
                        val envelope = SupvanProtocol.wrapDmaEnvelope(chunk)
                        val subchunks = SupvanProtocol.splitEnvelopeForBle(envelope, sliceSize)
                        for (sub in subchunks) {
                            writeData(sub)
                            delay(50) // 50ms inter-subchunk pacing (DMA_BLE_SUBCHUNK_DELAY_S)
                        }
                    }

                    // Send BUF_FULL to commit page to print engine
                    val cmdBufFull = SupvanProtocol.buildCommandFrameIntParam(SupvanProtocol.CMD_BUF_FULL, 0)
                    writeData(cmdBufFull)
                    delay(200)
                }

                withContext(Dispatchers.Main) { onProgress("Printing label...") }

                // Crucial: Hold GATT connection while printer's stepper motor feeds and thermal head prints
                // (Physical feed of a 40-50mm label takes ~3.5 to 5.0 seconds; disconnecting early aborts print)
                delay(5000)

                withContext(Dispatchers.Main) {
                    onComplete(true, null)
                }

            } catch (e: Exception) {
                Log.e(TAG, "Printing failed", e)
                withContext(Dispatchers.Main) {
                    onComplete(false, e.message ?: "Unknown error during print")
                }
            } finally {
                try {
                    gatt?.disconnect()
                    gatt?.close()
                } catch (e: Exception) {
                    // ignore cleanup errors
                }
            }
        }
    }
}
