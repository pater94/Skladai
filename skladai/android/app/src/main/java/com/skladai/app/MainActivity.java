package com.skladai.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Auto-grant audio capture for getUserMedia / Web Speech API inside the
        // Capacitor WebView. Without this, calls like SpeechRecognition / mic
        // access fail with NotAllowedError on Android even when RECORD_AUDIO is
        // declared in the manifest, because the WebView's default
        // WebChromeClient denies every PermissionRequest.
        // We still defer to Capacitor's BridgeWebChromeClient for non-audio
        // resources so other plugin features (camera, file pickers, etc.)
        // keep working unchanged.
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                boolean wantsAudio = false;
                for (String resource : request.getResources()) {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                        wantsAudio = true;
                        break;
                    }
                }
                if (wantsAudio) {
                    runOnUiThread(() -> request.grant(request.getResources()));
                } else {
                    super.onPermissionRequest(request);
                }
            }
        });

        // Expose a tiny JavaScript interface so the web layer can deep-link the
        // user to this app's Android settings page when mic permission was
        // denied. Used by the VoiceLog "Otwórz ustawienia" fallback button.
        bridge.getWebView().addJavascriptInterface(new AndroidAppBridge(), "AndroidApp");
    }

    private class AndroidAppBridge {
        @JavascriptInterface
        public void openAppSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ignored) {
                // Best-effort: nothing else we can do from JS-bridge land.
            }
        }
    }
}
