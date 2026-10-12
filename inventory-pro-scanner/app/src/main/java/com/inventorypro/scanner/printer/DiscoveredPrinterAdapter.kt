package com.inventorypro.scanner.printer

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.inventorypro.scanner.databinding.ItemDiscoveredPrinterBinding

class DiscoveredPrinterAdapter(
    private val onDeviceSelected: (SupvanBleManager.DiscoveredPrinter) -> Unit
) : RecyclerView.Adapter<DiscoveredPrinterAdapter.PrinterViewHolder>() {

    private val devices = mutableListOf<SupvanBleManager.DiscoveredPrinter>()

    fun addOrUpdateDevice(device: SupvanBleManager.DiscoveredPrinter) {
        val existingIndex = devices.indexOfFirst { it.address == device.address }
        if (existingIndex >= 0) {
            devices[existingIndex] = device
            notifyItemChanged(existingIndex)
        } else {
            devices.add(device)
            notifyItemInserted(devices.size - 1)
        }
    }

    fun clear() {
        val count = devices.size
        devices.clear()
        notifyItemRangeRemoved(0, count)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PrinterViewHolder {
        val binding = ItemDiscoveredPrinterBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return PrinterViewHolder(binding)
    }

    override fun onBindViewHolder(holder: PrinterViewHolder, position: Int) {
        holder.bind(devices[position])
    }

    override fun getItemCount(): Int = devices.size

    inner class PrinterViewHolder(
        private val binding: ItemDiscoveredPrinterBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(device: SupvanBleManager.DiscoveredPrinter) {
            binding.tvDeviceName.text = device.name
            binding.tvDeviceAddress.text = device.address
            binding.tvDeviceRssi.text = "${device.rssi} dBm"

            binding.btnConnectDevice.setOnClickListener {
                onDeviceSelected(device)
            }

            binding.root.setOnClickListener {
                onDeviceSelected(device)
            }
        }
    }
}
