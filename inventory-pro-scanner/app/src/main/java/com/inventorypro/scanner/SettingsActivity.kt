package com.inventorypro.scanner

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.inventorypro.scanner.databinding.ActivitySettingsBinding
import okhttp3.Credentials
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.net.URL

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Settings"

        // Load current config
        val prefs = getSharedPreferences("ScannerConfig", Context.MODE_PRIVATE)
        binding.etServerUrl.setText(prefs.getString("ServerUrl", "http://localhost:3000"))
        binding.etUsername.setText(prefs.getString("Username", "admin"))
        binding.etPassword.setText(prefs.getString("Password", ""))
        binding.switchZebra.isChecked = prefs.getBoolean("EnableZebra", true)
        binding.switchCamera.isChecked = prefs.getBoolean("EnableCamera", true)
        binding.switchManual.isChecked = prefs.getBoolean("EnableManual", true)

        binding.btnSaveSettings.setOnClickListener {
            val serverUrl = binding.etServerUrl.text.toString().trim()
            val username = binding.etUsername.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()

            if (serverUrl.isEmpty() || username.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Simple URL format check
            try {
                URL(serverUrl)
            } catch (e: Exception) {
                Toast.makeText(this, "Invalid Server URL format", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            testAndSaveSettings(serverUrl, username, password)
        }
    }

    private fun testAndSaveSettings(url: String, user: String, pass: String) {
        binding.tvStatus.text = "Testing connection..."
        binding.tvStatus.setTextColor(resources.getColor(R.color.text_secondary))
        binding.btnSaveSettings.isEnabled = false

        // Query a dummy URL to check auth and connection
        val testUrl = if (url.endsWith("/")) "${url}api/scanner/part?upc=test_connection" else "$url/api/scanner/part?upc=test_connection"
        val credential = Credentials.basic(user, pass)

        val request = Request.Builder()
            .url(testUrl)
            .header("Authorization", credential)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    binding.btnSaveSettings.isEnabled = true
                    binding.tvStatus.text = "Connection Failed: ${e.message}"
                    binding.tvStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val code = response.code
                response.close()
                
                Handler(Looper.getMainLooper()).post {
                    binding.btnSaveSettings.isEnabled = true
                    // 404 is expected if the server is reached (since 'test_connection' UPC won't exist), which means authentication succeeded!
                    // 401 is auth failure, 200 is unexpected success.
                    if (code == 404 || code == 200) {
                        // Success - Save settings
                        val prefs = getSharedPreferences("ScannerConfig", Context.MODE_PRIVATE)
                        prefs.edit().apply {
                            putString("ServerUrl", url)
                            putString("Username", user)
                            putString("Password", pass)
                            putBoolean("EnableZebra", binding.switchZebra.isChecked)
                            putBoolean("EnableCamera", binding.switchCamera.isChecked)
                            putBoolean("EnableManual", binding.switchManual.isChecked)
                            apply()
                        }
                        binding.tvStatus.text = "Connection Verified! Settings Saved."
                        binding.tvStatus.setTextColor(resources.getColor(R.color.green_add))
                        Toast.makeText(this@SettingsActivity, "Configuration saved successfully", Toast.LENGTH_SHORT).show()
                    } else if (code == 401) {
                        binding.tvStatus.text = "Authentication Failed (Invalid Credentials)"
                        binding.tvStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                    } else {
                        binding.tvStatus.text = "Server responded with status code: $code"
                        binding.tvStatus.setTextColor(resources.getColor(R.color.amber_deduct))
                    }
                }
            }
        })
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressed()
        return true
    }
}
