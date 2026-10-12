package com.inventorypro.scanner.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SupvanProtocolTest {

    @Test
    fun testChecksumSum() {
        val data = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val sum = SupvanProtocol.checksumSum(data)
        assertEquals(10, sum)
    }

    @Test
    fun testCommandFrameIntParam() {
        // Density 110 wire frame test
        val densityFrame = SupvanProtocol.buildCommandFrameIntParam(
            SupvanProtocol.CMD_BLTCMD_SET_HEADRATE,
            110
        )
        // Expected frame:
        // 7E 5A 0C 00 10 01 AA C9 6F 00 00 01 6E 00 00 00
        assertEquals(16, densityFrame.size)
        assertEquals(0x7E.toByte(), densityFrame[0])
        assertEquals(0x5A.toByte(), densityFrame[1])
        assertEquals(0x0C.toByte(), densityFrame[2]) // lengthField = 12
        assertEquals(0x00.toByte(), densityFrame[3])
        assertEquals(0x10.toByte(), densityFrame[4])
        assertEquals(0x01.toByte(), densityFrame[5])
        assertEquals(0xAA.toByte(), densityFrame[6])
        assertEquals(0xC9.toByte(), densityFrame[7]) // Opcode
        assertEquals(0x6F.toByte(), densityFrame[8]) // Checksum lo: sum(payload) = 0x6E + 1 = 0x6F
        assertEquals(0x00.toByte(), densityFrame[9]) // Checksum hi
        assertEquals(0x00.toByte(), densityFrame[10])
        assertEquals(0x01.toByte(), densityFrame[11])
        assertEquals(0x6E.toByte(), densityFrame[12]) // 110 lo byte
        assertEquals(0x00.toByte(), densityFrame[13]) // 110 hi byte
        assertEquals(0x00.toByte(), densityFrame[14])
        assertEquals(0x00.toByte(), densityFrame[15])
    }

    @Test
    fun testPreLzmaBufferAndChecksum() {
        val columns = 50
        val raster = ByteArray(columns * 12) { (it and 0xFF).toByte() }
        val buffer = SupvanProtocol.buildPreLzmaBuffer(raster, columns, density = 4)

        assertEquals(14 + raster.size, buffer.size)
        // Verify column count in LE16
        assertEquals((columns and 0xFF).toByte(), buffer[4])
        assertEquals(((columns shr 8) and 0xFF).toByte(), buffer[5])
        // Verify mPerLineByte = 12
        assertEquals(12.toByte(), buffer[6])

        // Verify that raster bytes were correctly copied to buffer[14..end]
        for (i in raster.indices) {
            assertEquals(raster[i], buffer[14 + i])
        }

        // Verify proprietary stride-based checksum (sum header [2..13] + strides at 255, 511, etc.)
        var expectedCsum = 0
        for (i in 2 until 14) {
            expectedCsum += (buffer[i].toInt() and 0xFF)
        }
        val numStrides = buffer.size / 256
        for (i in 1..numStrides) {
            expectedCsum += (buffer[i * 256 - 1].toInt() and 0xFF)
        }
        expectedCsum = expectedCsum and 0xFFFF
        val actualCsum = (buffer[0].toInt() and 0xFF) or ((buffer[1].toInt() and 0xFF) shl 8)
        assertEquals(expectedCsum, actualCsum)
    }

    @Test
    fun testLzmaAloneCompressionHeader() {
        val testData = "SUPVAN_TEST_DATA_FOR_LABEL_PRINTING".toByteArray()
        val compressed = SupvanProtocol.compressLzmaAlone(testData)

        // Minimum LZMA-Alone container size is 13-byte header + stream
        assertTrue(compressed.size > 13)

        // Header byte 0: (pb * 5 + lp) * 9 + lc = (2 * 5 + 0) * 9 + 3 = 93 = 0x5D
        assertEquals(0x5D.toByte(), compressed[0])

        // Dictionary size: 8192 bytes LE32 = 0x00, 0x20, 0x00, 0x00
        assertEquals(0x00.toByte(), compressed[1])
        assertEquals(0x20.toByte(), compressed[2])
        assertEquals(0x00.toByte(), compressed[3])
        assertEquals(0x00.toByte(), compressed[4])

        // Uncompressed size LE64: testData.size
        assertEquals(testData.size.toByte(), compressed[5])
        assertEquals(0x00.toByte(), compressed[6])
        assertEquals(0x00.toByte(), compressed[7])
        assertEquals(0x00.toByte(), compressed[8])
    }

    @Test
    fun testDmaChunkingAndEnvelopeWrapping() {
        // Create 700 bytes of dummy compressed payload (will split into 2 chunks)
        val dummyPayload = ByteArray(700) { it.toByte() }
        val chunks = SupvanProtocol.splitIntoDmaChunks(dummyPayload)

        assertEquals(2, chunks.size)
        assertEquals(506, chunks[0].size)
        assertEquals(506, chunks[1].size)

        // First chunk header
        assertEquals(0xAA.toByte(), chunks[0][0])
        assertEquals(0xBB.toByte(), chunks[0][1])
        assertEquals(0.toByte(), chunks[0][4]) // chunk index 0
        assertEquals(2.toByte(), chunks[0][5]) // total chunks 2

        // Second chunk header
        assertEquals(0xAA.toByte(), chunks[1][0])
        assertEquals(0xBB.toByte(), chunks[1][1])
        assertEquals(1.toByte(), chunks[1][4]) // chunk index 1
        assertEquals(2.toByte(), chunks[1][5]) // total chunks 2

        // Test outer envelope wrapping (512 bytes)
        val envelope = SupvanProtocol.wrapDmaEnvelope(chunks[0])
        assertEquals(512, envelope.size)
        assertEquals(0x7E.toByte(), envelope[0])
        assertEquals(0x5A.toByte(), envelope[1])
        assertEquals(0xFC.toByte(), envelope[2])
        assertEquals(0x01.toByte(), envelope[3])
        assertEquals(0x10.toByte(), envelope[4])
        assertEquals(0x02.toByte(), envelope[5])

        // Test BLE subchunk slicing (4 x 128 bytes)
        val subchunks = SupvanProtocol.splitEnvelopeForBle(envelope)
        assertEquals(4, subchunks.size)
        for (sub in subchunks) {
            assertEquals(128, sub.size)
        }
    }
}
