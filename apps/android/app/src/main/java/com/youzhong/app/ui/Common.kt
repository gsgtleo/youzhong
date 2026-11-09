package com.youzhong.app.ui

import androidx.compose.ui.graphics.Color
import com.youzhong.app.data.Task
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

val Brand = Color(0xFF0E9F8A)

/** 主题调色板：在 MainActivity 组合前调用 applyPalette(dark)，所有界面共用 */
var Ink = Color(0xFF1F2329)
    private set
var Muted = Color(0xFF5A6474)
    private set
var Faint = Color(0xFF98A2B3)
    private set
var LineColor = Color(0xFFE6E8EC)
    private set
var SurfaceBg = Color(0xFFF7F8FA)
    private set
var CardBg = Color(0xFFFFFFFF)
    private set
var IsDark = false
    private set

fun applyPalette(dark: Boolean) {
    IsDark = dark
    if (dark) {
        Ink = Color(0xFFE6E8EC)
        Muted = Color(0xFF9BA3B0)
        Faint = Color(0xFF6B7381)
        LineColor = Color(0xFF2C2F36)
        SurfaceBg = Color(0xFF121316)
        CardBg = Color(0xFF1A1C21)
    } else {
        Ink = Color(0xFF1F2329)
        Muted = Color(0xFF5A6474)
        Faint = Color(0xFF98A2B3)
        LineColor = Color(0xFFE6E8EC)
        SurfaceBg = Color(0xFFF7F8FA)
        CardBg = Color(0xFFFFFFFF)
    }
}

fun priorityColor(priority: Int): Color = when (priority) {
    5 -> Color(0xFFE5484D)
    3 -> Color(0xFFF5A623)
    1 -> Color(0xFF3B82F6)
    else -> Color(0xFFC4CBD6)
}

fun priorityLabel(priority: Int): String = when (priority) {
    5 -> "高"
    3 -> "中"
    1 -> "低"
    else -> "无"
}

object Dates {
    private val zone: ZoneId = ZoneId.systemDefault()
    private val fmt: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ")

    fun parse(value: String?): OffsetDateTime? {
        if (value.isNullOrBlank()) return null
        return runCatching { OffsetDateTime.parse(value.replace(Regex("([+-]\\d{2})(\\d{2})$"), "$1:$2")) }
            .recoverCatching { LocalDateTime.parse(value.take(23)).atZone(zone).toOffsetDateTime() }
            .getOrNull()
    }

    fun stamp(time: LocalDateTime): String = time.atZone(zone).toOffsetDateTime().format(fmt)

    fun now(): LocalDateTime = LocalDateTime.now()

    fun key(value: String?): String? = parse(value)?.toLocalDate()?.toString()

    fun hhmm(value: String?): String = parse(value)?.toLocalTime()?.let { "%02d:%02d".format(it.hour, it.minute) } ?: ""

    fun relative(value: String?, isAllDay: Boolean = false): String {
        val date = parse(value) ?: return "未安排"
        val label = dayLabel(date.toLocalDate())
        return if (isAllDay) label else "$label ${hhmm(value)}".trim()
    }

    /**
     * 日期标签：近 7 天内用「今天 / 明天 / 后天 / N 天后」，更远的直接写日期。
     * 重复任务要按发生日算，不能用首次到期日。
     */
    fun dayLabel(date: LocalDate): String {
        val days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), date)
        return when {
            days == 0L -> "今天"
            days == 1L -> "明天"
            days == 2L -> "后天"
            days in 3..6 -> "$days 天后"
            days == -1L -> "昨天"
            else -> "${date.monthValue}月${date.dayOfMonth}日"
        }
    }

    /** 重复任务在日历某一天的展示：日期取发生日，时间取原任务 */
    fun occurrence(value: String?, date: LocalDate, isAllDay: Boolean = false): String =
        if (isAllDay) "${dayLabel(date)} 全天" else "${dayLabel(date)} ${hhmm(value)}"

    fun isOverdue(task: Task): Boolean {
        if (task.status == 2) return false
        val due = parse(task.dueDate) ?: return false
        return due.toLocalDate().isBefore(LocalDate.now())
    }

    fun isToday(value: String?): Boolean = key(value) == LocalDate.now().toString()
}

fun repeatLabel(flag: String?): String {
    if (flag.isNullOrBlank()) return "不重复"
    val freq = Regex("FREQ=(DAILY|WEEKLY|MONTHLY)").find(flag)?.groupValues?.get(1) ?: return "不重复"
    val interval = Regex("INTERVAL=(\\d+)").find(flag)?.groupValues?.get(1)?.toIntOrNull() ?: 1
    return when (freq) {
        "DAILY" -> if (interval == 1) "每天" else "每 $interval 天"
        "WEEKLY" -> if (interval == 1) "每周" else "每 $interval 周"
        else -> if (interval == 1) "每月" else "每 $interval 个月"
    }
}

fun buildRepeat(freq: String, interval: Int = 1): String = "RRULE:FREQ=$freq;INTERVAL=${maxOf(1, interval)}"

/** 快速添加输入框下方的解析预览：明天 10:00 · 高优先级 */
fun quickParsePreview(result: QuickParseResult): String {
    val dateText = result.dueDate?.let { stamp ->
        Dates.parse(stamp)?.toLocalDate()?.let { Dates.occurrence(stamp, it, result.isAllDay) }
    } ?: "未设置日期"
    val priorityText = if (result.priority == 0) "" else " · ${priorityLabel(result.priority)}优先级"
    return dateText + priorityText
}

/**
 * 把重复任务的截止时间展开成 [from, to] 区间内的所有日期（含首次）。
 * 日历经此不再只显示首次那一条，重复任务也能提前看到后续排期。
 */
fun expandRepeatDates(due: String?, flag: String?, from: LocalDate, to: LocalDate): List<LocalDate> {
    val first = Dates.parse(due)?.toLocalDate() ?: return emptyList()
    if (flag.isNullOrBlank()) return if (!first.isBefore(from) && !first.isAfter(to)) listOf(first) else emptyList()

    val freq = Regex("FREQ=(DAILY|WEEKLY|MONTHLY)").find(flag)?.groupValues?.get(1) ?: "NONE"
    if (freq == "NONE") return if (!first.isBefore(from) && !first.isAfter(to)) listOf(first) else emptyList()
    val interval = (Regex("INTERVAL=(\\d+)").find(flag)?.groupValues?.get(1)?.toIntOrNull() ?: 1).coerceAtLeast(1)

    fun step(date: LocalDate): LocalDate = when (freq) {
        "DAILY" -> date.plusDays(interval.toLong())
        "WEEKLY" -> date.plusWeeks(interval.toLong())
        else -> date.plusMonths(interval.toLong())
    }

    var cursor = first
    var guard = 0
    while (cursor.isBefore(from) && guard < 5000) {
        cursor = step(cursor)
        guard += 1
    }

    val result = mutableListOf<LocalDate>()
    while (!cursor.isAfter(to) && result.size < 400) {
        result += cursor
        cursor = step(cursor)
    }
    return result
}

/** 与网页端一致的两套四象限规则 */
enum class Quadrant(val title: String, val subtitle: String, val color: Color) {
    Q1("重要且紧急", "马上做", Color(0xFFE5484D)),
    Q2("重要不紧急", "计划推进", Color(0xFF3B82F6)),
    Q3("紧急不重要", "尽快处理", Color(0xFFF5A623)),
    Q4("不重要不紧急", "有空再说", Color(0xFF8B95A7));

    companion object {
        fun of(task: Task, ruleId: String): Quadrant {
            val important = task.priority >= 3
            if (ruleId == "priority") {
                return when (task.priority) {
                    5 -> Q1
                    3 -> Q2
                    1 -> Q3
                    else -> Q4
                }
            }
            val due = Dates.parse(task.dueDate)
            val urgent = due != null && due.toInstant().toEpochMilli() <= System.currentTimeMillis() + 48 * 3600_000L
            return when {
                important && urgent -> Q1
                important -> Q2
                urgent -> Q3
                else -> Q4
            }
        }

        fun apply(task: Task, target: Quadrant, ruleId: String): Task {
            if (ruleId == "priority") {
                val priority = when (target) {
                    Q1 -> 5
                    Q2 -> 3
                    Q3 -> 1
                    Q4 -> 0
                }
                return task.copy(priority = priority)
            }
            val due = when (target) {
                Q1 -> Dates.now().withHour(18).withMinute(0).withSecond(0).withNano(0)
                Q2 -> Dates.now().plusDays(3).withHour(18).withMinute(0).withSecond(0).withNano(0)
                Q3 -> Dates.now().withHour(18).withMinute(0).withSecond(0).withNano(0)
                Q4 -> Dates.now().plusDays(7).withHour(18).withMinute(0).withSecond(0).withNano(0)
            }
            val priority = if (target == Q1 || target == Q2) 5 else if (target == Q3) 1 else 0
            return task.copy(priority = priority, dueDate = Dates.stamp(due), isAllDay = false)
        }
    }
}

/**
 * 版本号形如 `1.0.202611081807`（主次版本 + 构建时刻），展示成「1.0 · 2026-11-07 09:29」。
 */
fun formatVersion(value: String?): String {
    if (value.isNullOrBlank()) return "—"
    val match = Regex("^(\\d+\\.\\d+)\\.(\\d{4})(\\d{2})(\\d{2})(\\d{2})(\\d{2})$").find(value) ?: return value
    val parts = match.groupValues
    return "${parts[1]} · ${parts[2]}-${parts[3]}-${parts[4]} ${parts[5]}:${parts[6]}"
}
