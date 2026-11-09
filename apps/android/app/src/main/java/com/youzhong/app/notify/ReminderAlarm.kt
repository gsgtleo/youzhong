package com.youzhong.app.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.youzhong.app.data.Task
import com.youzhong.app.ui.Dates
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.youzhong.app.work.DueCheckWorker

/**
 * 用 AlarmManager 精确调度提醒：WorkManager 周期任务最小 15 分钟，
 * 且国产 ROM 后台限制严格，单靠它会导致「到点没提醒」。
 */
object ReminderScheduler {

    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_ID = "id"

    /** 设备时钟相对服务器时钟的偏差（serverNow - deviceNow），用于抵消失准 */
    @Volatile
    var timeOffsetMs: Long = 0L

    fun updateOffset(serverTimeIso: String?) {
        val serverMs = runCatching { java.time.Instant.parse(serverTimeIso ?: "") }.getOrNull() ?: return
        timeOffsetMs = serverMs.toEpochMilli() - System.currentTimeMillis()
    }

    /** 任务变化后整体重排（数量级几十条，成本可接受） */
    fun sync(context: Context, tasks: List<Task>) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        tasks.filter { it.status == 0 }.forEach { task ->
            cancel(context, task.id, 1000)
            cancel(context, task.id, 2000)

            val reminder = Dates.parse(task.reminders.firstOrNull()?.trigger)?.toInstant()?.toEpochMilli()
            val due = Dates.parse(task.dueDate)?.toInstant()?.toEpochMilli()
            val now = System.currentTimeMillis() + timeOffsetMs // 用服务器时间判断"是否已过"

            if (reminder != null && reminder > now) {
                schedule(context, manager, task, reminder, 1000, "任务提醒", task.title)
            }
            if (due != null && due > now) {
                schedule(context, manager, task, due, 2000, "任务到期", task.title)
            }
        }
    }

    private fun schedule(
        context: Context,
        manager: AlarmManager,
        task: Task,
        atMillis: Long,
        offset: Int,
        title: String,
        body: String,
    ) {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            putExtra(EXTRA_ID, task.id.hashCode() + offset)
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra("taskId", task.id)
        }
        val pending = PendingIntent.getBroadcast(
            context,
            task.id.hashCode() + offset,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        // 目标时刻按服务器时间计算，换算成"设备时钟"上的触发点：device = server - offset
        val deviceAt = (atMillis - timeOffsetMs).coerceAtLeast(System.currentTimeMillis() + 1_000)
        try {
            val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
            if (canExact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deviceAt, pending)
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deviceAt, pending)
        } catch (error: SecurityException) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, deviceAt, pending)
        }
    }

    private fun cancel(context: Context, taskId: String, offset: Int) {
        val intent = Intent(context, ReminderReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context,
            taskId.hashCode() + offset,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        context.getSystemService(AlarmManager::class.java)?.cancel(pending)
    }
}

/** 闹钟到点：发本地通知，并顺手触发一次同步把服务端消息也拉下来 */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "任务提醒"
        val body = intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: "该处理了"
        val id = intent.getIntExtra(ReminderScheduler.EXTRA_ID, System.currentTimeMillis().toInt())
        Notifier.post(context, id, title, body, intent.getStringExtra("taskId"))
        runCatching {
            WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<DueCheckWorker>().build())
        }
    }
}
