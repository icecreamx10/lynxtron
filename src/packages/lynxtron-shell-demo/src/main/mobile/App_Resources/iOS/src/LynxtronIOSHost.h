// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <Lynx/LynxModule.h>

NS_ASSUME_NONNULL_BEGIN

@protocol LynxtronIOSHostListener <NSObject>

- (void)onPageStart:(NSString *)url;
- (void)onRuntimeReady;
- (void)onLoadSuccess;
- (void)onFirstScreen;
- (void)onError:(NSInteger)code message:(NSString *)message;
- (void)onBridgeCall:(NSString *)method
          paramsJSON:(NSString *)paramsJSON
            callback:(LynxCallbackBlock)callback;
- (void)onBridgeSend:(NSString *)method paramsJSON:(NSString *)paramsJSON;
- (void)onDestroyed;

@end

@interface LynxtronIOSHost : NSObject

- (instancetype)initWithListener:(id<LynxtronIOSHostListener>)listener;
- (UIView *)createViewWithFrame:(CGRect)frame;
- (BOOL)renderAsset:(NSString *)assetName dataJSON:(NSString *)dataJSON;
- (BOOL)renderBytes:(NSData *)bytes dataJSON:(NSString *)dataJSON url:(NSString *)url;
- (BOOL)updateDataJSON:(NSString *)dataJSON;
- (BOOL)updateGlobalPropsJSON:(NSString *)propsJSON;
- (BOOL)sendGlobalEvent:(NSString *)name argsJSON:(NSString *)argsJSON;
- (void)show;
- (void)hide;
- (void)destroy;

@end

NS_ASSUME_NONNULL_END
