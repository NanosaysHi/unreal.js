import Collection from "@discordjs/collection";
import { FProperty, ReadType } from "../../assets/objects/FProperty";
import { FAssetArchive } from "../../assets/reader/FAssetArchive";
import { PropertyType } from "../../assets/objects/PropertyType";
import { ParserException } from "../../../exceptions/Exceptions";
import { FAssetArchiveWriter } from "../../assets/writer/FAssetArchiveWriter";

export class UScriptMap {
    numKeysToRemove: number
    mapData: Collection<FProperty, FProperty>

    constructor(Ar: FAssetArchive, typeData: PropertyType)
    constructor(numKeyToRemove: number, mapData: Collection<FProperty, FProperty>)
    constructor(x?: any, y?: any) {
        if (x instanceof FAssetArchive) {
            this.numKeysToRemove = x.readInt32()
            if (this.numKeysToRemove !== 0) {
                let i = 0
                while (i < this.numKeysToRemove) {
                    FProperty.readPropertyValue(x, y.innerType, ReadType.MAP)
                    ++i
                }
            }
            const length = x.readInt32()
            this.mapData = new Collection<FProperty, FProperty>()
            let i = 0
            while (i < length) {
                let isReadingValue = false
                try {
                    const key = FProperty.readPropertyValue(x, y.innerType, ReadType.MAP)
                    isReadingValue = true
                    const value = FProperty.readPropertyValue(x, y.valueType, ReadType.MAP)
                    this.mapData.set(key, value)
                } catch (e) {
                    throw ParserException(`Failed to read ${isReadingValue ? "value" : "key"} for index ${i} in map`)
                }
                ++i
            }
        } else {
            this.numKeysToRemove = x
            this.mapData = y
        }
    }

    serialize(Ar: FAssetArchiveWriter) {
        Ar.writeInt32(this.numKeysToRemove)
        Ar.writeInt32(this.mapData.size)
        this.mapData.forEach((v, k) => {
            FProperty.writePropertyValue(Ar, k, ReadType.MAP)
            FProperty.writePropertyValue(Ar, v, ReadType.MAP)
        })
    }
}