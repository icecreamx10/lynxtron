// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import "LynxtronTextureViewUI.h"

#import "LynxtronSurfaceRegistry.h"

#import <Lynx/LynxEventEmitter.h>
#import <Lynx/LynxUIOwner.h>

static NSString *const LynxtronSurfaceDidEnterForeground =
    @"LynxtronSurfaceDidEnterForeground";
static NSString *const LynxtronSurfaceDidEnterBackground =
    @"LynxtronSurfaceDidEnterBackground";

typedef void (^LynxtronSurfaceEventHandler)(NSString *, NSDictionary *);

@interface LynxtronTextureContainerView : UIView
@property(nonatomic, copy) LynxtronSurfaceEventHandler eventHandler;
@end

@implementation LynxtronTextureContainerView

- (void)emitSurfaceEvent:(NSString *)name detail:(NSDictionary *)detail {
  if (self.eventHandler != nil) {
    self.eventHandler(name, detail);
  }
}

- (instancetype)init {
  self = [super init];
  if (self) {
    self.backgroundColor = [UIColor colorWithRed:0.07 green:0.09 blue:0.14 alpha:1.0];
    self.clipsToBounds = YES;
    self.multipleTouchEnabled = YES;
    self.isAccessibilityElement = YES;
    self.accessibilityLabel = @"Lynxtron native iOS canvas surface";

    UIPinchGestureRecognizer *pinch =
        [[UIPinchGestureRecognizer alloc] initWithTarget:self
                                                  action:@selector(handlePinch:)];
    pinch.cancelsTouchesInView = NO;
    [self addGestureRecognizer:pinch];

    if (@available(iOS 13.0, *)) {
      UIHoverGestureRecognizer *hover =
          [[UIHoverGestureRecognizer alloc] initWithTarget:self
                                                    action:@selector(handleHover:)];
      [self addGestureRecognizer:hover];
    }
  }
  return self;
}

- (void)drawRect:(CGRect)rect {
  CGContextRef context = UIGraphicsGetCurrentContext();
  if (context == nil) {
    return;
  }
  CGFloat cell = 22.0;
  UIColor *first = [UIColor colorWithRed:0.10 green:0.14 blue:0.22 alpha:1.0];
  UIColor *second = [UIColor colorWithRed:0.14 green:0.21 blue:0.34 alpha:1.0];
  NSInteger rows = (NSInteger)ceil(CGRectGetHeight(rect) / cell);
  NSInteger columns = (NSInteger)ceil(CGRectGetWidth(rect) / cell);
  for (NSInteger row = 0; row < rows; row++) {
    for (NSInteger column = 0; column < columns; column++) {
      UIColor *color = ((row + column) % 2 == 0) ? first : second;
      CGContextSetFillColorWithColor(context, color.CGColor);
      CGContextFillRect(context, CGRectMake(column * cell, row * cell, cell, cell));
    }
  }

  NSString *label = @"Native iOS Surface";
  NSDictionary *attributes = @{
    NSFontAttributeName : [UIFont boldSystemFontOfSize:18],
    NSForegroundColorAttributeName : UIColor.whiteColor,
  };
  CGSize size = [label sizeWithAttributes:attributes];
  [label drawAtPoint:CGPointMake((CGRectGetWidth(rect) - size.width) / 2.0,
                                 (CGRectGetHeight(rect) - size.height) / 2.0)
       withAttributes:attributes];
}

- (NSDictionary *)detailForTouch:(UITouch *)touch {
  CGPoint point = [touch locationInView:self];
  return @{
    @"x" : @(point.x),
    @"y" : @(point.y),
    @"clientX" : @(point.x),
    @"clientY" : @(point.y),
    @"buttons" : @1,
    @"pointerType" : @"touch",
  };
}

- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesBegan:touches withEvent:event];
  UITouch *touch = touches.anyObject;
  if (touch != nil) {
    [self emitSurfaceEvent:@"mousedown" detail:[self detailForTouch:touch]];
  }
}

- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesMoved:touches withEvent:event];
  UITouch *touch = touches.anyObject;
  if (touch != nil) {
    [self emitSurfaceEvent:@"mousemove" detail:[self detailForTouch:touch]];
  }
}

- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesEnded:touches withEvent:event];
  UITouch *touch = touches.anyObject;
  if (touch != nil) {
    NSMutableDictionary *detail = [[self detailForTouch:touch] mutableCopy];
    detail[@"buttons"] = @0;
    [self emitSurfaceEvent:@"mouseup" detail:detail];
  }
}

- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event {
  [super touchesCancelled:touches withEvent:event];
  [self emitSurfaceEvent:@"pointercancel"
                  detail:@{ @"pointerType" : @"touch" }];
}

- (void)handlePinch:(UIPinchGestureRecognizer *)recognizer {
  CGPoint center = [recognizer locationInView:self];
  [self emitSurfaceEvent:@"zoom"
                  detail:@{
                    @"scale" : @(recognizer.scale),
                    @"x" : @(center.x),
                    @"y" : @(center.y),
                    @"state" : @(recognizer.state),
                  }];
}

- (void)handleHover:(UIHoverGestureRecognizer *)recognizer API_AVAILABLE(ios(13.0)) {
  CGPoint point = [recognizer locationInView:self];
  [self emitSurfaceEvent:@"hover"
                  detail:@{
                    @"x" : @(point.x),
                    @"y" : @(point.y),
                    @"pointerType" : @"mouse",
                    @"state" : @(recognizer.state),
                  }];
}

@end

@interface LynxtronTextureViewUI ()
@property(nonatomic, assign) NSInteger surfaceID;
@property(nonatomic, assign) CGSize lastPixelSize;
@property(nonatomic, assign) BOOL didEmitCreate;
@property(nonatomic, assign) BOOL didEmitSurface;
@property(nonatomic, assign) BOOL didObserveLifecycle;
@property(nonatomic, assign) BOOL didRemove;
@end

@implementation LynxtronTextureViewUI

- (UIView *)createView {
  LynxtronTextureContainerView *view = [[LynxtronTextureContainerView alloc] init];
  __weak typeof(self) weakSelf = self;
  view.eventHandler = ^(NSString *name, NSDictionary *detail) {
    [weakSelf emitEvent:name detail:detail];
  };
  return view;
}

- (void)onNodeReady {
  [super onNodeReady];
  if (!self.didEmitCreate) {
    self.didEmitCreate = YES;
    [self emitEvent:@"create" detail:@{}];
  }

  if (!self.didObserveLifecycle) {
    self.didObserveLifecycle = YES;
    NSNotificationCenter *center = NSNotificationCenter.defaultCenter;
    [center addObserver:self
               selector:@selector(handleForeground)
                   name:UIApplicationWillEnterForegroundNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(handleBackground)
                   name:UIApplicationDidEnterBackgroundNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(handleForeground)
                   name:LynxtronSurfaceDidEnterForeground
                 object:nil];
    [center addObserver:self
               selector:@selector(handleBackground)
                   name:LynxtronSurfaceDidEnterBackground
                 object:nil];
  }
}

- (void)layoutDidFinished {
  [super layoutDidFinished];
  CGFloat scale = self.view.window.screen.scale ?: UIScreen.mainScreen.scale;
  CGSize pointSize = self.view.bounds.size;
  CGSize pixelSize = CGSizeMake(pointSize.width * scale, pointSize.height * scale);
  if (pixelSize.width <= 0 || pixelSize.height <= 0) {
    return;
  }

  if (!CGSizeEqualToSize(pixelSize, self.lastPixelSize)) {
    self.lastPixelSize = pixelSize;
    [self.view setNeedsDisplay];
    [self emitEvent:@"resize"
             detail:@{
               @"width" : @(pointSize.width),
               @"height" : @(pointSize.height),
               @"pixelRatio" : @(scale),
               @"pixelWidth" : @(pixelSize.width),
               @"pixelHeight" : @(pixelSize.height),
             }];
  }

  if (!self.didEmitSurface) {
    self.surfaceID = [LynxtronSurfaceRegistry registerView:self.view];
    self.didEmitSurface = YES;
    [self emitEvent:@"createsurface"
             detail:@{
               @"surface" : @(self.surfaceID),
               @"surfaceID" : @(self.surfaceID),
               @"width" : @(pixelSize.width),
               @"height" : @(pixelSize.height),
               @"pixelRatio" : @(scale),
               @"processID" : @(NSProcessInfo.processInfo.processIdentifier),
             }];
  }
}

- (void)onNodeRemoved {
  if (!self.didRemove) {
    self.didRemove = YES;
    [self emitEvent:@"destroy" detail:@{ @"surfaceID" : @(self.surfaceID) }];
    [LynxtronSurfaceRegistry unregisterSurfaceID:self.surfaceID];
  }
  [NSNotificationCenter.defaultCenter removeObserver:self];
  [super onNodeRemoved];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
  [LynxtronSurfaceRegistry unregisterSurfaceID:self.surfaceID];
}

- (void)handleForeground {
  [self emitEvent:@"foreground" detail:@{ @"surfaceID" : @(self.surfaceID) }];
}

- (void)handleBackground {
  [self emitEvent:@"background" detail:@{ @"surfaceID" : @(self.surfaceID) }];
}

- (void)emitEvent:(NSString *)name detail:(NSDictionary *)detail {
  if (self.context.eventEmitter == nil) {
    return;
  }
  LynxCustomEvent *event = [[LynxDetailEvent alloc] initWithName:name
                                                     targetSign:self.sign
                                                         detail:detail];
  [self.context.eventEmitter dispatchCustomEvent:event];
}

@end
