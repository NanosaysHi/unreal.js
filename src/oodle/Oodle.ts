import * as ffi from "ffi-napi"
import ref from "ref-napi"
import { CompressException, DecompressException, OodleException } from "./Exceptions";

export class Oodle {
    static oodleLib: OodleLibrary = null

    /**
     * Decompresses an Oodle compressed array
     * @param src the compressed source data
     * @param dstLen the uncompressed length
     * @return the decompressed data
     * @throws {DecompressException} when the decompression fails
     */
    static decompress(src: Buffer, dstLen: number)

    /**
     * Decompresses an Oodle compressed array
     * @param src the compressed source data
     * @param dst the destination buffer
     * @throws DecompressException when the decompression fails
     * @throws {Error} when the library could not be loaded
     */
    static decompress(src: Buffer, dst: Buffer)

    /**
     * Decompresses an Oodle compressed array
     * @param src the compressed source data
     * @param srcOff the offset into `src`
     * @param srcLen the compressed length
     * @param dst the destination buffer
     * @param dstOff the offset into `dst`
     * @param dstLen the uncompressed length
     * @throws {DecompressException} when the decompression fails
     * @throws {SyntaxError} when the library could not be loaded
     */
    static decompress(src: Buffer, dstLen?: number, dst?: Buffer, dstOff?: number, srcOff?: number, srcLen?: number)

    static decompress(src: Buffer, dstLen?: Buffer | number, dst?: Buffer, dstOff?: number, srcOff?: number, srcLen?: number) {
        this.ensureLib()
        if (typeof dstLen === "number" && !dst) {
            return this.decompress(src, dstLen as number, Buffer.alloc(dstLen as number), 0, 0, src.length)
        } else if (Buffer.isBuffer(dstLen)) {
            return this.decompress(src, (dstLen as Buffer).length, dstLen as Buffer, 0, 0, src.length)
        } else {
            const start = Date.now()
            const sourcePointer = Buffer.alloc(srcLen)
            ref.writePointer(src, srcOff, sourcePointer)
            const dstPointer = Buffer.alloc(dstLen as number)
            const resultCode = this.oodleLib.OodleLZ_Decompress(
                sourcePointer, srcLen,
                dstPointer, dstLen as number,
                0, 0, Number.MAX_VALUE,
                ref.NULL, 0,
                ref.NULL, ref.NULL, ref.NULL,
                0, 0
            )
            if (resultCode < 0)
                throw DecompressException(`Oodle decompression failed with code ${resultCode}`)
            ref.readPointer(sourcePointer, dstOff, dstLen as number).copy(dst)
            const stop = Date.now()
            const seconds = (stop - start) / 1000
            console.info(`Oodle decompress: ${srcLen} => ${dstLen} (${seconds} seconds)`)
        }
    }

    /**
     * Compresses a byte array
     * @param uncompressed the uncompressed source data
     * @param compressor the compressor to use
     * @param compressionLevel the compression level to use
     * @return the compressed data
     * @throws CompressException when the compression fails
     * @throws IllegalStateException when the library could not be loaded
     */
    static compress(uncompressed: Buffer, compressor: number, compressionLevel: number) {
        this.ensureLib()
        const start = Date.now()
        const srcLength = uncompressed.length
        const dstLength = srcLength + 65536
        const sourcePointer = Buffer.alloc(srcLength)
        ref.writePointer(uncompressed, 0, sourcePointer)
        const dstPointer = Buffer.alloc(dstLength)
        const resultCode = this.oodleLib.OodleLZ_Compress(
            compressor,
            sourcePointer, srcLength,
            dstPointer, compressionLevel,
            ref.NULL, 0, 0, ref.NULL, 0
        )
        if (resultCode <= 0)
            throw CompressException(`Oodle compression failed with code ${resultCode}`)
        const dst = dstPointer.subarray(0, resultCode)
        const stop = Date.now()
        const seconds = (stop - start) / 1000
        console.info(`Oodle compress: ${srcLength} => ${dst.length} (${seconds} seconds)`)
        return dst
    }

    static ensureLib() {
        try {
            if (!this.oodleLib) {
                this.oodleLib = ffi.Library("oo2core_8_win64.dll", {
                    OodleLZ_Decompress: [ref.types.int, ["uint8*", "int", "uint8*", "size_t", "int", "int", "int", "uint8*", "size_t", "void*", "void*", "void*", "size_t", "int"]],
                    OodleLZ_Compress: ["int", ["int", "uint8*", "size_t", "uint8*", "int", "void*", "size_t", "size_t", "void*", "size_t"]]
                })
            }
        } catch (e) {
            throw OodleException(e)
        }
    }
}

interface OodleLibrary {
    OodleLZ_Decompress(
        src_buf: Buffer,
        src_len: number,
        dst: Buffer,
        dst_size: number,
        fuzz: number,
        crc: number,
        verbose: number,
        dst_base: Buffer | null,
        e: number,
        cb: Buffer | null,
        cb_ctx: Buffer | null,
        scratch: Buffer | null,
        scratch_size: number,
        threadPhase: number
    ): number

    OodleLZ_Compress(
        codec: number,
        src_buf: Buffer,
        src_len: number,
        dst_buf: Buffer,
        level: number,
        opts: Buffer | null,
        offs: number,
        unused: number,
        scratch: Buffer | null,
        scratch_size: number
    ): number
}
