package com.inventorypro.scanner

import android.content.res.ColorStateList
import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import java.util.UUID

data class SessionHistoryItem(
    val id: String = UUID.randomUUID().toString(),
    val partId: String,
    val partName: String,
    val deltaAmount: Int,
    val newStock: Int,
    val timestamp: String,
    val category: String? = null,
    val location: String? = null,
    val locationColor: String? = null,
    val upc: String? = null
)

class SessionHistoryAdapter(
    private var items: MutableList<SessionHistoryItem>,
    private val onItemClick: (SessionHistoryItem) -> Unit,
    private val onUndoClick: (SessionHistoryItem) -> Unit
) : RecyclerView.Adapter<SessionHistoryAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvDeltaBadge: TextView = view.findViewById(R.id.tvDeltaBadge)
        val tvHistoryPartName: TextView = view.findViewById(R.id.tvHistoryPartName)
        val tvHistoryStock: TextView = view.findViewById(R.id.tvHistoryStock)
        val tvHistoryTime: TextView = view.findViewById(R.id.tvHistoryTime)
        val layoutHistoryLocation: LinearLayout = view.findViewById(R.id.layoutHistoryLocation)
        val viewHistoryLocColor: View = view.findViewById(R.id.viewHistoryLocColor)
        val tvHistoryLocation: TextView = view.findViewById(R.id.tvHistoryLocation)
        val btnUndoHistory: ImageButton = view.findViewById(R.id.btnUndoHistory)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_session_history, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        val context = holder.itemView.context

        holder.tvHistoryPartName.text = item.partName
        holder.tvHistoryStock.text = "Stock: ${item.newStock}"
        holder.tvHistoryTime.text = item.timestamp

        // Visual delta badge
        if (item.deltaAmount > 0) {
            holder.tvDeltaBadge.text = "+${item.deltaAmount}"
            holder.tvDeltaBadge.backgroundTintList = ColorStateList.valueOf(
                ContextCompat.getColor(context, R.color.green_add)
            )
            holder.tvDeltaBadge.setTextColor(Color.WHITE)
        } else {
            holder.tvDeltaBadge.text = "${item.deltaAmount}"
            holder.tvDeltaBadge.backgroundTintList = ColorStateList.valueOf(
                ContextCompat.getColor(context, R.color.amber_deduct)
            )
            holder.tvDeltaBadge.setTextColor(Color.BLACK)
        }

        // Optional Location chip
        if (!item.location.isNullOrEmpty()) {
            holder.layoutHistoryLocation.visibility = View.VISIBLE
            holder.tvHistoryLocation.text = item.location
            try {
                holder.viewHistoryLocColor.setBackgroundColor(
                    Color.parseColor(item.locationColor ?: "#4b5563")
                )
            } catch (e: Exception) {
                holder.viewHistoryLocColor.setBackgroundColor(Color.GRAY)
            }
        } else {
            holder.layoutHistoryLocation.visibility = View.GONE
        }

        // Tap item to reopen/inspect part
        holder.itemView.setOnClickListener {
            onItemClick(item)
        }

        // Tap undo button to revert change
        holder.btnUndoHistory.setOnClickListener {
            onUndoClick(item)
        }
    }

    override fun getItemCount() = items.size

    fun getItems(): List<SessionHistoryItem> = items

    fun updateItems(newItems: MutableList<SessionHistoryItem>) {
        items = newItems
        notifyDataSetChanged()
    }

    fun addItem(item: SessionHistoryItem) {
        items.add(0, item)
        notifyItemInserted(0)
    }

    fun removeItem(item: SessionHistoryItem): Int {
        val index = items.indexOfFirst { it.id == item.id }
        if (index != -1) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
        return index
    }

    fun clearAll() {
        val count = items.size
        items.clear()
        notifyItemRangeRemoved(0, count)
    }
}
