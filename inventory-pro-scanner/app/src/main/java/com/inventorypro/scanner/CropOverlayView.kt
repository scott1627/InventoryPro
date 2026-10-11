package com.inventorypro.scanner

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class CropOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val cropRect = RectF()
    private val imageBounds = RectF()

    private val dimPaint = Paint().apply {
        color = Color.parseColor("#B3000000") // 70% opacity dark overlay
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

    private val cornerHandleLength = 20f * resources.displayMetrics.density
    private val touchRadius = 36f * resources.displayMetrics.density
    private val minCropSize = 60f * resources.displayMetrics.density

    private var activeHandle = Handle.NONE
    private var lastTouchX = 0f
    private var lastTouchY = 0f

    private enum class Handle {
        NONE, CENTER, TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT,
        EDGE_TOP, EDGE_BOTTOM, EDGE_LEFT, EDGE_RIGHT
    }

    fun setImageBounds(bounds: RectF) {
        imageBounds.set(bounds)
        resetCropRect()
    }

    fun resetCropRect() {
        if (imageBounds.width() <= 0 || imageBounds.height() <= 0) return
        
        // Default to centered 80% box
        val insetX = imageBounds.width() * 0.1f
        val insetY = imageBounds.height() * 0.1f
        cropRect.set(
            imageBounds.left + insetX,
            imageBounds.top + insetY,
            imageBounds.right - insetX,
            imageBounds.bottom - insetY
        )
        invalidate()
    }

    fun getCropRect(): RectF = RectF(cropRect)

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (cropRect.isEmpty) return

        // 1. Draw 4 dimmed masks around cropRect
        canvas.drawRect(0f, 0f, width.toFloat(), cropRect.top, dimPaint) // Top
        canvas.drawRect(0f, cropRect.bottom, width.toFloat(), height.toFloat(), dimPaint) // Bottom
        canvas.drawRect(0f, cropRect.top, cropRect.left, cropRect.bottom, dimPaint) // Left
        canvas.drawRect(cropRect.right, cropRect.top, width.toFloat(), cropRect.bottom, dimPaint) // Right

        // 2. Draw border
        canvas.drawRect(cropRect, borderPaint)

        // 3. Draw Rule of Thirds grid
        val oneThirdW = cropRect.width() / 3f
        val oneThirdH = cropRect.height() / 3f

        canvas.drawLine(cropRect.left + oneThirdW, cropRect.top, cropRect.left + oneThirdW, cropRect.bottom, gridPaint)
        canvas.drawLine(cropRect.left + 2 * oneThirdW, cropRect.top, cropRect.left + 2 * oneThirdW, cropRect.bottom, gridPaint)
        canvas.drawLine(cropRect.left, cropRect.top + oneThirdH, cropRect.right, cropRect.top + oneThirdH, gridPaint)
        canvas.drawLine(cropRect.left, cropRect.top + 2 * oneThirdH, cropRect.right, cropRect.top + 2 * oneThirdH, gridPaint)

        // 4. Draw Corner Handles (L shapes)
        val l = cornerHandleLength
        // Top Left
        canvas.drawLine(cropRect.left, cropRect.top, cropRect.left + l, cropRect.top, cornerPaint)
        canvas.drawLine(cropRect.left, cropRect.top, cropRect.left, cropRect.top + l, cornerPaint)
        // Top Right
        canvas.drawLine(cropRect.right, cropRect.top, cropRect.right - l, cropRect.top, cornerPaint)
        canvas.drawLine(cropRect.right, cropRect.top, cropRect.right, cropRect.top + l, cornerPaint)
        // Bottom Left
        canvas.drawLine(cropRect.left, cropRect.bottom, cropRect.left + l, cropRect.bottom, cornerPaint)
        canvas.drawLine(cropRect.left, cropRect.bottom, cropRect.left, cropRect.bottom - l, cornerPaint)
        // Bottom Right
        canvas.drawLine(cropRect.right, cropRect.bottom, cropRect.right - l, cropRect.bottom, cornerPaint)
        canvas.drawLine(cropRect.right, cropRect.bottom, cropRect.right, cropRect.bottom - l, cornerPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val y = event.y

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                activeHandle = getTouchedHandle(x, y)
                lastTouchX = x
                lastTouchY = y
                return activeHandle != Handle.NONE
            }
            MotionEvent.ACTION_MOVE -> {
                if (activeHandle == Handle.NONE) return false
                val dx = x - lastTouchX
                val dy = y - lastTouchY

                applyDelta(dx, dy)
                lastTouchX = x
                lastTouchY = y
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

        // Corners first
        if (dist(cropRect.left, cropRect.top) < touchRadius) return Handle.TOP_LEFT
        if (dist(cropRect.right, cropRect.top) < touchRadius) return Handle.TOP_RIGHT
        if (dist(cropRect.left, cropRect.bottom) < touchRadius) return Handle.BOTTOM_LEFT
        if (dist(cropRect.right, cropRect.bottom) < touchRadius) return Handle.BOTTOM_RIGHT

        // Edges
        if (x in (cropRect.left - touchRadius)..(cropRect.right + touchRadius)) {
            if (kotlin.math.abs(y - cropRect.top) < touchRadius) return Handle.EDGE_TOP
            if (kotlin.math.abs(y - cropRect.bottom) < touchRadius) return Handle.EDGE_BOTTOM
        }
        if (y in (cropRect.top - touchRadius)..(cropRect.bottom + touchRadius)) {
            if (kotlin.math.abs(x - cropRect.left) < touchRadius) return Handle.EDGE_LEFT
            if (kotlin.math.abs(x - cropRect.right) < touchRadius) return Handle.EDGE_RIGHT
        }

        // Inside crop rectangle -> move entire box
        if (cropRect.contains(x, y)) return Handle.CENTER

        return Handle.NONE
    }

    private fun applyDelta(dx: Float, dy: Float) {
        when (activeHandle) {
            Handle.CENTER -> {
                var newLeft = cropRect.left + dx
                var newTop = cropRect.top + dy
                var newRight = cropRect.right + dx
                var newBottom = cropRect.bottom + dy

                // Clamp to image bounds
                if (newLeft < imageBounds.left) {
                    val shift = imageBounds.left - newLeft
                    newLeft += shift
                    newRight += shift
                }
                if (newRight > imageBounds.right) {
                    val shift = newRight - imageBounds.right
                    newLeft -= shift
                    newRight -= shift
                }
                if (newTop < imageBounds.top) {
                    val shift = imageBounds.top - newTop
                    newTop += shift
                    newBottom += shift
                }
                if (newBottom > imageBounds.bottom) {
                    val shift = newBottom - imageBounds.bottom
                    newTop -= shift
                    newBottom -= shift
                }
                cropRect.set(newLeft, newTop, newRight, newBottom)
            }
            Handle.TOP_LEFT -> {
                cropRect.left = (cropRect.left + dx).coerceIn(imageBounds.left, cropRect.right - minCropSize)
                cropRect.top = (cropRect.top + dy).coerceIn(imageBounds.top, cropRect.bottom - minCropSize)
            }
            Handle.TOP_RIGHT -> {
                cropRect.right = (cropRect.right + dx).coerceIn(cropRect.left + minCropSize, imageBounds.right)
                cropRect.top = (cropRect.top + dy).coerceIn(imageBounds.top, cropRect.bottom - minCropSize)
            }
            Handle.BOTTOM_LEFT -> {
                cropRect.left = (cropRect.left + dx).coerceIn(imageBounds.left, cropRect.right - minCropSize)
                cropRect.bottom = (cropRect.bottom + dy).coerceIn(cropRect.top + minCropSize, imageBounds.bottom)
            }
            Handle.BOTTOM_RIGHT -> {
                cropRect.right = (cropRect.right + dx).coerceIn(cropRect.left + minCropSize, imageBounds.right)
                cropRect.bottom = (cropRect.bottom + dy).coerceIn(cropRect.top + minCropSize, imageBounds.bottom)
            }
            Handle.EDGE_TOP -> {
                cropRect.top = (cropRect.top + dy).coerceIn(imageBounds.top, cropRect.bottom - minCropSize)
            }
            Handle.EDGE_BOTTOM -> {
                cropRect.bottom = (cropRect.bottom + dy).coerceIn(cropRect.top + minCropSize, imageBounds.bottom)
            }
            Handle.EDGE_LEFT -> {
                cropRect.left = (cropRect.left + dx).coerceIn(imageBounds.left, cropRect.right - minCropSize)
            }
            Handle.EDGE_RIGHT -> {
                cropRect.right = (cropRect.right + dx).coerceIn(cropRect.left + minCropSize, imageBounds.right)
            }
            Handle.NONE -> {}
        }
    }
}
