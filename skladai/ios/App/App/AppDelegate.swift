import UIKit
import Capacitor
import WebKit

// MARK: - DebugLog
//
// Temporary native-side diagnostic that POSTs JSON to the same
// /api/debug-log endpoint the web persistent logger in app/layout.tsx
// uses. Lets us tell (from Vercel runtime logs) whether the native
// cold-launch path runs at all when the WebView is showing a black
// screen — a black screen with no Swift events means iOS never even
// launched the app properly; events without a matching web app_start
// means WKWebView wedged before parsing HTML.
//
// Safe: fire-and-forget URLSession task, 5 s timeout, any error is
// silently ignored. sessionId is a fresh UUID per process — matches
// the "sess" keying used in the web layer.
enum DebugLog {
    /// Fresh UUID per app launch — lets us correlate multiple events
    /// from the same native process in the logs.
    static let sessionId: String = UUID().uuidString

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static func post(type: String, extra: [String: Any] = [:]) {
        guard let url = URL(string: "https://skladai.com/api/debug-log") else { return }

        var payload: [String: Any] = [
            "t": isoFormatter.string(from: Date()),
            "type": type,
            "sess": sessionId,
            "source": "native-ios",
            "device": UIDevice.current.systemName + " " + UIDevice.current.systemVersion,
            "model": UIDevice.current.model,
            "bundleVersion": Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "?",
            "bundleShortVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "?",
        ]
        for (key, value) in extra {
            payload[key] = value
        }

        guard let body = try? JSONSerialization.data(withJSONObject: payload, options: []) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = 5
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData

        // Fire and forget. We discard both data and errors — the URLSession
        // task is freed automatically once it completes or times out.
        URLSession.shared.dataTask(with: request).resume()
    }
}

// MARK: - DiagBridgeViewController
//
// Subclass of CAPBridgeViewController that wraps the WKNavigationDelegate
// set by Capacitor's bridge with a forwarding proxy so we can observe
// load errors without breaking existing plugin navigation handling.
// Wired in via Base.lproj/Main.storyboard (customClass="DiagBridgeViewController",
// customModule="App").
class DiagBridgeViewController: CAPBridgeViewController {
    // Strongly held — WKWebView's navigationDelegate is a weak reference.
    private let navigationProxy = DiagNavigationDelegateProxy()

    override func loadWebView() {
        // Let Capacitor build the WebView and install its own delegate first.
        super.loadWebView()
        guard let webView = self.webView else {
            DebugLog.post(type: "webview_missing_after_load")
            return
        }
        // Keep the original (Capacitor's WebViewDelegationHandler) around so
        // everything we don't explicitly handle flows through untouched.
        navigationProxy.forward = webView.navigationDelegate
        webView.navigationDelegate = navigationProxy
        DebugLog.post(type: "webview_delegate_installed")
    }
}

// MARK: - DiagNavigationDelegateProxy
//
// Implements only the three WKNavigationDelegate callbacks we care about
// (didFail, didFailProvisional, didFinish). Any other method goes to the
// original delegate via Objective-C message forwarding so plugins that
// rely on decidePolicyFor etc. keep working.
class DiagNavigationDelegateProxy: NSObject, WKNavigationDelegate {
    weak var forward: WKNavigationDelegate?

    // --- ObjC forwarding glue ---

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let original = forward as? NSObject, original.responds(to: aSelector) {
            return original
        }
        return nil
    }

    override func responds(to aSelector: Selector!) -> Bool {
        if super.responds(to: aSelector) { return true }
        if let original = forward as? NSObject {
            return original.responds(to: aSelector)
        }
        return false
    }

    // --- Observed callbacks ---

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        DebugLog.post(type: "webview_load_error", extra: [
            "stage": "provisional",
            "error": error.localizedDescription,
            "code": nsError.code,
            "domain": nsError.domain,
            "url": webView.url?.absoluteString ?? "",
            "failingURL": nsError.userInfo["NSErrorFailingURLStringKey"] as? String ?? ""
        ])
        // Forward to Capacitor's handler (optional @objc method — use `?`).
        forward?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        DebugLog.post(type: "webview_load_error", extra: [
            "stage": "committed",
            "error": error.localizedDescription,
            "code": nsError.code,
            "domain": nsError.domain,
            "url": webView.url?.absoluteString ?? "",
            "failingURL": nsError.userInfo["NSErrorFailingURLStringKey"] as? String ?? ""
        ])
        forward?.webView?(webView, didFail: navigation, withError: error)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        DebugLog.post(type: "webview_did_finish", extra: [
            "url": webView.url?.absoluteString ?? ""
        ])
        forward?.webView?(webView, didFinish: navigation)
    }
}

// MARK: - AppDelegate

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Diagnostic marker — prints to Xcode console + device.log.
        print("[CAPACITOR] didFinishLaunchingWithOptions fired")
        // The very first network-visible event of this process. If this
        // never shows up in Vercel logs for a black-screen reopen, we
        // know the black screen is NOT a WebView issue — the native app
        // didn't even get to finish launching.
        DebugLog.post(type: "native_app_start")

        // Wipe transient WKWebView caches on every cold launch.
        //
        // Why: the cold-reopen black screen on iOS almost certainly comes
        // from WKWebView trying to reuse stale data from the last session
        // (HTTP disk cache, memory cache, service-worker registrations
        // left over from older app versions, and the fetch-cache used by
        // fetch()/XHR). Nuking just these four categories guarantees a
        // fresh network fetch for skladai.com on every launch.
        //
        // What we deliberately do NOT wipe (those stay on the default
        // data store so the user stays signed in and their client-side
        // data persists):
        //   - WKWebsiteDataTypeCookies
        //   - WKWebsiteDataTypeLocalStorage
        //   - WKWebsiteDataTypeIndexedDBDatabases
        //   - WKWebsiteDataTypeSessionStorage
        //   - WKWebsiteDataTypeWebSQLDatabases
        let types: Set<String> = [
            WKWebsiteDataTypeDiskCache,
            WKWebsiteDataTypeMemoryCache,
            WKWebsiteDataTypeServiceWorkerRegistrations,
            WKWebsiteDataTypeFetchCache,
        ]
        WKWebsiteDataStore.default().removeData(
            ofTypes: types,
            modifiedSince: Date.distantPast,
            completionHandler: {
                print("[CAPACITOR] WKWebView caches cleared on cold launch")
                DebugLog.post(type: "native_cache_cleared")
            }
        )

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
