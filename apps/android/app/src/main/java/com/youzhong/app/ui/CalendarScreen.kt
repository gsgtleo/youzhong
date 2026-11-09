package com.youzhong.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.data.Event
import com.youzhong.app.data.Task
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.YearMonth
import kotlin.math.roundToInt

@Composable
fun CalendarScreen(
    tasks: List<Task>,
    events: List<Event>,
    onOpenTask: (Task, LocalDate) -> Unit,
    onRescheduleTask: (Task, LocalDate) -> Unit,
    onRescheduleEvent: (Event, LocalDate) -> Unit,
    onCreateEvent: (Event) -> Unit,
    onUpdateEvent: (Event) -> Unit,
    onDeleteEvent: (String) -> Unit,
) {
    var anchor by remember { mutableStateOf(YearMonth.now()) }
    var selected by remember { mutableStateOf(LocalDate.now()) }
    var creating by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Event?>(null) }

    val bounds = remember { mutableMapOf<LocalDate, Rect>() }
    var dragging by remember { mutableStateOf<Pair<String, String>?>(null) } // kind to id
    var dragTitle by remember { mutableStateOf("") }
    var dragPos by remember { mutableStateOf(Offset.Zero) }
    var rootOrigin by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current

    // 重复任务要展开成当月所有发生日，否则日历只看得到首次那一条
    val taskByDay = remember(tasks, anchor) {
        val start = anchor.atDay(1)
        val end = anchor.atEndOfMonth()
        val map = mutableMapOf<String, MutableList<Task>>()
        tasks.filter { it.status == 0 && !it.dueDate.isNullOrBlank() }.forEach { task ->
            expandRepeatDates(task.dueDate, task.repeatFlag, start, end).forEach { date ->
                map.getOrPut(date.toString()) { mutableListOf() }.add(task)
            }
        }
        map
    }
    val eventByDay = remember(events) { events.groupBy { Dates.key(it.startDate) } }

    val firstDay = anchor.atDay(1)
    val leading = (firstDay.dayOfWeek.value + 6) % 7
    val daysInMonth = anchor.lengthOfMonth()
    val rows = (leading + daysInMonth + 6) / 7
    val dayTasks = taskByDay[selected.toString()].orEmpty()
    val dayEvents = eventByDay[selected.toString()].orEmpty()

    fun finishDrag() {
        val target = bounds.entries.firstOrNull { it.value.contains(dragPos) }?.key
        val current = dragging
        if (target != null && current != null) {
            val (kind, id) = current
            if (kind == "task") tasks.firstOrNull { it.id == id }?.let { onRescheduleTask(it, target) }
            else events.firstOrNull { it.id == id }?.let { onRescheduleEvent(it, target) }
        }
        dragging = null
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(SurfaceBg)
            .onGloballyPositioned { rootOrigin = it.positionInWindow() },
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${anchor.year} 年 ${anchor.monthValue} 月", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Spacer(Modifier.weight(1f))
                IconButton(onClick = { anchor = anchor.minusMonths(1) }) { Icon(Icons.Filled.ChevronLeft, "上月") }
                TextButton(onClick = { anchor = YearMonth.now(); selected = LocalDate.now() }) { Text("今天", fontSize = 12.sp) }
                IconButton(onClick = { anchor = anchor.plusMonths(1) }) { Icon(Icons.Filled.ChevronRight, "下月") }
                IconButton(onClick = { creating = true }) { Icon(Icons.Filled.Add, "新建日程") }
            }

            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
                listOf("一", "二", "三", "四", "五", "六", "日").forEach { label ->
                    Text(label, fontSize = 11.sp, color = Faint, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                }
            }

            Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
                repeat(rows) { row ->
                    Row(Modifier.fillMaxWidth().height(50.dp)) {
                        repeat(7) { col ->
                            val index = row * 7 + col
                            val dayNumber = index - leading + 1
                            val inMonth = dayNumber in 1..daysInMonth
                            val date = if (inMonth) anchor.atDay(dayNumber) else null
                            val isSelected = date == selected
                            val count = date?.let { (taskByDay[it.toString()]?.size ?: 0) + (eventByDay[it.toString()]?.size ?: 0) } ?: 0

                            Box(
                                Modifier
                                    .weight(1f)
                                    .padding(2.dp)
                                    .onGloballyPositioned { if (date != null) bounds[date] = it.boundsInWindow() }
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) Brand.copy(alpha = 0.14f) else Color.Transparent)
                                    .clickable(enabled = date != null) { date?.let { selected = it } },
                                contentAlignment = Alignment.Center,
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        if (inMonth) dayNumber.toString() else "",
                                        fontSize = 13.sp,
                                        color = when {
                                            !inMonth -> Color.Transparent
                                            isSelected -> Brand
                                            date == LocalDate.now() -> Brand
                                            else -> Ink
                                        },
                                        fontWeight = if (isSelected || date == LocalDate.now()) FontWeight.SemiBold else FontWeight.Normal,
                                    )
                                    if (count > 0) Box(Modifier.size(4.dp).background(Brand, RoundedCornerShape(2.dp)))
                                }
                            }
                        }
                    }
                }
            }

            Text(
                "${selected.monthValue} 月 ${selected.dayOfMonth} 日 · ${dayTasks.size + dayEvents.size} 项",
                fontSize = 12.sp,
                color = Muted,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
            )
            Text("长按任务/日程拖到上方日期可改期", fontSize = 10.sp, color = Faint, modifier = Modifier.padding(horizontal = 16.dp))

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(dayEvents, key = { "e_" + it.id }) { event ->
                    var origin by remember { mutableStateOf(Offset.Zero) }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .onGloballyPositioned { origin = it.positionInWindow() }
                            .background(CardBg, RoundedCornerShape(12.dp))
                            .pointerInput(event.id) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        dragging = "event" to event.id
                                        dragTitle = event.summary
                                        dragPos = origin + offset
                                    },
                                    onDragEnd = { finishDrag() },
                                    onDragCancel = { dragging = null },
                                ) { change, delta ->
                                    change.consume()
                                    dragPos += delta
                                }
                            }
                            .clickable { editing = event }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.width(3.dp).height(28.dp).background(event.color.toColor(), RoundedCornerShape(2.dp)))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(event.summary, fontSize = 14.sp, color = Ink)
                            Text(Dates.relative(event.startDate, event.isAllDay), fontSize = 11.sp, color = Faint)
                        }
                    }
                }
                items(dayTasks, key = { "t_" + it.id }) { task ->
                    var origin by remember { mutableStateOf(Offset.Zero) }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .onGloballyPositioned { origin = it.positionInWindow() }
                            .background(CardBg, RoundedCornerShape(12.dp))
                            .pointerInput(task.id) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        dragging = "task" to task.id
                                        dragTitle = task.title
                                        dragPos = origin + offset
                                    },
                                    onDragEnd = { finishDrag() },
                                    onDragCancel = { dragging = null },
                                ) { change, delta ->
                                    change.consume()
                                    dragPos += delta
                                }
                            }
                            .clickable { onOpenTask(task, selected) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(Modifier.width(3.dp).height(28.dp).background(priorityColor(task.priority), RoundedCornerShape(2.dp)))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(task.title, fontSize = 14.sp, color = Ink)
                            // 重复任务在这里是「某一次发生」，日期要按选中那天算，不能用首次到期日
                            Text(
                                Dates.occurrence(task.dueDate, selected, task.isAllDay),
                                fontSize = 11.sp,
                                color = Faint,
                            )
                        }
                    }
                }
                if (dayTasks.isEmpty() && dayEvents.isEmpty()) {
                    item { Text("这一天没有安排，点右上角 + 新建日程", fontSize = 12.sp, color = Faint, modifier = Modifier.padding(vertical = 24.dp)) }
                }
                item { Spacer(Modifier.height(72.dp)) }
            }
        }

        if (dragging != null) {
            val local = dragPos - rootOrigin
            Box(
                Modifier
                    .offset { IntOffset(local.x.roundToInt() - with(density) { 50.dp.roundToPx() }, local.y.roundToInt() - with(density) { 16.dp.roundToPx() }) }
                    .width(110.dp)
                    .background(Brand, RoundedCornerShape(8.dp))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            ) {
                Text(dragTitle, fontSize = 11.sp, color = Color.White, maxLines = 1)
            }
        }
    }

    if (creating) {
        EventEditorDialog(
            event = null,
            date = selected,
            onDismiss = { creating = false },
            onConfirm = { title, start, end, allDay, color ->
                onCreateEvent(
                    Event(
                        id = java.util.UUID.randomUUID().toString().replace("-", "").take(24),
                        summary = title,
                        startDate = Dates.stamp(start),
                        endDate = Dates.stamp(end),
                        isAllDay = allDay,
                        color = color,
                    ),
                )
                creating = false
            },
        )
    }

    editing?.let { current ->
        EventEditorDialog(
            event = current,
            date = Dates.parse(current.startDate)?.toLocalDate() ?: selected,
            onDismiss = { editing = null },
            onConfirm = { title, start, end, allDay, color ->
                onUpdateEvent(
                    current.copy(
                        summary = title,
                        startDate = Dates.stamp(start),
                        endDate = Dates.stamp(end),
                        isAllDay = allDay,
                        color = color,
                    ),
                )
                editing = null
            },
            onDelete = {
                onDeleteEvent(current.id)
                editing = null
            },
        )
    }
}

private val EVENT_COLORS = listOf("#0E9F8A", "#22A06B", "#F59E0B", "#E5484D", "#8B5CF6")

private fun parseHm(value: String): LocalTime? =
    runCatching { LocalTime.parse(value.trim().padStart(5, '0')) }.getOrNull()

/** 日程新建 / 编辑弹窗：同一套表单，编辑态额外提供删除 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EventEditorDialog(
    event: Event?,
    date: LocalDate,
    onDismiss: () -> Unit,
    onConfirm: (String, LocalDateTime, LocalDateTime, Boolean, String) -> Unit,
    onDelete: (() -> Unit)? = null,
) {
    val initialStart = event?.let { Dates.parse(it.startDate)?.toLocalDateTime() } ?: LocalDateTime.of(date, LocalTime.of(10, 0))
    val initialEnd = event?.let { Dates.parse(it.endDate)?.toLocalDateTime() } ?: initialStart.plusHours(1)

    var title by remember(event?.id) { mutableStateOf(event?.summary ?: "") }
    var day by remember(event?.id) { mutableStateOf(initialStart.toLocalDate()) }
    var startText by remember(event?.id) { mutableStateOf("%02d:%02d".format(initialStart.hour, initialStart.minute)) }
    var endText by remember(event?.id) { mutableStateOf("%02d:%02d".format(initialEnd.hour, initialEnd.minute)) }
    var allDay by remember(event?.id) { mutableStateOf(event?.isAllDay ?: false) }
    var color by remember(event?.id) { mutableStateOf(event?.color ?: EVENT_COLORS.first()) }
    var showDatePicker by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    val startTime = parseHm(startText) ?: LocalTime.of(10, 0)
    val endTime = parseHm(endText) ?: LocalTime.of(11, 0)
    val valid = title.isNotBlank() && (allDay || endTime > startTime)

    if (showDatePicker) {
        val state = rememberDatePickerState(
            initialSelectedDateMillis = day.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli(),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                        day = java.time.Instant.ofEpochMilli(millis).atZone(java.time.ZoneOffset.UTC).toLocalDate()
                    }
                    showDatePicker = false
                }) { Text("确定") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("取消") } },
        ) { DatePicker(state = state) }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${if (event == null) "新建日程" else "编辑日程"} · ${day.monthValue}月${day.dayOfMonth}日") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("标题") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("全天", fontSize = 13.sp, color = Muted)
                    Spacer(Modifier.width(8.dp))
                    Switch(checked = allDay, onCheckedChange = { allDay = it })
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { showDatePicker = true }) { Text("改日期") }
                }
                if (!allDay) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = startText,
                            onValueChange = { startText = it },
                            label = { Text("开始 HH:mm") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = endText,
                            onValueChange = { endText = it },
                            label = { Text("结束 HH:mm") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (endTime <= startTime) {
                        Text("结束时间需晚于开始时间", fontSize = 11.sp, color = Color(0xFFE5484D))
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("颜色", fontSize = 12.sp, color = Muted)
                    EVENT_COLORS.forEach { value ->
                        Box(
                            Modifier
                                .size(20.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .border(if (color == value) 2.dp else 0.dp, Ink, RoundedCornerShape(10.dp))
                                .background(value.toColor())
                                .clickable { color = value },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                val start = if (allDay) LocalDateTime.of(day, LocalTime.MIDNIGHT) else LocalDateTime.of(day, startTime)
                val end = if (allDay) LocalDateTime.of(day, LocalTime.of(23, 59)) else LocalDateTime.of(day, endTime)
                onConfirm(title.trim(), start, end, allDay, color)
            }) { Text(if (event == null) "创建" else "保存") }
        },
        dismissButton = {
            Row {
                if (onDelete != null) {
                    TextButton(onClick = { if (confirmDelete) onDelete() else confirmDelete = true }) {
                        Text(if (confirmDelete) "确认删除" else "删除", color = Color(0xFFE5484D))
                    }
                }
                TextButton(onClick = onDismiss) { Text("取消") }
            }
        },
    )
}

fun shiftTaskDate(task: Task, target: LocalDate): Task {
    val time = Dates.parse(task.dueDate)?.toLocalTime() ?: LocalTime.of(9, 0)
    return task.copy(dueDate = Dates.stamp(LocalDateTime.of(target, time)))
}

fun shiftEventDate(event: Event, target: LocalDate): Event {
    val start = Dates.parse(event.startDate) ?: return event
    val diff = java.time.temporal.ChronoUnit.DAYS.between(start.toLocalDate(), target)
    val newStart = start.plusDays(diff)
    val newEnd = Dates.parse(event.endDate)?.plusDays(diff)
    return event.copy(startDate = Dates.stamp(newStart.toLocalDateTime()), endDate = newEnd?.let { Dates.stamp(it.toLocalDateTime()) })
}
