package com.inventorypro.scanner

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.hypot

class CropView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var sourceBitmap: Bitmap? = null
    private val imageBounds = RectF()
    private val cropRect = RectF()
    private val initialCropRect = RectF()

    private val dimPaint = Paint().apply {
        color = Color.parseColor("#B3000000") // 70% dark mask
        style = Paint.Style.FILL
    }

    private val borderPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 2f * resources.displayMetrics.density
        isAntiAlias = true
    }

    private val gridPaint = Paint().apply {
        color = Color.parseColor("#66FFFFFF")
        style = Paint.Style.STROKE
        strokeWidth = 1f * resources.displayMetrics.density
        isAntiAlias = true
    }

    private val cornerPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 4f * resources.displayMetrics.density
        strokeCap = Paint.Cap.ROUND
        isAntiAlias = true
    }

    private val bitmapPaint = Paint(Paint.FILTER_BITMAP_FLAG)

    private val cornerHandleLength = 22f * resources.displayMetrics.density
    private val touchRadius = 40f * resources.displayMetrics.density
    private val minCropSize = 64f * resources.displayMetrics.density

    private var activeHandle = Handle.NONE
    private var touchStartX = 0f
    private var touchStartY = 0f

    private enum class Handle {
        NONE, CENTER, TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT,
        EDGE_TOP, EDGE_BOTTOM, EDGE_LEFT, EDGE_RIGHT
    }

    fun setSourceBitmap(bitmap: Bitmap) {
        sourceBitmap = bitmap
        updateBoundsAndResetCrop()
        invalidate()
    }

    fun getSourceBitmap(): Bitmap? = sourceBitmap

    fun rotateClockwise() {
        val current = sourceBitmap ?: return
        val matrix = Matrix().apply { postRotate(90f) }
        val rotated = Bitmap.createBitmap(current, 0, 0, current.width, current.height, matrix, true)
        if (rotated != current) {
            current.recycle()
        }
        sourceBitmap = rotated
        updateBoundsAndResetCrop()
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        updateBoundsAndResetCrop()
    }

    private fun updateBoundsAndResetCrop() {
        val bitmap = sourceBitmap ?: return
        if (width <= 0 || height <= 0) return

        val viewW = width.toFloat()
        val viewH = height.toFloat()
        val bw = bitmap.width.toFloat()
        val bh = bitmap.height.toFloat()

        // Fit center
        val scale = minOf(viewW / bw, viewH / bh)
        val displayedW = bw * scale
        val displayedH = bh * scale

        val left = (viewW - displayedW) / 2f
        val top = (viewH - displayedH) / 2f

        imageBounds.set(left, top, left + displayedW, top + displayedH)

        // Default crop box to 85% of image centered
        val insetX = displayedW * 0.08f
        val insetY = displayedH * 0.08f
        cropRect.set(
            imageBounds.left + insetX,
            imageBounds.top + insetY,
            imageBounds.right - insetX,
            imageBounds.bottom - insetY
        )
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val bitmap = sourceBitmap ?: return
        if (imageBounds.isEmpty || cropRect.isEmpty) return

        // 1. Draw scaled image in a single pass
        canvas.drawBitmap(bitmap, null, imageBounds, bitmapPaint)

        // 2. Draw 4 dimmed masks around the crop box
        canvas.drawRect(0f, 0f, width.toFloat(), cropRect.top, dimPaint) // Top
        canvas.drawRect(0f, cropRect.bottom, width.toFloat(), height.toFloat(), dimPaint) // Bottom
        canvas.drawRect(0f, cropRect.top, cropRect.left, cropRect.bottom, dimPaint) // Left
        canvas.drawRect(cropRect.right, cropRect.top, width.toFloat(), cropRect.bottom, dimPaint) // Right

        // 3. Draw crop border
        canvas.drawRect(cropRect, borderPaint)

        // 4. Draw Rule of Thirds grid
        val oneThirdW = cropRect.width() / 3f
        val oneThirdH = cropRect.height() / 3f
        canvas.drawLine(cropRect.left + oneThirdW, cropRect.top, cropRect.left + oneThirdW, cropRect.bottom, gridPaint)
        canvas.drawLine(cropRect.left + 2 * oneThirdW, cropRect.top, cropRect.left + 2 * oneThirdW, cropRect.bottom, gridPaint)
        canvas.drawLine(cropRect.left, cropRect.top + oneThirdH, cropRect.right, cropRect.top + oneThirdH, gridPaint)
        canvas.drawLine(cropRect.left, cropRect.top + 2 * oneThirdH, cropRect.right, cropRect.top + 2 * oneThirdH, gridPaint)

        // 5. Draw prominent corner handles
        val l = cornerHandleLength
        // Top-Left
        canvas.drawLine(cropRect.left, cropRect.top, cropRect.left + l, cropRect.top, cornerPaint)
        canvas.drawLine(cropRect.left, cropRect.top, cropRect.left, cropRect.top + l, cornerPaint)
        // Top-Right
        canvas.drawLine(cropRect.right, cropRect.top, cropRect.right - l, cropRect.top, cornerPaint)
        canvas.drawLine(cropRect.right, cropRect.top, cropRect.right, cropRect.top + l, cornerPaint)
        // Bottom-Left
        canvas.drawLine(cropRect.left, cropRect.bottom, cropRect.left + l, cropRect.bottom, cornerPaint)
        canvas.drawLine(cropRect.left, cropRect.bottom, cropRect.left, cropRect.bottom - l, cornerPaint)
        // Bottom-Right
        canvas.drawLine(cropRect.right, cropRect.bottom, cropRect.right - l, cropRect.bottom, cornerPaint)
        canvas.drawLine(cropRect.right, cropRect.bottom, cropRect.right, cropRect.bottom - l, cornerPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                activeHandle = getTouchedHandle(x, y)
                if (activeHandle != Handle.NONE) {
                    touchStartX = x
                    touchStartY = y
                    initialCropRect.set(cropRect)
                    return true
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (activeHandle == Handle.NONE) return false

                val totalDx = x - touchStartX
                val totalDy = y - touchStartY

                applyAbsoluteDelta(totalDx, totalDy)
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                activeHandle = Handle.NONE
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun getTouchedHandle(x: Float, y: Float): Handle {
        fun dist(hx: Float, hy: Float) = hypot(x - hx, y - hy)

        // Priority 1: Corners (generous touch radius)
        if (dist(cropRect.left, cropRect.top) < touchRadius) return Handle.TOP_LEFT
        if (dist(cropRect.right, cropRect.top) < touchRadius) return Handle.TOP_RIGHT
        if (dist(cropRect.left, cropRect.bottom) < touchRadius) return Handle.BOTTOM_LEFT
        if (dist(cropRect.right, cropRect.bottom) < touchRadius) return Handle.BOTTOM_RIGHT

        // Priority 2: Edges
        if (x in (cropRect.left - touchRadius)..(cropRect.right + touchRadius)) {
            if (abs(y - cropRect.top) < touchRadius) return Handle.EDGE_TOP
            if (abs(y - cropRect.bottom) < touchRadius) return Handle.EDGE_BOTTOM
        }
        if (y in (cropRect.top - touchRadius)..(cropRect.bottom + touchRadius)) {
            if (abs(x - cropRect.left) < touchRadius) return Handle.EDGE_LEFT
            if (abs(x - cropRect.right) < touchRadius) return Handle.EDGE_RIGHT
        }

        // Priority 3: Inside rectangle -> move entire box
        if (cropRect.contains(x, y)) return Handle.CENTER

        return Handle.NONE
    }

    private fun applyAbsoluteDelta(dx: Float, dy: Float) {
        when (activeHandle) {
            Handle.CENTER -> {
                val boxW = initialCropRect.width()
                val boxH = initialCropRect.height()

                var newLeft = initialCropRect.left + dx
                var newTop = initialCropRect.top + dy

                // Clamp within image bounds
                newLeft = newLeft.coerceIn(imageBounds.left, imageBounds.right - boxW)
                newTop = newTop.coerceIn(imageBounds.top, imageBounds.bottom - boxH)

                cropRect.set(newLeft, newTop, newLeft + boxW, newTop + boxH)
            }
            Handle.TOP_LEFT -> {
                val newLeft = (initialCropRect.left + dx).coerceIn(imageBounds.left, initialCropRect.right - minCropSize)
                val newTop = (initialCropRect.top + dy).coerceIn(imageBounds.top, initialCropRect.bottom - minCropSize)
                cropRect.set(newLeft, newTop, initialCropRect.right, initialCropRect.bottom)
            }
            Handle.TOP_RIGHT -> {
                val newRight = (initialCropRect.right + dx).coerceIn(initialCropRect.left + minCropSize, imageBounds.right)
                val newTop = (initialCropRect.top + dy).coerceIn(imageBounds.top, initialCropRect.bottom - minCropSize)
                cropRect.set(initialCropRect.left, newTop, newRight, initialCropRect.bottom)
            }
            Handle.BOTTOM_LEFT -> {
                val newLeft = (initialCropRect.left + dx).coerceIn(imageBounds.left, initialCropRect.right - minCropSize)
                val newBottom = (initialCropRect.bottom + dy).coerceIn(initialCropRect.top + minCropSize, imageBounds.bottom)
                cropRect.set(newLeft, initialCropRect.top, initialCropRect.right, newBottom)
            }
            Handle.BOTTOM_RIGHT -> {
                val newRight = (initialCropRect.right + dx).coerceIn(initialCropRect.left + minCropSize, imageBounds.right)
                val newBottom = (initialCropRect.bottom + dy).coerceIn(initialCropRect.top + minCropSize, imageBounds.bottom)
                cropRect.set(initialCropRect.left, initialCropRect.top, newRight, newBottom)
            }
            Handle.EDGE_TOP -> {
                val newTop = (initialCropRect.top + dy).coerceIn(imageBounds.top, initialCropRect.bottom - minCropSize)
                cropRect.top = newTop
            }
            Handle.EDGE_BOTTOM -> {
                val newBottom = (initialCropRect.bottom + dy).coerceIn(initialCropRect.top + minCropSize, imageBounds.bottom)
                cropRect.bottom = newBottom
            }
            Handle.EDGE_LEFT -> {
                val newLeft = (initialCropRect.left + dx).coerceIn(imageBounds.left, initialCropRect.right - minCropSize)
                cropRect.left = newLeft
            }
            Handle.EDGE_RIGHT -> {
                val newRight = (initialCropRect.right + dx).coerceIn(initialCropRect.left + minCropSize, imageBounds.right)
                cropRect.right = newRight
            }
            Handle.NONE -> {}
        }
    }

    fun getCroppedBitmap(): Bitmap? {
        val bitmap = sourceBitmap ?: return null
        if (imageBounds.width() <= 0 || imageBounds.height() <= 0) return null

        val scale = minOf(
            imageBounds.width() / bitmap.width.toFloat(),
            imageBounds.height() / bitmap.height.toFloat()
        )

        val cropLeft = ((cropRect.left - imageBounds.left) / scale).toInt().coerceIn(0, bitmap.width - 1)
        val cropTop = ((cropRect.top - imageBounds.top) / scale).toInt().coerceIn(0, bitmap.height - 1)
        val cropWidth = (((cropRect.right - imageBounds.left) / scale) - cropLeft).toInt()
            .coerceAtLeast(1)
            .coerceAtMost(bitmap.width - cropLeft)
        val cropHeight = (((cropRect.bottom - imageBounds.top) / scale) - cropTop).toInt()
            .coerceAtLeast(1)
            .coerceAtMost(bitmap.height - cropTop)

        return Bitmap.createBitmap(bitmap, cropLeft, cropTop, cropWidth, cropHeight)
    }
}
