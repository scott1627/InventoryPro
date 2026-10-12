package com.inventorypro.scanner.printer

import android.app.Dialog
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.recyclerview.widget.LinearLayoutManager
import com.inventorypro.scanner.databinding.DialogSelectPrinterBinding

/**
 * Dialog that searches for nearby Bluetooth LE Katasymbol / Supvan printers
 * and lets the user connect & save the printer.
 */
object PrinterPickerDialog {

    fun show(
        context: Context,
        bleManager: SupvanBleManager,
        onPrinterSelected: (SupvanBleManager.DiscoveredPrinter) -> Unit
    ) {
        val binding = DialogSelectPrinterBinding.inflate(LayoutInflater.from(context))
        val dialog = AlertDialog.Builder(context)
            .setView(binding.root)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val adapter = DiscoveredPrinterAdapter { printer ->
            SupvanBleManager.savePrinter(context, printer.name, printer.address)
            Toast.makeText(context, "Selected printer: ${printer.name}", Toast.LENGTH_SHORT).show()
            onPrinterSelected(printer)
            dialog.dismiss()
        }

        binding.rvDiscoveredPrinters.layoutManager = LinearLayoutManager(context)
        binding.rvDiscoveredPrinters.adapter = adapter

        fun startScan() {
            adapter.clear()
            binding.layoutScanningSpinner.visibility = View.VISIBLE
            binding.tvEmptyPrinters.visibility = View.GONE
            binding.tvScanningText.text = "Searching for BLE printers..."

            bleManager.startScan(
                onDeviceFound = { device ->
                    binding.tvEmptyPrinters.visibility = View.GONE
                    adapter.addOrUpdateDevice(device)
                },
                onScanFinished = {
                    binding.layoutScanningSpinner.visibility = View.GONE
                    if (adapter.itemCount == 0) {
                        binding.tvEmptyPrinters.visibility = View.VISIBLE
                    }
                },
                scanDurationMs = 8000
            )
        }

        binding.btnRescanPrinters.setOnClickListener {
            startScan()
        }

        binding.btnCancelSelectPrinter.setOnClickListener {
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            bleManager.stopScan()
        }

        dialog.show()
        startScan()
    }
}
