// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import "LynxtronIOSHost.h"

#import <Lynx/LynxConfig.h>
#import <Lynx/LynxTemplateData.h>
#import <Lynx/LynxView.h>
#import <Lynx/LynxViewBuilder.h>
#import <Lynx/LynxViewClient.h>

@class LynxtronIOSHost;

@interface LynxtronBridgeModule : NSObject <LynxModule>
- (instancetype)initWithParam:(LynxtronIOSHost *)host;
@end

@interface LynxtronNodeModule : NSObject <LynxModule>
@end

@interface LynxtronIOSHost () <LynxViewLifecycle>
@property(nonatomic, strong) id<LynxtronIOSHostListener> listener;
@property(nonatomic, strong, nullable) LynxView *lynxView;
@end

static id LynxtronJSONObject(NSString *json, Class expectedClass, id fallback) {
  if (json.length == 0) {
    return fallback;
  }
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (data == nil) {
    return fallback;
  }
  id value = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  return [value isKindOfClass:expectedClass] ? value : fallback;
}

static NSString *LynxtronJSONString(id value) {
  if (value == nil || ![NSJSONSerialization isValidJSONObject:value]) {
    return @"{}";
  }
  NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:nil];
  return data == nil ? @"{}" : [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

@implementation LynxtronIOSHost

- (instancetype)initWithListener:(id<LynxtronIOSHostListener>)listener {
  self = [super init];
  if (self) {
    _listener = listener;
  }
  return self;
}

- (UIView *)createViewWithFrame:(CGRect)frame {
  LynxConfig *config = [[LynxConfig alloc] initWithProvider:nil];
  [config registerModule:LynxtronBridgeModule.class param:self];
  [config registerModule:LynxtronNodeModule.class];

  LynxView *view = [[LynxView alloc] initWithBuilderBlock:^(LynxViewBuilder *builder) {
    builder.config = config;
    builder.frame = frame;
    builder.screenSize = frame.size;
    builder.fontScale = 1.0;
  }];
  view.frame = frame;
  view.preferredLayoutWidth = frame.size.width;
  view.preferredLayoutHeight = frame.size.height;
  view.layoutWidthMode = LynxViewSizeModeExact;
  view.layoutHeightMode = LynxViewSizeModeExact;
  view.enableAutoLayout = YES;
  [view addLifecycleClient:self];
  self.lynxView = view;
  return view;
}

- (BOOL)renderAsset:(NSString *)assetName dataJSON:(NSString *)dataJSON {
  NSString *path = [NSBundle.mainBundle pathForResource:assetName ofType:nil];
  NSData *bytes = path == nil ? nil : [NSData dataWithContentsOfFile:path];
  if (bytes == nil) {
    [self.listener onError:-1
                   message:[NSString stringWithFormat:@"Missing iOS asset: %@", assetName]];
    return NO;
  }
  NSString *url = [@"app://" stringByAppendingString:assetName];
  return [self renderBytes:bytes dataJSON:dataJSON url:url];
}

- (BOOL)renderBytes:(NSData *)bytes dataJSON:(NSString *)dataJSON url:(NSString *)url {
  if (self.lynxView == nil || bytes.length == 0) {
    return NO;
  }
  NSDictionary *data = LynxtronJSONObject(dataJSON, NSDictionary.class, @{});
  [self.listener onPageStart:url];
  [self.lynxView loadTemplate:bytes
                      withURL:url
                     initData:[[LynxTemplateData alloc] initWithDictionary:data]];
  [self.lynxView triggerLayout];
  return YES;
}

- (BOOL)updateDataJSON:(NSString *)dataJSON {
  if (self.lynxView == nil) {
    return NO;
  }
  NSDictionary *data = LynxtronJSONObject(dataJSON, NSDictionary.class, @{});
  [self.lynxView updateDataWithDictionary:data];
  return YES;
}

- (BOOL)updateGlobalPropsJSON:(NSString *)propsJSON {
  if (self.lynxView == nil) {
    return NO;
  }
  NSDictionary *props = LynxtronJSONObject(propsJSON, NSDictionary.class, @{});
  [self.lynxView updateGlobalPropsWithDictionary:props];
  return YES;
}

- (BOOL)sendGlobalEvent:(NSString *)name argsJSON:(NSString *)argsJSON {
  if (self.lynxView == nil) {
    return NO;
  }
  NSArray *args = LynxtronJSONObject(argsJSON, NSArray.class, @[]);
  [self.lynxView sendGlobalEvent:name withParams:args];
  return YES;
}

- (void)show {
  self.lynxView.hidden = NO;
}

- (void)hide {
  self.lynxView.hidden = YES;
}

- (void)destroy {
  if (self.lynxView == nil) {
    return;
  }
  [self.lynxView removeLifecycleClient:self];
  [self.lynxView clearForDestroy];
  [self.lynxView removeFromSuperview];
  self.lynxView = nil;
  [self.listener onDestroyed];
}

- (void)lynxViewDidConstructJSRuntime:(LynxView *)view {
  [self.listener onRuntimeReady];
}

- (void)lynxView:(LynxView *)view didLoadFinishedWithUrl:(NSString *)url {
  [self.listener onLoadSuccess];
}

- (void)lynxViewDidFirstScreen:(LynxView *)view {
  [self.listener onFirstScreen];
}

- (void)lynxView:(LynxView *)view didRecieveError:(NSError *)error {
  [self.listener onError:error.code message:error.localizedDescription ?: @"Unknown Lynx error"];
}

@end

@interface LynxtronBridgeModule ()
@property(nonatomic, weak) LynxtronIOSHost *host;
@end


@implementation LynxtronBridgeModule

+ (NSString *)name {
  return @"bridge";
}

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{
    @"call" : NSStringFromSelector(@selector(call:params:callback:)),
    @"send" : NSStringFromSelector(@selector(send:params:)),
  };
}

- (instancetype)initWithParam:(LynxtronIOSHost *)host {
  self = [super init];
  if (self) {
    _host = host;
  }
  return self;
}

- (void)call:(NSString *)method params:(NSDictionary *)params callback:(LynxCallbackBlock)callback {
  NSString *paramsJSON = LynxtronJSONString(params);
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.host.listener onBridgeCall:method paramsJSON:paramsJSON callback:callback];
  });
}

- (void)send:(NSString *)method params:(NSDictionary *)params {
  NSString *paramsJSON = LynxtronJSONString(params);
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.host.listener onBridgeSend:method paramsJSON:paramsJSON];
  });
}

@end

@implementation LynxtronNodeModule

+ (NSString *)name {
  return @"nodejs";
}

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{
    @"echo" : NSStringFromSelector(@selector(echo:)),
  };
}

- (NSString *)echo:(NSString *)message {
  return [@"Echo from Mobile BG Thread: " stringByAppendingString:message ?: @""];
}

@end
