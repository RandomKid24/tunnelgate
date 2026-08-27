#include "rdp_session.h"
#include <freerdp/settings.h>
#ifdef _WIN32
#include <timeapi.h>
#pragma comment(lib, "winmm.lib")
#endif
#include <freerdp/version.h>
#include <freerdp/gdi/gdi.h>
#include <freerdp/input.h>
#include <freerdp/crypto/certificate.h>
#include <winpr/wlog.h>
#include <winpr/sspi.h>
#include <thread>
#include <chrono>
#include <mutex>
static std::mutex s_logMutex;

static void fileLog(const char* msg) {
#ifdef _WIN32
  std::lock_guard<std::mutex> lock(s_logMutex);
  const char* appData = getenv("APPDATA");
  std::string logPath = "addon-debug.log";
  if (appData) {
    logPath = std::string(appData) + "\\tunnelgate\\addon-debug.log";
  }
  FILE* f = fopen(logPath.c_str(), "a");
  if (f) {
    fprintf(f, "%s\n", msg);
    fclose(f);
  }
#endif
  fprintf(stderr, "%s\n", msg);
  fflush(stderr);
}

// FreeRDP 2.x passes the certificate Common Name (the server's computer name)
// directly to the verify callbacks. Capture it so serverName detection works on
// Linux builds that link against system freerdp2 (Ubuntu/Debian stable).
struct RdpSessionContext {
  rdpContext _ctx;
  RdpSession* session;
};

static void captureServerNameFromCommonName(freerdp* instance, const char* common_name) {
  if (!common_name || !common_name[0]) return;
  RdpSession* self = ((RdpSessionContext*)instance->context)->session;
  if (self) {
    self->setServerName(common_name);
    fileLog((std::string("[RDP] verifyCertificateCallback: detected server name '") + common_name + "'").c_str());
  }
}

static DWORD verifyCertificateCallback(freerdp* instance, const char* common_name,
                                       const char* subject, const char* issuer,
                                       const char* fingerprint, BOOL host_mismatch) {
  const char* host = freerdp_settings_get_string(instance->context->settings, FreeRDP_ServerHostname);
  captureServerNameFromCommonName(instance, common_name);
  fileLog((std::string("[RDP] verifyCertificateCallback: Accepting cert for ") + (host ? host : "tunnel host")).c_str());
  return 1; // Trust certificate over tunnel
}

static DWORD verifyChangedCertificateCallback(freerdp* instance, const char* common_name,
                                              const char* subject, const char* issuer,
                                              const char* fingerprint, const char* old_subject,
                                              const char* old_issuer, const char* old_fingerprint) {
  const char* host = freerdp_settings_get_string(instance->context->settings, FreeRDP_ServerHostname);
  captureServerNameFromCommonName(instance, common_name);
  fileLog((std::string("[RDP] verifyChangedCertificateCallback: Accepting changed cert for ") + (host ? host : "tunnel host")).c_str());
  return 1; // Trust changed certificate over tunnel
}

// Extract the server's computer name from the Common Name of the leaf
// certificate in the presented PEM chain. Windows sets this to the machine's
// NetBIOS name / FQDN (e.g. "DESKTOP-ABC123"), which is the real server name.
#if defined(FREERDP_VERSION_MAJOR) && FREERDP_VERSION_MAJOR >= 3
int RdpSession::verifyX509Certificate(freerdp* instance, const BYTE* data, size_t length,
                                      const char* hostname, UINT16 port, DWORD flags) {
  fileLog((std::string("[RDP] verifyX509Certificate: server presented cert chain (") +
           std::to_string(length) + " bytes)").c_str());

  std::string pem((const char*)data, length);
  std::string commonName;

  // Walk every PEM block and use the first one we can parse (the leaf cert).
  size_t pos = 0;
  while (pos < pem.size()) {
    size_t begin = pem.find("-----BEGIN CERTIFICATE-----", pos);
    if (begin == std::string::npos) break;
    size_t end = pem.find("-----END CERTIFICATE-----", begin);
    if (end == std::string::npos) break;
    end += strlen("-----END CERTIFICATE-----");

    std::string block = pem.substr(begin, end - begin);
    rdpCertificate* cert = freerdp_certificate_new_from_pem(block.c_str());
    if (cert) {
      size_t nameLen = 0;
      char* cn = freerdp_certificate_get_common_name(cert, &nameLen);
      if (cn && nameLen > 0) {
        commonName.assign(cn, nameLen);
        free(cn);
      }
      freerdp_certificate_free(cert);
      if (!commonName.empty()) break;
    }
    pos = end;
  }

  if (!commonName.empty()) {
    RdpSession* self = getSelf(instance->context);
    if (self) {
      self->setServerName(commonName);
      fileLog((std::string("[RDP] verifyX509Certificate: detected server name '") + commonName + "'").c_str());
    }
  } else {
    fileLog("[RDP] verifyX509Certificate: no common name found in server certificate");
  }

  // Accept the certificate for this session only (connection goes over loopback tunnel).
  return 2;
}
#endif

RdpSession::RdpSession(const std::string& host, int port,
                       int width, int height,
                       const std::string& username,
                       const std::string& password,
                       RdpFrameListener* listener,
                       const std::string& serverHostname)
  : host_(host), port_(port), width_(width), height_(height),
    username_(username), password_(password), listener_(listener),
    serverHostname_(serverHostname.empty() ? host : serverHostname) {}

RdpSession::~RdpSession() {
  disconnect();
}

BOOL RdpSession::postConnectCallback(freerdp* instance) {
  fileLog("[RDP] postConnectCallback entered");
  RdpSession* self = getSelf(instance->context);
  if (!self) {
    fileLog("[RDP] postConnectCallback: self is null!");
    return FALSE;
  }

  fileLog(("[RDP] postConnect called, gdi pointer: " + std::to_string((uintptr_t)instance->context->gdi)).c_str());

  fileLog("[RDP] calling gdi_init...");
  BOOL gdiInitResult = gdi_init(instance, PIXEL_FORMAT_BGRX32);
  fileLog(("[RDP] gdi_init result: " + std::to_string(gdiInitResult)).c_str());

  if (gdiInitResult != TRUE) {
    self->lastError_ = "gdi_init failed in PostConnect";
    if (self->listener_) self->listener_->onError(self->lastError_.c_str());
    return FALSE;
  }

  fileLog(("[RDP] gdi_init OK, primary_buffer pointer: " + std::to_string((uintptr_t)instance->context->gdi->primary_buffer)).c_str());

  fileLog(("[RDP] registering callbacks via context_->update: " + std::to_string((uintptr_t)self->context_->update)).c_str());
  self->context_->update->BeginPaint = beginPaint;
  self->context_->update->EndPaint = endPaint;
  self->context_->update->DesktopResize = desktopResize;
  fileLog(("[RDP] callbacks set: EndPaint=" + std::to_string((uintptr_t)self->context_->update->EndPaint) + ", DesktopResize=" + std::to_string((uintptr_t)self->context_->update->DesktopResize)).c_str());

  // Emit server name from tunnel config (serverHostname_), not from cert CN.
  // The cert callback is disabled; IgnoreCertificate=TRUE handles TLS.
  if (!self->serverHostname_.empty() && self->listener_) {
    self->listener_->onServerName(self->serverHostname_.c_str());
  }

  fileLog("[RDP] postConnectCallback exiting with TRUE");
  return TRUE;
}

// Plain helper with NO C++ objects on its stack frame.
// MSVC C2712: __try/__except cannot appear in a function that has C++ objects
// requiring unwinding (std::string, std::vector, etc.).  By isolating freerdp_connect
// here, we satisfy the compiler and can safely catch the SEH 0xC0000005 access
// violation that FreeRDP's licensing/RC4 path can raise.
// Returns:  TRUE  - connected OK
//           FALSE - freerdp_connect returned FALSE (normal error)
//           -1    - SEH exception was caught
static int rdp_connect_seh(freerdp* instance) {
#ifdef _WIN32
  __try {
    return (int)freerdp_connect(instance);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    return -1;
  }
#else
  return (int)freerdp_connect(instance);
#endif
}

static void rdp_free_safe(freerdp* instance) {
  if (!instance) return;
#ifdef _WIN32
  __try {
    if (instance->context) {
      freerdp_context_free(instance);
    }
    freerdp_free(instance);
  } __except (EXCEPTION_EXECUTE_HANDLER) {
    fileLog("[RDP] SEH caught during freerdp_context_free/freerdp_free");
  }
#else
  if (instance->context) {
    freerdp_context_free(instance);
  }
  freerdp_free(instance);
#endif
}

bool RdpSession::connect() {
  sspi_GlobalInit();
  instance_ = freerdp_new();
  if (!instance_) {
    lastError_ = "freerdp_new failed";
    if (listener_) listener_->onError(lastError_.c_str());
    return false;
  }

  instance_->ContextSize = sizeof(RdpSessionContext);
  instance_->ContextNew = nullptr;
  instance_->ContextFree = nullptr;

  if (freerdp_context_new(instance_) != TRUE) {
    lastError_ = "freerdp_context_new failed";
    if (listener_) listener_->onError(lastError_.c_str());
    freerdp_free(instance_);
    instance_ = nullptr;
    return false;
  }
  context_ = instance_->context;
  ((RdpSessionContext*)context_)->session = this;

  rdpSettings* settings = context_->settings;
  freerdp_settings_set_string(settings, FreeRDP_ServerHostname, host_.c_str());
  // UserSpecifiedServerName is set to the REAL hostname (not 127.0.0.1) so that
  // FreeRDP's NLA/SSPI can generate a valid SPN for authentication. ServerHostname
  // stays as 127.0.0.1 so the TCP connection goes through the cloudflared tunnel.
  // FreeRDP 3.x uses UserSpecifiedServerName ONLY for SPN/title, not for TCP resolution
  // when ServerHostname is explicitly set.
#if defined(FREERDP_VERSION_MAJOR) && FREERDP_VERSION_MAJOR >= 3
  freerdp_settings_set_string(settings, FreeRDP_UserSpecifiedServerName, serverHostname_.c_str());
#else
  freerdp_settings_set_string(settings, FreeRDP_ServerHostname, host_.c_str());
#endif
  freerdp_settings_set_uint32(settings, FreeRDP_ServerPort, port_);
  freerdp_settings_set_uint32(settings, FreeRDP_DesktopWidth, width_);
  freerdp_settings_set_uint32(settings, FreeRDP_DesktopHeight, height_);
  freerdp_settings_set_uint32(settings, FreeRDP_ColorDepth, 32);

  if (username_.empty()) {
    fileLog("[RDP] ERROR: no username provided, cannot authenticate");
    lastError_ = "No username provided for RDP authentication";
    if (listener_) listener_->onError(lastError_.c_str());
    freerdp_context_free(instance_);
    freerdp_free(instance_);
    instance_ = nullptr;
    context_ = nullptr;
    return false;
  }

  std::string normUsername = username_;
  for (char& c : normUsername) {
    if (c == '/') {
      c = '\\';
    }
  }

  freerdp_settings_set_string(settings, FreeRDP_Username, normUsername.c_str());
  freerdp_settings_set_string(settings, FreeRDP_Password, password_.c_str());

  {
    char* parsedUser = nullptr;
    char* parsedDomain = nullptr;
    if (freerdp_parse_username(normUsername.c_str(), &parsedUser, &parsedDomain)) {
      if (parsedUser) {
        freerdp_settings_set_string(settings, FreeRDP_Username, parsedUser);
      }
      if (parsedDomain && strlen(parsedDomain) > 0) {
        // An explicit domain was typed (e.g. "CORP\user" or ".\user" for a
        // deliberate local-account override) — honor it exactly as given.
        freerdp_settings_set_string(settings, FreeRDP_Domain, parsedDomain);
      } else {
        // No domain prefix given (e.g. just "Administrator"). Leave the NTLM
        // domain blank rather than forcing "." (local-machine-only auth):
        // this field has flip-flopped between "" and "." across the project's
        // history because a single hardcoded value can't be right for both a
        // workgroup/local-account server and a domain-joined one — forcing "."
        // causes STATUS_LOGON_FAILURE against domain-joined servers even
        // though the same credential authenticates fine via mstsc.exe, which
        // also leaves the domain unspecified in this case. Anyone who
        // genuinely needs local-account-only auth can still force it
        // explicitly by typing ".\username" in the Windows Username field —
        // that's parsed as an explicit domain above and passed through as-is.
        freerdp_settings_set_string(settings, FreeRDP_Domain, "");
      }
      fileLog((std::string("[RDP] parsed domain='") + (freerdp_settings_get_string(settings, FreeRDP_Domain) ? freerdp_settings_get_string(settings, FreeRDP_Domain) : "") + "' user='" + (parsedUser ? parsedUser : "") + "' from username='" + normUsername + "'").c_str());
      free(parsedUser);
      free(parsedDomain);
    } else {
      freerdp_settings_set_string(settings, FreeRDP_Domain, "");
    }
    fileLog((std::string("[RDP] credentials: username='") + (freerdp_settings_get_string(settings, FreeRDP_Username) ? freerdp_settings_get_string(settings, FreeRDP_Username) : "") + "' domain='" + (freerdp_settings_get_string(settings, FreeRDP_Domain) ? freerdp_settings_get_string(settings, FreeRDP_Domain) : "") + "' password_len=" + std::to_string(password_.length())).c_str());
  }

  // Security: enable NLA + TLS + RDP on all platforms.
  // NLA was previously disabled on Windows to work around SSPI loopback blocks,
  // but sspi_GlobalInit() + WITH_NATIVE_SSPI=OFF fully resolves that.
  // NLA must be TRUE — server rejects with HYBRID_REQUIRED_BY_SERVER without it.
  freerdp_settings_set_bool(settings, FreeRDP_NegotiateSecurityLayer, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_TlsSecurity, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_RdpSecurity, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_NlaSecurity, TRUE);

  // Set TLS security level to 1 (instead of OpenSSL 3.x default of 2).
  // This allows connecting to servers with self-signed certificates or smaller key sizes (e.g. 1024-bit).
  freerdp_settings_set_uint32(settings, FreeRDP_TlsSecLevel, 1);

  // IgnoreCertificate: accept all certificates over the secure cloudflared tunnel.
  // ExternalCertificateManagement is intentionally NOT set — on some FreeRDP 3.x versions
  // the VerifyX509Certificate callback is not invoked in the ExternalCertificateManagement
  // path (verification_status stays at -1), causing ERRCONNECT_TLS_CONNECT_FAILED.
  // With IgnoreCertificate=TRUE alone, FreeRDP auto-accepts certificates without calling
  // the callback. Server name detection uses serverHostname_ from tunnel config instead.
  freerdp_settings_set_bool(settings, FreeRDP_IgnoreCertificate, TRUE);

#if defined(FREERDP_VERSION_MAJOR) && FREERDP_VERSION_MAJOR >= 3
  // Skip the RC4-based RDP license exchange entirely.
  // FreeRDP_ServerLicenseRequired = FALSE tells FreeRDP not to perform the license
  // handshake, so winpr_RC4_New is never called and the null-deref crash cannot fire.
  // FreeRDP 2.x uses a different licensing path and doesn't have this constant.
  freerdp_settings_set_bool(settings, FreeRDP_ServerLicenseRequired, FALSE);
#endif

  freerdp_settings_set_bool(settings, FreeRDP_Authentication, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_AutoLogonEnabled, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_DisableCredentialsDelegation, TRUE);

  freerdp_settings_set_bool(settings, FreeRDP_NSCodec, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_RemoteFxCodec, TRUE);
  freerdp_settings_set_bool(settings, FreeRDP_FastPathOutput, TRUE);

  // Disable GFX pipeline and H264 codecs to prevent crashes in GDI mode on Windows
  freerdp_settings_set_bool(settings, FreeRDP_GfxAVC444, FALSE);
  freerdp_settings_set_bool(settings, FreeRDP_GfxH264, FALSE);
  freerdp_settings_set_bool(settings, FreeRDP_SupportGraphicsPipeline, FALSE);

  // Detect and set display scaling factor
#ifdef _WIN32
  UINT32 dpi = 96;
  HMODULE hUser32 = GetModuleHandleA("user32.dll");
  if (hUser32) {
    typedef UINT(WINAPI* GetDpiForSystemFn)();
    GetDpiForSystemFn pGetDpiForSystem = (GetDpiForSystemFn)GetProcAddress(hUser32, "GetDpiForSystem");
    if (pGetDpiForSystem) {
      dpi = pGetDpiForSystem();
    }
  }
  UINT32 scale = (dpi * 100) / 96;
  UINT32 freerdpScale = 100;
  if (scale >= 160) freerdpScale = 180;
  else if (scale >= 120) freerdpScale = 140;
  
  freerdp_settings_set_uint32(settings, FreeRDP_DesktopScaleFactor, freerdpScale);
  freerdp_settings_set_uint32(settings, FreeRDP_DeviceScaleFactor, freerdpScale);
#endif

  // VerifyX509Certificate / VerifyCertificate callbacks are NOT set.
  // IgnoreCertificate=TRUE handles certificate acceptance without callbacks.
  // Server name is detected via serverHostname_ from tunnel config in postConnectCallback.
  instance_->PostConnect = postConnectCallback;

  WLog_SetLogLevel(WLog_Get("com.freerdp.core.tls"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_Get("com.freerdp.core.nego"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_Get("com.freerdp.core.transport"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_Get("com.freerdp.core.nla"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_Get("com.freerdp.core.credssp"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_Get("com.winpr.sspi"), WLOG_TRACE);
  WLog_SetLogLevel(WLog_GetRoot(), WLOG_TRACE);

  const char* actualHost = freerdp_settings_get_string(settings, FreeRDP_ServerHostname);
  UINT32 actualPort = freerdp_settings_get_uint32(settings, FreeRDP_ServerPort);
  fileLog((std::string("[RDP] AUTH_TUPLE: host='") + (actualHost ? actualHost : "null") +
           "', port=" + std::to_string(actualPort) +
           ", username='" + (freerdp_settings_get_string(settings, FreeRDP_Username) ? freerdp_settings_get_string(settings, FreeRDP_Username) : "null") +
           "', domain='" + (freerdp_settings_get_string(settings, FreeRDP_Domain) ? freerdp_settings_get_string(settings, FreeRDP_Domain) : "null") +
           "', password_len=" + std::to_string(password_.length()) +
           ", IgnoreCertificate=" + std::to_string(freerdp_settings_get_bool(settings, FreeRDP_IgnoreCertificate) ? 1 : 0) +
           ", NlaSecurity=" + std::to_string(freerdp_settings_get_bool(settings, FreeRDP_NlaSecurity) ? 1 : 0) +
           ", TlsSecurity=" + std::to_string(freerdp_settings_get_bool(settings, FreeRDP_TlsSecurity) ? 1 : 0)).c_str());

  fileLog("[RDP] RdpSession::connect: calling freerdp_connect");

  // rdp_connect_seh() is a plain C-linkage helper with no C++ objects on its stack.
  // This is required because MSVC (C2712) forbids __try/__except in any function that
  // has C++ objects that require unwinding (e.g. std::string, std::vector).  By moving
  // the freerdp_connect call into a separate frame we can safely catch the SEH
  // 0xC0000005 access violation that FreeRDP can raise during license negotiation.
  BOOL connectResult = rdp_connect_seh(instance_);

  fileLog(("[RDP] RdpSession::connect: freerdp_connect returned " + std::to_string(connectResult)).c_str());
  if (connectResult == -1) {
    // SEH exception was caught inside rdp_connect_seh
    char sehBuf[256];
    snprintf(sehBuf, sizeof(sehBuf),
             "freerdp_connect raised an access violation (SEH) [host='%s' port=%u]",
             actualHost ? actualHost : "null", actualPort);
    fileLog((std::string("[RDP] CAUGHT SEH: ") + sehBuf).c_str());
    lastError_ = sehBuf;
    if (listener_) listener_->onError(lastError_.c_str());
    rdp_free_safe(instance_);
    instance_ = nullptr;
    context_ = nullptr;
    return false;
  }
  if (connectResult != TRUE) {
    UINT32 lastError = freerdp_get_last_error(context_);
    lastErrorCode_ = lastError;
    const char* errorStr = freerdp_get_last_error_string(lastError);
    char buf[256];
    if (errorStr) {
      snprintf(buf, sizeof(buf), "freerdp_connect failed: code=%u (%s) [host='%s' port=%u]",
               lastError, errorStr,
               actualHost ? actualHost : "null", actualPort);
    } else {
      snprintf(buf, sizeof(buf), "freerdp_connect failed: code=%u [host='%s' port=%u]",
               lastError,
               actualHost ? actualHost : "null", actualPort);
    }
    lastError_ = buf;
    fileLog((std::string("[RDP] RdpSession::connect failed error: ") + lastError_).c_str());
    if (listener_) listener_->onError(lastError_.c_str());
    freerdp_context_free(instance_);
    freerdp_free(instance_);
    instance_ = nullptr;
    context_ = nullptr;
    return false;
  }

  fileLog("[RDP] RdpSession::connect: successful connection, starting pump thread");
  connected_ = true;
  running_ = true;
#ifdef _WIN32
  timeBeginPeriod(1);
#endif

  updateThread_ = new std::thread(&RdpSession::pump, this);
  fileLog("[RDP] RdpSession::connect exiting with true");

  return true;
}

void RdpSession::disconnect() {
  bool wasConnected = connected_;
  running_ = false;
  connected_ = false;

  if (updateThread_) {
    updateThread_->join();
    delete updateThread_;
    updateThread_ = nullptr;
  }

  if (instance_) {
    freerdp_disconnect(instance_);
    if (instance_->context)
      gdi_free(instance_);
    rdp_free_safe(instance_);
    instance_ = nullptr;
    context_ = nullptr;
  }

  if (wasConnected) {
#ifdef _WIN32
    timeEndPeriod(1);
#endif
  }
}

void RdpSession::pump() {
  int consecutiveFailures = 0;
  while (running_ && connected_) {
    HANDLE handles[64];
    DWORD ncount = freerdp_get_event_handles(context_, handles, 64);
    if (ncount == 0) {
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
      continue;
    }

#ifdef _WIN32
    WaitForMultipleObjects(ncount, handles, FALSE, 100);
#endif

    if (!freerdp_check_event_handles(context_)) {
#if defined(FREERDP_VERSION_MAJOR) && (FREERDP_VERSION_MAJOR >= 3)
      int shall = freerdp_shall_disconnect_context(context_);
#else
      int shall = freerdp_shall_disconnect(instance_);
#endif
      UINT32 err = freerdp_get_last_error(context_);

      if (shall) {
        if (listener_) listener_->onDisconnect("RDP server disconnected");
        connected_ = false;
        break;
      }

      consecutiveFailures++;
      if (consecutiveFailures > 50) {
        if (listener_) listener_->onDisconnect("RDP pump stalled");
        connected_ = false;
        break;
      }
    } else {
      consecutiveFailures = 0;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
}

void RdpSession::sendPointerEvent(int flags, int x, int y) {
  if (!connected_ || !context_) return;
  freerdp_input_send_mouse_event(context_->input, (UINT16)flags, (UINT16)x, (UINT16)y);
}

void RdpSession::sendKeyboardEvent(int flags, UINT16 code) {
  if (!connected_ || !context_) return;
  freerdp_input_send_keyboard_event(context_->input, (UINT16)flags, (UINT16)code);
}

void RdpSession::resize(int width, int height) {
  width_ = width;
  height_ = height;
}

RdpSession* RdpSession::getSelf(rdpContext* ctx) {
  return ((RdpSessionContext*)ctx)->session;
}

BOOL RdpSession::beginPaint(rdpContext* ctx) {
  return TRUE;
}

BOOL RdpSession::endPaint(rdpContext* ctx) {
  RdpSession* self = getSelf(ctx);
  if (!self || !self->listener_) {
    return TRUE;
  }

  rdpGdi* gdi = ctx->gdi;
  if (!gdi || !gdi->primary_buffer) {
    return TRUE;
  }

  // Guard the full pointer chain before any dereference.
  // In headless/addon mode, primary, hdc, hwnd, or invalid can be null
  // during connection negotiation or after a resolution change.
  if (!gdi->primary || !gdi->primary->hdc ||
      !gdi->primary->hdc->hwnd || !gdi->primary->hdc->hwnd->invalid) {
    return TRUE;
  }

  HGDI_WND wnd = gdi->primary->hdc->hwnd;

  if (wnd->invalid->null)
    return TRUE;

  INT32 x = wnd->invalid->x;
  INT32 y = wnd->invalid->y;
  INT32 w = wnd->invalid->w;
  INT32 h = wnd->invalid->h;

  // Clamp negative origins into the valid buffer region.
  // Malformed server updates can send negative x/y.
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }

  // Clamp extents against the actual GDI surface dimensions.
  if (x + w > (INT32)gdi->width)  w = (INT32)gdi->width  - x;
  if (y + h > (INT32)gdi->height) h = (INT32)gdi->height - y;

  if (w <= 0 || h <= 0) {
    wnd->invalid->null = TRUE;
    return TRUE;
  }

  int stride = gdi->stride;  // Use gdi->stride — may include alignment padding
  int bpp = 4;

  const BYTE* src = gdi->primary_buffer;
  size_t needed = (size_t)w * h * bpp;
  if (self->frameBuffer_.size() < needed) {
    self->frameBuffer_.resize(needed);
  }

  for (int row = 0; row < h; row++) {
    const BYTE* srcRow = src + (y + row) * stride + x * bpp;
    uint8_t* dstRow = self->frameBuffer_.data() + row * w * bpp;
    for (int col = 0; col < w; col++) {
      dstRow[col * 4 + 0] = srcRow[col * 4 + 2];  // R ← B (BGRX→RGBA)
      dstRow[col * 4 + 1] = srcRow[col * 4 + 1];  // G ← G
      dstRow[col * 4 + 2] = srcRow[col * 4 + 0];  // B ← R
      dstRow[col * 4 + 3] = 255;
    }
  }

  try {
    self->listener_->onBitmapUpdate(x, y, w, h, self->frameBuffer_.data(), needed);
  } catch (const std::exception& e) {
  } catch (...) {
  }

  wnd->invalid->null = TRUE;
  wnd->ninvalid = 0;

  return TRUE;
}

BOOL RdpSession::desktopResize(rdpContext* ctx) {
  fileLog("[RDP] desktopResize called");

  RdpSession* self = getSelf(ctx);
  if (!self) {
    fileLog("[RDP] desktopResize: self is null");
    return FALSE;
  }

  rdpSettings* settings = ctx->settings;
  UINT32 newW = freerdp_settings_get_uint32(settings, FreeRDP_DesktopWidth);
  UINT32 newH = freerdp_settings_get_uint32(settings, FreeRDP_DesktopHeight);
  fileLog(("[RDP] desktopResize: new size = " + std::to_string(newW) + "x" + std::to_string(newH)).c_str());

  if (newW == 0 || newH == 0) {
    fileLog("[RDP] desktopResize: invalid dimensions, skipping");
    return FALSE;
  }

  // Resize the GDI framebuffer to match the new remote resolution.
  // Without this, the old buffer remains at the old size and subsequent
  // endPaint calls with the new coordinates overflow into unmapped memory.
  // NOTE: gdi_resize() reallocates primary_buffer — do NOT use any pointer
  // cached before this call after it returns.
  rdpGdi* gdi = ctx->gdi;
  if (gdi) {
    fileLog("[RDP] calling gdi_resize...");
    if (!gdi_resize(gdi, newW, newH)) {
      fileLog("[RDP] desktopResize: gdi_resize failed");
      return FALSE;
    }
    fileLog(("[RDP] desktopResize: gdi_resize OK, new primary_buffer=" + std::to_string((uintptr_t)gdi->primary_buffer)).c_str());
  } else {
    fileLog("[RDP] desktopResize: gdi is null, skipping resize");
  }

  self->width_  = (int)newW;
  self->height_ = (int)newH;

  if (self->listener_) {
    fileLog("[RDP] calling onResize listener callback");
    self->listener_->onResize((int)newW, (int)newH);
    fileLog("[RDP] onResize callback successful");
  }

  return TRUE;
}

