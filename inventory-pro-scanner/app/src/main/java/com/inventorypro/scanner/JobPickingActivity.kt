package com.inventorypro.scanner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.inventorypro.scanner.databinding.ActivityJobPickingBinding
import android.content.res.ColorStateList
import androidx.core.content.ContextCompat
import okhttp3.Credentials
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

class JobPickingActivity : AppCompatActivity() {

    private lateinit var binding: ActivityJobPickingBinding
    private val client = OkHttpClient()
    private var toneGenerator: ToneGenerator? = null

    private var jobId: String = ""
    private var jobName: String = ""
    private lateinit var adapter: PickingChecklistAdapter

    private var isZebraEnabled = true
    private var isReceiverRegistered = false

    // Broadcast receiver to listen for Zebra DataWedge intent
    private val scanReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return

            val scanData = intent.getStringExtra("com.symbol.datawedge.data_string") ?: ""
            if (scanData.isNotEmpty()) {
                Handler(Looper.getMainLooper()).post {
                    handleScannedBarcode(scanData)
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityJobPickingBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.hide()

        jobId = intent.getStringExtra("JOB_ID") ?: ""
        jobName = intent.getStringExtra("JOB_NAME") ?: "Picking Job"

        binding.tvPickingTitle.text = jobName

        binding.btnBack.setOnClickListener {
            finish()
        }

        // Initialize audio feedback
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Setup RecyclerView
        adapter = PickingChecklistAdapter(emptyList())
        binding.rvPickingChecklist.layoutManager = LinearLayoutManager(this)
        binding.rvPickingChecklist.adapter = adapter

        binding.btnCompleteJob.setOnClickListener {
            completeJob()
        }
        updatePickingProgressStatus()

        fetchJobParts()
    }

    override fun onResume() {
        super.onResume()
        val prefs = getSharedPreferences("ScannerConfig", Context.MODE_PRIVATE)
        isZebraEnabled = prefs.getBoolean("EnableZebra", true)

        if (isZebraEnabled && !isReceiverRegistered) {
            val filter = IntentFilter("com.inventorypro.scanner.ACTION")
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(scanReceiver, filter)
            }
            isReceiverRegistered = true
        }
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

    private fun playBeep(success: Boolean) {
        try {
            if (success) {
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 120)
            } else {
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

    private fun fetchJobParts() {
        val config = getCredentials()
        if (config == null) {
            Toast.makeText(this, "Setup required", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        binding.layoutPickingLoading.visibility = View.VISIBLE
        binding.tvPickingLoadingMsg.text = "Loading job parts list..."

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) {
            "${serverUrl}api/scanner/jobs/$jobId/parts"
        } else {
            "$serverUrl/api/scanner/jobs/$jobId/parts"
        }

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutPickingLoading.visibility = View.GONE
                    Toast.makeText(this@JobPickingActivity, "Failed to load parts: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutPickingLoading.visibility = View.GONE
                    if (code == 200) {
                        try {
                            val jsonObject = JSONObject(responseData)
                            val jsonArray = jsonObject.getJSONArray("parts")
                            val partsList = mutableListOf<PickingPartItem>()
                            for (i in 0 until jsonArray.length()) {
                                val obj = jsonArray.getJSONObject(i)
                                partsList.add(
                                    PickingPartItem(
                                        partId = obj.getString("partId"),
                                        name = obj.getString("name"),
                                        description = obj.optString("description", ""),
                                        upc = if (obj.isNull("upc")) null else obj.getString("upc"),
                                        category = obj.getString("category"),
                                        location = obj.getString("location"),
                                        locationColor = obj.optString("locationColor", "#4b5563"),
                                        stock = obj.getInt("stock"),
                                        totalRequired = obj.getInt("totalRequired"),
                                        totalPulled = obj.getInt("totalPulled")
                                    )
                                )
                            }
                            adapter.updateItems(partsList)
                            updatePickingProgressStatus()
                        } catch (e: Exception) {
                            Toast.makeText(this@JobPickingActivity, "Failed to parse job parts data: ${e.message}", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@JobPickingActivity, "Fetch failed ($code)", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun handleScannedBarcode(barcode: String) {
        // Find matching part in checklist
        val items = adapter.getItems()
        val match = items.find { it.upc == barcode }

        if (match == null) {
            binding.tvPickingScanStatus.text = "Error: Part '$barcode' is not required for this job!"
            binding.tvPickingScanStatus.setTextColor(Color.RED)
            playBeep(false)
            return
        }

        if (match.totalPulled >= match.totalRequired) {
            binding.tvPickingScanStatus.text = "Error: Part '${match.name}' is already fully picked!"
            binding.tvPickingScanStatus.setTextColor(Color.RED)
            playBeep(false)
            return
        }

        // Perform stateful pick
        pullPart(match)
    }

    private fun pullPart(item: PickingPartItem) {
        val config = getCredentials()
        if (config == null) return

        binding.layoutPickingLoading.visibility = View.VISIBLE
        binding.tvPickingLoadingMsg.text = "Pulling ${item.name}..."

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) {
            "${serverUrl}api/scanner/jobs/$jobId/pull"
        } else {
            "$serverUrl/api/scanner/jobs/$jobId/pull"
        }

        val jsonBody = JSONObject().apply {
            put("partId", item.partId)
            put("amount", 1)
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
                    binding.layoutPickingLoading.visibility = View.GONE
                    binding.tvPickingScanStatus.text = "Network Error: ${e.message}"
                    binding.tvPickingScanStatus.setTextColor(Color.RED)
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutPickingLoading.visibility = View.GONE
                    if (code == 200) {
                        item.totalPulled++
                        adapter.notifyDataSetChanged()
                        binding.tvPickingScanStatus.text = "Pulled 1x ${item.name} (${item.totalPulled}/${item.totalRequired})"
                        binding.tvPickingScanStatus.setTextColor(ContextCompat.getColor(this@JobPickingActivity, R.color.green_add))
                        playBeep(true)
                        updatePickingProgressStatus()
                    } else {
                        try {
                            val json = JSONObject(responseData)
                            val errMsg = json.optString("error", "Pull failed ($code)")
                            binding.tvPickingScanStatus.text = errMsg
                        } catch (e: Exception) {
                            binding.tvPickingScanStatus.text = "Pull failed ($code)"
                        }
                        binding.tvPickingScanStatus.setTextColor(Color.RED)
                        playBeep(false)
                    }
                }
            }
        })
    }

    private fun updatePickingProgressStatus() {
        val items = adapter.getItems()
        val allCompleted = items.isNotEmpty() && items.all { it.totalPulled >= it.totalRequired }
        binding.btnCompleteJob.isEnabled = allCompleted
        if (allCompleted) {
            binding.btnCompleteJob.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.green_add))
            binding.tvPickingScanStatus.text = "All parts successfully picked! Tap Complete."
            binding.tvPickingScanStatus.setTextColor(ContextCompat.getColor(this, R.color.green_add))
        } else {
            binding.btnCompleteJob.backgroundTintList = ColorStateList.valueOf(Color.parseColor("#4b5563"))
            if (items.isNotEmpty()) {
                binding.tvPickingScanStatus.text = "Scan a part barcode to pull"
                binding.tvPickingScanStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
            }
        }
    }

    private fun completeJob() {
        val config = getCredentials()
        if (config == null) return

        binding.layoutPickingLoading.visibility = View.VISIBLE
        binding.tvPickingLoadingMsg.text = "Completing job and adjusting inventory..."

        val (serverUrl, credential) = config
        val endpoint = if (serverUrl.endsWith("/")) {
            "${serverUrl}api/scanner/jobs/$jobId/complete"
        } else {
            "$serverUrl/api/scanner/jobs/$jobId/complete"
        }

        val request = Request.Builder()
            .url(endpoint)
            .header("Authorization", credential)
            .post("".toRequestBody())
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.layoutPickingLoading.visibility = View.GONE
                    Toast.makeText(this@JobPickingActivity, "Complete Job failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    playBeep(false)
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val responseData = response.body?.string() ?: ""
                val code = response.code
                response.close()

                Handler(Looper.getMainLooper()).post {
                    binding.layoutPickingLoading.visibility = View.GONE
                    if (code == 200) {
                        playBeep(true)
                        Toast.makeText(this@JobPickingActivity, "Job completed and stock deducted successfully!", Toast.LENGTH_LONG).show()
                        finish()
                    } else {
                        try {
                            val json = JSONObject(responseData)
                            val errMsg = json.optString("error", "Failed to complete job ($code)")
                            Toast.makeText(this@JobPickingActivity, errMsg, Toast.LENGTH_LONG).show()
                        } catch (e: Exception) {
                            Toast.makeText(this@JobPickingActivity, "Failed to complete job ($code)", Toast.LENGTH_LONG).show()
                        }
                        playBeep(false)
                    }
                }
            }
        })
    }
}
