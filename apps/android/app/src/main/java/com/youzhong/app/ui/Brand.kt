package com.youzhong.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * 品牌标识：与 docs/logo.svg（米色底 + 朱红印章 + 「终」字）一致。
 * 网页端的字形已转成 path；这里用系统衬线字体绘制同一个字，视觉上等价且不必维护路径数据。
 */
private val MarkCream = Color(0xFFF3EDE2)
private val MarkRed = Color(0xFFB23A2E)
private val MarkInk = Color(0xFFFBF4E8)
private val MarkRing = Color(0xFFCBD2DC)

@Composable
fun BrandMark(size: Dp = 38.dp, modifier: Modifier = Modifier) {
    // 字形占画布的比例与图标一致：font-size 196 / viewBox 512
    val glyphSize = with(LocalDensity.current) { (size.value * 0.383f).sp }
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val width = this.size.width
            val height = this.size.height
            val unit = minOf(width, height) / 512f
            drawRoundRect(MarkCream, cornerRadius = CornerRadius(116f * unit))
            drawRoundRect(
                MarkRed,
                topLeft = Offset(96f * unit, 96f * unit),
                size = Size(320f * unit, 320f * unit),
                cornerRadius = CornerRadius(40f * unit),
            )
            drawRoundRect(
                MarkCream.copy(alpha = 0.55f),
                topLeft = Offset(122f * unit, 122f * unit),
                size = Size(268f * unit, 268f * unit),
                cornerRadius = CornerRadius(26f * unit),
                style = Stroke(width = 6f * unit),
            )
        }
        Text(
            text = "终",
            color = MarkInk,
            fontSize = glyphSize,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.Bold,
        )
    }
}

/**
 * 任务完成标识：印章本体（与 BrandMark 同一枚，去掉米色留白，小尺寸更清楚）。
 * 未完成时只画一圈细边，保持列表安静。
 */
@Composable
fun YouzhongCheckbox(
    checked: Boolean,
    onCheckedChange: ((Boolean) -> Unit)? = null,
    size: Dp = 20.dp,
    enabled: Boolean = true,
) {
    val glyphSize = with(LocalDensity.current) { (size.value * 0.62f).sp }
    Box(
        modifier = Modifier
            .size(size)
            .clip(if (checked) RoundedCornerShape(size * 0.25f) else CircleShape)
            .then(if (checked) Modifier.background(MarkRed) else Modifier.border(1.5.dp, MarkRing, CircleShape))
            .clickable(enabled = enabled) { onCheckedChange?.invoke(!checked) },
        contentAlignment = Alignment.Center,
    ) {
        if (checked) {
            Text(
                text = "终",
                color = MarkInk,
                fontSize = glyphSize,
                fontFamily = FontFamily.Serif,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
