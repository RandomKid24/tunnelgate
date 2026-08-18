#include <napi.h>
#include <string>
#import <CoreLocation/CoreLocation.h>
#import <CoreWLAN/CoreWLAN.h>
#import <Foundation/Foundation.h>

@interface TGLocationAuthWaiter : NSObject <CLLocationManagerDelegate>
@property(nonatomic, assign) BOOL resolved;
@property(nonatomic, assign) CLAuthorizationStatus finalStatus;
@end

@implementation TGLocationAuthWaiter
- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager {
  CLAuthorizationStatus status = manager.authorizationStatus;
  if (status == kCLAuthorizationStatusNotDetermined) return;
  self.finalStatus = status;
  self.resolved = YES;
}
@end

static BOOL IsAuthorized(CLAuthorizationStatus status) {
  return status != kCLAuthorizationStatusNotDetermined &&
         status != kCLAuthorizationStatusDenied &&
         status != kCLAuthorizationStatusRestricted;
}

// Ensures location authorization is resolved (requesting it, and pumping a
// run loop up to timeoutSeconds if it's not yet determined — this is what
// actually surfaces the system consent dialog to a first-time user). Must be
// called off the main JS thread since it can block for the full timeout.
static BOOL EnsureLocationAuthorized(double timeoutSeconds) {
  if (![CLLocationManager locationServicesEnabled]) {
    return NO;
  }

  CLLocationManager *manager = [[CLLocationManager alloc] init];
  TGLocationAuthWaiter *waiter = [[TGLocationAuthWaiter alloc] init];
  manager.delegate = waiter;

  CLAuthorizationStatus status = manager.authorizationStatus;
  if (IsAuthorized(status)) {
    return YES;
  }
  if (status == kCLAuthorizationStatusDenied || status == kCLAuthorizationStatusRestricted) {
    return NO;
  }

  waiter.resolved = NO;
  [manager requestWhenInUseAuthorization];

  NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:timeoutSeconds];
  while (!waiter.resolved && [deadline timeIntervalSinceNow] > 0) {
    [[NSRunLoop currentRunLoop] runMode:NSDefaultRunLoopMode
                              beforeDate:[NSDate dateWithTimeIntervalSinceNow:0.2]];
  }

  return waiter.resolved && IsAuthorized(waiter.finalStatus);
}

// Runs off the main JS thread (Execute), so a slow/never-answered system
// permission dialog never blocks Electron's event loop or IPC handling.
class WifiWorker : public Napi::AsyncWorker {
 public:
  WifiWorker(Napi::Env env, double timeoutSeconds)
      : Napi::AsyncWorker(env),
        timeoutSeconds_(timeoutSeconds),
        deferred_(Napi::Promise::Deferred::New(env)) {}

  Napi::Promise GetPromise() { return deferred_.Promise(); }

  void Execute() override {
    @autoreleasepool {
      if (!EnsureLocationAuthorized(timeoutSeconds_)) {
        authorized_ = false;
        return;
      }
      authorized_ = true;

      CWInterface *iface = [[CWWiFiClient sharedWiFiClient] interface];
      if (iface == nil) return;

      NSString *ssid = [iface ssid];
      if (ssid == nil) return;

      ssid_ = std::string([ssid UTF8String]);
      NSString *bssid = [iface bssid];
      if (bssid != nil) {
        bssid_ = std::string([bssid UTF8String]);
        hasBssid_ = true;
      }
      hasResult_ = true;
    }
  }

  void OnOK() override {
    Napi::Env env = Env();
    Napi::Object result = Napi::Object::New(env);
    result.Set("authorized", Napi::Boolean::New(env, authorized_));
    if (authorized_ && hasResult_) {
      result.Set("ssid", Napi::String::New(env, ssid_));
      result.Set("bssid", hasBssid_ ? (napi_value)Napi::String::New(env, bssid_) : (napi_value)env.Null());
    } else {
      result.Set("ssid", env.Null());
      result.Set("bssid", env.Null());
    }
    deferred_.Resolve(result);
  }

  void OnError(const Napi::Error& e) override {
    deferred_.Reject(e.Value());
  }

 private:
  double timeoutSeconds_;
  bool authorized_ = false;
  bool hasResult_ = false;
  bool hasBssid_ = false;
  std::string ssid_;
  std::string bssid_;
  Napi::Promise::Deferred deferred_;
};

Napi::Value GetCurrentWifi(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  double timeoutSeconds = 60.0;
  if (info.Length() > 0 && info[0].IsNumber()) {
    timeoutSeconds = info[0].As<Napi::Number>().DoubleValue();
  }

  WifiWorker* worker = new WifiWorker(env, timeoutSeconds);
  Napi::Promise promise = worker->GetPromise();
  worker->Queue();
  return promise;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("getCurrentWifi", Napi::Function::New(env, GetCurrentWifi));
  return exports;
}

NODE_API_MODULE(wifi_native, Init)
