// @ts-nocheck
declare const ptr: any;
declare const Interceptor: any;
declare const Module: any;
declare const Memory: any;
declare const NativeFunction: any;
declare const Script: any;

const QUEST_PLATFORM = 1;
const SYMBOLS_URL = "https://pastebin.com/raw/0da0c4sr";

function parseUrl(url: string): {
  hostname: string;
  path: string;
  port: number;
} {
  const match = url.match(/^https?:\/\/([^/:]+)(?::(\d+))?(.*)$/);
  if (!match) {
    return { hostname: "", path: "/", port: 443 };
  }
  const hostname = match[1];
  const port = match[2]
    ? parseInt(match[2])
    : url.startsWith("https")
      ? 443 // made by byte
      : 80;
  const path = match[3] || "/";
  return { hostname, path, port };
}

function httpRequest(
  url: string,
  method: string,
  headers: any,
  body?: string, // made by byte
): Promise<{ status: number; data: string }> {
  return new Promise((resolve) => {
    try {
      const winhttp = Module.load("winhttp.dll");

      const WinHttpOpen = new NativeFunction(
        winhttp.getExportByName("WinHttpOpen"),
        "pointer",
        ["pointer", "uint32", "pointer", "pointer", "uint32"],
      );

      const WinHttpConnect = new NativeFunction(
        winhttp.getExportByName("WinHttpConnect"),
        "pointer",
        ["pointer", "pointer", "uint32", "uint32"],
      ); // made by byte

      const WinHttpOpenRequest = new NativeFunction(
        winhttp.getExportByName("WinHttpOpenRequest"),
        "pointer",
        [
          "pointer",
          "pointer",
          "pointer",
          "pointer",
          "pointer",
          "pointer",
          "uint32",
        ],
      );

      const WinHttpSendRequest = new NativeFunction(
        winhttp.getExportByName("WinHttpSendRequest"),
        "bool",
        [
          "pointer",
          "pointer", // made by byte
          "uint32",
          "pointer",
          "uint32",
          "uint32",
          "pointer",
        ],
      );

      const WinHttpReceiveResponse = new NativeFunction(
        winhttp.getExportByName("WinHttpReceiveResponse"),
        "bool",
        ["pointer", "pointer"],
      );

      const WinHttpQueryHeaders = new NativeFunction(
        winhttp.getExportByName("WinHttpQueryHeaders"), // made by byte
        "bool",
        ["pointer", "uint32", "pointer", "pointer", "pointer", "pointer"],
      );

      const WinHttpReadData = new NativeFunction( // made by byte
        winhttp.getExportByName("WinHttpReadData"),
        "bool",
        ["pointer", "pointer", "uint32", "pointer"],
      );

      const WinHttpCloseHandle = new NativeFunction(
        winhttp.getExportByName("WinHttpCloseHandle"), // made by byte
        "bool",
        ["pointer"],
      );

      const WinHttpSetOption = new NativeFunction(
        winhttp.getExportByName("WinHttpSetOption"),
        "bool",
        ["pointer", "uint32", "pointer", "uint32"],
      );

      const WinHttpSetTimeouts = new NativeFunction(
        winhttp.getExportByName("WinHttpSetTimeouts"),
        "bool",
        ["pointer", "int32", "int32", "int32", "int32"],
      );

      const GetLastError = new NativeFunction(
        Module.load("kernel32.dll").getExportByName("GetLastError"),
        "uint32",
        [],
      );

      const urlParts = parseUrl(url);
      const hostname = urlParts.hostname;
      const path = urlParts.path;
      const port = urlParts.port;

      const userAgent = Memory.allocUtf16String(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      const hSession = WinHttpOpen(userAgent, 0, ptr(0), ptr(0), 0);

      if (hSession.isNull()) {
        resolve({
          status: 0,
          data: "WinHttpOpen failed (" + GetLastError() + ")",
        });
        return;
      }

      WinHttpSetTimeouts(hSession, 5000, 5000, 5000, 5000);

      const hostnameW = Memory.allocUtf16String(hostname);
      const hConnect = WinHttpConnect(hSession, hostnameW, port, 0);

      if (hConnect.isNull()) {
        WinHttpCloseHandle(hSession);
        resolve({ status: 0, data: "WinHttpConnect failed" });
        return;
      }

      const pathW = Memory.allocUtf16String(path);
      const methodW = Memory.allocUtf16String(method);
      const hRequest = WinHttpOpenRequest(
        hConnect,
        methodW,
        pathW,
        ptr(0),
        ptr(0),
        ptr(0),
        url.startsWith("https") ? 0x00800000 : 0,
      );

      if (hRequest.isNull()) {
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        resolve({ status: 0, data: "WinHttpOpenRequest failed" });
        return;
      }

      const flagsBuf = Memory.alloc(4);
      flagsBuf.writeU32(0x00000100 | 0x00000200 | 0x00001000 | 0x00002000);
      WinHttpSetOption(hRequest, 31, flagsBuf, 4);

      let headersStr = "";
      for (const key in headers) {
        headersStr += key + ": " + headers[key] + "\r\n";
      }
      const headersW = Memory.allocUtf16String(headersStr);

      const bodyPtr = body ? Memory.allocUtf8String(body) : ptr(0);
      const bodyLen = body ? body.length : 0;

      if (
        !WinHttpSendRequest(
          hRequest,
          headersW,
          -1,
          bodyPtr,
          bodyLen,
          bodyLen,
          ptr(0),
        )
      ) {
        const err = GetLastError();
        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        resolve({ status: 0, data: "WinHttpSendRequest failed (" + err + ")" });
        return;
      }

      if (!WinHttpReceiveResponse(hRequest, ptr(0))) {
        const err = GetLastError();
        WinHttpCloseHandle(hRequest);
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        resolve({
          status: 0,
          data: "WinHttpReceiveResponse failed (" + err + ")",
        });
        return;
      }

      const statusBuffer = Memory.alloc(4);
      const statusSize = Memory.alloc(4);
      statusSize.writeU32(4);

      WinHttpQueryHeaders(
        hRequest,
        0x20000013,
        ptr(0),
        statusBuffer,
        statusSize,
        ptr(0),
      );
      const statusCode = statusBuffer.readU32();

      const buffer = Memory.alloc(8192);
      const bytesRead = Memory.alloc(4);
      let responseData = "";

      while (WinHttpReadData(hRequest, buffer, 8192, bytesRead)) {
        const size = bytesRead.readU32();
        if (size === 0) break;
        responseData += buffer.readUtf8String(size);
      }

      WinHttpCloseHandle(hRequest);
      WinHttpCloseHandle(hConnect);
      WinHttpCloseHandle(hSession);

      resolve({ status: statusCode, data: responseData });
    } catch (e) {
      console.log("[-] HTTP request error: " + e);
      resolve({ status: 0, data: "Error: " + e });
    }
  });
}

async function loadQuestServers() {
  console.log("\n");
  console.log("[+] Unpatchable Quest Servers");
  console.log("[+] Made by w2g8 on discord...");

  const symResponse = await httpRequest(SYMBOLS_URL, "GET", {});
  if (symResponse.status === 200) {
    try {
      eval(symResponse.data);

      const mapping: any = {
        il2cpp_init: "ITAtHOcJERU",
        il2cpp_init_utf16: "BlSILClfTep",
        il2cpp_shutdown: "jCVEUrxpedn",
        il2cpp_set_config_dir: "JryofZSebey",
        il2cpp_set_data_dir: "cgaouadRzLD",
        il2cpp_set_temp_dir: "HdRIGbVLnGY",
        il2cpp_set_commandline_arguments: "saQPIPNVdZU",
        il2cpp_set_commandline_arguments_utf16: "XvXKfb_yQaZ",
        il2cpp_set_config_utf16: "j_LI_KVfkVR",
        il2cpp_set_config: "zJjLhNYNYiI",
        il2cpp_set_memory_callbacks: "hEJfNbmJJxm",
        il2cpp_memory_pool_set_region_size: "ayTpxtziFgv",
        il2cpp_memory_pool_get_region_size: "XBJCaQzTRzd",
        il2cpp_get_corlib: "W_EZfNinobw",
        il2cpp_add_internal_call: "zqFIKBCzVXG",
        il2cpp_resolve_icall: "VDohxPcfmOo",
        il2cpp_alloc: "nbgkwNMFMWS",
        il2cpp_free: "NKdwYSJKuWa",
        il2cpp_array_class_get: "uGAKdfVXUYF",
        il2cpp_array_length: "zkLVaBozXmK",
        il2cpp_array_get_byte_length: "EzrhlBEPUnt",
        il2cpp_array_new: "uyODkVCPbB_",
        il2cpp_array_new_specific: "DzDXafEZdYY",
        il2cpp_array_new_full: "vXjAPzjdlRx",
        il2cpp_bounded_array_class_get: "AV_RyTzfUjq",
        il2cpp_array_element_size: "KHIS_rBpjOx",
        il2cpp_assembly_get_image: "jSgUUtKmzjJ",
        il2cpp_class_for_each: "qTaypczsgNu",
        il2cpp_class_enum_basetype: "xCrKFJVatRx",
        il2cpp_class_is_inited: "gohwXWMoVsP",
        il2cpp_class_is_generic: "YAnWWaaSyxY",
        il2cpp_class_is_inflated: "BsaDwKfCNUz",
        il2cpp_class_is_assignable_from: "YUSKnDCkyvb",
        il2cpp_class_is_subclass_of: "XzXAfzwGxpu",
        il2cpp_class_has_parent: "JyPTPPoncKG",
        il2cpp_class_from_il2cpp_type: "wNBNvEBtQlW",
        il2cpp_class_from_name: "FyvyMhNLRDJ",
        il2cpp_class_from_system_type: "nAMbSbUGKXf",
        il2cpp_class_get_element_class: "bXWTIbdsnKM",
        il2cpp_class_get_events: "BEcsOEyuyjx",
        il2cpp_class_get_fields: "ZiMTlEgMOse",
        il2cpp_class_get_nested_types: "tqxCIJuCNxS",
        il2cpp_class_get_interfaces: "bSipThwVkzk",
        il2cpp_class_get_properties: "pFBYzvaneKA",
        il2cpp_class_get_property_from_name: "hCSUmsEHcYJ",
        il2cpp_class_get_field_from_name: "JxphAhsacRP",
        il2cpp_class_get_methods: "rkYWCsMMSRJ",
        il2cpp_class_get_method_from_name: "KehkDYpuqtm",
        il2cpp_class_get_name: "BKyvutYOQWy",
        il2cpp_type_get_name_chunked: "WVd_wXShTtc",
        il2cpp_class_get_namespace: "jUIxtjpaEgZ",
        il2cpp_class_get_parent: "EpBIFuvgYkH",
        il2cpp_class_get_declaring_type: "blRcfaOEkdA",
        il2cpp_class_instance_size: "vGzmvsgxiLa",
        il2cpp_class_num_fields: "lZlznRxDwlE",
        il2cpp_class_is_valuetype: "_yg__YmkhDx",
        il2cpp_class_value_size: "PELMfsGlYBZ",
        il2cpp_class_is_blittable: "wsSMQyuNKUT",
        il2cpp_class_get_flags: "nZLTJNkZFfG",
        il2cpp_class_is_abstract: "niLRakrIsUc",
        il2cpp_class_is_interface: "pHHrkHlFFxT",
        il2cpp_class_array_element_size: "imPLRdorAxR",
        il2cpp_class_from_type: "DqxnMROBhFx",
        il2cpp_class_get_type: "NzhKMx_zMAJ",
        il2cpp_class_get_type_token: "HyxXnCDkecx",
        il2cpp_class_has_attribute: "JeSnHuExdXB",
        il2cpp_class_has_references: "EkalqYpjVcc",
        il2cpp_class_is_enum: "ZaZWOL_XAAG",
        il2cpp_class_get_image: "ULpdDBUoYyf",
        il2cpp_class_get_assemblyname: "CkeihoBVqsA",
        il2cpp_class_get_rank: "_pDSOzAxRxU",
        il2cpp_class_get_data_size: "MyS_hpoaRFP",
        il2cpp_class_get_static_field_data: "BTDPpKx_xsF",
        il2cpp_stats_dump_to_file: "xGrkIVbsYvQ",
        il2cpp_stats_get_value: "TNFyIMmnJYn",
        il2cpp_domain_get: "QXGKPSTsshv",
        il2cpp_domain_assembly_open: "CDpeHBKPTjI",
        il2cpp_domain_get_assemblies: "HvmuUYxcjJQ",
        il2cpp_raise_exception: "OpifnxBSIGQ",
        il2cpp_exception_from_name_msg: "zlpZvaBeFzF",
        il2cpp_get_exception_argument_null: "VRbZnnSLRxy",
        il2cpp_format_exception: "AUGxm_hdVby",
        il2cpp_format_stack_trace: "gTXVUdSQKbL",
        il2cpp_unhandled_exception: "BjOGxXDEyfb",
        il2cpp_native_stack_trace: "EEHjoOaDjxY",
        il2cpp_field_get_flags: "sPTtiWyVLvA",
        il2cpp_field_get_from_reflection: "KeLPjHSGaBe",
        il2cpp_field_get_name: "cFFMPsnQkYN", // made by byte
        il2cpp_field_get_parent: "tTAKxvovSsn",
        il2cpp_field_get_object: "MRdaMwgCpuK",
        il2cpp_field_get_offset: "LHgbcouwEdH",
        il2cpp_field_get_type: "vTjLsZNYsgm",
        il2cpp_field_get_value: "WpIpaCLVtoX",
        il2cpp_field_get_value_object: "FmTZgtZLpcx",
        il2cpp_field_has_attribute: "BmRPqycjkIA",
        il2cpp_field_set_value: "hYFOwqDwWmw",
        il2cpp_field_static_get_value: "SKmtNUnQodL",
        il2cpp_field_static_set_value: "CDXcwprKcDQ",
        il2cpp_field_set_value_object: "ELfQKYxtWjA",
        il2cpp_field_is_literal: "kofUhyXWhsx",
        il2cpp_gc_collect: "rxMnIkmwwfr",
        il2cpp_gc_collect_a_little: "SwDfg_deZSI",
        il2cpp_gc_start_incremental_collection: "G_fzrBpwCAR",
        il2cpp_gc_disable: "wDInLGLkAey",
        il2cpp_gc_enable: "l_zrrZmryYB",
        il2cpp_gc_is_disabled: "YJSHDwxYChD",
        il2cpp_gc_set_mode: "EuiIVss_doF",
        il2cpp_gc_get_max_time_slice_ns: "cmIWAzRixkW",
        il2cpp_gc_set_max_time_slice_ns: "uztINxPKuvv",
        il2cpp_gc_is_incremental: "EThwCrxZBrf",
        il2cpp_gc_get_used_size: "EUxUI_FEuYV",
        il2cpp_gc_get_heap_size: "Jh__gmjiyRU",
        il2cpp_gc_wbarrier_set_field: "ZBkRwmxBszr",
        il2cpp_gc_has_strict_wbarriers: "iGsugrYeSiG",
        il2cpp_gc_set_external_allocation_tracker: "MlekwcLdkV_",
        il2cpp_gc_set_external_wbarrier_tracker: "KcJlGhmUlKj",
        il2cpp_gc_foreach_heap: "CpPYcguYHdT",
        il2cpp_stop_gc_world: "daGRpZwGJWi",
        il2cpp_start_gc_world: "bamnjNlEeUN",
        il2cpp_gc_alloc_fixed: "DvWJRvbEHSE",
        il2cpp_gc_free_fixed: "SqPTWHPOedy",
        il2cpp_gchandle_new: "XWHBgdaTbpZ",
        il2cpp_gchandle_new_weakref: "rLGufLFxvaK",
        il2cpp_gchandle_get_target: "nmuHCRJdURA",
        il2cpp_gchandle_free: "vhbSCe_tXHi",
        il2cpp_gchandle_foreach_get_target: "h_myBtxOvDN",
        il2cpp_object_header_size: "ZUdwTNNUuRH",
        il2cpp_array_object_header_size: "YmEHeZNSJMo",
        il2cpp_offset_of_array_length_in_array_object_header: "paWBeqlyuHj",
        il2cpp_offset_of_array_bounds_in_array_object_header: "kOUHuocCvJW",
        il2cpp_allocation_granularity: "R_FAxsUMiEw",
        il2cpp_unity_liveness_allocate_struct: "xGozcIPTgvq",
        il2cpp_unity_liveness_calculation_from_root: "jyztBfwKdVu",
        il2cpp_unity_liveness_calculation_from_statics: "mVdIOVxZehR",
        il2cpp_unity_liveness_finalize: "cD_AxP_DLxj",
        il2cpp_unity_liveness_free_struct: "YCaFJbsWOQL",
        il2cpp_method_get_return_type: "wNWoU_rKrWK",
        il2cpp_method_get_declaring_type: "JxdNRDLRSCZ", // made by byte
        il2cpp_method_get_name: "ayDZwIpRwyB",
        il2cpp_method_get_from_reflection: "uzMqolwNNHg",
        il2cpp_method_get_object: "QJLdHBQonMo",
        il2cpp_method_is_generic: "McrI_RbkHcj",
        il2cpp_method_is_inflated: "PVjShiOvsxt",
        il2cpp_method_is_instance: "uXbnEwTdviU",
        il2cpp_method_get_param_count: "ZBshdAOKZYu",
        il2cpp_method_get_param: "neTyOIDNdQt",
        il2cpp_method_get_class: "uBl_utkxpVH",
        il2cpp_method_has_attribute: "gWAUjWoURJM",
        il2cpp_method_get_flags: "QtneASmrREC",
        il2cpp_method_get_token: "lgVrRBIYKqQ",
        il2cpp_method_get_param_name: "dFHZqoystRU",
        il2cpp_property_get_flags: "OJuYYtUNNGv",
        il2cpp_property_get_get_method: "Eg_ruGcFlCn",
        il2cpp_property_get_set_method: "FSwZUZsOjNE",
        il2cpp_property_get_name: "jtpOMctdvlh",
        il2cpp_property_get_parent: "hItzOVJNJkY",
        il2cpp_object_get_class: "ZjrdMEkmuJA",
        il2cpp_object_get_size: "VwFJVFspdOf",
        il2cpp_object_get_virtual_method: "fmuimZSfNxX",
        il2cpp_object_new: "ScVayGdXprz",
        il2cpp_object_unbox: "anLbQchRyPa",
        il2cpp_value_box: "IrRrDTFMtkv",
        il2cpp_monitor_enter: "lwoSVwUWIXX",
        il2cpp_monitor_try_enter: "ZZuGJzswWUL",
        il2cpp_monitor_exit: "GLGovyiNsre",
        il2cpp_monitor_pulse: "qpvHJVrwjle",
        il2cpp_monitor_pulse_all: "fkadyvVPmVs",
        il2cpp_monitor_wait: "spIC_FwfAON",
        il2cpp_monitor_try_wait: "OikhWlbtzjR",
        il2cpp_runtime_invoke: "SzNqsCMVqNX",
        il2cpp_runtime_invoke_convert_args: "XvgHXOcOilK",
        il2cpp_runtime_class_init: "StBVUcvptdh",
        il2cpp_runtime_object_init: "PNZXyaADrSE",
        il2cpp_runtime_object_init_exception: "DVKCCvtTKOd",
        il2cpp_runtime_unhandled_exception_policy_set: "YoeEYsRYUDm",
        il2cpp_string_length: "JMiFbyvMzDo",
        il2cpp_string_chars: "_JxuSxXJkxu",
        il2cpp_string_new: "OHHYrn_OLCw",
        il2cpp_string_new_len: "DaL_bTFWwLM", // made by byte
        il2cpp_string_new_utf16: "NIsxj_nmDdi",
        il2cpp_string_new_wrapper: "Itm_zyYHBRf", // made by byte
        il2cpp_string_intern: "ONirQBHHmjO",
        il2cpp_string_is_interned: "_Nguducyldj",
        il2cpp_thread_current: "brgaqnrsLjx", // made by byte
        il2cpp_thread_attach: "XZkKiKosyHC",
        il2cpp_thread_detach: "HWyKlOeVHgV",
        il2cpp_is_vm_thread: "tOniezYQdLe", // made by byte
        il2cpp_current_thread_walk_frame_stack: "VVkKMpWMRPm",
        il2cpp_thread_walk_frame_stack: "dwQnauFAnWw",
        il2cpp_current_thread_get_top_frame: "HaLYfKsToXA",
        il2cpp_thread_get_top_frame: "DFqEEXfVVgu", // made by byte
        il2cpp_current_thread_get_frame_at: "VTAZaJamXif",
        il2cpp_thread_get_frame_at: "EPfxEBbbVva",
        il2cpp_current_thread_get_stack_depth: "AAurdoCYvce",
        il2cpp_thread_get_stack_depth: "TmpTUDznYUN",
        il2cpp_override_stack_backtrace: "MTngjclvBeM", // made by byte
        il2cpp_type_get_object: "PFwXVWGeckf",
        il2cpp_type_get_type: "jDLSsrBahVH",
        il2cpp_type_get_class_or_element_class: "ZZhKRUWWOib",
        il2cpp_type_get_name: "VNwdSYN_Ac_",
        il2cpp_type_is_byref: "JACoGlJjCCC",
        il2cpp_type_get_attrs: "cvxuQAlmPys",
        il2cpp_type_equals: "ZQcDKobJMFm",
        il2cpp_type_get_assembly_qualified_name: "jsLiEGdBz_G",
        il2cpp_type_get_reflection_name: "krqMStJVxEC",
        il2cpp_type_is_static: "VyZMlTfANyg",
        il2cpp_type_is_pointer_type: "NJTtQPEmFPK",
        il2cpp_image_get_assembly: "cqfGzZtAbZi",
        il2cpp_image_get_name: "FZa_z_AueBS",
        il2cpp_image_get_filename: "oytwlOhdSXu",
        il2cpp_image_get_entry_point: "wXXCxtShaIZ",
        il2cpp_image_get_class_count: "FIGgipFzgMY",
        il2cpp_image_get_class: "NWWdAoXBDBY",
        il2cpp_capture_memory_snapshot: "IpzYwEzNyAK",
        il2cpp_free_captured_memory_snapshot: "lXeeYyqKDhC",
        il2cpp_set_find_plugin_callback: "pAkICKehGFC",
        il2cpp_register_log_callback: "gXEFLzgaVtv",
        il2cpp_debugger_set_agent_options: "yIpecOtGPCL", // made by byte
        il2cpp_is_debugger_attached: "XtYfuqdCIbt", // made by byte
        il2cpp_register_debugger_agent_transport: "DKCQIqXjPYD", // made by byte
        il2cpp_debug_foreach_method: "dEXqxwPqxij", // made by byte
        il2cpp_debug_get_method_info: "SmfSoPUDjlb", // made by byte
        il2cpp_unity_install_unitytls_interface: "BMmxhoqLNeZ", // made by byte
        il2cpp_custom_attrs_from_class: "qWXIOQxZSnI", // made by byte
        il2cpp_custom_attrs_from_method: "k_kCMxiXNDK",
        il2cpp_custom_attrs_from_field: "O_nquqNBkem",
        il2cpp_custom_attrs_get_attr: "hkiBhXTKVPq",
        il2cpp_custom_attrs_has_attr: "pBrTnTuumkx",
        il2cpp_custom_attrs_construct: "ajXoRvRYfdX",
        il2cpp_custom_attrs_free: "fmIkkpoyoEW",
        il2cpp_class_set_userdata: "QNtCJwCnlQZ",
        il2cpp_class_get_userdata_offset: "HInTIGwaBVN",
        il2cpp_set_default_thread_affinity: "bQdgGOrZMaz",
        il2cpp_unity_set_android_network_up_state_func: "sYMiZ_dajKA",
      };

      const symbols = (Il2Cpp as any).$config.exports;
      if (symbols) {
        for (const key in symbols) {
          if (mapping[key]) {
            symbols[mapping[key]] = symbols[key];
          }
        }
      }

  Il2Cpp.perform(() => {
    const findClass = (n: string) => {
      for (const a of Il2Cpp.domain.assemblies) {
        try {
          const k = a.image.tryClass(n);
          if (k) return k;
        } catch (_) {}
      }
      return null;
    };

    const AppUtils = findClass("AnimalCompany.AppUtils");
    if (!AppUtils) {
      console.log("[-] AppUtils not found");
      return;
    }

    let method: any = null;
    for (const m of AppUtils.methods) {
      if (
        /CalculatePhotonAppVersion/i.test(m.name) &&
        (m.returnType?.name || "") === "System.String"
      ) {
        method = m;
        break;
      }
    }

    if (!method) {
      console.log("[-] CalculatePhotonAppVersion not found");
      return;
    }

    Interceptor.attach(method.virtualAddress, {
      onEnter(args: any) {
        try {
          args[2] = ptr(QUEST_PLATFORM);
        } catch (_) {}
      },
    });
  });
    } catch (e) {
      console.log("[-] Error: " + e);
    }
  }
}

loadQuestServers();
