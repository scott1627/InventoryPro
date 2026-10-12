package com.inventorypro.scanner.printer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Renders 96-dot tall monochrome labels tailored for 203 DPI Katasymbol / Supvan
 * E10 and E11 thermal label printers.
 */
object LabelBitmapGenerator {

    const val HEAD_DOTS = 96

    data class LabelPartInfo(
        val id: String,
        val name: String,
        val binLocation: String = "",
        val category: String = "",
        val upcBarcode: String = "",
        val stock: Int = 0
    ) {
        val cleanBarcode: String
            get() = if (upcBarcode.isNotBlank()) upcBarcode.trim() else id.trim()
    }

    enum class LabelStyle(val displayName: String) {
        BIN_LABEL_QR("Bin Label (QR Code + Large Bin)"),
        ITEM_LABEL_BARCODE("Item Label (1D Barcode + Details)"),
        COMPACT_BIN("Compact Bin Tag"),
        DUAL_PART_STACKED("Combined Bin (Stacked + Bin QR)"),
        DUAL_PART_SPLIT_QR("Combined Bin (Dual QR Codes)")
    }

    /**
     * Generates a monochrome label bitmap matching the chosen style.
     */
    fun generateLabel(
        partId: String,
        partName: String,
        binLocation: String,
        category: String = "",
        upcBarcode: String = "",
        style: LabelStyle = LabelStyle.BIN_LABEL_QR
    ): Bitmap {
        val cleanBarcode = if (upcBarcode.isNotBlank()) upcBarcode.trim() else partId.trim()
        val cleanBin = if (binLocation.isNotBlank()) binLocation.trim() else "NO-BIN"
        val cleanName = if (partName.isNotBlank()) partName.trim() else "Unnamed Item"

        return when (style) {
            LabelStyle.BIN_LABEL_QR -> renderBinLabelQr(cleanBarcode, cleanName, cleanBin, category, partId)
            LabelStyle.ITEM_LABEL_BARCODE -> renderItemLabelBarcode(cleanBarcode, cleanName, cleanBin, category, partId)
            LabelStyle.COMPACT_BIN -> renderCompactBinLabel(cleanBarcode, cleanName, cleanBin, partId)
            LabelStyle.DUAL_PART_STACKED, LabelStyle.DUAL_PART_SPLIT_QR -> {
                // If dual style called with single part, fallback to standard bin QR
                renderBinLabelQr(cleanBarcode, cleanName, cleanBin, category, partId)
            }
        }
    }

    /**
     * Generates a combined label for two parts residing in the same bin.
     */
    fun generateDualLabel(
        part1: LabelPartInfo,
        part2: LabelPartInfo,
        binLocation: String,
        style: LabelStyle = LabelStyle.DUAL_PART_STACKED
    ): Bitmap {
        val cleanBin = if (binLocation.isNotBlank()) binLocation.trim() else if (part1.binLocation.isNotBlank()) part1.binLocation.trim() else "NO-BIN"
        return when (style) {
            LabelStyle.DUAL_PART_SPLIT_QR -> renderDualSideBySideLabel(part1, part2, cleanBin)
            else -> renderDualStackedLabel(part1, part2, cleanBin)
        }
    }

    /**
     * Bin Label Layout:
     * [ QR Code 84x84 ] | BIN: A-12-03 (Large Bold)
     *                   | Part Name (Bold)
     *                   | Part ID • Category
     */
    private fun renderBinLabelQr(
        barcode: String,
        partName: String,
        binLocation: String,
        category: String,
        partId: String
    ): Bitmap {
        val width = 360
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            isAntiAlias = false // Crisp thermal edges
            color = Color.BLACK
        }

        // 1. Render QR Code (84x84 dots at x=6, y=6)
        val qrBitmap = generateQrCodeBitmap(barcode, 84, 84)
        if (qrBitmap != null) {
            canvas.drawBitmap(qrBitmap, 6f, 6f, null)
        }

        // 2. Vertical separator dashed line at x = 96
        paint.strokeWidth = 1f
        for (y in 8 until (HEAD_DOTS - 8) step 4) {
            canvas.drawLine(96f, y.toFloat(), 96f, (y + 2).toFloat(), paint)
        }

        // 3. Right column text
        val textLeft = 104f

        // Top line: Large Bin Location with optional pill border
        val binPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 25f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val binText = if (binLocation.startsWith("BIN", ignoreCase = true)) binLocation.uppercase(Locale.US) else "BIN: ${binLocation.uppercase(Locale.US)}"
        canvas.drawText(truncateText(binText, binPaint, (width - textLeft - 8)), textLeft, 30f, binPaint)

        // Middle line: Part Name
        val namePaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 17f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(truncateText(partName, namePaint, (width - textLeft - 8)), textLeft, 56f, namePaint)

        // Bottom line: SKU / Barcode & Category
        val subPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        val subText = if (category.isNotBlank()) "$partId  •  $category" else "$partId  •  $barcode"
        canvas.drawText(truncateText(subText, subPaint, (width - textLeft - 8)), textLeft, 78f, subPaint)

        return bitmap
    }

    /**
     * Item Label Layout with 1D Code 128 Barcode:
     * Top: Part Name & [BIN]
     * Middle: Code 128 Barcode
     * Bottom: Human-readable barcode text
     */
    private fun renderItemLabelBarcode(
        barcode: String,
        partName: String,
        binLocation: String,
        category: String,
        partId: String
    ): Bitmap {
        val width = 400
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = true
        }

        // Top line: Part description on left
        val titlePaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 16f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(truncateText(partName, titlePaint, 270f), 8f, 20f, titlePaint)

        // Bin badge on top right (inverted black badge with white text)
        val badgeText = binLocation.uppercase(Locale.US)
        val badgePaint = Paint().apply {
            isAntiAlias = true
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val textWidth = badgePaint.measureText(badgeText)
        val badgeRect = RectF(width - textWidth - 22f, 4f, width - 8f, 24f)
        paint.color = Color.BLACK
        canvas.drawRoundRect(badgeRect, 4f, 4f, paint)

        badgePaint.color = Color.WHITE
        canvas.drawText(badgeText, badgeRect.left + 7f, 19f, badgePaint)

        // 1D Barcode in the center (Code 128)
        val barcodeBitmap = generate1DBarcodeBitmap(barcode, 360, 44)
        if (barcodeBitmap != null) {
            val startX = (width - barcodeBitmap.width) / 2f
            canvas.drawBitmap(barcodeBitmap, startX, 28f, null)
        }

        // Human-readable barcode digits under barcode
        val humanPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 13f
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(barcode, width / 2f, 88f, humanPaint)

        return bitmap
    }

    /**
     * Compact Bin Label:
     * 280 x 96 dots with bold prominent bin text.
     */
    private fun renderCompactBinLabel(
        barcode: String,
        partName: String,
        binLocation: String,
        partId: String
    ): Bitmap {
        val width = 280
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        // QR Code 80x80 on the left
        val qr = generateQrCodeBitmap(barcode, 80, 80)
        if (qr != null) {
            canvas.drawBitmap(qr, 8f, 8f, null)
        }

        val textLeft = 98f

        // Giant Bin
        val binPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 30f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(truncateText(binLocation.uppercase(Locale.US), binPaint, width - textLeft - 8), textLeft, 38f, binPaint)

        // SKU / Part ID
        val skuPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 15f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText(truncateText(partId, skuPaint, width - textLeft - 8), textLeft, 60f, skuPaint)

        // Part name
        val namePaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        canvas.drawText(truncateText(partName, namePaint, width - textLeft - 8), textLeft, 80f, namePaint)

        return bitmap
    }

    /**
     * Dual-Part Layout Option 1: Stacked with Single Shared Bin QR Code.
     * Dimensions: 410 x 96 dots.
     * Left: 84x84 QR Code for Bin Location.
     * Right:
     *   - Top: Bin Location Header (Bold 17f) + dividing rule.
     *   - Middle: ① Part 1 Name (Bold 13.5f) & ID • Category (10.5f).
     *   - Divider line.
     *   - Bottom: ② Part 2 Name (Bold 13.5f) & ID • Category (10.5f).
     */
    private fun renderDualStackedLabel(
        part1: LabelPartInfo,
        part2: LabelPartInfo,
        binLocation: String
    ): Bitmap {
        val width = 410
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = false
            strokeWidth = 1f
        }

        // 1. Bin QR Code on left (84x84 dots)
        val qrContent = if (binLocation.startsWith("BIN", ignoreCase = true)) binLocation else "BIN:$binLocation"
        val qr = generateQrCodeBitmap(qrContent, 84, 84)
        if (qr != null) {
            canvas.drawBitmap(qr, 6f, 6f, null)
        }

        // 2. Vertical dashed divider line at x = 96
        for (y in 6 until (HEAD_DOTS - 6) step 4) {
            canvas.drawLine(96f, y.toFloat(), 96f, (y + 2).toFloat(), paint)
        }

        val textLeft = 104f
        val rightEdge = width - 8f
        val maxTextWidth = rightEdge - textLeft

        // 3. Top Header: BIN Location
        val binPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 17f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val binText = if (binLocation.startsWith("BIN", ignoreCase = true)) binLocation.uppercase(Locale.US) else "BIN: ${binLocation.uppercase(Locale.US)}"
        canvas.drawText(truncateText(binText, binPaint, maxTextWidth), textLeft, 20f, binPaint)

        // Thin horizontal line under Bin header at y = 24
        canvas.drawLine(textLeft, 24f, rightEdge, 24f, paint)

        // 4. Section ①: Part 1
        val namePaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 13.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 10.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }

        val p1Name = "① " + part1.name.trim()
        canvas.drawText(truncateText(p1Name, namePaint, maxTextWidth), textLeft, 39f, namePaint)

        val p1Sub = buildString {
            append(part1.id.trim())
            if (part1.category.isNotBlank()) append(" • ").append(part1.category.trim())
            if (part1.stock > 0) append(" • Qty: ").append(part1.stock)
        }
        canvas.drawText(truncateText(p1Sub, subPaint, maxTextWidth), textLeft, 52f, subPaint)

        // Horizontal dashed separator at y = 57
        for (x in textLeft.toInt() until rightEdge.toInt() step 5) {
            canvas.drawLine(x.toFloat(), 57f, (x + 3).toFloat(), 57f, paint)
        }

        // 5. Section ②: Part 2
        val p2Name = "② " + part2.name.trim()
        canvas.drawText(truncateText(p2Name, namePaint, maxTextWidth), textLeft, 73f, namePaint)

        val p2Sub = buildString {
            append(part2.id.trim())
            if (part2.category.isNotBlank()) append(" • ").append(part2.category.trim())
            if (part2.stock > 0) append(" • Qty: ").append(part2.stock)
        }
        canvas.drawText(truncateText(p2Sub, subPaint, maxTextWidth), textLeft, 87f, subPaint)

        return bitmap
    }

    /**
     * Dual-Part Layout Option 2: Split with Dual Independent QR Codes.
     * Dimensions: 440 x 96 dots.
     * Top: Prominent inverted black header pill with "BIN: A-12-03".
     * Left: Mini QR code (58x58) for Part 1 + Part 1 details.
     * Divider: Vertical separator down the middle.
     * Right: Mini QR code (58x58) for Part 2 + Part 2 details.
     */
    private fun renderDualSideBySideLabel(
        part1: LabelPartInfo,
        part2: LabelPartInfo,
        binLocation: String
    ): Bitmap {
        val width = 440
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = false
            strokeWidth = 1f
        }

        // 1. Top Bin Header: Inverted black pill badge spanning width
        val badgeRect = RectF(6f, 3f, width - 6f, 21f)
        val paintBlack = Paint().apply {
            color = Color.BLACK
            isAntiAlias = true
        }
        canvas.drawRoundRect(badgeRect, 4f, 4f, paintBlack)

        val binTextPaint = Paint().apply {
            isAntiAlias = true
            color = Color.WHITE
            textSize = 13f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val binText = if (binLocation.startsWith("BIN", ignoreCase = true)) binLocation.uppercase(Locale.US) else "BIN: ${binLocation.uppercase(Locale.US)}"
        canvas.drawText(binText, width / 2f, 17f, binTextPaint)

        // 2. Central Vertical dashed line at x = 220 from y = 24 to 92
        for (y in 24 until (HEAD_DOTS - 4) step 4) {
            canvas.drawLine(220f, y.toFloat(), 220f, (y + 2).toFloat(), paint)
        }

        val namePaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 12f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val idPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 10f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val detailPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 9.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }

        // 3. Left Half: Part 1
        val qr1 = generateQrCodeBitmap(part1.cleanBarcode, 58, 58)
        if (qr1 != null) {
            canvas.drawBitmap(qr1, 8f, 28f, null)
        }
        val textLeft1 = 70f
        val textWidth1 = 212f - textLeft1
        canvas.drawText(truncateText("① " + part1.name, namePaint, textWidth1), textLeft1, 42f, namePaint)
        canvas.drawText(truncateText(part1.id, idPaint, textWidth1), textLeft1, 57f, idPaint)
        val p1Info = if (part1.category.isNotBlank()) part1.category else if (part1.stock > 0) "Qty: ${part1.stock}" else part1.cleanBarcode
        canvas.drawText(truncateText(p1Info, detailPaint, textWidth1), textLeft1, 71f, detailPaint)
        if (part1.stock > 0 && part1.category.isNotBlank()) {
            canvas.drawText(truncateText("Qty: ${part1.stock}", detailPaint, textWidth1), textLeft1, 84f, detailPaint)
        }

        // 4. Right Half: Part 2
        val qr2 = generateQrCodeBitmap(part2.cleanBarcode, 58, 58)
        if (qr2 != null) {
            canvas.drawBitmap(qr2, 228f, 28f, null)
        }
        val textLeft2 = 290f
        val textWidth2 = (width - 8f) - textLeft2
        canvas.drawText(truncateText("② " + part2.name, namePaint, textWidth2), textLeft2, 42f, namePaint)
        canvas.drawText(truncateText(part2.id, idPaint, textWidth2), textLeft2, 57f, idPaint)
        val p2Info = if (part2.category.isNotBlank()) part2.category else if (part2.stock > 0) "Qty: ${part2.stock}" else part2.cleanBarcode
        canvas.drawText(truncateText(p2Info, detailPaint, textWidth2), textLeft2, 71f, detailPaint)
        if (part2.stock > 0 && part2.category.isNotBlank()) {
            canvas.drawText(truncateText("Qty: ${part2.stock}", detailPaint, textWidth2), textLeft2, 84f, detailPaint)
        }

        return bitmap
    }

    /**
     * Test print label for verifying BLE connectivity, printhead alignment and contrast.
     */
    fun generateTestLabel(): Bitmap {
        val width = 340
        val bitmap = Bitmap.createBitmap(width, HEAD_DOTS, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val paint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = true
        }

        // Test QR on left
        val qr = generateQrCodeBitmap("SUPVAN-E11-OK", 80, 80)
        if (qr != null) {
            canvas.drawBitmap(qr, 8f, 8f, null)
        }

        // Header
        val headPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 20f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("KATASYMBOL E11", 96f, 30f, headPaint)

        val subPaint = Paint().apply {
            isAntiAlias = true
            color = Color.BLACK
            textSize = 14f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
        }
        canvas.drawText("InventoryPro • 203 DPI", 96f, 52f, subPaint)

        val timeStr = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText("Test OK: $timeStr", 96f, 72f, subPaint)

        // Test calibration ticks along the right edge
        for (i in 0 until HEAD_DOTS step 8) {
            canvas.drawLine(width - 12f, i.toFloat(), width - 2f, i.toFloat(), paint)
        }

        return bitmap
    }

    /**
     * Generates a monochrome QR code bitmap using ZXing.
     */
    private fun generateQrCodeBitmap(content: String, width: Int, height: Int): Bitmap? {
        return try {
            val hints = HashMap<EncodeHintType, Any>().apply {
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
                put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M)
                put(EncodeHintType.MARGIN, 0)
            }
            val bitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, width, height, hints)
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
                }
            }
            bmp
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Generates a 1D Code 128 barcode bitmap using ZXing.
     */
    private fun generate1DBarcodeBitmap(content: String, width: Int, height: Int): Bitmap? {
        return try {
            val hints = HashMap<EncodeHintType, Any>().apply {
                put(EncodeHintType.MARGIN, 0)
            }
            val bitMatrix = MultiFormatWriter().encode(content, BarcodeFormat.CODE_128, width, height, hints)
            val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
                }
            }
            bmp
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Converts an ARGB_8888 Bitmap into the Katasymbol printer's column-major 1-bit raster:
     * - Column-major order: all 12 bytes of column 0, then column 1, ...
     * - Each byte represents 8 vertical dots in column x.
     * - LSB (bit 0) = topmost dot (y = 0); MSB (bit 7) = 8th dot (y = 7).
     * - Total bytes: width * 12 (for 96 dots height).
     */
    fun bitmapToColumnMajorRaster(bitmap: Bitmap, threshold: Int = 128): ByteArray {
        val width = bitmap.width
        val height = bitmap.height.coerceAtMost(HEAD_DOTS)
        val bytesPerColumn = SupvanProtocol.E10_BYTES_PER_COLUMN // 12
        val out = ByteArray(width * bytesPerColumn)

        val pixels = IntArray(width * bitmap.height)
        bitmap.getPixels(pixels, 0, width, 0, 0, width, bitmap.height)

        for (x in 0 until width) {
            val colBase = x * bytesPerColumn
            for (y in 0 until height) {
                val pixel = pixels[y * width + x]
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                val gray = (0.299 * r + 0.587 * g + 0.114 * b).toInt()

                // Thermal dot ON if dark pixel
                if (gray < threshold) {
                    val byteIdx = colBase + (y shr 3)
                    val bitIdx = y and 7
                    out[byteIdx] = (out[byteIdx].toInt() or (1 shl bitIdx)).toByte()
                }
            }
        }
        return out
    }

    private fun truncateText(text: String, paint: Paint, maxWidth: Float): String {
        if (paint.measureText(text) <= maxWidth) return text
        var truncated = text
        while (truncated.isNotEmpty() && paint.measureText("$truncated…") > maxWidth) {
            truncated = truncated.dropLast(1)
        }
        return if (truncated.isNotEmpty()) "$truncated…" else text
    }
}
