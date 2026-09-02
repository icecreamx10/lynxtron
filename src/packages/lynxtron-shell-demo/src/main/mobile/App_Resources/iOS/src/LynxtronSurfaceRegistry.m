// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import "LynxtronSurfaceRegistry.h"

@implementation LynxtronSurfaceRegistry

+ (NSMapTable<NSNumber *, UIView *> *)surfaceViews {
  static NSMapTable<NSNumber *, UIView *> *views;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    views = [NSMapTable strongToWeakObjectsMapTable];
  });
  return views;
}

+ (NSInteger)registerView:(UIView *)view {
  static NSInteger nextSurfaceID = 1;
  @synchronized(self) {
    NSInteger surfaceID = nextSurfaceID++;
    [[self surfaceViews] setObject:view forKey:@(surfaceID)];
    return surfaceID;
  }
}

+ (UIView *)viewForSurfaceID:(NSInteger)surfaceID {
  @synchronized(self) {
    return [[self surfaceViews] objectForKey:@(surfaceID)];
  }
}

+ (void)unregisterSurfaceID:(NSInteger)surfaceID {
  @synchronized(self) {
    [[self surfaceViews] removeObjectForKey:@(surfaceID)];
  }
}

@end
