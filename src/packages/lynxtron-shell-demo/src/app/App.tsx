// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect } from '@lynx-js/react';
import './App.css';
import placeholder from '@assets/placeholder.png?inline';
import {
  echoFromHost,
  greetingFromRetouchNative,
  showHostDialog,
} from './symmetric-host';

export function App() {
  useEffect(() => {
    'background only';

    try {
      const napiGreeting = greetingFromRetouchNative();
      console.log(`[LYNXTRON_GATE0] ${napiGreeting}`);
    } catch (error) {
      console.log(`[LYNXTRON_GATE0] RetouchNative unavailable: ${error}`);
    }
  }, []);

  const handleTap = useCallback(() => {
    'background only';

    const message = echoFromHost('Hello from Lynxtron!');
    console.log('[App] handleTap triggered', message);
    showHostDialog(message, () => {
      console.log('[App] bridge.request callback fired');
    });
  }, []);

  return (
    <view className="Background">
      <image className="BackgroundImage" src={placeholder}></image>
      <view className="Container" bindtap={handleTap}>
        <text className="Title">Hello, Lynxtron</text>
        <text className="Hint">Tap card to show native dialog</text>
      </view>
    </view>
  );
}
