package com.youzhong.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.youzhong.app.YouzhongApp
import com.youzhong.app.notify.Notifier

/**
 * 后台到期检查：
 * 1) 拉服务端 /notifications?since= 增量（含钉钉/飞书同款事件）
 * 2) 本地再按 dueDate 兜底检查未来 30 分钟内的任务
 * 任意失败直接 return success，避免 WorkManager 无限重试烧电
 */
class DueCheckWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = YouzhongApp.from(applicationContext)
        val config = runCatching { app.tokenStore.load() }.getOrNull() ?: return Result.success()
        if (config.token.isEmpty()) return Result.success()

        val prefs = applicationContext.getSharedPreferences("youzhong-work", Context.MODE_PRIVATE)
        val since = prefs.getLong("last_notice_ts", 0L)

        // 服务端通知
        runCatching { app.api.notifications(since) }.getOrNull()?.let { list ->
            val nowTs = System.currentTimeMillis()
            // 只弹 15 分钟内的新通知；历史积压（如关闭后台/换机）直接跳过，避免"迟到提醒"
            val freshWindow = 15 * 60 * 1000L
            var newest = since
            list.notifications.forEach { notice ->
                if (notice.createdAt > newest) newest = notice.createdAt
                val age = nowTs - notice.createdAt
                // createdAt 是服务端毫秒时间戳；设备时钟偏差过大时 age 可能为负，用绝对值兜底
                if (kotlin.math.abs(age) > freshWindow) return@forEach
                Notifier.post(
                    context = applicationContext,
                    id = notice.id.hashCode(),
                    title = notice.title,
                    body = notice.body ?: "点击查看任务详情",
                    taskId = notice.taskId,
                )
            }
            prefs.edit().putLong("last_notice_ts", maxOf(newest, nowTs - 1000)).apply()
        }

        // 本地兜底：30 分钟内到期且未完成
        runCatching { app.api.snapshot() }.getOrNull()?.let { snapshot ->
            val now = System.currentTimeMillis()
            val horizon = now + 30 * 60 * 1000
            snapshot.tasks
                .filter { it.status == 0 && it.dueDate != null }
                .forEach { task ->
                    val due = parseStamp(task.dueDate) ?: return@forEach
                    if (due in now..horizon) {
                        val key = "notified_${task.id}"
                        val lastNotified = prefs.getLong(key, 0L)
                        if (now - lastNotified > 30 * 60 * 1000) {
                            Notifier.post(
                                context = applicationContext,
                                id = task.id.hashCode(),
                                title = "任务即将到期",
                                body = task.title,
                                taskId = task.id,
                            )
                            prefs.edit().putLong(key, now).apply()
                        }
                    }
                }
        }

        return Result.success()
    }

    private fun parseStamp(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        val normalized = value.replace(Regex("([+-]\\d{2})(\\d{2})$"), "$1:$2")
        return runCatching { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", java.util.Locale.US).parse(normalized)?.time }
            .getOrNull()
    }
}
