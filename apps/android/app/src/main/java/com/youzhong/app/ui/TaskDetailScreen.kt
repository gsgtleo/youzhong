package com.youzhong.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.data.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    initial: Task,
    projects: List<Project>,
    allTags: List<Tag>,
    onBack: () -> Unit,
    onChange: (Task) -> Unit,
    onDelete: (String) -> Unit,
    occurrence: LocalDate? = null,
) {
    var task by remember { mutableStateOf(initial) }
    var tagInput by remember { mutableStateOf("") }
    var subInput by remember { mutableStateOf("") }
    var showDate by remember { mutableStateOf(false) }
    var showTime by remember { mutableStateOf(false) }
    var showRepeat by remember { mutableStateOf(false) }
    var showProject by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }

    fun update(next: Task) {
        task = next
        onChange(next)
    }

    // 标题与备注按输入停顿 600ms 再提交，避免逐字 PATCH
    LaunchedEffect(task.title, task.content) {
        kotlinx.coroutines.delay(600)
        onChange(task)
    }

    val due = Dates.parse(task.dueDate)

    /** 改截止时间时按相同偏移平移提醒，避免提醒留在过去时刻而永远不触发 */
    fun shiftReminders(newDue: LocalDateTime): List<com.youzhong.app.data.Reminder> {
        if (task.reminders.isEmpty()) return task.reminders
        val old = due?.toLocalDateTime() ?: return task.reminders
        val delta = java.time.Duration.between(old, newDue).toMillis()
        if (delta == 0L) return task.reminders
        return task.reminders.map { reminder ->
            val at = Dates.parse(reminder.trigger)?.toInstant()?.toEpochMilli()
            if (at == null) {
                reminder
            } else {
                reminder.copy(
                    trigger = Dates.stamp(
                        LocalDateTime.ofInstant(java.time.Instant.ofEpochMilli(at + delta), java.time.ZoneId.systemDefault()),
                    ),
                )
            }
        }
    }

    // 默认只读详情：点右上角「编辑」才进入可修改状态
    if (!editing) {
        TaskDetailView(
            task = task,
            projects = projects,
            occurrence = occurrence,
            onBack = onBack,
            onEdit = { editing = true },
            onEditDate = {
                editing = true
                showDate = true
            },
            onToggleStatus = { update(task.copy(status = if (task.status == 2) 0 else 2)) },
            onToggleItem = { id, checked ->
                update(task.copy(items = task.items.map { if (it.id == id) it.copy(status = if (checked) 2 else 0) else it }))
            },
            onDelete = { onDelete(task.id); onBack() },
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("编辑任务", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "返回") } },
                actions = {
                    IconButton(onClick = { onDelete(task.id); onBack() }) {
                        Icon(Icons.Filled.DeleteOutline, contentDescription = "删除", tint = Color(0xFFE5484D))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                YouzhongCheckbox(
                    checked = task.status == 2,
                    onCheckedChange = { update(task.copy(status = if (task.status == 2) 0 else 2)) },
                )
                TextField(
                    value = task.title,
                    onValueChange = { task = task.copy(title = it) },
                    placeholder = { Text("任务标题") },
                    textStyle = LocalTextStyle.current.copy(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
                    colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent),
                    modifier = Modifier.weight(1f),
                )
            }

            // 清单
            SectionCard("清单") {
                Row(
                    Modifier.fillMaxWidth().clickable { showProject = true },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .background(projects.firstOrNull { it.id == task.projectId }?.color?.toColor() ?: Brand, RoundedCornerShape(3.dp)),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(projects.firstOrNull { it.id == task.projectId }?.name ?: "笔记本", fontSize = 14.sp)
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Faint)
                }
            }

            // 优先级
            SectionCard("优先级") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(5, 3, 1, 0).forEach { p ->
                        FilterChip(
                            selected = task.priority == p,
                            onClick = { update(task.copy(priority = p)) },
                            label = { Text(priorityLabel(p), fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = priorityColor(p).copy(alpha = 0.16f),
                                selectedLabelColor = priorityColor(p),
                            ),
                        )
                    }
                }
            }

            // 日期与时间
            SectionCard("日期") {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(due?.let { "${it.monthValue}月${it.dayOfMonth}日 ${Dates.hhmm(task.dueDate)}" } ?: "未设置", fontSize = 14.sp, color = if (due == null) Faint else Ink)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { showDate = true }) { Text(if (due == null) "选日期" else "改日期") }
                    TextButton(onClick = { showTime = true }) { Text(if (due == null) "选时间" else "改时间") }
                    if (due != null) TextButton(onClick = { update(task.copy(dueDate = null, reminders = emptyList())) }) { Text("清除", color = Color(0xFFE5484D)) }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("全天", fontSize = 13.sp, color = Muted)
                    Spacer(Modifier.width(8.dp))
                    Switch(
                        checked = task.isAllDay,
                        onCheckedChange = { update(task.copy(isAllDay = it, dueDate = due?.toLocalDateTime()?.let { t -> Dates.stamp(t) } ?: task.dueDate)) },
                    )
                }
            }

            // 重复
            SectionCard("重复") {
                Row(
                    Modifier.fillMaxWidth().clickable { showRepeat = true },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Repeat, contentDescription = null, tint = if (task.repeatFlag != null) Brand else Faint, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(repeatLabel(task.repeatFlag), fontSize = 14.sp)
                    Spacer(Modifier.weight(1f))
                    Icon(Icons.Filled.KeyboardArrowRight, contentDescription = null, tint = Faint)
                }
            }

            // 提醒
            SectionCard("提醒") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    listOf(0, 15, 30, 60).forEach { minutes ->
                        FilterChip(
                            selected = false,
                            enabled = due != null,
                            onClick = {
                                val base = due?.toLocalDateTime() ?: Dates.now()
                                val trigger = base.minusMinutes(minutes.toLong())
                                update(task.copy(reminders = listOf(com.youzhong.app.data.Reminder(id = "r${System.currentTimeMillis()}", trigger = Dates.stamp(trigger)))))
                            },
                            label = { Text(if (minutes == 0) "准时" else "提前$minutes 分", fontSize = 11.sp) },
                        )
                    }
                }
                val reminder = task.reminders.firstOrNull()
                val reminderPast = reminder?.let { Dates.parse(it.trigger)?.toInstant()?.toEpochMilli()?.let { at -> at < System.currentTimeMillis() } } ?: false
                Text(
                    reminder?.let { "已设置：${Dates.hhmm(it.trigger)}" + if (reminderPast) "（已过期）" else "" } ?: "未设置",
                    fontSize = 11.sp,
                    color = when {
                        task.reminders.isEmpty() -> Faint
                        reminderPast -> Color(0xFFE5484D)
                        else -> Brand
                    },
                )
            }

            // 标签
            SectionCard("标签") {
                FlowRowSimple(items = (allTags.map { it.name } + task.tags).distinct()) { name ->
                    FilterChip(
                        selected = name in task.tags,
                        onClick = { update(task.copy(tags = if (name in task.tags) task.tags - name else task.tags + name)) },
                        label = { Text(name, fontSize = 12.sp) },
                    )
                }
                OutlinedTextField(
                    value = tagInput,
                    onValueChange = { tagInput = it },
                    placeholder = { Text("新标签，回车添加", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (tagInput.isNotBlank()) {
                    TextButton(onClick = { update(task.copy(tags = (task.tags + tagInput.trim()).distinct())); tagInput = "" }) { Text("添加标签") }
                }
            }

            // 子任务
            SectionCard("子任务") {
                task.items.forEach { item ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        YouzhongCheckbox(
                            checked = item.status == 2,
                            onCheckedChange = { checked ->
                                update(task.copy(items = task.items.map { if (it.id == item.id) it.copy(status = if (checked) 2 else 0) else it }))
                            },
                        )
                        Text(
                            item.title,
                            fontSize = 13.sp,
                            textDecoration = if (item.status == 2) TextDecoration.LineThrough else null,
                            color = if (item.status == 2) Faint else Ink,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { update(task.copy(items = task.items.filter { it.id != item.id })) }) {
                            Icon(Icons.Filled.Close, contentDescription = "删除子任务", tint = Faint, modifier = Modifier.size(14.dp))
                        }
                    }
                }
                OutlinedTextField(
                    value = subInput,
                    onValueChange = { subInput = it },
                    placeholder = { Text("添加子任务，回车确认", fontSize = 12.sp) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    trailingIcon = {
                        IconButton(onClick = {
                            if (subInput.isNotBlank()) {
                                update(task.copy(items = task.items + Subtask(id = "s${System.currentTimeMillis()}", title = subInput.trim())))
                                subInput = ""
                            }
                        }) { Icon(Icons.Filled.Add, contentDescription = "添加") }
                    },
                )
            }

            // 备注
            SectionCard("备注") {
                OutlinedTextField(
                    value = task.content ?: "",
                    onValueChange = { task = task.copy(content = it) },
                    placeholder = { Text("补充背景、链接或验收标准…", fontSize = 13.sp) },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }

    if (showDate) {
        val state = rememberDatePickerState()
        DatePickerDialog(
            onDismissRequest = { showDate = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { millis ->
                    val date = java.time.Instant.ofEpochMilli(millis).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                    val time = due?.toLocalTime() ?: LocalTime.of(9, 0)
                    val newDue = LocalDateTime.of(date, time)
                    update(task.copy(dueDate = Dates.stamp(newDue), reminders = shiftReminders(newDue)))
                    }
                    showDate = false
                }) { Text("确定") }
            },
            dismissButton = { TextButton(onClick = { showDate = false }) { Text("取消") } },
        ) { DatePicker(state = state) }
    }

    if (showTime) {
        val timeState = rememberTimePickerState(
            initialHour = due?.hour ?: 9,
            initialMinute = due?.minute ?: 0,
            is24Hour = true,
        )
        AlertDialog(
            onDismissRequest = { showTime = false },
            title = { Text("选择时间") },
            text = { TimePicker(state = timeState) },
            confirmButton = {
                TextButton(onClick = {
                    val date = due?.toLocalDate() ?: java.time.LocalDate.now()
                    val minute = timeState.minute
                    val newDue = LocalDateTime.of(date, LocalTime.of(timeState.hour, minute))
                    update(
                        task.copy(
                            dueDate = Dates.stamp(newDue),
                            isAllDay = false,
                            reminders = shiftReminders(newDue),
                        ),
                    )
                    showTime = false
                }) { Text("确定") }
            },
            dismissButton = { TextButton(onClick = { showTime = false }) { Text("取消") } },
        )
    }

    if (showRepeat) {
        AlertDialog(
            onDismissRequest = { showRepeat = false },
            title = { Text("重复") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("不重复" to null, "每天" to buildRepeat("DAILY"), "每周" to buildRepeat("WEEKLY"), "每月" to buildRepeat("MONTHLY")).forEach { (label, flag) ->
                        Text(
                            label,
                            fontSize = 14.sp,
                            modifier = Modifier.fillMaxWidth().clickable { update(task.copy(repeatFlag = flag)); showRepeat = false }.padding(vertical = 8.dp),
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showRepeat = false }) { Text("关闭") } },
        )
    }

    if (showProject) {
        AlertDialog(
            onDismissRequest = { showProject = false },
            title = { Text("移动到清单") },
            text = {
                Column {
                    projects.forEach { project ->
                        Text(
                            project.name,
                            fontSize = 14.sp,
                            modifier = Modifier.fillMaxWidth().clickable { update(task.copy(projectId = project.id)); showProject = false }.padding(vertical = 8.dp),
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showProject = false }) { Text("关闭") } },
        )
    }
}

/** 只读详情：标题、日期 + 闹钟、重复周期、子任务、备注；点日期进编辑 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaskDetailView(
    task: Task,
    projects: List<Project>,
    occurrence: LocalDate?,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onEditDate: () -> Unit,
    onToggleStatus: () -> Unit,
    onToggleItem: (String, Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    val due = Dates.parse(task.dueDate)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("任务详情", fontSize = 16.sp, fontWeight = FontWeight.SemiBold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "返回") } },
                actions = {
                    TextButton(onClick = onEdit) { Text("编辑", fontSize = 14.sp, color = Brand) }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Filled.DeleteOutline, contentDescription = "删除", tint = Color(0xFFE5484D))
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                YouzhongCheckbox(checked = task.status == 2, onCheckedChange = { onToggleStatus() })
                Text(
                    task.title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (task.status == 2) Faint else Ink,
                    textDecoration = if (task.status == 2) TextDecoration.LineThrough else null,
                    modifier = Modifier.weight(1f),
                )
            }

            // 日期 + 闹钟：没有日期就整块不展示
            if (due != null) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Row(
                        Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(Brand.copy(alpha = 0.12f))
                            .clickable { onEditDate() }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // 从日历某一天的重复任务点进来时，显示那一天，而不是首次到期日
                        Text(
                            Dates.dayLabel(occurrence ?: due.toLocalDate()),
                            fontSize = 14.sp,
                            color = Brand,
                            fontWeight = FontWeight.Medium,
                        )
                        if (!task.isAllDay) {
                            Spacer(Modifier.width(6.dp))
                            Text(Dates.hhmm(task.dueDate), fontSize = 14.sp, color = Brand)
                        }
                        if (task.reminders.isNotEmpty()) {
                            Spacer(Modifier.width(6.dp))
                            Icon(Icons.Filled.Alarm, contentDescription = "有提醒", tint = Brand, modifier = Modifier.size(16.dp))
                        }
                    }
                    if (task.repeatFlag != null) {
                        Text(
                            "重复：${repeatLabel(task.repeatFlag)}",
                            fontSize = 11.sp,
                            color = Faint,
                            modifier = Modifier.padding(start = 4.dp),
                        )
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(projects.firstOrNull { it.id == task.projectId }?.name ?: "笔记本", fontSize = 12.sp, color = Faint)
                Text("·", fontSize = 12.sp, color = Faint)
                Text(priorityLabel(task.priority), fontSize = 12.sp, color = priorityColor(task.priority))
                if (task.tags.isNotEmpty()) {
                    Text("·", fontSize = 12.sp, color = Faint)
                    Text(task.tags.joinToString(" · "), fontSize = 12.sp, color = Faint)
                }
            }

            if (task.items.isNotEmpty()) {
                SectionCard("子任务 ${task.items.count { it.status == 2 }}/${task.items.size}") {
                    task.items.forEach { item ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            YouzhongCheckbox(checked = item.status == 2, onCheckedChange = { onToggleItem(item.id, it) })
                            Text(
                                item.title,
                                fontSize = 13.sp,
                                color = if (item.status == 2) Faint else Ink,
                                textDecoration = if (item.status == 2) TextDecoration.LineThrough else null,
                            )
                        }
                    }
                }
            }

            if (!task.content.isNullOrBlank()) {
                SectionCard("备注") {
                    Text(task.content.orEmpty(), fontSize = 13.sp, color = Ink)
                }
            }

            Text("点右上角「编辑」可修改时间、提醒与内容", fontSize = 11.sp, color = Faint)
        }
    }
}

@Composable
fun SectionCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(14.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, fontSize = 11.sp, color = Faint)
        content()
    }
}

@Composable
fun FlowRowSimple(items: List<String>, content: @Composable (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        items.chunked(4).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { content(it) }
            }
        }
    }
}

fun String.toColor(): Color = runCatching { Color(android.graphics.Color.parseColor(this)) }.getOrDefault(Brand)
