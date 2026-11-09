package com.youzhong.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

private val Context.dataStore by preferencesDataStore(name = "youzhong_client")

class ApiException(message: String) : Exception(message)

/** 登录态失效（401）：客户端应退回登录页 */
class UnauthorizedException : Exception("登录已过期，请重新登录")

data class ServerConfig(val serverUrl: String, val token: String)

/** 服务器地址与 token 持久化：登录页可随时改服务器 */
class TokenStore(private val context: Context) {
    companion object {
        private val KEY_SERVER = stringPreferencesKey("server_url")
        private val KEY_TOKEN = stringPreferencesKey("token")
        private val KEY_USER = stringPreferencesKey("display_name")
        private val KEY_THEME = stringPreferencesKey("theme")
    }

    suspend fun theme(): String = context.dataStore.data.map { it[KEY_THEME] ?: "system" }.first()

    suspend fun saveTheme(value: String) {
        context.dataStore.edit { it[KEY_THEME] = value }
    }

    suspend fun load(): ServerConfig {
        val prefs = context.dataStore.data.first()
        return ServerConfig(prefs[KEY_SERVER] ?: "", prefs[KEY_TOKEN] ?: "")
    }

    suspend fun displayName(): String = context.dataStore.data.map { it[KEY_USER] ?: "" }.first()

    suspend fun save(serverUrl: String, token: String, displayName: String = "") {
        context.dataStore.edit {
            it[KEY_SERVER] = serverUrl.trimEnd('/')
            it[KEY_TOKEN] = token
            if (displayName.isNotEmpty()) it[KEY_USER] = displayName
        }
    }

    suspend fun saveServer(serverUrl: String) {
        context.dataStore.edit { it[KEY_SERVER] = serverUrl.trimEnd('/') }
    }

    suspend fun clearToken() {
        context.dataStore.edit { it[KEY_TOKEN] = "" }
    }
}

private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
    explicitNulls = false
}

private val client = OkHttpClient.Builder()
    .connectTimeout(8, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .build()

/** 轻量 HTTP 封装：Android 端只依赖 /api 契约，不内嵌任何业务规则 */
class YouzhongApi(private val tokenStore: TokenStore) {

    /**
     * 所有网络调用统一切到 IO 线程：
     * OkHttp 的 execute() 是阻塞调用，如果直接在 Compose 的 Main 调度器里跑，
     * 会触发 NetworkOnMainThreadException 并让界面卡死（ANR）。
     */
    private suspend fun call(
        serverUrl: String,
        path: String,
        method: String = "GET",
        body: String? = null,
        auth: Boolean = true,
        timeoutSeconds: Long = 20,
    ): String = withContext(Dispatchers.IO) {
        try {
            callInner(serverUrl, path, method, body, auth, timeoutSeconds)
        } catch (error: ApiException) {
            throw error
        } catch (error: java.net.UnknownHostException) {
            throw ApiException("找不到服务器：${serverUrl.ifBlank { "未填写地址" }}，请检查 IP 是否正确")
        } catch (error: java.net.ConnectException) {
            throw ApiException("无法连接 ${serverUrl}：端口未开放或不在同一网络")
        } catch (error: java.net.SocketTimeoutException) {
            throw ApiException("连接超时：${serverUrl}，请检查防火墙与网络")
        } catch (error: java.io.IOException) {
            throw ApiException("网络错误：${error.message ?: "请稍后重试"}")
        }
    }

    private suspend fun callInner(
        serverUrl: String,
        path: String,
        method: String,
        body: String?,
        auth: Boolean,
        timeoutSeconds: Long,
    ): String {
        val base = serverUrl.trimEnd('/').ifEmpty { throw ApiException("请先填写服务器地址") }
        val token = if (auth) tokenStore.load().token else ""
        val builder = Request.Builder()
            .url("$base/api$path")
            .header("Content-Type", "application/json")
            .header("X-Requested-With", "youzhong-android")
        if (token.isNotEmpty()) builder.header("Authorization", "Bearer $token")
        val payload = body?.toRequestBody("application/json".toMediaType())
        val request = when (method) {
            "POST" -> builder.post(payload ?: "{}".toRequestBody("application/json".toMediaType()))
            "PATCH" -> builder.patch(payload ?: "{}".toRequestBody("application/json".toMediaType()))
            "PUT" -> builder.put(payload ?: "{}".toRequestBody("application/json".toMediaType()))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }.build()

        val fastClient = if (timeoutSeconds == 20L) client else client.newBuilder().readTimeout(timeoutSeconds, TimeUnit.SECONDS).build()
        val response = fastClient.newCall(request).execute()
        val text = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            if (response.code == 401) throw UnauthorizedException()
            val message = runCatching { json.decodeFromString(ApiErrorBody.serializer(), text).error?.message }
                .getOrNull() ?: "请求失败（${response.code}）"
            throw ApiException(message)
        }
        return text
    }

    suspend fun ping(serverUrl: String): PingResult {
        val text = call(serverUrl, "/ping", auth = false, timeoutSeconds = 8)
        return json.decodeFromString(PingResult.serializer(), text)
    }

    suspend fun login(serverUrl: String, username: String, password: String): AuthSession {
        val body = Json.encodeToString(LoginPayload.serializer(), LoginPayload(username.trim(), password))
        val text = call(serverUrl, "/auth/login", "POST", body, auth = false)
        return json.decodeFromString(AuthSession.serializer(), text)
    }

    /** 版本信息：客户端用它和当前版本比对，提示是否有新安装包 */
    suspend fun version(serverUrl: String): VersionInfo {
        val text = call(serverUrl, "/version", auth = false, timeoutSeconds = 8)
        return json.decodeFromString(VersionInfo.serializer(), text)
    }

    suspend fun snapshot(): Snapshot {
        val config = tokenStore.load()
        return json.decodeFromString(Snapshot.serializer(), call(config.serverUrl, "/snapshot"))
    }

    suspend fun toggleTask(task: Task): Task {
        val config = tokenStore.load()
        val updated = task.copy(status = if (task.status == 2) 0 else 2)
        val body = json.encodeToString(TaskWrapper.serializer(), TaskWrapper(updated))
        call(config.serverUrl, "/tasks/${task.id}", "PATCH", body)
        return updated
    }

    suspend fun notifications(since: Long): NoticeList {
        val config = tokenStore.load()
        return json.decodeFromString(NoticeList.serializer(), call(config.serverUrl, "/notifications?since=$since"))
    }

    suspend fun markAllRead() {
        val config = tokenStore.load()
        call(config.serverUrl, "/notifications/read", "POST", "{}")
    }

    suspend fun channels(): List<Channel> {
        val config = tokenStore.load()
        return json.decodeFromString(ChannelList.serializer(), call(config.serverUrl, "/channels")).channels
    }

    suspend fun createChannel(payload: ChannelPayload): Channel {
        val config = tokenStore.load()
        val body = json.encodeToString(ChannelPayload.serializer(), payload)
        val text = call(config.serverUrl, "/channels", "POST", body)
        return json.decodeFromString(ChannelWrapper.serializer(), text).channel
    }

    suspend fun testChannel(id: String): String {
        val config = tokenStore.load()
        val text = call(config.serverUrl, "/channels/$id/test", "POST", "{}", timeoutSeconds = 25)
        return runCatching { json.decodeFromString(TestResult.serializer(), text).message }.getOrDefault("测试消息已发送")
    }

    suspend fun deleteChannel(id: String) {
        val config = tokenStore.load()
        call(config.serverUrl, "/channels/$id", "DELETE")
    }

    suspend fun createTask(task: Task): Task {
        val config = tokenStore.load()
        val body = json.encodeToString(TaskWrapper.serializer(), TaskWrapper(task))
        return json.decodeFromString(Task.serializer(), call(config.serverUrl, "/tasks", "POST", body))
    }

    suspend fun updateTask(task: Task): Task {
        val config = tokenStore.load()
        val body = json.encodeToString(TaskWrapper.serializer(), TaskWrapper(task))
        return json.decodeFromString(Task.serializer(), call(config.serverUrl, "/tasks/${task.id}", "PATCH", body))
    }

    suspend fun deleteTask(id: String) {
        val config = tokenStore.load()
        call(config.serverUrl, "/tasks/$id", "DELETE")
    }

    suspend fun createProject(name: String): Project {
        val config = tokenStore.load()
        val body = json.encodeToString(ProjectPayload.serializer(), ProjectPayload(name))
        return json.decodeFromString(Project.serializer(), call(config.serverUrl, "/projects", "POST", body))
    }

    suspend fun createEvent(event: Event): Event {
        val config = tokenStore.load()
        val body = json.encodeToString(EventWrapper.serializer(), EventWrapper(event))
        return json.decodeFromString(Event.serializer(), call(config.serverUrl, "/events", "POST", body))
    }

    suspend fun updateEvent(event: Event): Event {
        val config = tokenStore.load()
        val body = json.encodeToString(EventWrapper.serializer(), EventWrapper(event))
        return json.decodeFromString(Event.serializer(), call(config.serverUrl, "/events/${event.id}", "PATCH", body))
    }

    suspend fun deleteEvent(id: String) {
        val config = tokenStore.load()
        call(config.serverUrl, "/events/$id", "DELETE")
    }

    suspend fun loadSettings(): SettingsPayload {
        val config = tokenStore.load()
        return json.decodeFromString(SettingsWrapper.serializer(), call(config.serverUrl, "/settings")).settings
    }

    suspend fun saveSettings(payload: SettingsPayload) {
        val config = tokenStore.load()
        val body = json.encodeToString(SettingsPayload.serializer(), payload)
        call(config.serverUrl, "/settings", "PUT", body)
    }

    suspend fun logout() {
        val config = tokenStore.load()
        runCatching { call(config.serverUrl, "/auth/logout", "POST", "{}") }
        tokenStore.clearToken()
    }
}

@kotlinx.serialization.Serializable
data class ChannelWrapper(val channel: Channel)

@kotlinx.serialization.Serializable
data class TestResult(val ok: Boolean = true, val message: String = "")
