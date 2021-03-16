import { ETextHistoryType } from "../../../assets/enums/ETextHistoryType";
import { FArchiveWriter } from "../../../writer/FArchiveWriter";
import { FArchive } from "../../../reader/FArchive";
import { FDateTime } from "../misc/DateTime";
import { EDateTimeStyle } from "../../../assets/enums/EDateTimeStyle";
import { FName } from "../../uobject/FName";
import { FAssetArchive } from "../../../assets/reader/FAssetArchive";
import { ParserException } from "../../../../exceptions/Exceptions";
import { UStringTable } from "../../../assets/exports/UStringTable";
import { FAssetArchiveWriter } from "../../../assets/writer/FAssetArchiveWriter";
import { Locres } from "../../../locres/Locres";

export enum EFormatArgumentType {
    Int = "Int",
    UInt = "UInt",
    Float = "Float",
    Double = "Double",
    Text = "Text",
    Gender = "Gender"
}

export class FText {
    flags: number
    historyType: any
    textHistory: FTextHistory
    text: string

    constructor(Ar: FArchive)
    constructor(sourceString: string)
    constructor(namespace: string, key: string, sourceString: string)
    constructor(namespace: string, key: string, sourceString: string, flags: number, historyType: ETextHistoryType)
    constructor(flags: number, historyType: number, textHistory: FTextHistory)
    constructor(...params) {
        const x =  params[0]
        if (x instanceof FArchive) {
            this.flags = x.readUInt32()
            this.historyType = new ETextHistoryType(0).valueOfByte(x.readInt8())
            this.textHistory = this.historyType === ETextHistoryType.None ? new FTextHistoryNone(x) :
                this.historyType === ETextHistoryType.Base ? new FTextHistoryBase(x) :
                this.historyType === ETextHistoryType.OrderedFormat ? new OrderedFormat(x) :
                this.historyType === ETextHistoryType.AsCurrency ? new FormatNumber(x) :
                this.historyType === ETextHistoryType.StringTableEntry ? new StringTableEntry(x) :
                null;
            this.text = this.textHistory.text
        } else if (typeof x === "string" && params.length === 1) {
            this.flags = 0
            this.historyType = ETextHistoryType.Base
            this.textHistory = new FTextHistoryBase("", "", x)
            this.text = this.textHistory.text
        } else if (typeof x === "string" && params.length === 3) {
            this.flags = 0
            this.historyType = ETextHistoryType.Base
            this.textHistory = new FTextHistoryBase(x, params[1], params[2])
            this.text = this.textHistory.text
        } else if (typeof x === "number") {
            this.flags = x
            this.historyType = params[1]
            this.textHistory = params[2]
            this.text = this.textHistory.text
        } else {
            this.flags = params[3]
            this.historyType = params[4]
            this.textHistory = new FTextHistoryBase(x, params[1], params[2])
            this.text = this.textHistory.text
        }
    }

    copy() {
        return new FText(this.flags, this.historyType, this.textHistory)
    }

    textForLocres(locres?: Locres): string {
        const history = this.textHistory
        return history instanceof FTextHistoryBase ?
            locres?.texts?.stringData?.get(history.namespace)?.get(history.key) || this.text :
            this.text
    }

    serialize(Ar: FArchiveWriter) {
        Ar.writeUInt32(this.flags)
        Ar.writeInt8(this.historyType.value)
        this.textHistory.serialize(Ar)
    }
}

export abstract class FTextHistory {
    abstract serialize(Ar: FArchiveWriter)
    abstract text: string

    OrderedFormat = class {
        sourceFmt: FText
        arguments
    }
}

export class FTextHistoryNone extends FTextHistory {
    cultureInvariantString: string = null
    get text(): string {
        return this.cultureInvariantString || ""
    }

    constructor()
    constructor(Ar: FArchive)
    constructor(x?: any) {
        super()
        if (x) {
            const bHasCultureInvariantString = x.readBoolean()
            if (bHasCultureInvariantString) {
                this.cultureInvariantString = x.readString()
            }
        }
    }

    serialize(Ar: FArchiveWriter) {
        const bHasCultureInvariantString = !!this.cultureInvariantString
        Ar.writeBoolean(bHasCultureInvariantString)
        if (bHasCultureInvariantString) {
            Ar.writeString(this.cultureInvariantString)
        }
    }
}

export class FTextHistoryBase extends FTextHistory {
    namespace: string
    key: string
    sourceString: string
    get text() {
        return this.sourceString
    }

    constructor(Ar: FArchive)
    constructor(namespace: string, key: string, sourceString: string)
    constructor(...params) {
        super()
        const x = params[0]
        if (x instanceof FArchive) {
            this.namespace = x.readString()
            this.key = x.readString()
            this.sourceString = x.readString()
        } else {
            this.namespace = x
            this.key = params[1]
            this.sourceString = params[2]
        }
    }

    serialize(Ar: FArchiveWriter) {
        Ar.writeString(this.namespace)
        Ar.writeString(this.key)
        Ar.writeString(this.sourceString)
    }
}

export class FTextHistoryDateTime extends FTextHistory {
    sourceDateTime: FDateTime
    dateStyle: EDateTimeStyle
    timeStyle: EDateTimeStyle
    timeZone: string
    targetCulture: string

    get text() {
        return `${this.timeZone}: ${this.sourceDateTime.date}`
    }

    constructor(Ar: FArchive)
    constructor(
        sourceDateTime: FDateTime,
        dateStyle: EDateTimeStyle,
        timeStyle: EDateTimeStyle,
        timeZone: string,
        targetCulture: string
    )
    constructor(...params) {
        super()
        const x = params[0]
        if (x instanceof FArchive) {
            this.sourceDateTime = new FDateTime(x)
            this.dateStyle = EDateTimeStyle[Object.keys(EDateTimeStyle)[x.readInt8()]]
            this.timeStyle = EDateTimeStyle[Object.keys(EDateTimeStyle)[x.readInt8()]]
            this.timeZone = x.readString()
            this.targetCulture = x.readString()
        } else {
            this.sourceDateTime = x
            this.dateStyle = params[1]
            this.timeStyle = params[2]
            this.timeZone = params[3]
            this.targetCulture = params[4]
        }
    }

    serialize(Ar: FArchiveWriter) {
        this.sourceDateTime.serialize(Ar)
        Ar.writeInt8(ordinal(this.dateStyle))
        Ar.writeInt8(ordinal(this.timeStyle))
        Ar.writeString(this.timeZone)
        Ar.writeString(this.targetCulture)
    }
}

export class OrderedFormat extends FTextHistory {
    sourceFmt: FText
    args: FFormatArgumentValue[]

    get text() {
        return this.sourceFmt.text
    }

    constructor(Ar: FArchive)
    constructor(sourceFmt: FText, args: FFormatArgumentValue[])
    constructor(x?: any, y?: any) {
        super()
        if (x instanceof FArchive) {
            this.sourceFmt = new FText(x)
            this.args = x.readArray(() => new FFormatArgumentValue(x))
        } else {
            this.sourceFmt = x
            this.args = y
        }
    }

    serialize(Ar: FArchiveWriter) {
        this.sourceFmt.serialize(Ar)
        Ar.writeTArray(this.args, (it) => it.serialize(Ar))
    }
}

export class FormatNumber extends FTextHistory {
    /** The source value to format from */
    sourceValue: FFormatArgumentValue
    /** The culture to format using */
    timeZone: string
    targetCulture: string

    get text(): string {
        return this.sourceValue.toString()
    }

    constructor(Ar: FArchive)
    constructor(sourceValue: FFormatArgumentValue, timeZone: string, targetCulture: string)
    constructor(x?: any, y?: any, z?:any) {
        super()
        if (x instanceof FArchive) {
            this.sourceValue = new FFormatArgumentValue(x)
            this.timeZone = x.readString()
            this.targetCulture = x.readString()
        } else {
            this.sourceValue = x
            this.timeZone = y
            this.targetCulture = z
        }
    }

    serialize(Ar: FArchiveWriter) {
        this.sourceValue.serialize(Ar)
        Ar.writeString(this.timeZone)
        Ar.writeString(this.targetCulture)
    }
}

export class StringTableEntry extends FTextHistory {
    tableId: FName
    key: string

    text: string

    constructor(Ar: FArchive)
    constructor(tableId: FName, key: string, text: string)
    constructor(x?: any, y?: any, z?: any) {
        super()
        if (x instanceof FArchive) {
            if (x instanceof FAssetArchive) {
                this.tableId = x.readFName()
                this.key = x.readString()

                const table = x.provider?.loadObject<UStringTable>(this.tableId.text)
                if (!table)
                    throw ParserException(`Failed to load string table '${this.tableId}'`)

                this.text = table.entries.get(this.key)
                if (!this.text)
                    throw ParserException("Didn't find needed in key in string table")
            } else {
                throw ParserException("Tried to load a string table entry with wrong archive type")
            }
        }
    }

    serialize(Ar: FArchiveWriter) {
        if (Ar instanceof FAssetArchiveWriter) {
            Ar.writeFName(this.tableId)
            Ar.writeString(this.key)
        } else {
            throw ParserException("Tried to save a string table entry with wrong archive type")
        }
    }
}

export class FFormatArgumentValue {
    type: EFormatArgumentType
    value: any

    constructor(Ar: FArchive)
    constructor(type: EFormatArgumentType, value: any)
    constructor(x?: any, y?: any) {
        if (x instanceof FArchive) {
            this.type = EDateTimeStyle[Object.keys(EDateTimeStyle)[x.readInt8()]]
            this.value = this.type === EFormatArgumentType.Int ? Number(x.readInt64()) :
                this.type === EFormatArgumentType.UInt ? Number(x.readUInt64()) :
                this.type === EFormatArgumentType.Float ? x.readFloat32() :
                this.type === EFormatArgumentType.Double ? x.readDouble() :
                this.type === EFormatArgumentType.Text ? new FText(x) :
                null // this.type === EFormatArgumentType.Gender
        } else {
            this.type = x
            this.value = y
        }
    }

    serialize(Ar: FArchiveWriter) {
        Ar.writeInt8(ordinal(this.type))
        switch (this.type) {
            case EFormatArgumentType.Int:
                Ar.writeInt64(this.value as number)
                break
            case EFormatArgumentType.UInt:
                Ar.writeUInt64(this.value as number)
                break
            case EFormatArgumentType.Float:
                Ar.writeFloat32(this.value as number)
                break
            case EFormatArgumentType.Double:
                Ar.writeDouble(this.value as number)
                break
            case EFormatArgumentType.Text:
                (this.value as FText).serialize(Ar)
                break
            case EFormatArgumentType.Gender:
                throw new Error("Gender Argument not supported yet")
                break
        }
    }

    toString() {
        return `[Object FFormatArgumentValue]`
    }
}

function ordinal(entry: any) {
    let pos: number
    const val = Object.values(entry)

    val.find((v, k) => {
        const h = v === entry
        if (h)
            pos = k
        return h
    })

    return pos
}