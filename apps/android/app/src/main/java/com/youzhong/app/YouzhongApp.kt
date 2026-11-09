package com.youzhong.app

import android.app.Application
import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.youzhong.app.calendar.CalendarSyncStore
import com.youzhong.app.data.YouzhongApi
import com.youzhong.app.data.TokenStore
import com.youzhong.app.notify.Notifier
import com.youzhong.app.work.CalendarExportWorker
import com.youzhong.app.work.DueCheckWorker
import java.time.Duration
import java.time.LocalTime
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

class YouzhongApp : Application() {

    lateinit var tokenStore: TokenStore
        private set
    lateinit var calendarSyncStore: CalendarSyncStore
        private set
    lateinit var api: YouzhongApi
        private set

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        calendarSyncStore = CalendarSyncStore(this)
        api = YouzhongApi(tokenStore)
        Notifier.ensureChannel(this)
        scheduleWork(this)
        scheduleCalendarExport(this)
    }

    companion object {
        fun from(context: Context): YouzhongApp = context.applicationContext as YouzhongApp

        /** 每 15 分钟同步一次：检查到期任务与服务端通知 */
        fun scheduleWork(context: Context) {
            val request = PeriodicWorkRequestBuilder<DueCheckWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork("youzhong-due-check", ExistingPeriodicWorkPolicy.KEEP, request)
        }

        /**
         * 每天固定时间把未来若干天的任务写进系统日历。
         * 用「到下一个目标小时的延迟」+ 24h 周期，保证重启/改系统时间后仍落在同一时刻。
         */
        fun scheduleCalendarExport(context: Context, hour: Int = 3) {
            val now = ZonedDateTime.now()
            var next = now.toLocalDate().atTime(LocalTime.of(hour, 0)).atZone(now.zone)
            if (!next.isAfter(now)) next = next.plusDays(1)
            val delayMinutes = Duration.between(now, next).toMinutes().coerceAtLeast(1)

            val request = PeriodicWorkRequestBuilder<CalendarExportWorker>(1, TimeUnit.DAYS)
                .setInitialDelay(delayMinutes, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork("youzhong-calendar-export", ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        /** 关闭开关时取消周期任务 */
        fun cancelCalendarExport(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork("youzhong-calendar-export")
        }

        /** 立即执行一次导出（设置页「立即同步」） */
        fun exportCalendarNow(context: Context) {
            WorkManager.getInstance(context).enqueue(
                androidx.work.OneTimeWorkRequestBuilder<CalendarExportWorker>()
                    .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                    .build(),
            )
        }
    }
}
