import { TypeMappingsProvider } from "./TypeMappingsProvider";
import { UScriptStruct } from "../exports/UScriptStruct";
import { PropertyInfo } from "../objects/PropertyInfo";
import { UStruct } from "../exports/UStruct";
import { Lazy } from "../../../util/Lazy";

export abstract class JsonTypeMappingsProvider extends TypeMappingsProvider {
    protected addStructs(json: any): boolean {
        if (!Array.isArray(json)) return false
        for (const entry of json) {
            if (Object.keys(entry).length < 1) continue
            const structEntry = new UScriptStruct()
            structEntry.name = entry.name
            const superType = entry.superType
            structEntry.superStruct = new Lazy<UStruct>(() => superType != null ? this.mappings.types[superType] : null)
            structEntry.childProperties2 = (entry.properties as any[])?.map(it => new PropertyInfo(it)) || []
            structEntry.propertyCount = entry.propertyCount
            this.mappings.types[structEntry.name] = structEntry
        }
        return true
    }

    protected addEnums(json: any): boolean {
        if (!Array.isArray(json)) return false
        for (const entry of json) {
            if (Object.keys(entry).length < 1) continue
            const enumName = entry.name
            this.mappings.enums[enumName] = (entry.values as any[])?.map(it => it as string)
        }
        return true
    }
}