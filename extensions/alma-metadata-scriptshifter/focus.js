// Store focus timing only in the page's isolated extension world, never field text.
if (!globalThis.almaScriptShifterFocusInstalled) {
  globalThis.almaScriptShifterFocusInstalled = true;
  document.addEventListener('focusin', event => {
    if (event.isTrusted) globalThis.almaScriptShifterFocusTime = Date.now();
  }, true);
}
