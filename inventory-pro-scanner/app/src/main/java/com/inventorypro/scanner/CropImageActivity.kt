package com.inventorypro.scanner

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.RectF
import android.media.ExifInterface
import android.os.Bundle
import android.view.ViewTreeObserver
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.inventorypro.scanner.databinding.ActivityCropImageBinding
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

class CropImageActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_IMAGE_PATH = "EXTRA_IMAGE_PATH"
        const val EXTRA_PART_NAME = "EXTRA_PART_NAME"
        const val EXTRA_CROPPED_PATH = "EXTRA_CROPPED_PATH"
        const val EXTRA_RETAKE = "EXTRA_RETAKE"
    }

    private lateinit var binding: ActivityCropImageBinding
    private var currentBitmap: Bitmap? = null
    private var sourceImagePath: String = ""
    private var displayedImageBounds = RectF()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCropImageBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.hide()

        sourceImagePath = intent.getStringExtra(EXTRA_IMAGE_PATH) ?: ""
        val partName = intent.getStringExtra(EXTRA_PART_NAME) ?: ""

        if (partName.isNotEmpty()) {
            binding.tvCropSubtitle.text = "Focus frame for $partName"
        }

        if (sourceImagePath.isEmpty() || !File(sourceImagePath).exists()) {
            Toast.makeText(this, "Failed to load image for cropping", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Load source image
        loadAndOrientBitmap(sourceImagePath)

        // Setup listeners
        binding.btnCropBack.setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        binding.btnRetake.setOnClickListener {
            val result = Intent().apply { putExtra(EXTRA_RETAKE, true) }
            setResult(RESULT_CANCELED, result)
            finish()
        }

        binding.btnCropRotate.setOnClickListener {
            rotateBitmapClockwise()
        }

        binding.btnUseFullPhoto.setOnClickListener {
            saveAndFinish(isCropped = false)
        }

        binding.btnConfirmCrop.setOnClickListener {
            saveAndFinish(isCropped = true)
        }
    }

    private fun loadAndOrientBitmap(path: String) {
        try {
            var bitmap = BitmapFactory.decodeFile(path) ?: return
            
            // Check EXIF orientation
            try {
                val exif = ExifInterface(path)
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

            currentBitmap = bitmap
            displayBitmap()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Error loading image: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun displayBitmap() {
        val bitmap = currentBitmap ?: return
        binding.ivCropSource.setImageBitmap(bitmap)

        // Wait for ImageView to be laid out to calculate exact fitCenter bounds
        binding.ivCropSource.viewTreeObserver.addOnGlobalLayoutListener(
            object : ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    binding.ivCropSource.viewTreeObserver.removeOnGlobalLayoutListener(this)
                    updateImageBounds()
                }
            }
        )
    }

    private fun updateImageBounds() {
        val bitmap = currentBitmap ?: return
        val viewW = binding.ivCropSource.width.toFloat()
        val viewH = binding.ivCropSource.height.toFloat()

        if (viewW <= 0 || viewH <= 0) return

        val bw = bitmap.width.toFloat()
        val bh = bitmap.height.toFloat()

        val scale = minOf(viewW / bw, viewH / bh)
        val displayedW = bw * scale
        val displayedH = bh * scale

        val left = (viewW - displayedW) / 2f
        val top = (viewH - displayedH) / 2f

        displayedImageBounds.set(left, top, left + displayedW, top + displayedH)
        binding.cropOverlayView.setImageBounds(displayedImageBounds)
    }

    private fun rotateBitmapClockwise() {
        val bitmap = currentBitmap ?: return
        val matrix = Matrix().apply { postRotate(90f) }
        val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        if (rotated != bitmap) {
            bitmap.recycle()
        }
        currentBitmap = rotated
        binding.ivCropSource.setImageBitmap(rotated)
        updateImageBounds()
    }

    private fun saveAndFinish(isCropped: Boolean) {
        val bitmap = currentBitmap ?: return
        try {
            val outputFile = File(cacheDir, "crop_result_${System.currentTimeMillis()}.jpg")
            
            val finalBitmap = if (isCropped) {
                val cropRect = binding.cropOverlayView.getCropRect()
                val scale = minOf(
                    displayedImageBounds.width() / bitmap.width.toFloat(),
                    displayedImageBounds.height() / bitmap.height.toFloat()
                )

                val cropLeft = ((cropRect.left - displayedImageBounds.left) / scale).toInt().coerceIn(0, bitmap.width - 1)
                val cropTop = ((cropRect.top - displayedImageBounds.top) / scale).toInt().coerceIn(0, bitmap.height - 1)
                val cropWidth = (((cropRect.right - displayedImageBounds.left) / scale) - cropLeft).toInt()
                    .coerceAtLeast(1)
                    .coerceAtMost(bitmap.width - cropLeft)
                val cropHeight = (((cropRect.bottom - displayedImageBounds.top) / scale) - cropTop).toInt()
                    .coerceAtLeast(1)
                    .coerceAtMost(bitmap.height - cropTop)

                Bitmap.createBitmap(bitmap, cropLeft, cropTop, cropWidth, cropHeight)
            } else {
                bitmap
            }

            FileOutputStream(outputFile).use { out ->
                finalBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }

            if (isCropped && finalBitmap != bitmap) {
                finalBitmap.recycle()
            }

            val resultIntent = Intent().apply {
                putExtra(EXTRA_CROPPED_PATH, outputFile.absolutePath)
            }
            setResult(RESULT_OK, resultIntent)
            finish()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to crop image: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        currentBitmap?.recycle()
        currentBitmap = null
    }
}
