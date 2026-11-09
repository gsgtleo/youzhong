package com.youzhong.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.youzhong.app.YouzhongApp
import com.youzhong.app.MainActivity
import com.youzhong.app.R
import com.youzhong.app.data.LiveBus
import com.youzhong.app.data.LiveStream
import com.youzhong.app.notify.Notifier

/**
 * 常驻前台服务：持有与服务器的 SSE 长连接。
 * 提醒由服务端到点推送，客户端只负责展示，因此不依赖手机系统时间。
 */
class LiveService : Service() {

    private var stream: LiveStream? = null
    private var connected = false

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        startForeground(FOREGROUND_ID, buildNotification(false))

        val app = YouzhongApp.from(this)
        stream = LiveStream(
            store = app.tokenStore,
            // 与本地闹钟用同一个通知 id，两者都触发时互相覆盖而不是弹两条
            onNotification = { title, body, taskId ->
                Notifier.post(this, taskId?.hashCode()?.plus(1000) ?: (title + body).hashCode(), title, body, taskId)
            },
            onSnapshotChange = { LiveBus.emit() },
            onState = { ok ->
                connected = ok
                val manager = getSystemService(NotificationManager::class.java)
                manager?.notify(FOREGROUND_ID, buildNotification(ok))
            },
        ).also { it.start() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        stream?.stop()
        stream = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "实时同步", NotificationManager.IMPORTANCE_LOW).apply {
                description = "保持与服务器的连接，用于即时同步与提醒"
                setShowBadge(false)
            },
        )
    }

    private fun buildNotification(ok: Boolean): Notification {
        val intent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("有终")
            .setContentText(if (ok) "实时连接正常，提醒由服务器推送" else "正在重新连接服务器…")
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(intent)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "youzhong_live"
        private const val FOREGROUND_ID = 1001

        fun start(context: Context) {
            runCatching { ContextCompat.startForegroundService(context, Intent(context, LiveService::class.java)) }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, LiveService::class.java))
        }
    }
}

/** 开机后自动恢复实时连接（有登录态才启动） */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val app = YouzhongApp.from(context)
        val pending = goAsync()
        Thread {
            val token = runCatching { kotlinx.coroutines.runBlocking { app.tokenStore.load().token } }.getOrNull()
            if (!token.isNullOrBlank()) {
                LiveService.start(context)
                // 夜里关机时补跑一次系统日历导出（全量重建，天然幂等）
                YouzhongApp.exportCalendarNow(context)
            }
            pending.finish()
        }.start()
    }
}
