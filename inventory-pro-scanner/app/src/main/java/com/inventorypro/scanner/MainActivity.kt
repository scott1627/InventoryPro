package com.inventorypro.scanner

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Rect
import android.media.AudioManager
import android.media.ExifInterface
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.inventorypro.scanner.databinding.ActivityMainBinding
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import com.inventorypro.scanner.printer.PrintLabelDialog
import com.inventorypro.scanner.printer.SupvanBleManager
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val client = OkHttpClient()
    private var toneGenerator: ToneGenerator? = null

    private var currentPartId: String? = null
    private var currentPartName: String? = null
    private var currentPartCategory: String? = null
    private var currentPartLocation: String? = null
    private var currentPartLocationColor: String? = null
    private var currentPartUpc: String? = null
    private var currentPartImageUrl: String? = null
    private var tempPhotoFile: File? = null
    private val currentBinParts = mutableListOf<com.inventorypro.scanner.printer.LabelBitmapGenerator.LabelPartInfo>()

    private lateinit var bleManager: SupvanBleManager

    private var isZebraEnabled = true
    private var isCameraEnabled = true
    private var isManualEnabled = true
    private var isReceiverRegistered = false

    private lateinit var searchAdapter: SearchResultAdapter
    private lateinit var jobAdapter: JobAdapter
    private lateinit var sessionHistoryAdapter: SessionHistoryAdapter
    private val sessionHistoryList = mutableListOf<SessionHistoryItem>()

    // Launcher for image cropping activity
    private val cropImageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            val croppedPath = result.data?.getStringExtra(CropImageActivity.EXTRA_CROPPED_PATH)
            if (!croppedPath.isNullOrEmpty() && File(croppedPath).exists()) {
                uploadCapturedPhoto(File(croppedPath))
            } else if (tempPhotoFile != null && tempPhotoFile!!.exists()) {
                uploadCapturedPhoto(tempPhotoFile!!)
            }
        } else {
            val retake = result.data?.getBooleanExtra(CropImageActivity.EXTRA_RETAKE, false) ?: false
            if (retake) {
                launchCameraCapture()
            } else {
                tempPhotoFile?.delete()
                tempPhotoFile = null
            }
        }
    }

    // Launcher for capturing photo directly via system camera without opening a file picker
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && tempPhotoFile != null && tempPhotoFile!!.exists()) {
            val intent = Intent(this, CropImageActivity::class.java).apply {
                putExtra(CropImageActivity.EXTRA_IMAGE_PATH, tempPhotoFile!!.absolutePath)
                putExtra(CropImageActivity.EXTRA_PART_NAME, currentPartName ?: "")
            }
            cropImageLauncher.launch(intent)
        } else {
            tempPhotoFile?.delete()
            tempPhotoFile = null
        }
    }

    // Permission launcher for camera access if required on the device
    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            launchCameraCapture()
        } else {
            Toast.makeText(this, "Camera permission is required to capture photos", Toast.LENGTH_SHORT).show()
        }
    }

    // Broadcast receiver to listen for Zebra DataWedge intent
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return

            // Standard Zebra DataWedge intent fields
            val scanData = intent.getStringExtra("com.symbol.datawedge.data_string") ?: ""
            val scanType = intent.getStringExtra("com.symbol.datawedge.label_type") ?: ""

            if (scanData.isNotEmpty()) {
                Handler(Looper.getMainLooper()).post {
                    val currentTabId = binding.bottomNavigation.selectedItemId
                    if (currentTabId == R.id.nav_scan) {
                        binding.tvScanStatus.text = "Scanned: $scanData ($scanType)"
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.primary))
                        handleIncomingScan(scanData)
                    } else if (currentTabId == R.id.nav_search) {
                        binding.etSearchQuery.setText(scanData)
                        performSearch(scanData)
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Hide the default Action Bar since we have a custom header bar
        supportActionBar?.hide()

        // Ensure root layout receives focus initially so no input field auto-focuses or opens keyboard
        binding.root.requestFocus()
        binding.etAdjustQuantity.clearFocus()
        binding.etManualBarcode.clearFocus()

        // Setup Zebra DataWedge Profile programmatically
        setupDataWedgeProfile()

        // Initialize audio feedback
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        binding.btnLookupManual.setOnClickListener {
            val barcode = binding.etManualBarcode.text.toString().trim()
            if (barcode.isNotEmpty()) {
                binding.tvScanStatus.text = "Manual Lookup: $barcode"
                handleIncomingScan(barcode)
            } else {
                Toast.makeText(this, "Please enter a barcode", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnQuickAdd.setOnClickListener {
            adjustQuantity(getAdjustmentAmount())
        }

        binding.btnQuickDeduct.setOnClickListener {
            adjustQuantity(-getAdjustmentAmount())
        }

        binding.fabCameraScan.setOnClickListener {
            startCameraScan()
        }

        binding.btnCameraScanPlaceholder.setOnClickListener {
            startCameraScan()
        }

        bleManager = SupvanBleManager(this)

        binding.btnCapturePhoto.setOnClickListener {
            checkAndLaunchCamera()
        }

        binding.containerPhotoPreview.setOnClickListener {
            checkAndLaunchCamera()
        }

        binding.tvBinSharedBadge.setOnClickListener {
            val loc = currentPartLocation
            if (!loc.isNullOrBlank()) {
                lookupBin(loc)
            } else {
                binding.btnPrintLabel.performClick()
            }
        }

        binding.tvPartLocation.setOnClickListener {
            val loc = currentPartLocation
            if (!loc.isNullOrBlank()) {
                lookupBin(loc)
            }
        }

        binding.btnPrintLabel.setOnClickListener {
            val partId = currentPartId
            if (partId == null) {
                Toast.makeText(this, "Please scan or select a part first", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (!SupvanBleManager.hasPermissions(this)) {
                androidx.core.app.ActivityCompat.requestPermissions(
                    this,
                    SupvanBleManager.getRequiredPermissions(),
                    102
                )
                return@setOnClickListener
            }

            val config = getCredentials()
            val serverUrl = config?.first
            val credential = config?.second

            PrintLabelDialog(
                context = this,
                partId = partId,
                partName = currentPartName ?: "Item",
                binLocation = currentPartLocation ?: "",
                category = currentPartCategory ?: "",
                upcBarcode = currentPartUpc ?: "",
                companionParts = currentBinParts,
                serverUrl = serverUrl,
                credential = credential,
                bleManager = bleManager
            ).show()
        }

        // Initialize Bottom Navigation and Tab Toggling
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            hideKeyboard()
            binding.root.requestFocus()
            when (item.itemId) {
                R.id.nav_scan -> {
                    binding.layoutTabScan.visibility = View.VISIBLE
                    binding.layoutTabSearch.visibility = View.GONE
                    binding.layoutTabJobs.visibility = View.GONE
                    true
                }
                R.id.nav_search -> {
                    binding.layoutTabScan.visibility = View.GONE
                    binding.layoutTabSearch.visibility = View.VISIBLE
                    binding.layoutTabJobs.visibility = View.GONE
                    true
                }
                R.id.nav_jobs -> {
                    binding.layoutTabScan.visibility = View.GONE
                    binding.layoutTabSearch.visibility = View.GONE
                    binding.layoutTabJobs.visibility = View.VISIBLE
                    fetchJobs()
                    true
                }
                else -> false
            }
        }

        // Setup Search recyclerview
        searchAdapter = SearchResultAdapter(emptyList()) { part ->
            binding.bottomNavigation.selectedItemId = R.id.nav_scan
            binding.etManualBarcode.setText(part.upc ?: "")
            lookupPart(upc = part.upc, id = part.id)
        }
        binding.rvSearchResults.layoutManager = LinearLayoutManager(this)
        binding.rvSearchResults.adapter = searchAdapter

        binding.btnSearch.setOnClickListener {
            val query = binding.etSearchQuery.text.toString().trim()
            if (query.isNotEmpty()) {
                performSearch(query)
            } else {
                Toast.makeText(this, "Please enter a search query", Toast.LENGTH_SHORT).show()
            }
        }

        binding.etSearchQuery.setOnEditorActionListener { _, _, _ ->
            val query = binding.etSearchQuery.text.toString().trim()
            if (query.isNotEmpty()) {
                performSearch(query)
            }
            true
        }

        // Setup Jobs recyclerview
        jobAdapter = JobAdapter(emptyList()) { job ->
            val intent = Intent(this, JobPickingActivity::class.java).apply {
                putExtra("JOB_ID", job.id)
                putExtra("JOB_NAME", job.name)
            }
            startActivity(intent)
        }
        binding.rvJobsList.layoutManager = LinearLayoutManager(this)
        binding.rvJobsList.adapter = jobAdapter

        // Setup Interactive Session History
        sessionHistoryAdapter = SessionHistoryAdapter(
            items = sessionHistoryList,
            onItemClick = { item ->
                binding.tvScanStatus.text = "Loading ${item.partName}..."
                binding.tvScanStatus.setTextColor(ContextCompat.getColor(this, R.color.primary))
                lookupPart(upc = item.upc, id = item.partId)
                binding.scrollScanTab.smoothScrollTo(0, 0)
            },
            onUndoClick = { item ->
                revertAdjustment(item)
            }
        )
        binding.rvSessionHistory.layoutManager = LinearLayoutManager(this)
        binding.rvSessionHistory.adapter = sessionHistoryAdapter

        binding.btnClearHistory.setOnClickListener {
            sessionHistoryList.clear()
            sessionHistoryAdapter.notifyDataSetChanged()
            updateHistoryUIState()
            Toast.makeText(this, "Session history cleared", Toast.LENGTH_SHORT).show()
        }
        updateHistoryUIState()
    }

    override fun onResume() {
        super.onResume()
        // Ensure inputs don't auto-grab focus and keyboard is hidden on app open/resume
        binding.root.requestFocus()
        binding.etAdjustQuantity.clearFocus()
        hideKeyboard()

        // Load preferences
        val prefs = getSharedPreferences("ScannerConfig", Context.MODE_PRIVATE)
        isZebraEnabled = prefs.getBoolean("EnableZebra", true)
        isCameraEnabled = prefs.getBoolean("EnableCamera", true)
        isManualEnabled = prefs.getBoolean("EnableManual", true)

        // Apply UI visibilities
        binding.fabCameraScan.visibility = if (isCameraEnabled) View.VISIBLE else View.GONE
        binding.btnCameraScanPlaceholder.visibility = if (isCameraEnabled) View.VISIBLE else View.GONE
        binding.layoutManualLookup.visibility = if (isManualEnabled) View.VISIBLE else View.GONE

        // Register receiver for Zebra DataWedge broadcast intents if enabled
        if (isZebraEnabled && !isReceiverRegistered) {
            val filter = IntentFilter("com.inventorypro.scanner.ACTION")
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(scanReceiver, filter)
            }
            isReceiverRegistered = true
            binding.tvScanStatus.text = "Ready to Scan / Aim laser to query"
        } else if (!isZebraEnabled) {
            binding.tvScanStatus.text = "Ready to Scan / Tap camera or type UPC"
        }
        binding.tvScanStatus.setTextColor(resources.getColor(R.color.text_secondary))
    }

    override fun onPause() {
        super.onPause()
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(scanReceiver)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            isReceiverRegistered = false
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        toneGenerator?.release()
    }

    private fun hideKeyboard() {
        val view = currentFocus ?: binding.root
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(view.windowToken, 0)
    }

    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean {
        if (ev?.action == MotionEvent.ACTION_DOWN) {
            val v = currentFocus
            if (v is EditText) {
                val outRect = Rect()
                v.getGlobalVisibleRect(outRect)
                if (!outRect.contains(ev.rawX.toInt(), ev.rawY.toInt())) {
                    v.clearFocus()
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                    imm?.hideSoftInputFromWindow(v.windowToken, 0)
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    private fun getAdjustmentAmount(): Int {
        val qtyText = binding.etAdjustQuantity.text.toString().trim()
        return qtyText.toIntOrNull() ?: 1
    }

    private fun updateHistoryUIState() {
        val count = sessionHistoryList.size
        binding.tvHistoryHeader.text = "RECENT SESSION UPDATES ($count)"
        if (count > 0) {
            binding.rvSessionHistory.visibility = View.VISIBLE
            binding.layoutEmptyHistory.visibility = View.GONE
            binding.btnClearHistory.visibility = View.VISIBLE
        } else {
            binding.rvSessionHistory.visibility = View.GONE
            binding.layoutEmptyHistory.visibility = View.VISIBLE
            binding.btnClearHistory.visibility = View.GONE
        }
    }

    private fun revertAdjustment(item: SessionHistoryItem) {
        val config = getCredentials() ?: run {
            Toast.makeText(this, "Setup required", Toast.LENGTH_SHORT).show()
            return
        }

        val inverseAmount = -item.deltaAmount
        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/adjust" else "$serverUrl/api/scanner/adjust"

        binding.layoutLoadingOverlay.visibility = View.VISIBLE
        binding.tvLoadingMessage.text = "Reverting adjustment for ${item.partName}..."

        val jsonBody = JSONObject().apply {
            put("partId", item.partId)
            put("amount", inverseAmount)
        }

        val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Revert failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val json = JSONObject(responseData)
                            val newStock = json.getInt("newStock")

                            // If this part is currently displayed on screen, update stock text
                            if (currentPartId == item.partId) {
                                binding.tvCurrentStock.text = newStock.toString()
                            }

                            // Remove item from session history
                            sessionHistoryAdapter.removeItem(item)
                            updateHistoryUIState()

                            val revertSign = if (inverseAmount > 0) "+$inverseAmount" else "$inverseAmount"
                            binding.tvScanStatus.text = "Reverted: ${item.partName} ($revertSign, Stock: $newStock)"
                            binding.tvScanStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.green_add))
                            Toast.makeText(this@MainActivity, "Reverted ${item.partName} ($revertSign)", Toast.LENGTH_SHORT).show()
                            playBeep(true)
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "Revert response error", Toast.LENGTH_SHORT).show()
                            playBeep(false)
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Revert failed ($code)", Toast.LENGTH_SHORT).show()
                        playBeep(false)
                    }
                }
            }
        })
    }

    private fun playBeep(success: Boolean) {
        try {
            if (success) {
                // Short high-pitched beep
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
            } else {
                // Long lower double beep
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 350)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun getCredentials(): Pair<String, String>? {
        val prefs = getSharedPreferences("ScannerConfig", Context.MODE_PRIVATE)
        val url = prefs.getString("ServerUrl", "") ?: ""
        val user = prefs.getString("Username", "") ?: ""
        val pass = prefs.getString("Password", "") ?: ""

        if (url.isEmpty() || user.isEmpty() || pass.isEmpty()) {
            return null
        }
        return Pair(url, Credentials.basic(user, pass))
    }

    private fun handleIncomingScan(scanData: String) {
        val trimmed = scanData.trim()
        if (trimmed.isEmpty()) return

        // Check if the scanned barcode/QR is a Bin identifier (e.g. starts with "BIN:", "BIN-", "BIN ")
        if (trimmed.startsWith("BIN:", ignoreCase = true) ||
            trimmed.startsWith("BIN-", ignoreCase = true) ||
            trimmed.startsWith("BIN ", ignoreCase = true)) {
            val cleanLocation = trimmed.replace(Regex("^(?i)bin[:\\s\\-]+"), "").trim()
            lookupBin(cleanLocation.ifEmpty { trimmed })
        } else {
            // First look up as part barcode/UPC; fallback automatically to bin lookup if not found (404)
            lookupPart(upc = trimmed, fallbackToBin = true)
        }
    }

    private fun lookupPart(upc: String?, id: String? = null, fallbackToBin: Boolean = false) {
        if (upc.isNullOrEmpty() && id.isNullOrEmpty()) return

        if (binding.layoutLoadingOverlay.visibility == View.VISIBLE) {
            // Already loading a part, ignore subsequent requests
            return
        }

        val config = getCredentials()
        if (config == null) {
            binding.tvScanStatus.text = "Setup Required: Tap Gear icon"
            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
            playBeep(false)
            startActivity(Intent(this, SettingsActivity::class.java))
            return
        }

        binding.layoutLoadingOverlay.visibility = View.VISIBLE
        binding.tvLoadingMessage.text = "Loading part data..."

        val (serverUrl, credential) = config
        val endpoint = if (!upc.isNullOrEmpty()) {
            if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/part?upc=$upc" else "$serverUrl/api/scanner/part?upc=$upc"
        } else {
            if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/part?id=$id" else "$serverUrl/api/scanner/part?id=$id"
        }

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    binding.tvScanStatus.text = "Network Error: ${e.message}"
                    binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                    binding.cardPlaceholder.visibility = View.VISIBLE
                    binding.cardPartInfo.visibility = View.GONE
                    binding.tvBinSharedBadge.visibility = View.GONE
                    currentBinParts.clear()
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val json = JSONObject(responseData)
                            currentPartId = json.getString("id")
                            currentPartName = json.getString("name")
                            currentPartCategory = json.optString("category", "")
                            currentPartLocation = json.optString("location", "")
                            currentPartLocationColor = json.optString("locationColor", "#4b5563")
                            currentPartUpc = if (json.has("upc") && !json.isNull("upc")) json.getString("upc") else upc

                            binding.tvPartName.text = json.getString("name")
                            binding.tvPartDescription.text = json.optString("description", "No description")
                            binding.tvPartCategory.text = json.getString("category").uppercase()
                            binding.tvPartLocation.text = json.getString("location")
                            binding.tvCurrentStock.text = json.getInt("stock").toString()

                            // Parse companion parts in the same bin
                            currentBinParts.clear()
                            val binPartsArr = json.optJSONArray("binParts")
                            if (binPartsArr != null) {
                                for (i in 0 until binPartsArr.length()) {
                                    val bp = binPartsArr.getJSONObject(i)
                                    currentBinParts.add(
                                        com.inventorypro.scanner.printer.LabelBitmapGenerator.LabelPartInfo(
                                            id = bp.getString("id"),
                                            name = bp.getString("name"),
                                            binLocation = currentPartLocation ?: "",
                                            category = bp.optString("category", ""),
                                            upcBarcode = bp.optString("upc", ""),
                                            stock = bp.optInt("stock", 0)
                                        )
                                    )
                                }
                            }

                            if (currentBinParts.size > 1) {
                                binding.tvBinSharedBadge.visibility = View.VISIBLE
                                binding.tvBinSharedBadge.text = "${currentBinParts.size} in Bin"
                            } else {
                                binding.tvBinSharedBadge.visibility = View.GONE
                            }

                            // Set location color dot
                            try {
                                val colorStr = json.optString("locationColor", "#4b5563")
                                binding.viewLocationColor.setBackgroundColor(Color.parseColor(colorStr))
                            } catch (e: Exception) {
                                binding.viewLocationColor.setBackgroundColor(Color.GRAY)
                            }

                            // Load part photo if available, or reset to placeholder
                            val imageUrl = json.optString("imageUrl", "")
                            currentPartImageUrl = if (imageUrl.isNotEmpty() && imageUrl != "null") imageUrl else null
                            if (!currentPartImageUrl.isNullOrEmpty()) {
                                binding.tvPhotoStatus.text = "Loading photo..."
                                binding.btnCapturePhoto.text = "Update Photo"
                                binding.ivPartPhoto.visibility = View.GONE
                                binding.ivPhotoPlaceholder.visibility = View.VISIBLE
                                loadPartPhotoFromServer(currentPartImageUrl!!)
                            } else {
                                resetPartPhotoUI()
                            }

                            binding.cardPlaceholder.visibility = View.GONE
                            binding.cardPartInfo.visibility = View.VISIBLE
                            binding.tvScanStatus.text = "Scan matched: ${json.getString("name")}"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.green_add))
                            binding.etManualBarcode.setText("")
                            binding.etAdjustQuantity.clearFocus()
                            binding.root.requestFocus()
                            hideKeyboard()
                            playBeep(true)
                        } catch (e: Exception) {
                            binding.tvScanStatus.text = "Data parse error"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                            binding.cardPlaceholder.visibility = View.VISIBLE
                            binding.cardPartInfo.visibility = View.GONE
                            playBeep(false)
                        }
                    } else if (code == 404) {
                        if (fallbackToBin && !upc.isNullOrEmpty()) {
                            // If UPC lookup fails, seamlessly check if the scanned value represents a storage bin!
                            lookupBin(upc)
                        } else {
                            binding.tvScanStatus.text = if (!upc.isNullOrEmpty()) "Part not found for barcode: $upc" else "Part not found"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                            binding.cardPlaceholder.visibility = View.VISIBLE
                            binding.cardPartInfo.visibility = View.GONE
                            playBeep(false)
                        }
                    } else if (code == 401) {
                        binding.tvScanStatus.text = "Authentication failed! Tap Settings."
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                        binding.cardPlaceholder.visibility = View.VISIBLE
                        binding.cardPartInfo.visibility = View.GONE
                        playBeep(false)
                    } else {
                        binding.tvScanStatus.text = "Server error ($code)"
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                        binding.cardPlaceholder.visibility = View.VISIBLE
                        binding.cardPartInfo.visibility = View.GONE
                        playBeep(false)
                    }
                }
            }
        })
    }

    private fun lookupBin(locationQuery: String) {
        val config = getCredentials()
        if (config == null) {
            binding.tvScanStatus.text = "Setup Required: Tap Gear icon"
            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
            playBeep(false)
            startActivity(Intent(this, SettingsActivity::class.java))
            return
        }

        binding.layoutLoadingOverlay.visibility = View.VISIBLE
        binding.tvLoadingMessage.text = "Checking bin: $locationQuery..."

        val (serverUrl, credential) = config
        val cleanLocation = locationQuery.replace(Regex("^(?i)bin[:\\s\\-]+"), "").trim().ifEmpty { locationQuery.trim() }
        val encoded = java.net.URLEncoder.encode(cleanLocation, "UTF-8")
        val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/bin?location=$encoded" else "$serverUrl/api/scanner/bin?location=$encoded"

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    binding.tvScanStatus.text = "Network Error: ${e.message}"
                    binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val json = JSONObject(responseData)
                            val binName = json.optString("location", locationQuery)
                            val partsArr = json.optJSONArray("parts") ?: org.json.JSONArray()
                            val partsList = mutableListOf<BinPartItem>()

                            for (i in 0 until partsArr.length()) {
                                val pObj = partsArr.getJSONObject(i)
                                partsList.add(
                                    BinPartItem(
                                        id = pObj.getString("id"),
                                        name = pObj.getString("name"),
                                        description = pObj.optString("description", ""),
                                        upc = if (pObj.has("upc") && !pObj.isNull("upc")) pObj.getString("upc") else null,
                                        category = pObj.optString("category", ""),
                                        location = pObj.optString("location", binName),
                                        locationColor = pObj.optString("locationColor", "#4b5563"),
                                        stock = pObj.optInt("stock", 0),
                                        imageUrl = pObj.optString("imageUrl", null)
                                    )
                                )
                            }

                            if (partsList.isEmpty()) {
                                binding.tvScanStatus.text = "Bin '$binName' found, but contains no parts."
                                binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                                playBeep(false)
                            } else if (partsList.size == 1) {
                                // Exactly 1 part in bin - load directly!
                                val singlePart = partsList[0]
                                binding.tvScanStatus.text = "Bin $binName: Loaded ${singlePart.name}"
                                lookupPart(upc = null, id = singlePart.id, fallbackToBin = false)
                            } else {
                                // Multiple parts in bin - present interactive picker!
                                playBeep(true)
                                binding.tvScanStatus.text = "Bin $binName: ${partsList.size} parts found"
                                binding.tvScanStatus.setTextColor(resources.getColor(R.color.primary))
                                BinPartsPickerDialog(
                                    context = this@MainActivity,
                                    binLocation = binName,
                                    parts = partsList,
                                    onPartSelected = { selectedPart ->
                                        binding.tvScanStatus.text = "Selected: ${selectedPart.name}"
                                        lookupPart(upc = null, id = selectedPart.id, fallbackToBin = false)
                                    }
                                ).show()
                            }
                        } catch (e: Exception) {
                            binding.tvScanStatus.text = "Bin parse error"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                            playBeep(false)
                        }
                    } else {
                        binding.tvScanStatus.text = "No part or bin found for '$locationQuery'"
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                        binding.cardPlaceholder.visibility = View.VISIBLE
                        binding.cardPartInfo.visibility = View.GONE
                        playBeep(false)
                    }
                }
            }
        })
    }

    private fun adjustQuantity(amount: Int) {
        val partId = currentPartId
        val partName = currentPartName
        if (partId == null || partName == null) {
            Toast.makeText(this, "No part selected", Toast.LENGTH_SHORT).show()
            return
        }

        val config = getCredentials()
        if (config == null) {
            Toast.makeText(this, "Setup required", Toast.LENGTH_SHORT).show()
            return
        }

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/adjust" else "$serverUrl/api/scanner/adjust"

        val jsonBody = JSONObject().apply {
            put("partId", partId)
            put("amount", amount)
        }

        val requestBody = jsonBody.toString().toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .post(requestBody)
            .build()

        binding.btnQuickAdd.isEnabled = false
        binding.btnQuickDeduct.isEnabled = false

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.btnQuickAdd.isEnabled = true
                    binding.btnQuickDeduct.isEnabled = true
                    binding.tvScanStatus.text = "Adjustment network failure: ${e.message}"
                    binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.btnQuickAdd.isEnabled = true
                    binding.btnQuickDeduct.isEnabled = true

                    if (code == 200) {
                        try {
                            val json = JSONObject(responseData)
                            val newStock = json.getInt("newStock")
                            binding.tvCurrentStock.text = newStock.toString()

                            // Update Status
                            val actionStr = if (amount > 0) "Added +$amount" else "Deducted $amount"
                            binding.tvScanStatus.text = "Updated: $partName ($actionStr)"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.green_add))

                            // Add to interactive session history
                            val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                            val historyItem = SessionHistoryItem(
                                partId = partId,
                                partName = partName,
                                deltaAmount = amount,
                                newStock = newStock,
                                timestamp = time,
                                category = currentPartCategory,
                                location = currentPartLocation,
                                locationColor = currentPartLocationColor,
                                upc = currentPartUpc
                            )
                            sessionHistoryAdapter.addItem(historyItem)
                            binding.rvSessionHistory.scrollToPosition(0)
                            updateHistoryUIState()

                            // Reset adjustment field to 1
                            binding.etAdjustQuantity.setText("1")
                            binding.etAdjustQuantity.clearFocus()
                            binding.root.requestFocus()
                            hideKeyboard()

                            playBeep(true)
                        } catch (e: Exception) {
                            binding.tvScanStatus.text = "Adjustment response parse error"
                            binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                            playBeep(false)
                        }
                    } else {
                        try {
                            val json = JSONObject(responseData)
                            val errMsg = json.optString("error", "Adjustment failed ($code)")
                            binding.tvScanStatus.text = errMsg
                        } catch (e: Exception) {
                            binding.tvScanStatus.text = "Adjustment failed ($code)"
                        }
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                        playBeep(false)
                    }
                }
            }
        })
    }

    private fun performSearch(query: String) {
        val config = getCredentials()
        if (config == null) {
            Toast.makeText(this, "Setup required", Toast.LENGTH_SHORT).show()
            return
        }

        binding.layoutLoadingOverlay.visibility = View.VISIBLE
        binding.tvLoadingMessage.text = "Searching parts..."

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) {
            "${serverUrl}api/scanner/search?q=$query"
        } else {
            "$serverUrl/api/scanner/search?q=$query"
        }

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Search failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val jsonArray = org.json.JSONArray(responseData)
                            val results = mutableListOf<PartSearchResult>()
                            for (i in 0 until jsonArray.length()) {
                                val obj = jsonArray.getJSONObject(i)
                                results.add(
                                    PartSearchResult(
                                        id = obj.getString("id"),
                                        name = obj.getString("name"),
                                        description = obj.optString("description", ""),
                                        upc = obj.optString("upc", null),
                                        category = obj.getString("category"),
                                        location = obj.getString("location"),
                                        locationColor = obj.optString("locationColor", "#4b5563"),
                                        stock = obj.getInt("stock"),
                                        imageUrl = obj.optString("imageUrl", null)
                                    )
                                )
                            }
                            searchAdapter.updateItems(results)
                            if (results.isEmpty()) {
                                Toast.makeText(this@MainActivity, "No parts found matching query", Toast.LENGTH_SHORT).show()
                            }
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "Search parse error", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Search failed with code $code", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun fetchJobs() {
        val config = getCredentials()
        if (config == null) {
            Toast.makeText(this, "Setup required", Toast.LENGTH_SHORT).show()
            return
        }

        binding.layoutLoadingOverlay.visibility = View.VISIBLE
        binding.tvLoadingMessage.text = "Fetching active jobs..."

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) {
            "${serverUrl}api/scanner/jobs"
        } else {
            "$serverUrl/api/scanner/jobs"
        }

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Jobs fetch failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutLoadingOverlay.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val jsonArray = org.json.JSONArray(responseData)
                            val results = mutableListOf<JobItem>()
                            for (i in 0 until jsonArray.length()) {
                                val obj = jsonArray.getJSONObject(i)
                                results.add(
                                    JobItem(
                                        id = obj.getString("id"),
                                        name = obj.getString("name"),
                                        description = obj.optString("description", null),
                                        status = obj.getString("status"),
                                        bomCount = obj.getInt("bomCount"),
                                        createdAt = obj.getString("createdAt")
                                    )
                                )
                            }
                            jobAdapter.updateItems(results)
                        } catch (e: Exception) {
                            Toast.makeText(this@MainActivity, "Jobs parse error", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Jobs fetch failed with code $code", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun startCameraScan() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS)
            .enableAutoZoom()
            .build()

        val scanner = GmsBarcodeScanning.getClient(this, options)
        scanner.startScan()
            .addOnSuccessListener { barcode ->
                val rawValue = barcode?.rawValue
                if (!rawValue.isNullOrEmpty()) {
                    val currentTabId = binding.bottomNavigation.selectedItemId
                    if (currentTabId == R.id.nav_scan) {
                        binding.tvScanStatus.text = "Camera Scanned: $rawValue"
                        binding.tvScanStatus.setTextColor(resources.getColor(R.color.primary))
                        handleIncomingScan(rawValue)
                    } else if (currentTabId == R.id.nav_search) {
                        binding.etSearchQuery.setText(rawValue)
                        performSearch(rawValue)
                    }
                }
            }
            .addOnFailureListener { e ->
                val msg = e.message ?: ""
                if (!msg.contains("cancel", ignoreCase = true)) {
                    Toast.makeText(this, "Scan failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
    }

    private fun checkAndLaunchCamera() {
        if (currentPartId == null) {
            Toast.makeText(this, "Please scan or select a part first", Toast.LENGTH_SHORT).show()
            return
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            launchCameraCapture()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchCameraCapture() {
        val partId = currentPartId ?: return
        try {
            val photoDir = File(cacheDir, "photos").apply { mkdirs() }
            val photoFile = File(photoDir, "part_${partId}_${System.currentTimeMillis()}.jpg")
            tempPhotoFile = photoFile
            val photoUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                photoFile
            )
            // Launches camera directly without prompting user to browse files
            takePictureLauncher.launch(photoUri)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to start camera: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun optimizeAndCompressPhoto(sourceFile: File): File {
        // 1. Decode dimensions only
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeFile(sourceFile.absolutePath, options)
        val origWidth = options.outWidth
        val origHeight = options.outHeight

        // Target max dimension 1200px
        val maxDimension = 1200
        var inSampleSize = 1
        if (origHeight > maxDimension || origWidth > maxDimension) {
            val halfHeight = origHeight / 2
            val halfWidth = origWidth / 2
            while ((halfHeight / inSampleSize) >= maxDimension && (halfWidth / inSampleSize) >= maxDimension) {
                inSampleSize *= 2
            }
        }

        // 2. Decode sampled bitmap into memory
        options.inJustDecodeBounds = false
        options.inSampleSize = inSampleSize
        var bitmap = BitmapFactory.decodeFile(sourceFile.absolutePath, options)
            ?: throw IOException("Could not decode captured image")

        // 3. Correct EXIF orientation from camera sensor
        try {
            val exif = ExifInterface(sourceFile.absolutePath)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
            }
            if (!matrix.isIdentity) {
                val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
                if (rotated != bitmap) {
                    bitmap.recycle()
                    bitmap = rotated
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 4. Downscale precisely if still exceeds max dimension
        if (bitmap.width > maxDimension || bitmap.height > maxDimension) {
            val ratio = minOf(maxDimension.toFloat() / bitmap.width, maxDimension.toFloat() / bitmap.height)
            val targetWidth = (bitmap.width * ratio).toInt()
            val targetHeight = (bitmap.height * ratio).toInt()
            val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
            if (scaled != bitmap) {
                bitmap.recycle()
                bitmap = scaled
            }
        }

        // 5. Compress to optimized JPEG
        val compressedFile = File(cacheDir, "compressed_${System.currentTimeMillis()}.jpg")
        FileOutputStream(compressedFile).use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
        }
        return compressedFile
    }

    private fun uploadCapturedPhoto(photoFile: File) {
        val partId = currentPartId ?: return
        val partName = currentPartName ?: "Part"
        val config = getCredentials() ?: run {
            Toast.makeText(this, "Server setup required", Toast.LENGTH_SHORT).show()
            return
        }

        binding.layoutPhotoUploading.visibility = View.VISIBLE
        binding.btnCapturePhoto.isEnabled = false
        binding.tvPhotoStatus.text = "Uploading photo..."

        Thread {
            var compressedFile: File? = null
            try {
                compressedFile = optimizeAndCompressPhoto(photoFile)
                val (serverUrl, credential) = config
                val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/scanner/part/photo" else "$serverUrl/api/scanner/part/photo"

                val requestBody = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("partId", partId)
                    .addFormDataPart(
                        "image",
                        "part_${partId}.jpg",
                        compressedFile.asRequestBody("image/jpeg".toMediaType())
                    )
                    .build()

                val request = Request.Builder()
                    .url(endpoint)
                    .header("Authorization", credential)
                    .post(requestBody)
                    .build()

                client.newCall(request).enqueue(object : okhttp3.Callback {
                    override fun onFailure(call: okhttp3.Call, e: IOException) {
                        Handler(Looper.getMainLooper()).post {
                            binding.layoutPhotoUploading.visibility = View.GONE
                            binding.btnCapturePhoto.isEnabled = true
                            binding.tvPhotoStatus.text = "Upload failed"
                            Toast.makeText(this@MainActivity, "Photo upload failed: ${e.message}", Toast.LENGTH_SHORT).show()
                            playBeep(false)
                            compressedFile?.delete()
                            photoFile.delete()
                        }
                    }

                    override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                        val responseData = response.body?.string() ?: ""
                        val code = response.code
                        response.close()

                        Handler(Looper.getMainLooper()).post {
                            binding.layoutPhotoUploading.visibility = View.GONE
                            binding.btnCapturePhoto.isEnabled = true

                            if (code == 200) {
                                try {
                                    val json = JSONObject(responseData)
                                    val newImageUrl = json.optString("imageUrl", "")
                                    currentPartImageUrl = newImageUrl

                                    val localBitmap = BitmapFactory.decodeFile(compressedFile?.absolutePath)
                                    if (localBitmap != null) {
                                        displayPartPhoto(localBitmap)
                                    } else if (newImageUrl.isNotEmpty()) {
                                        loadPartPhotoFromServer(newImageUrl)
                                    }

                                    binding.tvPhotoStatus.text = "Photo saved"
                                    binding.btnCapturePhoto.text = "Update Photo"
                                    binding.tvScanStatus.text = "Photo updated for $partName"
                                    binding.tvScanStatus.setTextColor(resources.getColor(R.color.green_add))
                                    Toast.makeText(this@MainActivity, "Photo updated successfully!", Toast.LENGTH_SHORT).show()
                                    playBeep(true)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            } else {
                                binding.tvPhotoStatus.text = "Upload failed ($code)"
                                Toast.makeText(this@MainActivity, "Server rejected photo ($code)", Toast.LENGTH_SHORT).show()
                                playBeep(false)
                            }
                            compressedFile?.delete()
                            photoFile.delete()
                        }
                    }
                })
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutPhotoUploading.visibility = View.GONE
                    binding.btnCapturePhoto.isEnabled = true
                    binding.tvPhotoStatus.text = "Processing error"
                    Toast.makeText(this@MainActivity, "Error preparing image: ${e.message}", Toast.LENGTH_SHORT).show()
                    playBeep(false)
                    compressedFile?.delete()
                    photoFile.delete()
                }
            }
        }.start()
    }

    private fun displayPartPhoto(bitmap: Bitmap) {
        binding.ivPartPhoto.setImageBitmap(bitmap)
        binding.ivPartPhoto.visibility = View.VISIBLE
        binding.ivPhotoPlaceholder.visibility = View.GONE
        binding.btnCapturePhoto.text = "Update Photo"
        binding.tvPhotoStatus.text = "Photo saved"
    }

    private fun resetPartPhotoUI() {
        binding.ivPartPhoto.setImageDrawable(null)
        binding.ivPartPhoto.visibility = View.GONE
        binding.ivPhotoPlaceholder.visibility = View.VISIBLE
        binding.btnCapturePhoto.text = "Take Photo"
        binding.tvPhotoStatus.text = "No photo assigned"
        binding.layoutPhotoUploading.visibility = View.GONE
        binding.btnCapturePhoto.isEnabled = true
    }

    private fun loadPartPhotoFromServer(imageUrl: String) {
        val config = getCredentials() ?: return
        val (serverUrl, credential) = config

        val fullUrl = if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
            imageUrl
        } else {
            val baseUrl = if (serverUrl.endsWith("/")) serverUrl.dropLast(1) else serverUrl
            val path = if (imageUrl.startsWith("/")) imageUrl else "/$imageUrl"
            "$baseUrl$path"
        }

        val request = Request.Builder()
            .url(fullUrl)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.tvPhotoStatus.text = "No photo loaded"
                    binding.ivPartPhoto.visibility = View.GONE
                    binding.ivPhotoPlaceholder.visibility = View.VISIBLE
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                if (response.isSuccessful) {
                    val bytes = response.body?.bytes()
                    response.close()
                    if (bytes != null && bytes.isNotEmpty()) {
                        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        if (bitmap != null) {
                            Handler(Looper.getMainLooper()).post {
                                displayPartPhoto(bitmap)
                            }
                            return
                        }
                    }
                } else {
                    response.close()
                }
                Handler(Looper.getMainLooper()).post {
                    binding.tvPhotoStatus.text = "No photo"
                    binding.ivPartPhoto.visibility = View.GONE
                    binding.ivPhotoPlaceholder.visibility = View.VISIBLE
                }
            }
        })
    }

    private fun setupDataWedgeProfile() {
        val profileName = "InventoryPro"

        // 1. Send intent to create the profile first (in case it doesn't exist)
        val createIntent = Intent().apply {
            action = "com.symbol.datawedge.api.ACTION"
            putExtra("com.symbol.datawedge.api.CREATE_PROFILE", profileName)
        }
        sendBroadcast(createIntent)

        // 2. Configure the profile (associate with our app and set plugins)
        val profileConfig = Bundle().apply {
            putString("PROFILE_NAME", profileName)
            putString("PROFILE_ENABLED", "true")
            putString("CONFIG_MODE", "UPDATE") // Update the existing or newly created profile
        }

        // Configure INTENT Output Plugin
        val intentConfig = Bundle().apply {
            putString("PLUGIN_NAME", "INTENT")
            putString("RESET_CONFIG", "true")
            putBundle("PARAM_LIST", Bundle().apply {
                putString("intent_output_enabled", "true")
                putString("intent_action", "com.inventorypro.scanner.ACTION")
                putString("intent_delivery", "2") // 2 = Broadcast Intent
            })
        }

        // Configure KEYSTROKE Output Plugin (disable it so it doesn't type into text fields)
        val keystrokeConfig = Bundle().apply {
            putString("PLUGIN_NAME", "KEYSTROKE")
            putString("RESET_CONFIG", "true")
            putBundle("PARAM_LIST", Bundle().apply {
                putString("keystroke_output_enabled", "false")
            })
        }

        // Nest the plugin configurations
        profileConfig.putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(intentConfig, keystrokeConfig))

        // Associate application with profile
        val appConfig = Bundle().apply {
            putString("PACKAGE_NAME", packageName)
            putStringArray("ACTIVITY_LIST", arrayOf("*"))
        }
        profileConfig.putParcelableArray("APP_LIST", arrayOf(appConfig))

        // Send the configuration intent
        val configIntent = Intent().apply {
            action = "com.symbol.datawedge.api.ACTION"
            putExtra("com.symbol.datawedge.api.SET_CONFIG", profileConfig)
        }
        sendBroadcast(configIntent)
    }
}
