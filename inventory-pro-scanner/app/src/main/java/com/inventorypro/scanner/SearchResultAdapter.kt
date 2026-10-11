package com.inventorypro.scanner

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

data class PartSearchResult(
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

class SearchResultAdapter(
    private var items: List<PartSearchResult>,
    private val onItemClick: (PartSearchResult) -> Unit
) : RecyclerView.Adapter<SearchResultAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvCategory: TextView = view.findViewById(R.id.tvCategory)
        val tvName: TextView = view.findViewById(R.id.tvName)
        val tvDescription: TextView = view.findViewById(R.id.tvDescription)
        val viewLocColor: View = view.findViewById(R.id.viewLocColor)
        val tvLocation: TextView = view.findViewById(R.id.tvLocation)
        val tvStock: TextView = view.findViewById(R.id.tvStock)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_search_result, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        holder.tvCategory.text = item.category.uppercase()
        holder.tvName.text = item.name
        holder.tvDescription.text = item.description.ifEmpty { "No description" }
        holder.tvLocation.text = item.location
        holder.tvStock.text = "Stock: ${item.stock}"

        try {
            holder.viewLocColor.setBackgroundColor(Color.parseColor(item.locationColor))
        } catch (e: Exception) {
            holder.viewLocColor.setBackgroundColor(Color.GRAY)
        }

        holder.itemView.setOnClickListener { onItemClick(item) }
    }

    override fun getItemCount() = items.size

    fun updateItems(newItems: List<PartSearchResult>) {
        items = newItems
        notifyDataSetChanged()
    }
}
