package com.youzhong.app.ui

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** 自然语言快速添加的解析结果（与网页端 quickParse.ts 行为保持一致） */
data class QuickParseResult(
    val title: String,
    val dueDate: String?,
    val priority: Int,
    val isAllDay: Boolean,
)

private val WEEKDAY_MAP = mapOf(
    "一" to 1, "二" to 2, "三" to 3, "四" to 4, "五" to 5, "六" to 6, "日" to 7, "天" to 7,
)

private val RELATIVE_RE = Regex("(大后天|今天|明天|后天)")
private val WEEKDAY_RE = Regex("(?:周|星期)([一二三四五六日天])")
private val MONTH_DAY_RE = Regex("(\\d{1,2})月(\\d{1,2})[日号]")
private val TIME_COLON_RE = Regex("(\\d{1,2})[:：](\\d{2})")
private val TIME_POINT_RE = Regex("(\\d{1,2})\\s*[点時时]")
private val PRIORITY_CN_RE = Regex("[!！]\\s*(高|中|低)")
private val PRIORITY_P_RE = Regex("\\bp([1-4])\\b", RegexOption.IGNORE_CASE)
private val SPACES_RE = Regex("\\s+")

/** 与服务端一致的日期串格式：2026-11-02T19:00:00.000+0800 */
private val STAMP_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ")

/**
 * 极简自然语言解析：今天/明天/后天/大后天、周X、M月D日、10:30 / 10点、!高 / !中 / !低 / p1-p4。
 * 只做本地预填，入库前仍走标准字段。
 */
fun parseQuickInput(input: String, now: LocalDate = LocalDate.now()): QuickParseResult {
    var text = " $input "
    var base: LocalDate? = null
    var hasTime = false
    var hour = 9
    var minute = 0
    var priority = 0

    RELATIVE_RE.find(text)?.let { match ->
        val offset = when (match.groupValues[1]) {
            "今天" -> 0L
            "明天" -> 1L
            "后天" -> 2L
            else -> 3L
        }
        base = now.plusDays(offset)
        text = text.replaceFirst(match.value, " ")
    }

    if (base == null) {
        WEEKDAY_RE.find(text)?.let { match ->
            val target = WEEKDAY_MAP[match.groupValues[1]] ?: now.dayOfWeek.value
            var diff = (target - now.dayOfWeek.value + 7) % 7
            if (diff == 0) diff = 7
            base = now.plusDays(diff.toLong())
            text = text.replaceFirst(match.value, " ")
        }
    }

    if (base == null) {
        MONTH_DAY_RE.find(text)?.let { match ->
            val month = match.groupValues[1].toIntOrNull()
            val day = match.groupValues[2].toIntOrNull()
            if (month != null && day != null) {
                runCatching { LocalDate.of(now.year, month, day) }.getOrNull()?.let { base = it }
            }
            if (base != null) text = text.replaceFirst(match.value, " ")
        }
    }

    val timeMatch = TIME_COLON_RE.find(text) ?: TIME_POINT_RE.find(text)
    if (timeMatch != null) {
        hour = (timeMatch.groupValues[1].toIntOrNull() ?: 9).coerceIn(0, 23)
        minute = timeMatch.groupValues.getOrNull(2)?.takeIf { it.isNotEmpty() }?.toIntOrNull()?.coerceIn(0, 59) ?: 0
        hasTime = true
        text = text.replaceFirst(timeMatch.value, " ")
        if (base == null) base = now
    }

    val priorityMatch = PRIORITY_CN_RE.find(text) ?: PRIORITY_P_RE.find(text)
    if (priorityMatch != null) {
        priority = when (priorityMatch.groupValues[1]) {
            "高", "1" -> 5
            "中", "2" -> 3
            "低", "3" -> 1
            else -> 0
        }
        text = text.replaceFirst(priorityMatch.value, " ")
    }

    val dueDate = base?.let { day ->
        val time = if (hasTime) LocalTime.of(hour, minute) else LocalTime.of(9, 0)
        LocalDateTime.of(day, time).atZone(ZoneId.systemDefault()).toOffsetDateTime().format(STAMP_FORMAT)
    }

    return QuickParseResult(
        title = text.replace(SPACES_RE, " ").trim(),
        dueDate = dueDate,
        priority = priority,
        isAllDay = base != null && !hasTime,
    )
}
