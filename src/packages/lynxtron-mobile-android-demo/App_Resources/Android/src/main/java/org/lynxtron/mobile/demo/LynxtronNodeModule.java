// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

package org.lynxtron.mobile.demo;

import android.content.Context;
import com.lynx.jsbridge.LynxMethod;
import com.lynx.jsbridge.LynxModule;

/** P0 fallback until the NativeScript BTS Worker owns the nodejs provider. */
public final class LynxtronNodeModule extends LynxModule {
  public LynxtronNodeModule(Context context) {
    super(context);
  }

  @LynxMethod
  public String echo(String message) {
    return "Echo from Mobile BG Thread: " + message;
  }
}
