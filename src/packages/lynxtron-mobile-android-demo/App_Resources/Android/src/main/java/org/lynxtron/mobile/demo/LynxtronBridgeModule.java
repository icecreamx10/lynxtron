// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

package org.lynxtron.mobile.demo;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.lynx.jsbridge.LynxMethod;
import com.lynx.jsbridge.LynxModule;
import com.lynx.react.bridge.Callback;
import com.lynx.react.bridge.ReadableMap;
import org.json.JSONObject;

/** Routes the symmetric bridge module from the Lynx BTS to NativeScript Main. */
public final class LynxtronBridgeModule extends LynxModule {
  private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
  private final LynxtronLynxHost.Listener listener;

  public LynxtronBridgeModule(Context context, Object param) {
    super(context, param);
    if (!(param instanceof LynxtronLynxHost.Listener)) {
      throw new IllegalArgumentException("Lynxtron bridge requires a window listener");
    }
    listener = (LynxtronLynxHost.Listener) param;
  }

  @LynxMethod
  public void call(String method, ReadableMap params, Callback callback) {
    String paramsJson = toJson(params);
    MAIN_HANDLER.post(() -> listener.onBridgeCall(method, paramsJson, callback));
  }

  @LynxMethod
  public void send(String method, ReadableMap params) {
    String paramsJson = toJson(params);
    MAIN_HANDLER.post(() -> listener.onBridgeSend(method, paramsJson));
  }

  private static String toJson(ReadableMap params) {
    return params == null ? "{}" : new JSONObject(params.asHashMap()).toString();
  }
}
