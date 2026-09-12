#import <React/RCTBridgeModule.h>
@interface RCT_EXTERN_MODULE(TableeInbox, NSObject)
RCT_EXTERN_METHOD(setSession:(NSString * _Nullable)account resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(read:(NSString *)account resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(acknowledge:(NSString *)account ids:(NSArray *)ids resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
