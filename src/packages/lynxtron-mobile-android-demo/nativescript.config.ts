import type { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'org.lynxtron.mobile.demo',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  android: {
    v8Flags: '--expose_gc',
    markingMode: 'none',
  },
} as NativeScriptConfig;
