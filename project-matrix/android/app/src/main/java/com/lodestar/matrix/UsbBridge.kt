// Imagined and engineered by:
// Aries Thorne & Todd Steinhauer
//
// Moral Support: Athena the K9
package com.lodestar.matrix

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbManager
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber
import com.hoho.android.usbserial.util.SerialInputOutputManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/** Gives the dashboard page a serial port over the phone's USB host. Exposed to the page as window.AndroidUsb. */
class UsbBridge(private val act: MainActivity) {
    private val usb = act.getSystemService(Context.USB_SERVICE) as UsbManager
    private val ex = Executors.newSingleThreadExecutor()
    private var port: UsbSerialPort? = null
    private var io: SerialInputOutputManager? = null
    private var conn: UsbDeviceConnection? = null
    private var curDev: UsbDevice? = null
    private val ACTION = "com.lodestar.matrix.USB_PERMISSION"

    private fun driverFor(d: UsbDevice): UsbSerialDriver? {
        UsbSerialProber.getDefaultProber().probeDevice(d)?.let { return it }
        for (i in 0 until d.interfaceCount) if (d.getInterface(i).interfaceClass == 2) return CdcAcmSerialDriver(d)
        return null
    }
    private fun candidates(): List<UsbDevice> = usb.deviceList.values.filter { driverFor(it) != null }

    private val rcv = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            when (i.action) {
                ACTION -> js("__ns.reqDone(${i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)}, 'USB permission was not granted.')")
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    @Suppress("DEPRECATION") val d = i.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    if (d != null && d.deviceName == curDev?.deviceName) { closeNow(); js("__ns.lost()") }
                }
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> js("__ns.attached()")
            }
        }
    }

    init {
        val f = IntentFilter().apply { addAction(ACTION); addAction(UsbManager.ACTION_USB_DEVICE_DETACHED); addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED) }
        ContextCompat.registerReceiver(act, rcv, f, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    private fun js(code: String) = act.runOnUiThread { act.web.evaluateJavascript("try{$code}catch(e){}", null) }

    fun destroy() { closeNow(); try { act.unregisterReceiver(rcv) } catch (_: Exception) {} }

    @JavascriptInterface fun present(): String {
        val a = JSONArray()
        for (d in candidates()) a.put(JSONObject().put("id", d.deviceName).put("vid", d.vendorId).put("pid", d.productId).put("perm", usb.hasPermission(d)))
        return a.toString()
    }

    @JavascriptInterface fun request() {
        val d = candidates().firstOrNull()
        if (d == null) { js("__ns.reqDone(false, 'No USB serial radio found. Plug the radio in with a data cable.')"); return }
        if (usb.hasPermission(d)) { js("__ns.reqDone(true)"); return }
        val pi = PendingIntent.getBroadcast(act, 0, Intent(ACTION).setPackage(act.packageName), PendingIntent.FLAG_MUTABLE)
        usb.requestPermission(d, pi)
    }

    @JavascriptInterface fun open(baud: Int) {
        ex.execute {
            try {
                closeNow()
                val d = candidates().firstOrNull { usb.hasPermission(it) } ?: throw Exception("No permitted USB radio. Tap Connect again and allow access.")
                val drv = driverFor(d)!!
                val c = usb.openDevice(d) ?: throw Exception("Android would not open the USB device.")
                val p = drv.ports[0]
                p.open(c)
                p.setParameters(baud, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
                conn = c; port = p; curDev = d
                val m = SerialInputOutputManager(p, object : SerialInputOutputManager.Listener {
                    override fun onNewData(data: ByteArray) { js("__ns.rx('${Base64.encodeToString(data, Base64.NO_WRAP)}')") }
                    override fun onRunError(e: Exception) { closeNow(); js("__ns.lost()") }
                })
                io = m; m.start()
                js("__ns.openDone(true)")
            } catch (e: Exception) {
                closeNow()
                js("__ns.openDone(false, ${JSONObject.quote(e.message ?: "open failed")})")
            }
        }
    }

    @JavascriptInterface fun write(b64: String) {
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        ex.execute { try { port?.write(bytes, 2000) } catch (_: Exception) {} }
    }

    @JavascriptInterface fun setSignals(dtr: Boolean, rts: Boolean) {
        ex.execute { try { port?.setDTR(dtr); port?.setRTS(rts) } catch (_: Exception) {} }
    }

    @JavascriptInterface fun close() { ex.execute { closeNow() } }

    @Synchronized private fun closeNow() {
        try { io?.stop() } catch (_: Exception) {}
        try { port?.close() } catch (_: Exception) {}
        try { conn?.close() } catch (_: Exception) {}
        io = null; port = null; conn = null; curDev = null
    }
}
