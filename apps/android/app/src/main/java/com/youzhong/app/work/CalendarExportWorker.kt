package com.youzhong.app.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.youzhong.app.YouzhongApp
import com.youzhong.app.calendar.CalendarExportItem
import com.youzhong.app.calendar.SystemCalendar
import com.youzhong.app.ui.Dates
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.TimeZone

/**
 * 每日把「未来 N 天未完成任务」全量写入用户指定的系统日历。
 * - 只删自己写入的（描述带 [有终] 标记），用户手工日程不受影响
 * - 任何异常都返回 success，避免 WorkManager 反复重试耗电；错误写进配置供设置页展示
 */
class CalendarExportWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = YouzhongApp.from(applicationContext)
        val store = app.calendarSyncStore
        val config = store.load()

        if (!config.enabled || config.calendarId == 0L) return Result.success()
        if (!SystemCalendar.hasPermission(applicationContext)) {
            store.recordSync(0, "缺少日历读写权限")
            return Result.success()
        }

        val session = runCatching { app.tokenStore.load() }.getOrNull()
        if (session == null || session.token.isEmpty()) {
            store.recordSync(0, "未登录")
            return Result.success()
        }

        return runCatching {
            val snapshot = app.api.snapshot()
            val zone = ZoneId.systemDefault()
            val from = LocalDate.now().atStartOfDay(zone).toInstant().toEpochMilli()
            val to = LocalDate.now().plusDays(config.rangeDays.toLong()).atStartOfDay(zone).toInstant().toEpochMilli()

            val items = snapshot.tasks.mapNotNull { task ->
                if (task.status == 2) return@mapNotNull null
                val due = task.dueDate?.let { Dates.parse(it)?.toInstant()?.toEpochMilli() } ?: return@mapNotNull null
                if (due < from || due >= to) return@mapNotNull null

                if (task.isAllDay) {
                    val day = Instant.ofEpochMilli(due).atZone(zone).toLocalDate()
                    CalendarExportItem(
                        taskId = task.id,
                        title = task.title,
                        startMillis = day.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
                        endMillis = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
                        allDay = true,
                    )
                } else {
                    // 定时任务按 30 分钟写入，与 App 内时间轴一致；跨天则截到当天 23:59
                    val dayEnd = Instant.ofEpochMilli(due).atZone(zone).toLocalDate()
                        .atTime(23, 59).atZone(zone).toInstant().toEpochMilli()
                    CalendarExportItem(
                        taskId = task.id,
                        title = task.title,
                        startMillis = due,
                        endMillis = minOf(due + 30 * 60_000L, dayEnd),
                        allDay = false,
                    )
                }
            }

            val written = SystemCalendar.replaceAll(
                context = applicationContext,
                calendarId = config.calendarId,
                items = items,
                timeZone = TimeZone.getDefault().id,
            )
            store.recordSync(written)
            Result.success()
        }.getOrElse { error ->
            store.recordSync(0, error.message ?: "同步失败")
            Result.success()
        }
    }
}
