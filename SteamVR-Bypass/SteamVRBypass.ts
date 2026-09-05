//@ts-ignore
declare const Il2Cpp: any;

Il2Cpp.perform(() => {

    const ac = Il2Cpp.domain
    .assembly("AnimalCompany")
	.image

	const apputils = ac.class("AnimalCompany.AppUtils")

	const status = ac.class("AnimalCompany.AppUtils").nested("SteamVRHeadsetStatus")

	const xr = apputils.method("GetXRBackend")
	const getstatus = apputils.method("GetSteamVRHeadsetStatus")
	const active = apputils.method("IsSteamVRHeadsetActive")

	active.implementation = function () {
        return true;
    };

	xr.implementation = function () {
        return 2;
    };

	getstatus.implementation = function () {
        const spoof = status.new().unbox();
        spoof.field("activeLoaderPresent").value = true
        spoof.field("xrDisplayRunning").value = true
        spoof.field("headDeviceValid").value = true
        spoof.field("userPresenceKnown").value = true
        spoof.field("userPresent").value = true
        return spoof;
    };

});
