// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

// iOS uses a process-local token instead of exposing a UIView pointer to JS.
// A statically linked N-API module can resolve the token on the main thread and
// bind the returned container view to its platform render target.
@interface LynxtronSurfaceRegistry : NSObject

+ (NSInteger)registerView:(UIView *)view;
+ (nullable UIView *)viewForSurfaceID:(NSInteger)surfaceID;
+ (void)unregisterSurfaceID:(NSInteger)surfaceID;

@end

NS_ASSUME_NONNULL_END
