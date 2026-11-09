package com.youzhong.app.calendar

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.calendarDataStore by preferencesDataStore(name = "youzhong_calendar_sync")

/** 「同步到手机日历」的配置与上次执行结果 */
data class CalendarSyncConfig(
    val enabled: Boolean = false,
    val calendarId: Long = 0L,
    val calendarName: String = "",
    val rangeDays: Int = 7,
    val hour: Int = 3,
    val lastSyncAt: Long = 0L,
    val lastCount: Int = 0,
    val lastError: String = "",
)

class CalendarSyncStore(private val context: Context) {

    private companion object {
        val ENABLED = booleanPreferencesKey("enabled")
        val CALENDAR_ID = longPreferencesKey("calendar_id")
        val CALENDAR_NAME = stringPreferencesKey("calendar_name")
        val RANGE_DAYS = intPreferencesKey("range_days")
        val HOUR = intPreferencesKey("hour")
        val LAST_AT = longPreferencesKey("last_at")
        val LAST_COUNT = intPreferencesKey("last_count")
        val LAST_ERROR = stringPreferencesKey("last_error")
    }

    suspend fun load(): CalendarSyncConfig {
        val prefs = context.calendarDataStore.data.first()
        return CalendarSyncConfig(
            enabled = prefs[ENABLED] ?: false,
            calendarId = prefs[CALENDAR_ID] ?: 0L,
            calendarName = prefs[CALENDAR_NAME] ?: "",
            rangeDays = prefs[RANGE_DAYS] ?: 7,
            hour = prefs[HOUR] ?: 3,
            lastSyncAt = prefs[LAST_AT] ?: 0L,
            lastCount = prefs[LAST_COUNT] ?: 0,
            lastError = prefs[LAST_ERROR] ?: "",
        )
    }

    suspend fun setEnabled(enabled: Boolean) {
        context.calendarDataStore.edit { it[ENABLED] = enabled }
    }

    suspend fun setCalendar(id: Long, name: String) {
        context.calendarDataStore.edit {
            it[CALENDAR_ID] = id
            it[CALENDAR_NAME] = name
        }
    }

    suspend fun setRange(days: Int) {
        context.calendarDataStore.edit { it[RANGE_DAYS] = days }
    }

    suspend fun recordSync(count: Int, error: String = "") {
        context.calendarDataStore.edit {
            it[LAST_AT] = System.currentTimeMillis()
            it[LAST_COUNT] = count
            it[LAST_ERROR] = error
        }
    }
}
