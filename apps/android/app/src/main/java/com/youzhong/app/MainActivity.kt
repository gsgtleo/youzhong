package com.youzhong.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import com.youzhong.app.ui.LoginScreen
import com.youzhong.app.ui.MainScreen
import com.youzhong.app.ui.ThemeState
import com.youzhong.app.ui.applyPalette

private val LightColors = lightColorScheme(
    primary = Color(0xFF0E9F8A),
    onPrimary = Color.White,
    background = Color(0xFFF7F8FA),
    surface = Color.White,
    onSurface = Color(0xFF1F2329),
    surfaceVariant = Color(0xFFF1F3F7),
    onSurfaceVariant = Color(0xFF5A6474),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF2FB3A1),
    onPrimary = Color(0xFF10131A),
    background = Color(0xFF121316),
    surface = Color(0xFF1A1C21),
    onSurface = Color(0xFFE6E8EC),
    surfaceVariant = Color(0xFF23252B),
    onSurfaceVariant = Color(0xFF9BA3B0),
)

class MainActivity : ComponentActivity() {

    private val requestNotification = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotification.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        setContent {
            val app = YouzhongApp.from(LocalContext.current)
            val mode by ThemeState.mode.collectAsState()
            val systemDark = isSystemInDarkTheme()
            val dark = when (mode) {
                "dark" -> true
                "light" -> false
                else -> systemDark
            }

            LaunchedEffect(Unit) { ThemeState.load(app.tokenStore) }

            applyPalette(dark)
            MaterialTheme(colorScheme = if (dark) DarkColors else LightColors) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    key(dark) { YouzhongRoot() }
                }
            }
        }
    }
}

private enum class Screen { Login, Main }

@Composable
private fun YouzhongRoot() {
    val context = LocalContext.current
    val app = YouzhongApp.from(context)
    var screen by remember { mutableStateOf<Screen?>(null) }

    LaunchedEffect(Unit) {
        val config = app.tokenStore.load()
        screen = if (config.token.isEmpty()) Screen.Login else Screen.Main
    }

    when (screen) {
        null -> Unit
        Screen.Login -> LoginScreen(onLoggedIn = { screen = Screen.Main })
        Screen.Main -> MainScreen(onLoggedOut = {
            com.youzhong.app.service.LiveService.stop(context)
            screen = Screen.Login
        })
    }
}
