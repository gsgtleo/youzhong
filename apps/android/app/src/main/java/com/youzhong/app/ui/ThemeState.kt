package com.youzhong.app.ui

import com.youzhong.app.data.TokenStore
import kotlinx.coroutines.flow.MutableStateFlow

/** 主题偏好：system / light / dark，持久化在 DataStore */
object ThemeState {
    val mode = MutableStateFlow("system")

    suspend fun load(store: TokenStore) {
        mode.value = store.theme()
    }

    suspend fun update(store: TokenStore, value: String) {
        mode.value = value
        store.saveTheme(value)
    }
}
