package com.inventorypro.scanner

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.inventorypro.scanner.databinding.DialogBinPartsPickerBinding

data class BinPartItem(
    val id: String,
    val name: String,
    val description: String,
    val upc: String?,
    val category: String,
    val location: String,
    val locationColor: String,
    val stock: Int,
    val imageUrl: String? = null
)

class BinPartsAdapter(
    private val items: List<BinPartItem>,
    private val onPartClick: (BinPartItem) -> Unit
) : RecyclerView.Adapter<BinPartsAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvCategory: TextView = view.findViewById(R.id.tvCategory)
        val tvPartName: TextView = view.findViewById(R.id.tvPartName)
        val tvPartDescription: TextView = view.findViewById(R.id.tvPartDescription)
        val tvPartStock: TextView = view.findViewById(R.id.tvPartStock)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_bin_part, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvCategory.text = item.category.uppercase()
        holder.tvPartName.text = item.name
        holder.tvPartDescription.text = item.description.ifEmpty { "No description" }
        holder.tvPartStock.text = item.stock.toString()

        holder.itemView.setOnClickListener {
            onPartClick(item)
        }
    }

    override fun getItemCount() = items.size
}

class BinPartsPickerDialog(
    private val context: Context,
    private val binLocation: String,
    private val parts: List<BinPartItem>,
    private val onPartSelected: (BinPartItem) -> Unit
) {
    private val binding = DialogBinPartsPickerBinding.inflate(LayoutInflater.from(context))
    private val dialog: AlertDialog = AlertDialog.Builder(context)
        .setView(binding.root)
        .create()

    init {
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val cleanTitle = if (binLocation.startsWith("BIN", ignoreCase = true)) {
            binLocation
        } else {
            "Bin: $binLocation"
        }
        binding.tvBinTitle.text = cleanTitle
        binding.tvBinSubtitle.text = "${parts.size} parts found in this bin. Tap one to select:"

        val adapter = BinPartsAdapter(parts) { part ->
            dialog.dismiss()
            onPartSelected(part)
        }
        binding.rvBinParts.layoutManager = LinearLayoutManager(context)
        binding.rvBinParts.adapter = adapter

        binding.btnCloseDialog.setOnClickListener {
            dialog.dismiss()
        }
        binding.btnCancelBinPicker.setOnClickListener {
            dialog.dismiss()
        }
    }

    fun show() {
        dialog.show()
    }
}
