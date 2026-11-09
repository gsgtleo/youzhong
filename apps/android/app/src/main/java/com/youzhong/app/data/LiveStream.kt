package com.youzhong.app.data

import kotlinx.coroutines.flow.MutableSharedFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** UI 订阅：服务端有新数据时触发刷新 */
object LiveBus {
    val changes = MutableSharedFlow<Unit>(extraBufferCapacity = 8)

    fun emit() {
        changes.tryEmit(Unit)
    }
}

/**
 * 服务端实时通道（SSE）客户端。
 * 通知的时间点完全由服务端决定，客户端只负责"收到就弹"，不依赖手机时钟。
 */
class LiveStream(
    private val store: TokenStore,
    private val onNotification: (title: String, body: String, taskId: String?) -> Unit,
    private val onSnapshotChange: () -> Unit,
    private val onState: (Boolean) -> Unit,
) {
    @Volatile
    private var running = false
    private var call: okhttp3.Call? = null

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // SSE 长连接不超时
        .retryOnConnectionFailure(true)
        .build()

    fun start() {
        if (running) return
        running = true
        Thread({ loop() }, "youzhong-live").apply { isDaemon = true }.start()
    }

    fun stop() {
        running = false
        call?.cancel()
        onState(false)
    }

    private fun loop() {
        while (running) {
            val config = kotlinx.coroutines.runBlocking { store.load() }
            if (config.token.isBlank() || config.serverUrl.isBlank()) {
                Thread.sleep(5_000)
                continue
            }
            val url = config.serverUrl.trimEnd('/') + "/api/stream?token=" + URLEncoder.encode(config.token, "UTF-8")
            val request = Request.Builder().url(url).header("Accept", "text/event-stream").build()
            try {
                call = client.newCall(request)
                call?.execute()?.use { response ->
                    if (!response.isSuccessful) {
                        onState(false)
                        Thread.sleep(5_000)
                        return@use
                    }
                    onState(true)
                    val source = response.body?.source() ?: return@use
                    var event = ""
                    while (running) {
                        val line = source.readUtf8Line() ?: break
                        when {
                            line.startsWith("event:") -> event = line.removePrefix("event:").trim()
                            line.startsWith("data:") -> handle(event, line.removePrefix("data:").trim())
                        }
                    }
                }
            } catch (error: Exception) {
                onState(false)
            }
            if (running) Thread.sleep(3_000)
        }
    }

    private fun handle(event: String, data: String) {
        when (event) {
            "snapshot-changed" -> onSnapshotChange()
            "notification" -> {
                val title = extract(data, "title") ?: "任务提醒"
                val body = extract(data, "body") ?: ""
                val taskId = extract(data, "taskId")
                onNotification(title, body, taskId)
            }
        }
    }

    /** 极简 JSON 取值，避免为了一个字段引入解析器 */
    private fun extract(json: String, key: String): String? {
        val regex = Regex("\"$key\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"")
        return regex.find(json)?.groupValues?.get(1)?.replace("\\\"", "\"")
    }
}
