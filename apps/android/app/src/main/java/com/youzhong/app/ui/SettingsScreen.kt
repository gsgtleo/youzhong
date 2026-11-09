package com.youzhong.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.runtime.collectAsState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.YouzhongApp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.youzhong.app.calendar.CalendarSyncConfig
import com.youzhong.app.calendar.SystemCalendar
import com.youzhong.app.calendar.SystemCalendarInfo
import com.youzhong.app.data.Channel
import com.youzhong.app.data.PingResult
import com.youzhong.app.data.VersionInfo
import kotlinx.coroutines.delay
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.youzhong.app.data.ChannelPayload
import com.youzhong.app.notify.Notifier
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit, onLoggedOut: () -> Unit) {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    val scope = rememberCoroutineScope()

    var serverUrl by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var channels by remember { mutableStateOf<List<Channel>>(emptyList()) }
    var dialogOpen by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    val themeMode by ThemeState.mode.collectAsState()

    LaunchedEffect(Unit) {
        val config = app.tokenStore.load()
        serverUrl = config.serverUrl
        displayName = app.tokenStore.displayName()
        runCatching { app.api.channels() }.onSuccess { channels = it }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("设置", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "返回") }
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
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(16.dp),
            ) {
                Text(displayName.ifEmpty { "已登录" }, fontWeight = FontWeight.SemiBold)
                Text(serverUrl, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = {
                    scope.launch {
                        app.api.logout()
                        onLoggedOut()
                    }
                }) { Text("退出登录") }
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(16.dp),
            ) {
                Text("外观", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("light" to "浅色", "dark" to "深色", "system" to "跟随系统").forEach { (value, label) ->
                        FilterChip(
                            selected = themeMode == value,
                            onClick = { scope.launch { ThemeState.update(app.tokenStore, value) } },
                            label = { Text(label, fontSize = 11.sp) },
                        )
                    }
                }
            }

            VersionCard(serverUrl = serverUrl, modifier = Modifier.fillMaxWidth())

            CalendarSyncCard(modifier = Modifier.fillMaxWidth())

            NotificationSelfTest(modifier = Modifier.fillMaxWidth())

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Notifications, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.size(6.dp))
                    Text("通知渠道", fontWeight = FontWeight.Medium)
                }
                TextButton(onClick = { dialogOpen = true }) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Text("新建")
                }
            }

            if (channels.isEmpty()) {
                Text(
                    "还没有渠道。添加钉钉或飞书群机器人后，到期提醒与每日汇总会同步推送到群里。",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            channels.forEach { channel ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("${if (channel.type == "feishu") "飞书" else "钉钉"} · ${channel.name}", fontSize = 14.sp)
                        Text(
                            if (channel.enabled) "已启用" else "已停用",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    OutlinedButton(onClick = {
                        scope.launch {
                            message = runCatching { app.api.testChannel(channel.id) }.getOrElse { it.message ?: "发送失败" }
                        }
                    }) { Text("测试") }
                    IconButton(onClick = {
                        scope.launch {
                            runCatching { app.api.deleteChannel(channel.id) }.onSuccess { channels = channels.filter { it.id != channel.id } }
                        }
                    }) { Icon(Icons.Filled.Delete, contentDescription = "删除", tint = Color(0xFFE5484D)) }
                }
            }

            if (message.isNotEmpty()) {
                Text(message, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            }

            Text(
                "提醒机制：App 每 15 分钟后台同步一次并检查 30 分钟内到期的任务；钉钉/飞书由服务端推送，网页端也能收到同一份配置。",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (dialogOpen) {
        ChannelCreateDialog(
            onDismiss = { dialogOpen = false },
            onCreate = { payload ->
                scope.launch {
                    runCatching { app.api.createChannel(payload) }
                        .onSuccess {
                            channels = app.api.channels()
                            message = "渠道已创建，可点「测试」验证"
                        }
                        .onFailure { message = it.message ?: "创建失败" }
                    dialogOpen = false
                }
            },
        )
    }
}

@Composable
private fun ChannelCreateDialog(onDismiss: () -> Unit, onCreate: (ChannelPayload) -> Unit) {
    var type by remember { mutableStateOf("dingtalk") }
    var name by remember { mutableStateOf("") }
    var webhook by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }
    var dueEnabled by remember { mutableStateOf(true) }
    var dailyEnabled by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("新建通知渠道") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { type = "dingtalk" }, enabled = type != "dingtalk") { Text("钉钉") }
                    OutlinedButton(onClick = { type = "feishu" }, enabled = type != "feishu") { Text("飞书") }
                }
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("渠道名称") }, singleLine = true)
                OutlinedTextField(value = webhook, onValueChange = { webhook = it }, label = { Text("Webhook 地址") }, singleLine = true)
                OutlinedTextField(value = secret, onValueChange = { secret = it }, label = { Text("加签密钥（可选）") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = dueEnabled, onCheckedChange = { dueEnabled = it })
                    Text("到期提醒", fontSize = 12.sp)
                    Spacer(Modifier.size(8.dp))
                    Switch(checked = dailyEnabled, onCheckedChange = { dailyEnabled = it })
                    Text("每日汇总", fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = name.isNotBlank() && webhook.startsWith("http"),
                onClick = {
                    val events = buildList {
                        if (dueEnabled) add("due")
                        if (dailyEnabled) add("daily")
                    }
                    onCreate(ChannelPayload(type = type, name = name.trim(), webhook = webhook.trim(), secret = secret.ifBlank { null }, events = events))
                },
            ) { Text("创建") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("取消") } },
    )
}

@Composable
private fun VersionCard(serverUrl: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    val scope = rememberCoroutineScope()
    var info by remember { mutableStateOf<VersionInfo?>(null) }
    var ping by remember { mutableStateOf<PingResult?>(null) }
    var checking by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf("") }

    val pkg = remember { runCatching { context.packageManager.getPackageInfo(context.packageName, 0) }.getOrNull() }
    val versionName = pkg?.versionName ?: "?"
    @Suppress("DEPRECATION")
    val versionCode = pkg?.let { if (Build.VERSION.SDK_INT >= 28) it.longVersionCode else it.versionCode.toLong() } ?: 0L

    fun check(notify: Boolean) {
        if (serverUrl.isBlank()) {
            if (notify) note = "还没填写服务器地址"
            return
        }
        scope.launch {
            checking = true
            // 连接状态：ping 通就显示服务器名与人数，失败显示未连接
            runCatching { app.api.ping(serverUrl) }
                .onSuccess { ping = it }
                .onFailure { ping = null }
            runCatching { app.api.version(serverUrl) }
                .onSuccess { loaded ->
                    info = loaded
                    note = ""
                    if (notify) {
                        val latest = loaded.apk?.version
                        note = when {
                            latest == null -> "服务端 ${loaded.server}，暂无安装包"
                            latest != versionName -> "发现新版本 $latest，点下面按钮下载覆盖安装"
                            else -> "已是最新版本（$latest）"
                        }
                    }
                }
                .onFailure { if (notify) note = "检查失败：${it.message}" }
            checking = false
        }
    }

    LaunchedEffect(serverUrl) { check(false) }

    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Text("版本", fontWeight = FontWeight.Medium, fontSize = 14.sp)
        Spacer(Modifier.height(6.dp))
        val faint = MaterialTheme.colorScheme.onSurfaceVariant
        Text("客户端 ${formatVersion(versionName)}（$versionCode）", fontSize = 12.sp, color = faint)
        Text("服务端 ${formatVersion(info?.server)}", fontSize = 12.sp, color = faint)
        Text("最新安装包 ${formatVersion(info?.apk?.version)}", fontSize = 12.sp, color = faint)
        Spacer(Modifier.height(4.dp))
        ping?.let { current ->
            Text(
                "已连接 · ${current.name} · ${current.userCount} 位用户",
                fontSize = 12.sp,
                color = Color(0xFF22A06B),
            )
        } ?: Text("未连接服务器，检查地址与网络", fontSize = 12.sp, color = Color(0xFFE5484D))
        if (note.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            Text(note, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { check(true) }, enabled = !checking) {
                Text(if (checking) "检查中…" else "检查更新")
            }
            info?.apk?.let { apk ->
                OutlinedButton(onClick = {
                    runCatching {
                        context.startActivity(
                            android.content.Intent(
                                android.content.Intent.ACTION_VIEW,
                                android.net.Uri.parse(serverUrl.trimEnd('/') + apk.url),
                            ),
                        )
                    }
                }) { Text("下载安装包") }
            }
        }
    }
}

private fun formatSyncTime(millis: Long): String =
    java.text.SimpleDateFormat("MM-dd HH:mm", java.util.Locale.getDefault()).format(java.util.Date(millis))

/** 同步到手机系统日历：开关 / 选日历 / 范围 / 立即同步 / 上次结果 */
@Composable
private fun CalendarSyncCard(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    val scope = rememberCoroutineScope()
    var config by remember { mutableStateOf(CalendarSyncConfig()) }
    var calendars by remember { mutableStateOf<List<SystemCalendarInfo>>(emptyList()) }
    var picking by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf("") }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result.values.all { it }) {
            calendars = SystemCalendar.writableCalendars(context)
            if (calendars.isEmpty()) note = "系统里没有可写日历，请先在手机日历里添加账户"
            else picking = true
        } else {
            note = "没有日历读写权限，无法开启同步"
        }
    }

    fun openPicker() {
        if (SystemCalendar.hasPermission(context)) {
            calendars = SystemCalendar.writableCalendars(context)
            if (calendars.isEmpty()) note = "系统里没有可写日历，请先在手机日历里添加账户" else picking = true
        } else {
            launcher.launch(
                arrayOf(android.Manifest.permission.READ_CALENDAR, android.Manifest.permission.WRITE_CALENDAR),
            )
        }
    }

    LaunchedEffect(Unit) { config = app.calendarSyncStore.load() }

    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("同步到手机日历", fontWeight = FontWeight.Medium, fontSize = 14.sp)
                Text(
                    config.calendarName.ifBlank { "未选择日历" },
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = config.enabled,
                onCheckedChange = { enabled ->
                    if (enabled) {
                        openPicker()
                    } else {
                        scope.launch {
                            app.calendarSyncStore.setEnabled(false)
                            YouzhongApp.cancelCalendarExport(context)
                            config = app.calendarSyncStore.load()
                            note = "已关闭每日同步，系统日历里由有终写入的条目会保留到下次开启"
                        }
                    }
                },
            )
        }

        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(3, 7, 14, 30).forEach { days ->
                FilterChip(
                    selected = config.rangeDays == days,
                    onClick = {
                        scope.launch {
                            app.calendarSyncStore.setRange(days)
                            config = app.calendarSyncStore.load()
                        }
                    },
                    label = { Text("$days 天", fontSize = 11.sp) },
                )
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { openPicker() }) { Text("选择日历", fontSize = 12.sp) }
            OutlinedButton(
                enabled = config.enabled && config.calendarId != 0L,
                onClick = {
                    YouzhongApp.exportCalendarNow(context)
                    note = "已开始同步，稍后这里会显示结果"
                    scope.launch {
                        delay(4000)
                        config = app.calendarSyncStore.load()
                    }
                },
            ) { Text("立即同步", fontSize = 12.sp) }
        }

        Spacer(Modifier.height(6.dp))
        val status = when {
            config.lastError.isNotBlank() -> "上次失败：${config.lastError}"
            config.lastSyncAt > 0L -> "上次同步 ${formatSyncTime(config.lastSyncAt)} · 写入 ${config.lastCount} 条"
            else -> "每天 ${config.hour}:00 自动同步，只写未来 ${config.rangeDays} 天未完成且有截止时间的任务"
        }
        Text(status, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (note.isNotBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(note, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
        }
    }

    if (picking) {
        AlertDialog(
            onDismissRequest = { picking = false },
            title = { Text("选择要写入的日历") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    calendars.forEach { item ->
                        TextButton(onClick = {
                            scope.launch {
                                app.calendarSyncStore.setCalendar(item.id, item.displayName)
                                app.calendarSyncStore.setEnabled(true)
                                YouzhongApp.scheduleCalendarExport(context)
                                YouzhongApp.exportCalendarNow(context)
                                config = app.calendarSyncStore.load()
                            }
                            picking = false
                            note = "已开启，每天 3:00 同步到「${item.displayName}」"
                        }) { Text("${item.displayName}（${item.accountName}）", fontSize = 12.sp) }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { picking = false }) { Text("取消") } },
        )
    }
}

@Composable
private fun NotificationSelfTest(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var status by remember { mutableStateOf("") }

    val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    } else true
    val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()

    val app = com.youzhong.app.YouzhongApp.from(context)
    var skewMinutes by remember { mutableStateOf<Long?>(null) }
    LaunchedEffect(Unit) {
        runCatching { app.api.snapshot() }.onSuccess { snap ->
            val serverMs = runCatching { java.time.Instant.parse(snap.serverTime).toEpochMilli() }.getOrNull()
            if (serverMs != null) skewMinutes = (System.currentTimeMillis() - serverMs) / 60000
        }
    }

    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Text("通知自检", fontWeight = FontWeight.Medium, fontSize = 14.sp)
        Spacer(Modifier.height(4.dp))
        Text(
            if (granted) "通知权限：已授予" else "通知权限：未授予，请到系统设置里允许通知",
            fontSize = 11.sp,
            color = if (granted) Muted else Color(0xFFE5484D),
        )
        Text(
            if (enabled) "系统通知总开关：开启" else "系统通知总开关：关闭",
            fontSize = 11.sp,
            color = if (enabled) Muted else Color(0xFFE5484D),
        )
        Text(
            when {
                skewMinutes == null -> "设备与服务器时间：检测中…"
                kotlin.math.abs(skewMinutes!!) >= 2 -> "设备比服务器${if (skewMinutes!! > 0) "快" else "慢"} ${kotlin.math.abs(skewMinutes!!)} 分钟，提醒会偏移，请校准手机时间"
                else -> "设备与服务器时间一致（偏差 ${skewMinutes} 分钟）"
            },
            fontSize = 11.sp,
            color = if (skewMinutes != null && kotlin.math.abs(skewMinutes!!) >= 2) Color(0xFFE5484D) else Muted,
        )
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = {
            // 引导用户把 App 加入「不受限制」名单，避免后台被系统清理
            val intents = listOf(
                android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, android.net.Uri.parse("package:${context.packageName}")),
                android.content.Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
            )
            intents.forEach { intent ->
                runCatching { context.startActivity(intent) }
            }
        }) { Text("允许后台常驻") }
        Spacer(Modifier.height(6.dp))
        OutlinedButton(onClick = {
            Notifier.ensureChannel(context)
            Notifier.post(context, 9001, "通知自检", "看到这条通知说明本地提醒链路是通的")
            status = "已发送，若 5 秒内没有弹出，请检查系统「通知管理」里本应用是否被设为静默"
        }) { Text("发送测试通知") }
        if (status.isNotEmpty()) {
            Text(status, fontSize = 11.sp, color = Brand, modifier = Modifier.padding(top = 6.dp))
        }
    }
}
