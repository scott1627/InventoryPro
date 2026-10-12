package com.inventorypro.scanner.printer

import org.tukaani.xz.LZMA2Options
import org.tukaani.xz.LZMAOutputStream
import java.io.ByteArrayOutputStream

/**
 * Protocol encoder and packet framer for Katasymbol / Supvan thermal label printers
 * (Supvan E10, E11, T15 Series 2 firmware family).
 *
 * Implements:
 * - 96-dot column-major raster layout
 * - Pre-LZMA page buffer with PAGE_REG_BITS and checksum
 * - LZMA-Alone stream compression (dict_size=8192, lc=3, lp=0, pb=2, nice_len=128)
 * - 0x7E, 0x5A command framing and 16-byte int-param payloads
 * - 506-byte DMA chunking, 512-byte outer enveloping, and 128-byte BLE write subchunks
 */
object SupvanProtocol {

    const val E10_HEAD_DOTS = 96
    const val E10_BYTES_PER_COLUMN = 12 // 96 dots / 8 bits
    const val DMA_CHUNK_SIZE = 506
    const val DMA_DATA_PER_CHUNK = 500
    const val DMA_PAGE_SIZE = 512
    const val DMA_ENVELOPE_SIZE = 512
    const val DMA_BLE_SUBCHUNK = 128

    // Frame magic constants
    const val MAGIC_0 = 0x7E
    const val MAGIC_1 = 0x5A
    const val HEADER_BYTE_4 = 0x10
    const val HEADER_BYTE_6 = 0xAA

    const val FRAME_TYPE_CMD = 0x01
    const val FRAME_TYPE_DATA = 0x02

    // DMA inner chunk magic
    const val DMA_MAGIC_0 = 0xAA
    const val DMA_MAGIC_1 = 0xBB

    // 6-byte DMA outer envelope header for E-series
    val DMA_ENVELOPE_HEADER = byteArrayOf(
        0x7E.toByte(), 0x5A.toByte(), 0xFC.toByte(), 0x01.toByte(), 0x10.toByte(), 0x02.toByte()
    )

    // Opcodes
    const val CMD_BUF_FULL = 0x10
    const val CMD_INQUIRY_STA = 0x11
    const val CMD_START_PRINT = 0x13
    const val CMD_STOP_PRINT = 0x14
    const val CMD_NEXT_ZIPPEDBULK = 0x5C
    const val CMD_PAPER_BACK = 0xBA
    const val CMD_BLTCMD_SET_HEADRATE = 0xC9

    // Standard BLE UUIDs
    const val SERVICE_UUID_FEE7 = "0000fee7-0000-1000-8000-00805f9b34fb"
    const val CHAR_UUID_FEC1 = "0000fec1-0000-1000-8000-00805f9b34fb"

    // Fallback UUIDs for legacy firmware
    const val SERVICE_UUID_E0FF = "0000e0ff-3c17-d293-8e48-14fe2e4da212"
    const val CHAR_NOTIFY_FFE1 = "0000ffe1-0000-1000-8000-00805f9b34fb"
    const val CHAR_WRITE_FFE9 = "0000ffe9-0000-1000-8000-00805f9b34fb"

    const val SERVICE_UUID_FF00 = "0000ff00-0000-1000-8000-00805f9b34fb"
    const val CHAR_NOTIFY_FF01 = "0000ff01-0000-1000-8000-00805f9b34fb"
    const val CHAR_WRITE_FF02 = "0000ff02-0000-1000-8000-00805f9b34fb"

    const val CCCD_UUID = "00002902-0000-1000-8000-00805f9b34fb"

    /**
     * Unsigned-byte sum mod 2^16 used across all Supvan checksums.
     */
    fun checksumSum(data: ByteArray, offset: Int = 0, length: Int = data.size - offset): Int {
        var sum = 0
        val end = offset + length
        for (i in offset until end) {
            sum += (data[i].toInt() and 0xFF)
        }
        return sum and 0xFFFF
    }

    /**
     * Builds a standard command frame.
     * Frame structure:
     * [0] 0x7E
     * [1] 0x5A
     * [2-3] LE16 length = payload.size + 6 (frame_size - 4)
     * [4] 0x10
     * [5] frame_type (0x01 cmd / 0x02 data)
     * [6] 0xAA
     * [7] opcode
     * [8-9] LE16 checksum of payload bytes
     * [10+] payload
     */
    fun buildCommandFrame(
        opcode: Int,
        payload: ByteArray = ByteArray(0),
        frameType: Int = FRAME_TYPE_CMD
    ): ByteArray {
        val lengthField = payload.size + 6
        val csum = checksumSum(payload)
        val out = ByteArray(10 + payload.size)
        out[0] = MAGIC_0.toByte()
        out[1] = MAGIC_1.toByte()
        out[2] = (lengthField and 0xFF).toByte()
        out[3] = ((lengthField shr 8) and 0xFF).toByte()
        out[4] = HEADER_BYTE_4.toByte()
        out[5] = frameType.toByte()
        out[6] = HEADER_BYTE_6.toByte()
        out[7] = (opcode and 0xFF).toByte()
        out[8] = (csum and 0xFF).toByte()
        out[9] = ((csum shr 8) and 0xFF).toByte()
        if (payload.isNotEmpty()) {
            System.arraycopy(payload, 0, out, 10, payload.size)
        }
        return out
    }

    /**
     * 16-byte fixed-frame command with 1 integer parameter.
     * Payload is: [0x00, 0x01, param_lo, param_hi, 0x00, 0x00]
     */
    fun buildCommandFrameIntParam(opcode: Int, param: Int = 0): ByteArray {
        val payload = byteArrayOf(
            0x00, 0x01,
            (param and 0xFF).toByte(),
            ((param shr 8) and 0xFF).toByte(),
            0x00, 0x00
        )
        return buildCommandFrame(opcode, payload, FRAME_TYPE_CMD)
    }

    /**
     * Builds the pre-LZMA buffer that precedes compression.
     * Header (14 bytes):
     * [0-1] LE16 checksum over bytes [2..end]
     * [2-3] PAGE_REG_BITS (2 bytes)
     * [4-5] LE16 column count (label width in dots)
     * [6]   12 (mPerLineByte)
     * [7]   0x00
     * [8]   0x01
     * [9]   0x00
     * [10]  0x01
     * [11]  0x00
     * [12]  0x00 (noZeroIndex trim offset)
     * [13]  0x00
     * [14+] column-major raster bytes (column_count * 12 bytes)
     */
    fun buildPreLzmaBuffer(
        raster: ByteArray,
        columnCount: Int,
        density: Int = 4,
        cutType: Int = 0,
        savePaper: Boolean = false
    ): ByteArray {
        val totalSize = 14 + raster.size
        val out = ByteArray(totalSize)

        // PAGE_REG_BITS Byte 0:
        // bit 1: PageSt (1)
        // bit 2: PageEnd (1)
        // bit 3: PrtEnd (1)
        // bits 4-6: Cut (3 bits)
        // bit 7: Savepaper (1 bit)
        var b0 = (1 shl 1) or (1 shl 2) or (1 shl 3)
        b0 = b0 or ((cutType and 0x07) shl 4)
        if (savePaper) {
            b0 = b0 or (1 shl 7)
        }

        // PAGE_REG_BITS Byte 1:
        // bits 0-1: FirstCut (0)
        // bits 2-3: Nodu (density and 0b11)
        // bits 4-7: Mat (1 shl 4 = 0x10)
        var b1 = (density and 0x03) shl 2
        val mat = 1
        b1 = b1 or ((mat and 0x0F) shl 4)

        out[2] = (b0 and 0xFF).toByte()
        out[3] = (b1 and 0xFF).toByte()
        out[4] = (columnCount and 0xFF).toByte()
        out[5] = ((columnCount shr 8) and 0xFF).toByte()
        out[6] = E10_BYTES_PER_COLUMN.toByte()
        out[7] = 0x00
        out[8] = 0x01
        out[9] = 0x00
        out[10] = 0x01
        out[11] = 0x00
        out[12] = 0x00
        out[13] = 0x00

        // Copy raster payload into buffer at offset 14
        System.arraycopy(raster, 0, out, 14, raster.size)

        // Proprietary stride-based LE16 checksum (T15Print.java:517-529):
        // sum header bytes [2..13] + sampled bytes at every 256-th boundary (255, 511, 767, ...)
        var csum = 0
        for (i in 2 until 14) {
            csum += (out[i].toInt() and 0xFF)
        }
        val numStrides = totalSize / 256
        for (i in 1..numStrides) {
            csum += (out[i * 256 - 1].toInt() and 0xFF)
        }
        csum = csum and 0xFFFF
        out[0] = (csum and 0xFF).toByte()
        out[1] = ((csum shr 8) and 0xFF).toByte()

        return out
    }

    /**
     * Compresses pre-LZMA buffer into an LZMA-Alone stream with the exact
     * parameters expected by Katasymbol/Supvan firmware:
     * - dict_size = 8192
     * - lc = 3
     * - lp = 0
     * - pb = 2
     * - nice_len = 128
     * - match_finder = BT4
     * - uncompressed size written in header, no EOS end marker.
     */
    fun compressLzmaAlone(preLzmaBuffer: ByteArray): ByteArray {
        val baos = ByteArrayOutputStream()
        val options = LZMA2Options().apply {
            dictSize = 8192
            lc = 3
            lp = 0
            pb = 2
            niceLen = 128
            mode = LZMA2Options.MODE_NORMAL
            matchFinder = LZMA2Options.MF_BT4
        }
        val lzmaOut = LZMAOutputStream(baos, options, preLzmaBuffer.size.toLong())
        lzmaOut.write(preLzmaBuffer)
        lzmaOut.finish()
        lzmaOut.close()
        return baos.toByteArray()
    }

    /**
     * Slices compressed payload into 506-byte DMA chunks (500 bytes payload + 6 bytes inner header).
     * Inner chunk structure:
     * [0-1] 0xAA, 0xBB
     * [2-3] LE16 checksum over bytes [4..505]
     * [4] chunk index
     * [5] total chunks
     * [6..505] 500 bytes of compressed data (zero-padded on last chunk)
     */
    fun splitIntoDmaChunks(compressed: ByteArray): List<ByteArray> {
        val totalChunks = (compressed.size + DMA_DATA_PER_CHUNK - 1) / DMA_DATA_PER_CHUNK
        val chunks = mutableListOf<ByteArray>()

        for (i in 0 until totalChunks) {
            val start = i * DMA_DATA_PER_CHUNK
            val end = minOf(start + DMA_DATA_PER_CHUNK, compressed.size)
            val chunk = ByteArray(DMA_CHUNK_SIZE)
            chunk[0] = DMA_MAGIC_0.toByte()
            chunk[1] = DMA_MAGIC_1.toByte()
            chunk[4] = (i and 0xFF).toByte()
            chunk[5] = (totalChunks and 0xFF).toByte()

            System.arraycopy(compressed, start, chunk, 6, end - start)

            // Checksum over bytes [4..505] (502 bytes)
            val csum = checksumSum(chunk, 4, 502)
            chunk[2] = (csum and 0xFF).toByte()
            chunk[3] = ((csum shr 8) and 0xFF).toByte()

            chunks.add(chunk)
        }
        return chunks
    }

    /**
     * Wraps a 506-byte DMA chunk in the 512-byte outer envelope.
     * Header: 7E 5A FC 01 10 02 (6 bytes)
     * Followed by 506 bytes of chunk.
     */
    fun wrapDmaEnvelope(chunk: ByteArray): ByteArray {
        val envelope = ByteArray(DMA_ENVELOPE_SIZE)
        System.arraycopy(DMA_ENVELOPE_HEADER, 0, envelope, 0, DMA_ENVELOPE_HEADER.size)
        System.arraycopy(chunk, 0, envelope, DMA_ENVELOPE_HEADER.size, chunk.size)
        return envelope
    }

    /**
     * Slices a 512-byte DMA envelope into writes for Bluetooth LE.
     * Default sliceSize is 128 bytes (4 packets).
     */
    fun splitEnvelopeForBle(envelope: ByteArray, sliceSize: Int = DMA_BLE_SUBCHUNK): List<ByteArray> {
        val result = mutableListOf<ByteArray>()
        var offset = 0
        while (offset < envelope.size) {
            val len = minOf(sliceSize, envelope.size - offset)
            val sub = ByteArray(len)
            System.arraycopy(envelope, offset, sub, 0, len)
            result.add(sub)
            offset += len
        }
        return result
    }

    /**
     * Builds the CMD_NEXT_ZIPPEDBULK (0x5C) initialization frame.
     * Payload: [0x00, 0x01, page_size_lo, page_size_hi, num_chunks_lo, num_chunks_hi]
     */
    fun buildNextZippedBulkFrame(numChunks: Int): ByteArray {
        val payload = byteArrayOf(
            0x00, 0x01,
            (DMA_PAGE_SIZE and 0xFF).toByte(),
            ((DMA_PAGE_SIZE shr 8) and 0xFF).toByte(),
            (numChunks and 0xFF).toByte(),
            ((numChunks shr 8) and 0xFF).toByte()
        )
        return buildCommandFrame(CMD_NEXT_ZIPPEDBULK, payload, FRAME_TYPE_CMD)
    }

    /**
     * Computes the headrate wire parameter for concentration (1..7).
     * Concentration 1 -> 80, 4 -> 110, 7 -> 140.
     */
    fun computeHeadrate(concentration: Int): Int {
        val clamped = concentration.coerceIn(1, 7)
        return (((clamped - 1) / 10.0 + 0.8) * 100.0).toInt()
    }
}
