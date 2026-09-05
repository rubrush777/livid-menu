//@ts-ignore
declare const Il2Cpp: any;
declare const Java: any;

Il2Cpp.perform(() => {
    const acImage = Il2Cpp.domain.assembly("AnimalCompany").image;
    const AnimalCompanyAPI = acImage.class("AnimalCompany.API.AnimalCompanyAPI");
    const apiSession = AnimalCompanyAPI.method("get_session").invoke();

    const bearer = apiSession.method("get_AuthToken").invoke();
    const refresh = apiSession.method("get_RefreshToken").invoke();

    console.log("made by rubrush");

    setTimeout(() => {
        console.log("bearer: " + bearer + " refresh: " + refresh);
    }, 6000);
});