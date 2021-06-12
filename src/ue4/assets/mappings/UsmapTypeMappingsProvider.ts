import { TypeMappingsProvider } from "./TypeMappingsProvider";
import { FArchive } from "../../reader/FArchive";
import { FName } from "../../objects/uobject/FName";
import { ParserException } from "../../../exceptions/Exceptions";
import { Compression } from "../../../compression/Compression";
import { PropertyType } from "../objects/PropertyType";
import { Lazy } from "../../../util/Lazy";
import { Utils } from "../../../util/Utils";
import { UScriptStruct } from "../exports/UScriptStruct";
import { PropertyInfo } from "../objects/PropertyInfo";
import { UStruct } from "../exports/UStruct";

export class UsmapTypeMappingsProvider extends TypeMappingsProvider {
    static FILE_MAGIC = 0x30C4

    private readonly load: () => FArchive

    constructor(file: Buffer)
    constructor(load: () => FArchive)
    constructor(x: any) {
        super()
        this.load = x instanceof Buffer ? () => new FArchive(x) : x
    }

    reload(): boolean {
        const data = this.readCompressedUsmap(this.load())
        this.parseData(new FUsmapNameTableArchive(data))
        return true
    }

    protected readCompressedUsmap(Ar: FArchive): Buffer {
        const magic = Ar.readInt16()
        if (magic !== UsmapTypeMappingsProvider.FILE_MAGIC) {
            throw ParserException(".usmap file has an invalid magic constant")
        }

        const version = Ar.readUInt8()
        if (version !== EUsmapVersion.latest()) {
            throw ParserException(`.usmap file has invalid version ${version}`)
        }

        const methodInt = Ar.readUInt8()
        const compSize = Ar.readInt32()
        const decompSize = Ar.readInt32()
        if (Ar.size - Ar.pos < compSize) {
            throw ParserException("There is not enough data in the .usmap file")
        }

        const compData = Ar.readBuffer(compSize)
        const data = Buffer.alloc(decompSize)

        const method = methodInt === 0 ? "None" : methodInt === 1 ? "Oodle" : methodInt === 2 ? "Brotli" : null
        if (!method)
            throw new Error(`Unknown compression method index ${methodInt}`)
        Compression.uncompress(method, data, 0, decompSize, compData, 0, compSize)

        return data
    }

    private deserializePropData(Ar: FUsmapNameTableArchive): PropertyType {
        const propType = EUsmapPropertyType[Ar.readUInt8()]
        const type = new PropertyType(FName.dummy(propType))
        switch (propType) {
            case "EnumProperty":
                const prop = this.deserializePropData(Ar)
                type.innerType = prop
                type.isEnumAsByte = prop.type.text === "ByteProperty"
                type.enumName = Ar.readFName()
                break
            case "StructProperty":
                type.structName = Ar.readFName()
                break
            case "SetProperty":
            case "ArrayProperty":
                type.innerType = this.deserializePropData(Ar)
                break
            case "MapProperty":
                type.innerType = this.deserializePropData(Ar)
                type.valueType = this.deserializePropData(Ar)
                break
        }
        if (!type.structName.isNone()) {
            type.structClass = new Lazy<any>(() => this.mappings.types[type.structName.text])
        }
        return type
    }

    private parseData(Ar: FUsmapNameTableArchive) {
        Ar.nameMap = Ar.readArray(() => Ar.readBuffer(Ar.readUInt8()).toString())
        const max0 = Ar.readInt32()
        for (let y = 0; y < max0; ++y) {
            const enumName = Ar.readFName().text
            const enumValues = []
            const limit = Ar.readUInt8()
            for (let i = 0; i < limit; ++i) {
                enumValues.push(Ar.readFName().text)
            }
            this.mappings.enums[enumName] = enumValues
        }
        const max1 = Ar.readInt32()
        for (let x = 0; x < max1; ++x) {
            const struct = new UScriptStruct()
            struct.name = Ar.readFName().text
            const superStructName = Ar.readFName()
            struct.superStruct = !superStructName.isNone() ? new Lazy<UStruct>(() => this.getStruct(superStructName)) : null
            struct.propertyCount = Ar.readUInt16()
            const serializablePropCount = Ar.readUInt16()
            const arr = []
            for (let i = 0; i < serializablePropCount; ++i) {
                const schemaIdx = Ar.readUInt16()
                const arraySize = Ar.readUInt8()
                const propertyName = Ar.readFName()
                const type = this.deserializePropData(Ar)
                const info = new PropertyInfo(propertyName.text, type, arraySize)
                info.index = schemaIdx
                arr.push(info)
            }
            struct.childProperties2 = arr
            this.mappings.types[struct.name] = struct
        }
    }

}

class FUsmapNameTableArchive extends FArchive {
    public nameMap: string[]

    constructor(data: Buffer) {
        super(data)
    }

    readFName(): FName {
        const nameIndex = this.readInt32()
        if (nameIndex === -1) {
            return FName.NAME_None
        }
        const entry = this.nameMap[nameIndex]
        if (!entry) {
            throw ParserException(`FName could not be read, requested index ${nameIndex}, name map size ${this.nameMap.length}`)
        }
        return FName.dummy(entry)
    }
}

class EUsmapVersion {
    public Initial = 0
    static latest() {
        return Object.values(new EUsmapVersion()).pop()
    }
}

const EUsmapPropertyType = [
    "ByteProperty",
    "BoolProperty",
    "IntProperty",
    "FloatProperty",
    "ObjectProperty",
    "NameProperty",
    "DelegateProperty",
    "DoubleProperty",
    "ArrayProperty",
    "StructProperty",
    "StrProperty",
    "TextProperty",
    "InterfaceProperty",
    "MulticastDelegateProperty",
    "WeakObjectProperty", //
    "LazyObjectProperty", // When deserialized, these 3 properties will be SoftObjects
    "AssetObjectProperty", //
    "SoftObjectProperty",
    "UInt64Property",
    "UInt32Property",
    "UInt16Property",
    "Int64Property",
    "Int16Property",
    "Int8Property",
    "MapProperty",
    "SetProperty",
    "EnumProperty",
    "FieldPathProperty"
]