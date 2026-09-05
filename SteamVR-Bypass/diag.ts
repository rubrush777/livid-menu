//@ts-ignore
declare const Il2Cpp: any;

Il2Cpp.perform(() => {
    const log = (m: string) => console.log("[diag] " + m);

    try {
        const Action = Il2Cpp.corlib.class("System.Action`1");
        log("Action handle=" + Action.handle + " isGeneric=" + Action.isGeneric + " isInflated=" + Action.isInflated);

        const type = Action.type;
        log("Action.type handle=" + type.handle);

        const typeObj = type.object;
        log("Action.type.object handle=" + typeObj.handle + " isNull=" + typeObj.isNull());

        const genArgs = typeObj.method("GetGenericArguments", 0).invoke();
        log("GetGenericArguments -> array handle=" + genArgs.handle + " length=" + genArgs.length);

        // Walk elementType chain step by step (this is what crashes in Array.elements)
        const arrObj = genArgs.object;
        log("array.object handle=" + arrObj.handle);
        const arrClass = arrObj.class;
        log("array.object.class handle=" + arrClass.handle + " name=" + (arrClass.name ?? "?"));
        const arrClassType = arrClass.type;
        log("array.object.class.type handle=" + arrClassType.handle);
        const arrClassFromType = arrClassType.class;
        log("array.object.class.type.class handle=" + arrClassFromType.handle);
        const bt = arrClassFromType.baseType;
        log("baseType handle=" + (bt ? bt.handle : "null"));

        if (bt) {
            const btClass = bt.class;
            log("baseType.class handle=" + btClass.handle);
            try {
                log("arrayElementSize=" + btClass.arrayElementSize);
            } catch (e: any) {
                log("arrayElementSize threw: " + e.message);
            }
            try {
                log("elementClass=" + btClass.elementClass);
            } catch (e: any) {
                log("elementClass threw: " + e.message);
            }
        }

        // Raw read of first element without library machinery
        const elemPtr = genArgs.handle.add(0x20).readPointer();
        log("raw first element pointer=" + elemPtr);

        // Now do the enum computation that crashes
        log("about to access Il2Cpp.Type.Enum...");
        const enumVal = Il2Cpp.Type.Enum;
        log("Il2Cpp.Type.Enum computed, VOID=" + enumVal.VOID);
    } catch (e: any) {
        log("DIAG ERROR: " + (e?.stack ?? e));
    }
});
