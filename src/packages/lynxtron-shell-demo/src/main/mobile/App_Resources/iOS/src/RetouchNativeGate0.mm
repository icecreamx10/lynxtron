// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#import <Foundation/Foundation.h>

#include <napi.h>

namespace {

Napi::Value Greeting(const Napi::CallbackInfo& info) {
  const bool is_main_thread = [NSThread isMainThread];
  NSLog(@"[LYNXTRON_GATE0] RetouchNative.greeting called; mainThread=%@",
        is_main_thread ? @"YES" : @"NO");
  return Napi::String::New(info.Env(),
                           "Hello from RetouchNative N-API on iOS");
}

napi_value RegisterRetouchNative(napi_env env, napi_value exports) {
  Napi::Env napi_env(env);
  Napi::Object module(napi_env, exports);
  module.Set("greeting",
             Napi::Function::New(napi_env, Greeting, "greeting"));
  return module;
}

}  // namespace

NAPI_MODULE_PRIMJS(RetouchNative, RegisterRetouchNative)
