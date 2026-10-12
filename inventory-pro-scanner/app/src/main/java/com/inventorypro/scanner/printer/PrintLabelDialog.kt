package com.inventorypro.scanner.printer

import android.content.Context
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import com.inventorypro.scanner.R
import com.inventorypro.scanner.databinding.DialogPrintLabelBinding
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException

/**
 * Interactive dialog displaying a live preview of the 96-dot label,
 * with style options (single & combined dual-part), density, copies,
 * printer device status, and print execution.
 */
class PrintLabelDialog(
    private val context: Context,
    private val partId: String,
    private val partName: String,
    private val binLocation: String,
    private val category: String = "",
    private val upcBarcode: String = "",
    private val companionParts: List<LabelBitmapGenerator.LabelPartInfo> = emptyList(),
    private val serverUrl: String? = null,
    private val credential: String? = null,
    private val bleManager: SupvanBleManager
) {

    private val binding = DialogPrintLabelBinding.inflate(LayoutInflater.from(context))
    private val dialog: AlertDialog = AlertDialog.Builder(context)
        .setView(binding.root)
        .create()

    private var currentBitmap: Bitmap? = null
    private var currentCopies = 1
    private var selectedDensity = 4
    private var currentStyle = LabelBitmapGenerator.LabelStyle.BIN_LABEL_QR

    private val availableCompanions = mutableListOf<LabelBitmapGenerator.LabelPartInfo>()
    private var selectedCompanion: LabelBitmapGenerator.LabelPartInfo? = null

    init {
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        setupCompanionsList()
        setupStyleSelector()
        setupDensitySpinner()
        setupCopiesControls()
        setupPrinterInfo()
        setupActionButtons()
        setupDualPartBanner()
        updatePreview()

        // If no companions passed upfront, query the server if credentials exist
        if (availableCompanions.isEmpty() && binLocation.isNotBlank() && !serverUrl.isNullOrBlank() && !credential.isNullOrBlank()) {
            queryBinCompanionsAsync()
        }
    }

    private fun setupCompanionsList() {
        availableCompanions.clear()
        // Filter out the primary part currently being viewed
        val filtered = companionParts.filter { it.id != partId }
        availableCompanions.addAll(filtered)
        if (availableCompanions.isNotEmpty()) {
            selectedCompanion = availableCompanions[0]
        }
    }

    private fun setupDualPartBanner() {
        if (availableCompanions.isNotEmpty()) {
            displayDualPartBanner()
        } else {
            binding.cardDualPartBanner.visibility = View.GONE
        }
    }

    private fun displayDualPartBanner() {
        binding.cardDualPartBanner.visibility = View.VISIBLE
        val totalInBin = availableCompanions.size + 1
        binding.tvDualPartNotice.text = "$totalInBin Parts in Bin (${binLocation.ifBlank { "Unassigned" }})"

        if (availableCompanions.size > 1) {
            binding.layoutCompanionPicker.visibility = View.VISIBLE
            val spinnerLabels = availableCompanions.map {
                if (it.category.isNotBlank()) "${it.name} • ${it.category}" else it.name
            }
            val adapter = ArrayAdapter(context, R.layout.item_spinner_selected, spinnerLabels).apply {
                setDropDownViewResource(R.layout.item_spinner_dropdown)
            }
            binding.spinnerCompanionPart.adapter = adapter
            binding.spinnerCompanionPart.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedCompanion = availableCompanions.getOrNull(position)
                    if (binding.switchCombineParts.isChecked) {
                        updatePreview()
                    }
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
        } else {
            binding.layoutCompanionPicker.visibility = View.GONE
            selectedCompanion = availableCompanions.firstOrNull()
        }

        binding.switchCombineParts.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                // Show dual styles, hide single-part specific styles
                binding.rbDualStacked.visibility = View.VISIBLE
                binding.rbDualTextOnly.visibility = View.VISIBLE
                binding.rbBinQr.visibility = View.GONE
                binding.rbItemBarcode.visibility = View.GONE
                binding.rbCompactBin.visibility = View.GONE
                binding.rbSingleTextOnly.visibility = View.GONE

                currentStyle = LabelBitmapGenerator.LabelStyle.DUAL_PART_STACKED
                binding.rbDualStacked.isChecked = true
            } else {
                // Revert to single-part styles
                binding.rbDualStacked.visibility = View.GONE
                binding.rbDualTextOnly.visibility = View.GONE
                binding.rbBinQr.visibility = View.VISIBLE
                binding.rbItemBarcode.visibility = View.VISIBLE
                binding.rbCompactBin.visibility = View.VISIBLE
                binding.rbSingleTextOnly.visibility = View.VISIBLE

                currentStyle = LabelBitmapGenerator.LabelStyle.BIN_LABEL_QR
                binding.rbBinQr.isChecked = true
            }
            updatePreview()
        }
    }

    private fun queryBinCompanionsAsync() {
        val sUrl = serverUrl ?: return
        val auth = credential ?: return
        val encodedBin = java.net.URLEncoder.encode(binLocation.trim(), "UTF-8")
        val url = if (sUrl.endsWith("/")) "${sUrl}api/scanner/bin?location=$encodedBin" else "$sUrl/api/scanner/bin?location=$encodedBin"

        val request = Request.Builder()
            .url(url)
            .header("Authorization", auth)
            .build()

        OkHttpClient().newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                // Ignore silent fetch failures
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val body = response.body?.string() ?: ""
                val code = response.code
                response.close()
                if (code == 200) {
                    try {
                        val json = JSONObject(body)
                        val partsArr = json.optJSONArray("parts") ?: return
                        val fetched = mutableListOf<LabelBitmapGenerator.LabelPartInfo>()
                        for (i in 0 until partsArr.length()) {
                            val pObj = partsArr.getJSONObject(i)
                            val pId = pObj.getString("id")
                            if (pId != partId) {
                                fetched.add(
                                    LabelBitmapGenerator.LabelPartInfo(
                                        id = pId,
                                        name = pObj.getString("name"),
                                        binLocation = pObj.optString("location", binLocation),
                                        category = pObj.optString("category", ""),
                                        upcBarcode = pObj.optString("upc", ""),
                                        stock = pObj.optInt("stock", 0)
                                    )
                                )
                            }
                        }
                        if (fetched.isNotEmpty()) {
                            Handler(Looper.getMainLooper()).post {
                                availableCompanions.clear()
                                availableCompanions.addAll(fetched)
                                selectedCompanion = availableCompanions.firstOrNull()
                                displayDualPartBanner()
                            }
                        }
                    } catch (e: Exception) {
                        // ignore parsing error
                    }
                }
            }
        })
    }

    private fun setupStyleSelector() {
        binding.rgLabelStyle.setOnCheckedChangeListener { _, checkedId ->
            currentStyle = when (checkedId) {
                R.id.rbItemBarcode -> LabelBitmapGenerator.LabelStyle.ITEM_LABEL_BARCODE
                R.id.rbCompactBin -> LabelBitmapGenerator.LabelStyle.COMPACT_BIN
                R.id.rbSingleTextOnly -> LabelBitmapGenerator.LabelStyle.SINGLE_TEXT_ONLY
                R.id.rbDualStacked -> LabelBitmapGenerator.LabelStyle.DUAL_PART_STACKED
                R.id.rbDualTextOnly -> LabelBitmapGenerator.LabelStyle.DUAL_TEXT_ONLY
                else -> {
                    if (binding.switchCombineParts.isChecked) {
                        LabelBitmapGenerator.LabelStyle.DUAL_PART_STACKED
                    } else {
                        LabelBitmapGenerator.LabelStyle.BIN_LABEL_QR
                    }
                }
            }
            updatePreview()
        }
    }

    private fun setupDensitySpinner() {
        val densityOptions = arrayOf(
            "1 - Lightest",
            "2 - Light",
            "3 - Medium Light",
            "4 - Normal (Recommended)",
            "5 - Dark",
            "6 - Very Dark",
            "7 - Maximum"
        )
        val adapter = ArrayAdapter(context, R.layout.item_spinner_selected, densityOptions).apply {
            setDropDownViewResource(R.layout.item_spinner_dropdown)
        }
        binding.spinnerDensity.adapter = adapter
        binding.spinnerDensity.setSelection(3) // Default to index 3 (level 4)
    }

    private fun setupCopiesControls() {
        binding.tvCopiesCount.text = currentCopies.toString()

        binding.btnMinusCopy.setOnClickListener {
            if (currentCopies > 1) {
                currentCopies--
                binding.tvCopiesCount.text = currentCopies.toString()
            }
        }

        binding.btnPlusCopy.setOnClickListener {
            if (currentCopies < 99) {
                currentCopies++
                binding.tvCopiesCount.text = currentCopies.toString()
            }
        }
    }

    private fun setupPrinterInfo() {
        updatePrinterDisplay()

        binding.btnSelectPrinter.setOnClickListener {
            PrinterPickerDialog.show(context, bleManager) {
                updatePrinterDisplay()
            }
        }
    }

    private fun updatePrinterDisplay() {
        val name = SupvanBleManager.getSavedPrinterName(context)
        val mac = SupvanBleManager.getSavedPrinterMac(context)

        if (!mac.isNullOrBlank()) {
            binding.tvPrinterName.text = name ?: "Katasymbol / Supvan"
            binding.tvPrinterAddress.text = mac
            binding.btnExecutePrint.isEnabled = true
            binding.btnExecutePrint.text = "Print Label"
        } else {
            binding.tvPrinterName.text = "No Printer Configured"
            binding.tvPrinterAddress.text = "Tap Change to scan & pair"
            binding.btnExecutePrint.isEnabled = true
            binding.btnExecutePrint.text = "Select Printer"
        }
    }

    private fun setupActionButtons() {
        binding.btnCloseDialog.setOnClickListener {
            dialog.dismiss()
        }

        binding.btnCancelPrint.setOnClickListener {
            dialog.dismiss()
        }

        binding.btnExecutePrint.setOnClickListener {
            executePrint()
        }
    }

    private fun updatePreview() {
        val bmp = if (binding.switchCombineParts.isChecked && selectedCompanion != null) {
            val part1 = LabelBitmapGenerator.LabelPartInfo(
                id = partId,
                name = partName,
                binLocation = binLocation,
                category = category,
                upcBarcode = upcBarcode
            )
            LabelBitmapGenerator.generateDualLabel(
                part1 = part1,
                part2 = selectedCompanion!!,
                binLocation = binLocation,
                style = currentStyle
            )
        } else {
            LabelBitmapGenerator.generateLabel(
                partId = partId,
                partName = partName,
                binLocation = binLocation,
                category = category,
                upcBarcode = upcBarcode,
                style = currentStyle
            )
        }
        currentBitmap = bmp
        binding.ivLabelPreview.setImageBitmap(bmp)

        val mmWidth = (bmp.width / 8.0).toInt()
        val modeStr = if (binding.switchCombineParts.isChecked) "Combined 2-in-1" else "Single Item"
        binding.tvLabelSpecs.text = "$modeStr • ${mmWidth}mm x 12mm • ${bmp.width}x96 dots • 203 DPI"
    }

    private fun executePrint() {
        val targetMac = SupvanBleManager.getSavedPrinterMac(context)
        if (targetMac.isNullOrBlank()) {
            Toast.makeText(context, "Please select a printer first", Toast.LENGTH_SHORT).show()
            PrinterPickerDialog.show(context, bleManager) { updatePrinterDisplay() }
            return
        }

        val bmp = currentBitmap ?: run {
            Toast.makeText(context, "Failed to generate label preview", Toast.LENGTH_SHORT).show()
            return
        }

        selectedDensity = binding.spinnerDensity.selectedItemPosition + 1

        // Immediate visual feedback that printing is in progress
        Toast.makeText(context, "Printing in progress...", Toast.LENGTH_SHORT).show()
        binding.layoutPrintProgress.visibility = View.VISIBLE
        binding.tvPrintProgressStatus.text = "Printing in progress: Connecting to $targetMac..."
        binding.btnExecutePrint.text = "Printing in progress..."
        binding.btnExecutePrint.isEnabled = false
        binding.btnCancelPrint.isEnabled = false
        binding.btnSelectPrinter.isEnabled = false

        bleManager.printBitmap(
            deviceAddress = targetMac,
            bitmap = bmp,
            density = selectedDensity,
            copies = currentCopies,
            onProgress = { status ->
                binding.tvPrintProgressStatus.text = "Printing in progress: $status"
            },
            onComplete = { success, errorMsg ->
                binding.layoutPrintProgress.visibility = View.GONE
                binding.btnExecutePrint.text = "Print Label"
                binding.btnExecutePrint.isEnabled = true
                binding.btnCancelPrint.isEnabled = true
                binding.btnSelectPrinter.isEnabled = true

                if (success) {
                    Toast.makeText(context, "Label printed successfully!", Toast.LENGTH_LONG).show()
                    dialog.dismiss()
                } else {
                    Toast.makeText(context, "Print failed: ${errorMsg ?: "Unknown error"}", Toast.LENGTH_LONG).show()
                }
            }
        )
    }

    fun show() {
        dialog.show()
        dialog.window?.let { window ->
            val metrics = context.resources.displayMetrics
            val width = (metrics.widthPixels * 0.94).toInt()
            val maxHeight = (metrics.heightPixels * 0.88).toInt()
            window.setLayout(width, maxHeight)
        }
    }
}
