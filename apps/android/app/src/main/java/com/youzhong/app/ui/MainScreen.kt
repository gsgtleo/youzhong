package com.youzhong.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.YouzhongApp
import com.youzhong.app.data.*
import com.youzhong.app.notify.ReminderScheduler
import com.youzhong.app.service.LiveService
import kotlinx.coroutines.launch
import java.time.LocalDate

private val FILTERS = listOf("today" to "今天", "week" to "最近 7 天", "inbox" to "笔记本", "all" to "全部", "done" to "已完成")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(onLoggedOut: () -> Unit) {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    fun report(error: Throwable) {
        if (error is UnauthorizedException) onLoggedOut()
        else scope.launch { snackbar.showSnackbar(error.message ?: "操作失败") }
    }

    var tasks by remember { mutableStateOf<List<Task>>(emptyList()) }
    var events by remember { mutableStateOf<List<Event>>(emptyList()) }
    var projects by remember { mutableStateOf<List<Project>>(emptyList()) }
    var tags by remember { mutableStateOf<List<Tag>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    var tab by remember { mutableStateOf(0) }
    var filter by remember { mutableStateOf("today") }
    var projectFilter by remember { mutableStateOf<String?>(null) }
    var ruleId by remember { mutableStateOf("priority") }
    var detail by remember { mutableStateOf<Task?>(null) }
    // 从日历某一天点进来的重复任务：记录「这一天的日期」，详情页按它显示
    var detailOccurrence by remember { mutableStateOf<java.time.LocalDate?>(null) }
    var adding by remember { mutableStateOf(false) }
    var newTitle by remember { mutableStateOf("") }
    var showProjectPicker by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }

    suspend fun reload() {
        loading = true
        runCatching { app.api.snapshot() }
            .onSuccess {
                tasks = it.tasks
                events = it.events
                projects = it.projects
                tags = it.tags
                error = null
                // 服务端时间决定提醒时刻；本地闹钟只是「App 未运行」时的兜底
                ReminderScheduler.updateOffset(it.serverTime)
                ReminderScheduler.sync(context, it.tasks)
            }
            .onFailure {
                error = it.message
                report(it)
            }
        runCatching { app.api.loadSettings() }.onSuccess { ruleId = it.ruleId }
        loading = false
    }

    fun replace(next: Task) {
        tasks = tasks.map { if (it.id == next.id) next else it }
    }

    fun persist(next: Task) {
        replace(next)
        scope.launch {
            runCatching { app.api.updateTask(next) }
                .onSuccess { saved ->
                    replace(saved) // 重复任务完成时会返回顺延后的任务
                    ReminderScheduler.sync(context, tasks)
                }
                .onFailure { err ->
                    error = err.message
                    report(err)
                }
        }
    }

    fun replaceEvent(next: Event) {
        events = if (events.any { it.id == next.id }) events.map { if (it.id == next.id) next else it } else events + next
    }

    /** 编辑日程：乐观更新，失败只提示（下一次刷新会纠正） */
    fun updateEvent(next: Event) {
        replaceEvent(next)
        scope.launch {
            runCatching { app.api.updateEvent(next) }
                .onSuccess { saved -> replaceEvent(saved) }
                .onFailure { err ->
                    error = err.message
                    report(err)
                }
        }
    }

    /** 新建日程：失败要回滚，避免留下打不开的幽灵日程 */
    fun createEvent(event: Event) {
        replaceEvent(event)
        scope.launch {
            runCatching { app.api.createEvent(event) }
                .onSuccess { saved -> replaceEvent(saved) }
                .onFailure { err ->
                    events = events.filterNot { it.id == event.id }
                    error = err.message
                    report(err)
                }
        }
    }

    fun deleteEvent(id: String) {
        val backup = events.firstOrNull { it.id == id } ?: return
        events = events.filterNot { it.id == id }
        scope.launch {
            runCatching { app.api.deleteEvent(id) }
                .onFailure { err ->
                    events = events + backup
                    error = err.message
                    report(err)
                }
        }
    }

    LaunchedEffect(Unit) {
        LiveService.start(context) // 前台常驻：保持 SSE，提醒由服务端推送
        reload()
    }

    LaunchedEffect("live") {
        // 其它终端改动 → 服务端广播 → 这里静默刷新
        LiveBus.changes.collect { reload() }
    }

    val inboxId = projects.firstOrNull { it.permission == "inbox" }?.id ?: projects.firstOrNull()?.id ?: "inbox"

    val visible = remember(tasks, filter, projectFilter, inboxId, query) {
        val today = LocalDate.now()
        val keyword = query.trim().lowercase()
        tasks.filter { task ->
            if (keyword.isNotEmpty()) {
                val haystack = buildString {
                    append(task.title.lowercase())
                    append(' ')
                    append(task.content?.lowercase() ?: "")
                    append(' ')
                    append(task.tags.joinToString(" ").lowercase())
                }
                if (!haystack.contains(keyword)) return@filter false
            }
            if (projectFilter != null && task.projectId != projectFilter) return@filter false
            when (filter) {
                "done" -> task.status == 2
                // 未设日期的未完成任务常驻「今天」：不改 dueDate、不生成每日重复；第二天仍未完成就继续显示
                "today" -> task.status == 0 && (Dates.key(task.dueDate)?.let { it <= today.toString() } ?: true)
                "week" -> task.status == 0 && (Dates.key(task.dueDate)?.let { it <= today.plusDays(7).toString() } ?: false)
                "inbox" -> task.status == 0 && task.projectId == inboxId
                else -> task.status == 0
            }
        }.sortedBy { it.dueDate ?: "9999" }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            NavigationBar(containerColor = CardBg, tonalElevation = 0.dp) {
                listOf(
                    "任务" to Icons.Filled.CheckCircle,
                    "日历" to Icons.Filled.CalendarMonth,
                    "四象限" to Icons.Filled.GridView,
                    "我的" to Icons.Filled.Person,
                ).forEachIndexed { index, (label, icon) ->
                    NavigationBarItem(
                        selected = tab == index,
                        onClick = { tab = index },
                        icon = { Icon(icon, contentDescription = label) },
                        label = { Text(label, fontSize = 11.sp) },
                    )
                }
            }
        },
        floatingActionButton = {
            if (tab == 0) {
                FloatingActionButton(onClick = { adding = true }, containerColor = Brand) {
                    Icon(Icons.Filled.Add, contentDescription = "新建任务", tint = Color.White)
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding).background(SurfaceBg)) {
            when {
                loading -> CircularProgressIndicator(Modifier.align(Alignment.Center), strokeWidth = 3.dp)
                tab == 0 -> Column(Modifier.fillMaxSize()) {
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            projects.firstOrNull { it.id == projectFilter }?.name ?: "我的任务",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("${visible.size}", fontSize = 11.sp, color = Faint)
                        Spacer(Modifier.weight(1f))
                        IconButton(onClick = { showProjectPicker = true }) { Icon(Icons.Filled.Folder, "选择清单") }
                        IconButton(onClick = { scope.launch { reload() } }) { Icon(Icons.Filled.Refresh, "刷新") }
                    }
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        FILTERS.forEach { (key, label) ->
                            FilterChip(
                                selected = filter == key,
                                onClick = { filter = key },
                                label = { Text(label, fontSize = 11.sp) },
                            )
                        }
                    }
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = { Text("搜索任务、备注或标签", fontSize = 12.sp) },
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.size(16.dp)) },
                        trailingIcon = {
                            if (query.isNotEmpty()) {
                                IconButton(onClick = { query = "" }) {
                                    Icon(Icons.Filled.Close, contentDescription = "清除搜索", modifier = Modifier.size(16.dp))
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                    if (error != null) {
                        Text(error!!, fontSize = 11.sp, color = Color(0xFFE5484D), modifier = Modifier.padding(16.dp))
                    }
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(visible, key = { it.id }) { task ->
                            TaskRow(task = task, onOpen = { detailOccurrence = null; detail = task }, onToggle = {
                                persist(task.copy(status = if (task.status == 2) 0 else 2))
                            })
                        }
                        if (visible.isEmpty()) {
                            item { Text("这里还没有任务", fontSize = 12.sp, color = Faint, modifier = Modifier.padding(vertical = 24.dp)) }
                        }
                        item { Spacer(Modifier.height(64.dp)) }
                    }
                }
                tab == 1 -> CalendarScreen(
                    tasks = tasks,
                    events = events,
                    onOpenTask = { task, date ->
                        detailOccurrence = date
                        detail = task
                    },
                    onRescheduleTask = { task, date -> persist(shiftTaskDate(task, date)) },
                    onRescheduleEvent = { event, date -> updateEvent(shiftEventDate(event, date)) },
                    onCreateEvent = { event -> createEvent(event) },
                    onUpdateEvent = { event -> updateEvent(event) },
                    onDeleteEvent = { id -> deleteEvent(id) },
                )
                tab == 2 -> QuadrantScreen(
                    tasks = tasks,
                    ruleId = ruleId,
                    onRuleChange = {
                        ruleId = it
                        scope.launch { runCatching { app.api.saveSettings(SettingsPayload(ruleId = it)) } }
                    },
                    onOpenTask = { detailOccurrence = null; detail = it },
                    onMove = { task, quadrant -> persist(Quadrant.apply(task, quadrant, ruleId)) },
                )
                else -> SettingsScreen(onBack = { tab = 0 }, onLoggedOut = onLoggedOut)
            }
        }
    }

    detail?.let { current ->
        TaskDetailScreen(
            initial = tasks.firstOrNull { it.id == current.id } ?: current,
            projects = projects,
            allTags = tags,
            occurrence = detailOccurrence,
            onBack = {
                detail = null
                detailOccurrence = null
            },
            onChange = { persist(it) },
            onDelete = { id ->
                tasks = tasks.filterNot { it.id == id }
                scope.launch {
                    runCatching { app.api.deleteTask(id) }.onFailure { err -> report(err) }
                }
            },
        )
    }

    if (adding) {
        val parsed = remember(newTitle) { parseQuickInput(newTitle) }
        AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text("新建任务") },
            text = {
                Column {
                    OutlinedTextField(
                        value = newTitle,
                        onValueChange = { newTitle = it },
                        placeholder = { Text("明天 10:00 提交周报 !高") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (newTitle.isNotBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            quickParsePreview(parsed),
                            fontSize = 11.sp,
                            color = if (parsed.dueDate != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (newTitle.isNotBlank()) {
                        val title = parsed.title.ifBlank { newTitle.trim() }
                        val task = Task(
                            id = java.util.UUID.randomUUID().toString().replace("-", "").take(24),
                            projectId = projectFilter ?: inboxId,
                            title = title,
                            priority = parsed.priority,
                            dueDate = parsed.dueDate,
                            isAllDay = parsed.isAllDay,
                        )
                        tasks = tasks + task
                        scope.launch {
                            runCatching { app.api.createTask(task) }
                                .onSuccess { saved ->
                                    tasks = tasks.map { if (it.id == task.id) saved else it }
                                    ReminderScheduler.sync(context, tasks)
                                }
                                .onFailure { err ->
                                    tasks = tasks.filterNot { it.id == task.id }
                                    report(err)
                                }
                        }
                    }
                    newTitle = ""
                    adding = false
                }) { Text("创建") }
            },
            dismissButton = { TextButton(onClick = { adding = false }) { Text("取消") } },
        )
    }

    if (showProjectPicker) {
        AlertDialog(
            onDismissRequest = { showProjectPicker = false },
            title = { Text("选择清单") },
            text = {
                Column {
                    Text(
                        "全部清单",
                        fontSize = 14.sp,
                        modifier = Modifier.fillMaxWidth().clickable { projectFilter = null; showProjectPicker = false }.padding(vertical = 10.dp),
                    )
                    projects.forEach { project ->
                        Text(
                            project.name,
                            fontSize = 14.sp,
                            modifier = Modifier.fillMaxWidth().clickable { projectFilter = project.id; showProjectPicker = false }.padding(vertical = 10.dp),
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showProjectPicker = false }) { Text("关闭") } },
        )
    }
}

@Composable
private fun TaskRow(task: Task, onOpen: () -> Unit, onToggle: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(12.dp))
            .clickable { onOpen() }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(3.dp).height(30.dp).background(priorityColor(task.priority), RoundedCornerShape(2.dp)))
        Spacer(Modifier.width(6.dp))
        YouzhongCheckbox(checked = task.status == 2, onCheckedChange = { onToggle() })
        Column(Modifier.weight(1f)) {
            Text(
                task.title,
                fontSize = 14.sp,
                textDecoration = if (task.status == 2) TextDecoration.LineThrough else null,
                color = if (task.status == 2) Faint else Ink,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    Dates.relative(task.dueDate, task.isAllDay),
                    fontSize = 11.sp,
                    color = if (Dates.isOverdue(task)) Color(0xFFE5484D) else Faint,
                )
                if (task.repeatFlag != null) {
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Filled.Repeat, contentDescription = null, tint = Faint, modifier = Modifier.size(11.dp))
                }
                if (task.items.isNotEmpty()) {
                    Spacer(Modifier.width(6.dp))
                    Text("${task.items.count { it.status == 2 }}/${task.items.size}", fontSize = 10.sp, color = Faint)
                }
            }
        }
    }
}
