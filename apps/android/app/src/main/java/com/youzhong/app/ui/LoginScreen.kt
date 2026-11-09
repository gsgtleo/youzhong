package com.youzhong.app.ui

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.YouzhongApp
import kotlinx.coroutines.launch

private val brand = Color(0xFF0E9F8A)

@Composable
fun LoginScreen(onLoggedIn: () -> Unit) {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    val scope = rememberCoroutineScope()

    var serverUrl by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var testing by remember { mutableStateOf(false) }
    var loggingIn by remember { mutableStateOf(false) }
    var testState by remember { mutableStateOf("idle") }
    var message by remember { mutableStateOf("填写服务器地址后先点「测试连接」") }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        val saved = app.tokenStore.load().serverUrl
        if (saved.isNotEmpty()) serverUrl = saved
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BrandMark(size = 46.dp)
            Spacer(Modifier.size(12.dp))
            Column {
                Text("有终", fontSize = 24.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onBackground)
                Text(
                    "靡不有初，鲜克有终",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Serif,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text("家庭任务服务器 · 安卓客户端", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            "「靡不有初，鲜克有终」出自《诗经·大雅·荡》：凡事都有开头，却很少有人能坚持到最后。",
            fontSize = 11.sp,
            lineHeight = 17.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 2.dp),
        )
        Spacer(Modifier.height(24.dp))

        OutlinedTextField(
            value = serverUrl,
            onValueChange = { serverUrl = it; testState = "idle" },
            label = { Text("服务器地址") },
            placeholder = { Text("http://服务器IP:10078") },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Cloud, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                onClick = {
                    scope.launch {
                        testing = true
                        message = "正在连接服务器…"
                        runCatching { app.api.ping(serverUrl) }
                            .onSuccess {
                                // 连上就用绿色对勾表示，不再弹「连接成功」文案（服务器信息在设置页可查）
                                testState = "ok"
                                app.tokenStore.saveServer(serverUrl)
                                message = ""
                            }
                            .onFailure { error ->
                                testState = "error"
                                message = "连接失败：${error.message}"
                            }
                        testing = false
                    }
                },
                enabled = !testing,
            ) {
                if (testing) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.size(8.dp))
                }
                Text("测试连接")
            }
            Spacer(Modifier.size(10.dp))
            Icon(
                imageVector = when (testState) {
                    "ok" -> Icons.Filled.CheckCircle
                    "error" -> Icons.Filled.ErrorOutline
                    else -> Icons.Filled.Cloud
                },
                contentDescription = null,
                tint = when (testState) {
                    "ok" -> Color(0xFF22A06B)
                    "error" -> Color(0xFFE5484D)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier.size(18.dp),
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(message, fontSize = 12.sp, color = if (testState == "error") Color(0xFFE5484D) else MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(18.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("用户名") },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Person, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("密码") },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null) },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(20.dp))

        Button(
            onClick = {
                scope.launch {
                    loggingIn = true
                    runCatching { app.api.login(serverUrl, username, password) }
                        .onSuccess { session ->
                            app.tokenStore.save(serverUrl, session.token, session.user.displayName)
                            message = "欢迎回来，${session.user.displayName}"
                            onLoggedIn()
                        }
                        .onFailure { message = it.message ?: "登录失败"; testState = "error" }
                    loggingIn = false
                }
            },
            enabled = !loggingIn,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(Brush.horizontalGradient(listOf(brand, Color(0xFF0B7969))), RoundedCornerShape(14.dp)),
            shape = RoundedCornerShape(14.dp),
        ) {
            if (loggingIn) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                Spacer(Modifier.size(8.dp))
            }
            Text(if (loggingIn) "登录中…" else "登录", fontSize = 16.sp, color = Color.White)
        }

        Spacer(Modifier.height(10.dp))
        Text("账号由管理员在服务端创建；测试连接失败请检查 IP、端口与防火墙", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
