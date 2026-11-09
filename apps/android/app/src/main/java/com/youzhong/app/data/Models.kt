package com.youzhong.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PingResult(
    val ok: Boolean = false,
    val name: String = "",
    val version: String = "",
    val apiVersion: Int = 0,
    val requiresAuth: Boolean = true,
    val userCount: Int = 0,
)

@Serializable
data class User(
    val id: String = "",
    val username: String = "",
    val displayName: String = "",
    val role: String = "member",
    val status: String = "active",
    val timezone: String = "Asia/Shanghai",
)

@Serializable
data class AuthSession(
    val user: User,
    val token: String = "",
    val expiresAt: Long = 0,
)

@Serializable
data class Subtask(
    val id: String = "",
    val title: String = "",
    val status: Int = 0,
)

@Serializable
data class Task(
    val id: String,
    val projectId: String = "inbox",
    val title: String = "",
    val content: String? = null,
    val priority: Int = 0,
    val status: Int = 0,
    val dueDate: String? = null,
    val isAllDay: Boolean = false,
    val tags: List<String> = emptyList(),
    val items: List<Subtask> = emptyList(),
    val reminders: List<Reminder> = emptyList(),
    val repeatFlag: String? = null,
    val modifiedTime: String? = null,
)

@Serializable
data class Reminder(val id: String = "", val trigger: String = "")

@Serializable
data class Project(
    val id: String,
    val name: String = "",
    val color: String = "#0E9F8A",
    val permission: String? = null,
)

@Serializable
data class Event(
    val id: String,
    val summary: String = "",
    val startDate: String = "",
    val endDate: String? = null,
    val isAllDay: Boolean = false,
    val color: String = "#0E9F8A",
    val description: String? = null,
)

@Serializable
data class Tag(val name: String, val color: String? = null)

@Serializable
data class Snapshot(
    val projects: List<Project> = emptyList(),
    val tasks: List<Task> = emptyList(),
    val events: List<Event> = emptyList(),
    val tags: List<Tag> = emptyList(),
    val serverTime: String = "",
    val mode: String = "server",
)

@Serializable
data class SettingsPayload(
    val weekStartsOn: Int = 1,
    val ruleId: String = "priority",
    val reminderMinutes: List<Int> = listOf(15),
    val dailyDigest: Boolean = true,
    val dailyDigestHour: Int = 9,
    val timezone: String = "Asia/Shanghai",
)

@Serializable
data class SettingsWrapper(val settings: SettingsPayload = SettingsPayload())

@Serializable
data class Notice(
    val id: String,
    val kind: String = "due",
    val title: String = "",
    val body: String? = null,
    val taskId: String? = null,
    val createdAt: Long = 0,
    val read: Boolean = false,
)

@Serializable
data class NoticeList(
    val notifications: List<Notice> = emptyList(),
    val unread: Int = 0,
)

@Serializable
data class Channel(
    val id: String,
    val type: String = "dingtalk",
    val name: String = "",
    val enabled: Boolean = true,
    val events: List<String> = emptyList(),
    val lastStatus: String? = null,
    val lastError: String? = null,
    val lastSentAt: Long? = null,
)

@Serializable
data class ChannelList(val channels: List<Channel> = emptyList())

@Serializable
data class ChannelPayload(
    val type: String,
    val name: String,
    val webhook: String,
    val secret: String? = null,
    val events: List<String> = listOf("due"),
    val enabled: Boolean = true,
)

@Serializable
data class LoginPayload(val username: String, val password: String)

@Serializable
data class TaskWrapper(val task: Task)

@Serializable
data class ProjectPayload(val name: String)

@Serializable
data class EventWrapper(val event: Event)

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail? = null)

@Serializable
data class ApiErrorDetail(val code: String = "", val message: String = "", val retryable: Boolean = false)

@Serializable
data class ApkInfo(
    val name: String = "",
    val version: String? = null,
    val size: Long = 0,
    val date: String = "",
    val url: String = "",
)

@Serializable
data class VersionInfo(
    val server: String = "",
    val apiVersion: Int = 0,
    val build: String? = null,
    val apk: ApkInfo? = null,
)

@Serializable
data class ServerSettings(
    @SerialName("reminderMinutes") val reminderMinutes: List<Int> = listOf(15),
    val dailyDigest: Boolean = true,
    val dailyDigestHour: Int = 9,
)
