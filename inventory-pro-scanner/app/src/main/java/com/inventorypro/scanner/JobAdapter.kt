package com.inventorypro.scanner

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class JobItem(
    val id: String,
    val name: String,
    val description: String?,
    val status: String,
    val bomCount: Int,
    val createdAt: String
)

class JobAdapter(
    private var items: List<JobItem>,
    private val onItemClick: (JobItem) -> Unit
) : RecyclerView.Adapter<JobAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvJobName: TextView = view.findViewById(R.id.tvJobName)
        val tvJobStatus: TextView = view.findViewById(R.id.tvJobStatus)
        val tvJobDescription: TextView = view.findViewById(R.id.tvJobDescription)
        val tvJobBOMCount: TextView = view.findViewById(R.id.tvJobBOMCount)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_job, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvJobName.text = item.name
        holder.tvJobStatus.text = item.status.uppercase()
        holder.tvJobDescription.text = item.description ?: "No description provided."
        holder.tvJobBOMCount.text = "${item.bomCount} BOMs associated"

        // Style the status text color depending on the value
        val context = holder.itemView.context
        if (item.status.equals("IN_PROGRESS", ignoreCase = true)) {
            holder.tvJobStatus.setTextColor(context.getColor(R.color.green_add))
        } else {
            holder.tvJobStatus.setTextColor(context.getColor(R.color.primary))
        }

        holder.itemView.setOnClickListener { onItemClick(item) }
    }

    override fun getItemCount() = items.size

    fun updateItems(newItems: List<JobItem>) {
        items = newItems
        notifyDataSetChanged()
    }
}
