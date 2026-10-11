package com.inventorypro.scanner

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.inventorypro.scanner.databinding.ActivityCropImageBinding
import java.io.File
import java.io.FileOutputStream

class CropImageActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_IMAGE_PATH = "EXTRA_IMAGE_PATH"
        const val EXTRA_PART_NAME = "EXTRA_PART_NAME"
        const val EXTRA_CROPPED_PATH = "EXTRA_CROPPED_PATH"
        const val EXTRA_RETAKE = "EXTRA_RETAKE"
    }

    private lateinit var binding: ActivityCropImageBinding
    private var sourceImagePath: String = ""

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

        // Fast, memory-optimized image load
        loadOptimizedBitmap(sourceImagePath)

        // Setup button listeners
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
            binding.cropView.rotateClockwise()
        }

        binding.btnUseFullPhoto.setOnClickListener {
            saveBitmapAndFinish(binding.cropView.getSourceBitmap())
        }

        binding.btnConfirmCrop.setOnClickListener {
            val cropped = binding.cropView.getCroppedBitmap()
            if (cropped != null) {
                saveBitmapAndFinish(cropped)
            } else {
                saveBitmapAndFinish(binding.cropView.getSourceBitmap())
            }
        }
    }

    private fun loadOptimizedBitmap(path: String) {
        try {
            // 1. Decode bounds only to calculate efficient sample size
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, options)
            val origW = options.outWidth
            val origH = options.outHeight

            // Target max dimension ~1400px (fast 60fps rendering without saturating mobile RAM)
            val targetDim = 1400
            var inSampleSize = 1
            while ((origW / inSampleSize) > targetDim * 1.4 || (origH / inSampleSize) > targetDim * 1.4) {
                inSampleSize *= 2
            }

            options.inJustDecodeBounds = false
            options.inSampleSize = inSampleSize
            var bitmap = BitmapFactory.decodeFile(path, options) ?: run {
                Toast.makeText(this, "Could not decode image", Toast.LENGTH_SHORT).show()
                finish()
                return
            }

            // 2. Check EXIF orientation
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

            // 3. Set onto unified CropView
            binding.cropView.setSourceBitmap(bitmap)
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Error loading image: ${e.message}", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    private fun saveBitmapAndFinish(bitmap: Bitmap?) {
        if (bitmap == null) {
            finish()
            return
        }
        try {
            val outputFile = File(cacheDir, "crop_result_${System.currentTimeMillis()}.jpg")
            FileOutputStream(outputFile).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }

            val resultIntent = Intent().apply {
                putExtra(EXTRA_CROPPED_PATH, outputFile.absolutePath)
            }
            setResult(RESULT_OK, resultIntent)
            finish()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to save cropped image: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
}
