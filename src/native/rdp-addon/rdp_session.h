#pragma once

#include <napi.h>
#include <freerdp/freerdp.h>
#include <freerdp/client/cmdline.h>
#include <freerdp/constants.h>
#include <freerdp/codec/color.h>
#include <freerdp/version.h>
#include <winpr/wtypes.h>
#include <thread>
#include <atomic>
#include <memory>
#include <mutex>
#include <functional>
#include <string>
#include <vector>

// Clipboard redirection (cliprdr SVC) is only wired up against FreeRDP 3.x —
// the client cliprdr API shape and freerdp_client_load_addins signature differ
// on the 2.x line that older Linux distros still ship. On 2.x the feature
// silently no-ops.
#if defined(FREERDP_VERSION_MAJOR) && FREERDP_VERSION_MAJOR >= 3
#define TG_CLIPBOARD 1
#include <freerdp/client/cliprdr.h>
#endif

class RdpFrameListener {
public:
  virtual ~RdpFrameListener() = default;
  virtual void onBitmapUpdate(int x, int y, int w, int h, const void* data, size_t size) = 0;
  virtual void onResize(int w, int h) = 0;
  virtual void onDisconnect(const char* reason) = 0;
  virtual void onError(const char* msg) = 0;
  virtual void onServerName(const char* name) = 0;
  // Remote session put UTF-8 text on its clipboard; bridge it to the host OS.
  virtual void onClipboardText(const char* utf8) = 0;
};

class RdpSession {
public:
  RdpSession(const std::string& host, int port,
             int width, int height,
             const std::string& username,
             const std::string& password,
             RdpFrameListener* listener,
             const std::string& serverHostname = "");
  ~RdpSession();

  bool connect();
  void disconnect();
  bool isConnected() const { return connected_; }
  const std::string& lastError() const { return lastError_; }
  UINT32 lastErrorCode() const { return lastErrorCode_; }

  void sendPointerEvent(int flags, int x, int y);
  void sendKeyboardEvent(int flags, UINT16 code);
  void resize(int width, int height);
  const std::string& serverName() const { return serverName_; }
  void setServerName(const std::string& name) { serverName_ = name; }

  // Push host-OS clipboard text into the remote session. Thread-safe: it only
  // stashes the text and flags the pump thread to advertise a new format list.
  void setClipboardText(const std::string& utf8);

private:
  static BOOL beginPaint(rdpContext* ctx);
  static BOOL endPaint(rdpContext* ctx);
  static BOOL desktopResize(rdpContext* ctx);
  static BOOL preConnectCallback(freerdp* instance);
  static BOOL postConnectCallback(freerdp* instance);
  static int verifyX509Certificate(freerdp* instance, const BYTE* data, size_t length,
                                   const char* hostname, UINT16 port, DWORD flags);

#ifdef TG_CLIPBOARD
  static void onChannelConnected(void* context, const ChannelConnectedEventArgs* e);
  static void onChannelDisconnected(void* context, const ChannelDisconnectedEventArgs* e);
  static UINT cliprdrMonitorReady(CliprdrClientContext* ctx, const CLIPRDR_MONITOR_READY* ready);
  static UINT cliprdrServerCapabilities(CliprdrClientContext* ctx, const CLIPRDR_CAPABILITIES* caps);
  static UINT cliprdrServerFormatList(CliprdrClientContext* ctx, const CLIPRDR_FORMAT_LIST* list);
  static UINT cliprdrServerFormatListResponse(CliprdrClientContext* ctx,
                                              const CLIPRDR_FORMAT_LIST_RESPONSE* resp);
  static UINT cliprdrServerFormatDataRequest(CliprdrClientContext* ctx,
                                             const CLIPRDR_FORMAT_DATA_REQUEST* req);
  static UINT cliprdrServerFormatDataResponse(CliprdrClientContext* ctx,
                                              const CLIPRDR_FORMAT_DATA_RESPONSE* resp);
  void sendClientFormatList();

  std::atomic<CliprdrClientContext*> cliprdr_{nullptr};
  std::atomic<bool> clipboardDirty_{false};
  std::mutex clipMutex_;
  std::string hostClipboardText_;   // guarded by clipMutex_
  UINT32 pendingRemoteFormat_ = 0;  // pump thread only
#endif


  freerdp* instance_ = nullptr;
  rdpContext* context_ = nullptr;
  std::thread* updateThread_ = nullptr;
  std::atomic<bool> connected_{false};
  std::atomic<bool> running_{false};
  RdpFrameListener* listener_ = nullptr;
  std::vector<uint8_t> frameBuffer_;

  std::string lastError_;
  UINT32 lastErrorCode_ = 0;
  std::string host_;
  std::string serverHostname_;
  std::string serverName_;
  int port_;
  int width_;
  int height_;
  std::string username_;
  std::string password_;

  void pump();

  static RdpSession* getSelf(rdpContext* ctx);
};
