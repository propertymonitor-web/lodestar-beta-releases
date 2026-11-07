// Imagined and engineered by:
// Aries Thorne & Todd Steinhauer
//
// Moral Support: Athena the K9
package com.lodestar.matrix

import android.Manifest
import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.WindowManager
import android.webkit.*
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : AppCompatActivity() {
    lateinit var web: WebView
    private lateinit var usb: UsbBridge
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private var geoCb: Pair<String, GeolocationPermissions.Callback>? = null
    private val HOME = "https://appassets.androidplatform.net/assets/matrix.html"

    private val chooser = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data)); fileCb = null
    }
    private val locPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        geoCb?.let { it.second.invoke(it.first, ok, false) }; geoCb = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        web = WebView(this)
        setContentView(web)
        val loader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true; databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false; allowFileAccess = false; allowContentAccess = false
            setGeolocationEnabled(true)
        }
        usb = UsbBridge(this)
        web.addJavascriptInterface(usb, "AndroidUsb")
        web.addJavascriptInterface(Files(), "AndroidFiles")
        val poly = assets.open("serial-polyfill.js").bufferedReader().use { it.readText() }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, r: WebResourceRequest) = loader.shouldInterceptRequest(r.url)
            override fun onPageStarted(v: WebView, url: String, f: android.graphics.Bitmap?) {
                if (url.startsWith("https://appassets.androidplatform.net/")) v.evaluateJavascript(poly, null)
            }
            override fun onPageFinished(v: WebView, url: String) {
                if (url.startsWith("https://appassets.androidplatform.net/")) v.evaluateJavascript(poly, null)
            }
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                if (r.url.host == "appassets.androidplatform.net") return false
                try { startActivity(Intent(Intent.ACTION_VIEW, r.url)) } catch (_: Exception) {}
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null); fileCb = cb
                return try { chooser.launch(p.createIntent()); true } catch (_: Exception) { fileCb = null; false }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) cb.invoke(origin, true, false)
                else { geoCb = origin to cb; locPerm.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
            }
        }
        if (b == null) web.loadUrl(HOME) else web.restoreState(b)
    }

    override fun onSaveInstanceState(o: Bundle) { super.onSaveInstanceState(o); web.saveState(o) }

    override fun onNewIntent(i: Intent) { super.onNewIntent(i); setIntent(i) }

    @Deprecated("back")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }

    override fun onDestroy() { usb.destroy(); super.onDestroy() }

    private fun toast(s: String) = runOnUiThread { Toast.makeText(this, s, Toast.LENGTH_LONG).show() }

    inner class Files {
        @JavascriptInterface fun saveFile(name: String, mime: String, b64: String) {
            try {
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
                val v = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safe); put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val u = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: throw Exception("could not create file")
                contentResolver.openOutputStream(u)!!.use { it.write(bytes) }
                toast("Saved to Downloads: $safe")
            } catch (e: Exception) { toast("Could not save: ${e.message}") }
        }

        @JavascriptInterface fun shareFile(name: String, mime: String, b64: String, title: String, text: String) {
            try {
                val dir = File(cacheDir, "shared").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
                val f = File(dir, name.replace(Regex("[^A-Za-z0-9._-]"), "_"))
                f.writeBytes(Base64.decode(b64, Base64.DEFAULT))
                val u = FileProvider.getUriForFile(this@MainActivity, "$packageName.files", f)
                val i = Intent(Intent.ACTION_SEND).apply {
                    type = mime; putExtra(Intent.EXTRA_STREAM, u)
                    if (title.isNotEmpty()) putExtra(Intent.EXTRA_SUBJECT, title)
                    if (text.isNotEmpty()) putExtra(Intent.EXTRA_TEXT, text)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                runOnUiThread { startActivity(Intent.createChooser(i, title.ifEmpty { "Share" })) }
            } catch (e: Exception) { toast("Could not share: ${e.message}") }
        }

        @JavascriptInterface fun shareText(title: String, text: String, url: String) {
            val i = Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, listOf(text, url).filter { it.isNotEmpty() }.joinToString("\n")) }
            runOnUiThread { startActivity(Intent.createChooser(i, title.ifEmpty { "Share" })) }
        }
    }
}
