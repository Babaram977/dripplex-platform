package com.dripplex.customer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Plugins that live in the app module are not discovered by Capacitor's
    // package scan — that only covers installed plugin packages. This must run
    // BEFORE super.onCreate(), which is where the bridge is built: register
    // after it and the plugin is silently absent, so DriverPresence.start()
    // rejects at runtime with "not implemented" on device while every build
    // and every test stays green (DPX-MOBILE-003).
    registerPlugin(DriverPresencePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
