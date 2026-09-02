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
  const [gate1Status, setGate1Status] = useState('Waiting for surface');
  const [gate1Details, setGate1Details] = useState(
    'Waiting for the native iOS custom element.'
  );
  const [inputDetails, setInputDetails] = useState(
    'Touch, pinch, or hover inside the surface.'
  );
  const [lifecycleDetails, setLifecycleDetails] = useState(
    'Lifecycle: foreground'
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

  const handleSurfaceCreate = useCallback(() => {
    'background only';

    setGate1Details('Custom element created · waiting for native surface');
  }, []);

  const handleSurfaceResize = useCallback((event) => {
    'background only';

    const detail = event?.detail ?? {};
    console.log(
      `[LYNXTRON_GATE1] resize ${detail.width}x${detail.height} @${detail.pixelRatio}`
    );
  }, []);

  const handleSurfaceReady = useCallback((event) => {
    'background only';

    const detail = event?.detail ?? {};
    const passed = Number(detail.surfaceID ?? detail.surface) > 0;
    setGate1Status(passed ? 'PASS' : 'FAIL');
    setGate1Details(
      passed
        ? `surface #${detail.surfaceID ?? detail.surface} · ${detail.width}×${
            detail.height
          } px · process ${detail.processID}`
        : 'The custom element did not return a valid surface token.'
    );
    console.log(`[LYNXTRON_GATE1] visible surface check: ${passed ? 'PASS' : 'FAIL'}`);
  }, []);

  const handlePointer = useCallback((event) => {
    'background only';

    const detail = event?.detail ?? {};
    setInputDetails(
      `pointer ${Math.round(Number(detail.x ?? 0))}, ${Math.round(
        Number(detail.y ?? 0)
      )}`
    );
  }, []);

  const handleZoom = useCallback((event) => {
    'background only';

    setInputDetails(`pinch scale ${Number(event?.detail?.scale ?? 1).toFixed(2)}`);
  }, []);

  const handleSurfaceLifecycle = useCallback((event) => {
    'background only';

    const phase = String(event?.type ?? 'changed');
    setLifecycleDetails(`Lifecycle: ${phase}`);
    console.log(`[LYNXTRON_GATE1] lifecycle ${phase}`);
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
      <view className="GateCard Gate1Card">
        <view className="GateHeader">
          <text className="GateTitle">Gate 1 · iOS canvas surface</text>
          <text className={`GateBadge GateBadge${gate1Status}`}>
            {gate1Status}
          </text>
        </view>
        <text className="GateDetails">{gate1Details}</text>
        <x-texture-view
          className="SurfaceProbe"
          bindcreate={handleSurfaceCreate}
          bindresize={handleSurfaceResize}
          bindcreatesurface={handleSurfaceReady}
          bindforeground={handleSurfaceLifecycle}
          bindbackground={handleSurfaceLifecycle}
          binddestroy={handleSurfaceLifecycle}
          bindmousedown={handlePointer}
          bindmousemove={handlePointer}
          bindmouseup={handlePointer}
          bindhover={handlePointer}
          bindzoom={handleZoom}
        />
        <text className="InputDetails">{inputDetails}</text>
        <text className="InputDetails">{lifecycleDetails}</text>
      </view>
    </view>
  );
}
