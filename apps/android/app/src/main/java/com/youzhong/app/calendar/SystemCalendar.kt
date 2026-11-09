package com.youzhong.app.calendar

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat

/** 系统日历里可写入的一个日历（Google / 华为 / 本地账户等） */
data class SystemCalendarInfo(
    val id: Long,
    val displayName: String,
    val accountName: String,
    val color: Int,
)

/** 一条待写入的日历事件（由任务映射而来） */
data class CalendarExportItem(
    val taskId: String,
    val title: String,
    val startMillis: Long,
    val endMillis: Long,
    val allDay: Boolean,
)

/**
 * 系统日历读写。写入的事件统一带 [有终] 前缀描述，
 * 全量重建时只删「本 App 写入」的条目，绝不动用户自己创建的日程。
 */
object SystemCalendar {

    const val MARK = "[有终]"

    private val PERMISSIONS = arrayOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR)

    fun hasPermission(context: Context): Boolean = PERMISSIONS.all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

    /** 可写（至少可添加事件）且可见的日历 */
    fun writableCalendars(context: Context): List<SystemCalendarInfo> {
        if (!hasPermission(context)) return emptyList()
        val projection = arrayOf(
            CalendarContract.Calendars._ID,
            CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME,
            CalendarContract.Calendars.CALENDAR_COLOR,
        )
        val selection =
            "${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ? AND ${CalendarContract.Calendars.VISIBLE} = 1"
        val args = arrayOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR.toString())

        val result = mutableListOf<SystemCalendarInfo>()
        runCatching {
            context.contentResolver
                .query(
                    CalendarContract.Calendars.CONTENT_URI,
                    projection,
                    selection,
                    args,
                    "${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME} ASC",
                )
                ?.use { cursor ->
                    while (cursor.moveToNext()) {
                        result += SystemCalendarInfo(
                            id = cursor.getLong(0),
                            displayName = cursor.getString(1) ?: "未命名日历",
                            accountName = cursor.getString(2).orEmpty(),
                            color = cursor.getInt(3),
                        )
                    }
                }
        }
        return result
    }

    /**
     * 全量重建：先删除该日历里带 [有终] 标记的旧事件，再写入最新任务。
     * 返回写入条数；无权限时返回 -1。
     */
    fun replaceAll(context: Context, calendarId: Long, items: List<CalendarExportItem>, timeZone: String): Int {
        if (!hasPermission(context)) return -1
        val resolver = context.contentResolver

        runCatching {
            resolver.delete(
                CalendarContract.Events.CONTENT_URI,
                "${CalendarContract.Events.CALENDAR_ID} = ? AND ${CalendarContract.Events.DESCRIPTION} LIKE ?",
                arrayOf(calendarId.toString(), "$MARK%"),
            )
        }

        var written = 0
        items.forEach { item ->
            val values = ContentValues().apply {
                put(CalendarContract.Events.CALENDAR_ID, calendarId)
                put(CalendarContract.Events.TITLE, item.title)
                put(CalendarContract.Events.DESCRIPTION, "$MARK #${item.taskId}")
                put(CalendarContract.Events.DTSTART, item.startMillis)
                put(CalendarContract.Events.DTEND, item.endMillis)
                put(CalendarContract.Events.ALL_DAY, if (item.allDay) 1 else 0)
                // 全天事件统一按 UTC 记日期，与系统日历约定一致
                put(CalendarContract.Events.EVENT_TIMEZONE, if (item.allDay) "UTC" else timeZone)
                put(CalendarContract.Events.HAS_ALARM, 0)
            }
            val uri = runCatching { resolver.insert(CalendarContract.Events.CONTENT_URI, values) }.getOrNull()
            if (uri != null) written += 1
        }
        return written
    }
}
