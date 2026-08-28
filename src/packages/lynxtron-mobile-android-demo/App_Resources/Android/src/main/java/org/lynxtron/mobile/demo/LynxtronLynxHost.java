// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

package org.lynxtron.mobile.demo;

import android.app.Application;
import android.content.Context;
import android.view.View;
import com.facebook.drawee.backends.pipeline.Fresco;
import com.lynx.react.bridge.JavaOnlyArray;
import com.lynx.service.image.LynxImageService;
import com.lynx.tasm.LynxEnv;
import com.lynx.tasm.LynxError;
import com.lynx.tasm.LynxView;
import com.lynx.tasm.LynxViewBuilder;
import com.lynx.tasm.LynxViewClient;
import com.lynx.tasm.TemplateData;
import com.lynx.tasm.provider.AbsTemplateProvider;
import com.lynx.tasm.service.LynxServiceCenter;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/** Small Java boundary used by NativeScript's JavaScript runtime. */
public final class LynxtronLynxHost {
  public interface Listener {
    void onPageStart(String url);

    void onRuntimeReady();

    void onLoadSuccess();

    void onFirstScreen();

    void onError(int code, String message);

    void onDestroyed();
  }

  private static final AtomicBoolean INITIALIZED = new AtomicBoolean(false);

  private LynxtronLynxHost() {}

  public static void initialize(Context context) {
    if (!INITIALIZED.compareAndSet(false, true)) {
      return;
    }

    Application application = (Application) context.getApplicationContext();
    Fresco.initialize(application);
    LynxServiceCenter.inst().registerService(LynxImageService.getInstance());
    LynxEnv.inst().init(application, null, null, null);
  }

  public static LynxView create(Context context, final Listener listener) {
    initialize(context);

    LynxViewBuilder builder = new LynxViewBuilder();
    builder.setTemplateProvider(new AssetTemplateProvider(context));
    LynxView view = builder.build(context);
    view.addLynxViewClient(
        new LynxViewClient() {
          @Override
          public void onPageStart(String url) {
            listener.onPageStart(url);
          }

          @Override
          public void onRuntimeReady() {
            listener.onRuntimeReady();
          }

          @Override
          public void onLoadSuccess() {
            listener.onLoadSuccess();
          }

          @Override
          public void onFirstScreen() {
            listener.onFirstScreen();
          }

          @Override
          public void onReceivedError(LynxError error) {
            listener.onError(error.getErrorCode(), error.getSummaryMessage());
          }

          @Override
          public void onDestroy() {
            listener.onDestroyed();
          }
        });
    return view;
  }

  public static void renderAsset(
      LynxView view, String assetPath, String initialDataJson) {
    view.renderTemplateUrl(assetPath, initialDataJson == null ? "" : initialDataJson);
  }

  public static void renderBytes(
      LynxView view, byte[] bytes, String initialDataJson, String baseUrl) {
    view.renderTemplateWithBaseUrl(
        bytes, initialDataJson == null ? "" : initialDataJson, baseUrl);
  }

  public static void updateData(LynxView view, String dataJson) {
    view.updateData(dataJson);
  }

  public static void updateGlobalProps(LynxView view, String propsJson) {
    view.updateGlobalProps(TemplateData.fromString(propsJson));
  }

  public static void sendGlobalEvent(LynxView view, String name, String argsJson) {
    JavaOnlyArray args = new JavaOnlyArray();
    args.pushString(argsJson);
    view.sendGlobalEvent(name, args);
  }

  public static void show(LynxView view) {
    view.setVisibility(View.VISIBLE);
    view.onEnterForeground();
  }

  public static void hide(LynxView view) {
    view.onEnterBackground();
    view.setVisibility(View.GONE);
  }

  public static void destroy(LynxView view) {
    view.destroy();
  }

  private static final class AssetTemplateProvider extends AbsTemplateProvider {
    private final Context context;

    AssetTemplateProvider(Context context) {
      this.context = context.getApplicationContext();
    }

    @Override
    public void loadTemplate(final String uri, final Callback callback) {
      new Thread(
              () -> {
                try (InputStream input = context.getAssets().open(uri);
                    ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                  byte[] buffer = new byte[8192];
                  int length;
                  while ((length = input.read(buffer)) != -1) {
                    output.write(buffer, 0, length);
                  }
                  callback.onSuccess(output.toByteArray());
                } catch (IOException error) {
                  callback.onFailed(error.getMessage());
                }
              },
              "lynxtron-template-loader")
          .start();
    }
  }
}
