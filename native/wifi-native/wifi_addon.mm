#include <napi.h>
#include <string>
#import <CoreLocation/CoreLocation.h>
#import <CoreWLAN/CoreWLAN.h>
#import <Foundation/Foundation.h>

@interface TGLocationAuthWaiter : NSObject <CLLocationManagerDelegate>
@property(nonatomic, assign) BOOL resolved;
@property(nonatomic, assign) CLAuthorizationStatus finalStatus;
@property(nonatomic, strong) dispatch_semaphore_t semaphore;
@property(nonatomic, strong) CLLocationManager *manager;
@end

@implementation TGLocationAuthWaiter
- (instancetype)init {
  self = [super init];
  if (self) {
    _resolved = NO;
    _finalStatus = kCLAuthorizationStatusNotDetermined;
  }
  return self;
}

- (void)locationManagerDidChangeAuthorization:(CLLocationManager *)manager {
  CLAuthorizationStatus status = manager.authorizationStatus;
  if (status == kCLAuthorizationStatusNotDetermined) return;
  self.finalStatus = status;
  self.resolved = YES;
  if (self.semaphore) {
    dispatch_semaphore_signal(self.semaphore);
  }
}
@end

static BOOL IsAuthorized(CLAuthorizationStatus status) {
  return status != kCLAuthorizationStatusNotDetermined &&
         status != kCLAuthorizationStatusDenied &&
         status != kCLAuthorizationStatusRestricted;
}

// Ensures location authorization is resolved on the main thread (requesting it
// and waiting on a semaphore if it's not yet determined). Must be called off
// the main JS thread since waiting on the semaphore would block the main thread.
static BOOL EnsureLocationAuthorized(double timeoutSeconds) {
  if (![CLLocationManager locationServicesEnabled]) {
    return NO;
  }

  __block CLAuthorizationStatus initialStatus = kCLAuthorizationStatusNotDetermined;
  __block TGLocationAuthWaiter *waiter = nil;
  __block dispatch_semaphore_t sem = NULL;

  dispatch_sync(dispatch_get_main_queue(), ^{
    CLLocationManager *manager = [[CLLocationManager alloc] init];
    initialStatus = manager.authorizationStatus;

    if (initialStatus == kCLAuthorizationStatusNotDetermined) {
      sem = dispatch_semaphore_create(0);
      waiter = [[TGLocationAuthWaiter alloc] init];
      waiter.semaphore = sem;
      waiter.manager = manager;
      manager.delegate = waiter;
      [manager requestWhenInUseAuthorization];
    }
  });

  if (IsAuthorized(initialStatus)) {
    return YES;
  }
  if (initialStatus == kCLAuthorizationStatusDenied || initialStatus == kCLAuthorizationStatusRestricted) {
    return NO;
  }

  if (sem) {
    dispatch_time_t deadline = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeoutSeconds * NSEC_PER_SEC));
    dispatch_semaphore_wait(sem, deadline);

    BOOL success = waiter.resolved && IsAuthorized(waiter.finalStatus);

    dispatch_async(dispatch_get_main_queue(), ^{
      if (waiter && waiter.manager) {
        waiter.manager.delegate = nil;
        waiter.manager = nil;
      }
    });

    return success;
  }

  return NO;
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
