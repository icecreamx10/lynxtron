// Copyright 2026 The Lynxtron Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useCallback, useEffect, useState } from '@lynx-js/react';
import './App.css';
import placeholder from '@assets/placeholder.png?inline';
import {
  echoFromHost,
  greetingFromRetouchNative,
  probeRetouchNative,
  showHostDialog,
} from './symmetric-host';

export function App() {
  const [gate0Status, setGate0Status] = useState('Waiting for self-check');
  const [gate0Details, setGate0Details] = useState(
    'Static N-API has not been probed yet.'
  );

  const runGate0Check = useCallback(() => {
    'background only';

    try {
      const result = probeRetouchNative();
      const passed =
        result.moduleName === 'RetouchNative' && result.isMainThread === false;
      setGate0Status(passed ? 'PASS' : 'FAIL');
      setGate0Details(
        `${result.moduleName} loaded · N-API returned · ${
          result.isMainThread ? 'main thread' : 'BTS background thread'
        }`
      );
      console.log(`[LYNXTRON_GATE0] visible self-check: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      setGate0Status('FAIL');
      setGate0Details(`Static N-API unavailable: ${String(error)}`);
      console.log(`[LYNXTRON_GATE0] self-check failed: ${error}`);
    }
  }, []);

  useEffect(() => {
    'background only';

    try {
      const napiGreeting = greetingFromRetouchNative();
      console.log(`[LYNXTRON_GATE0] ${napiGreeting}`);
    } catch (error) {
      console.log(`[LYNXTRON_GATE0] RetouchNative unavailable: ${error}`);
    }
    runGate0Check();
  }, [runGate0Check]);

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
      <view className="GateCard">
        <view className="GateHeader">
          <text className="GateTitle">Gate 0 · BTS + static N-API</text>
          <text className={`GateBadge GateBadge${gate0Status}`}>
            {gate0Status}
          </text>
        </view>
        <text className="GateDetails">{gate0Details}</text>
        <view className="GateButton" bindtap={runGate0Check}>
          <text className="GateButtonText">Run Gate 0 Check</text>
        </view>
      </view>
    </view>
  );
}
