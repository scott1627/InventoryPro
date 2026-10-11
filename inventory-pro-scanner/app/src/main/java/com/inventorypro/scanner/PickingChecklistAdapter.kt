package com.inventorypro.scanner

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class PickingPartItem(
    val partId: String,
    val name: String,
    val description: String?,
    val upc: String?,
    val category: String,
    val location: String,
    val locationColor: String,
    val stock: Int,
    val totalRequired: Int,
    var totalPulled: Int
)

class PickingChecklistAdapter(
    private var items: List<PickingPartItem>
) : RecyclerView.Adapter<PickingChecklistAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val layoutPickingCard: View = view.findViewById(R.id.layoutPickingCard)
        val viewPickingLocColor: View = view.findViewById(R.id.viewPickingLocColor)
        val tvPickingLocation: TextView = view.findViewById(R.id.tvPickingLocation)
        val tvPickingProgress: TextView = view.findViewById(R.id.tvPickingProgress)
        val tvPickingPartName: TextView = view.findViewById(R.id.tvPickingPartName)
        val tvPickingPartDesc: TextView = view.findViewById(R.id.tvPickingPartDesc)
        val pbPickingPart: ProgressBar = view.findViewById(R.id.pbPickingPart)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_picking_part, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvPickingPartName.text = item.name
        holder.tvPickingPartDesc.text = item.description ?: "No description"
        holder.tvPickingLocation.text = item.location
        holder.tvPickingProgress.text = "${item.totalPulled} / ${item.totalRequired}"

        // Set location dot color
        try {
            holder.viewPickingLocColor.setBackgroundColor(Color.parseColor(item.locationColor))
        } catch (e: Exception) {
            holder.viewPickingLocColor.setBackgroundColor(Color.GRAY)
        }

        // Set progress bar
        holder.pbPickingPart.max = item.totalRequired
        holder.pbPickingPart.progress = item.totalPulled

        // Set visual complete/incomplete state styling with .mutate() to prevent shared caching bugs
        val context = holder.itemView.context
        if (item.totalPulled >= item.totalRequired) {
            holder.layoutPickingCard.background.mutate().setTint(Color.parseColor("#2210B981"))
            holder.tvPickingProgress.setTextColor(context.getColor(R.color.green_add))
            holder.pbPickingPart.progressTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.green_add))
        } else {
            holder.layoutPickingCard.background.mutate().setTint(context.getColor(R.color.surface))
            holder.tvPickingProgress.setTextColor(context.getColor(R.color.text_primary))
            holder.pbPickingPart.progressTintList = android.content.res.ColorStateList.valueOf(context.getColor(R.color.primary))
        }
    }

    override fun getItemCount() = items.size

    fun getItems() = items

    fun updateItems(newItems: List<PickingPartItem>) {
        items = newItems
        notifyDataSetChanged()
    }
}
