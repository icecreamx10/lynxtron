// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

package org.lynxtron.mobile.demo;

import com.tns.NativeScriptApplication;

public final class LynxtronApplication extends NativeScriptApplication {
  @Override
  public void onCreate() {
    super.onCreate();
    LynxtronLynxHost.initialize(this);
  }
}
