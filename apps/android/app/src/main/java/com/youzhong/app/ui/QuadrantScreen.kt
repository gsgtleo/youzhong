package com.youzhong.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.youzhong.app.data.Task
import kotlin.math.roundToInt

@Composable
fun QuadrantScreen(
    tasks: List<Task>,
    ruleId: String,
    onRuleChange: (String) -> Unit,
    onOpenTask: (Task) -> Unit,
    onMove: (Task, Quadrant) -> Unit,
) {
    val grouped = remember(tasks, ruleId) { tasks.filter { it.status == 0 }.groupBy { Quadrant.of(it, ruleId) } }
    val bounds = remember { mutableStateMapOf<Quadrant, Rect>() }
    var dragTask by remember { mutableStateOf<Task?>(null) }
    var dragPos by remember { mutableStateOf(Offset.Zero) }
    var rootOrigin by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current

    val startDrag: (Task, Offset) -> Unit = { task, point ->
        dragTask = task
        dragPos = point
    }
    val moveDrag: (Offset) -> Unit = { delta -> dragPos += delta }
    val endDrag: () -> Unit = {
        val target = bounds.entries.firstOrNull { it.value.contains(dragPos) }?.key
        if (target != null) dragTask?.let { onMove(it, target) }
        dragTask = null
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(SurfaceBg)
            .onGloballyPositioned { rootOrigin = it.positionInWindow() },
    ) {
        Column(Modifier.fillMaxSize().padding(12.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("四象限", fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                Spacer(Modifier.weight(1f))
                FilterChip(selected = ruleId == "priority", onClick = { onRuleChange("priority") }, label = { Text("按优先级", fontSize = 11.sp) })
                Spacer(Modifier.width(6.dp))
                FilterChip(selected = ruleId == "urgency", onClick = { onRuleChange("urgency") }, label = { Text("优先级+时间", fontSize = 11.sp) })
            }
            Text("拖动任务到别的格子即可调整", fontSize = 10.sp, color = Faint, modifier = Modifier.padding(bottom = 8.dp))

            Row(Modifier.weight(1f).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(listOf(Quadrant.Q1, Quadrant.Q3), listOf(Quadrant.Q2, Quadrant.Q4)).forEach { column ->
                    Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        column.forEach { quadrant ->
                            QuadrantCard(
                                quadrant = quadrant,
                                tasks = grouped[quadrant].orEmpty(),
                                modifier = Modifier.weight(1f).fillMaxWidth(),
                                onOpenTask = onOpenTask,
                                bounds = bounds,
                                onDragStart = startDrag,
                                onDrag = moveDrag,
                                onDrop = endDrag,
                            )
                        }
                    }
                }
            }
        }

        dragTask?.let { task ->
            val local = dragPos - rootOrigin
            Box(
                Modifier
                    .offset {
                        IntOffset(
                            local.x.roundToInt() - with(density) { 50.dp.roundToPx() },
                            local.y.roundToInt() - with(density) { 16.dp.roundToPx() },
                        )
                    }
                    .width(110.dp)
                    .background(Brand, RoundedCornerShape(8.dp))
                    .padding(horizontal = 8.dp, vertical = 6.dp),
            ) {
                Text(task.title, fontSize = 11.sp, color = Color.White, maxLines = 1)
            }
        }
    }
}

@Composable
private fun QuadrantCard(
    quadrant: Quadrant,
    tasks: List<Task>,
    modifier: Modifier,
    onOpenTask: (Task) -> Unit,
    bounds: MutableMap<Quadrant, Rect>,
    onDragStart: (Task, Offset) -> Unit,
    onDrag: (Offset) -> Unit,
    onDrop: () -> Unit,
) {
    Column(
        modifier
            .onGloballyPositioned { bounds[quadrant] = it.boundsInWindow() }
            .background(CardBg, RoundedCornerShape(14.dp))
            .padding(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(6.dp).background(quadrant.color, RoundedCornerShape(3.dp)))
            Spacer(Modifier.width(6.dp))
            Text(quadrant.title, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Ink)
            Spacer(Modifier.weight(1f))
            Text("${tasks.size}", fontSize = 10.sp, color = Faint)
        }
        Text(quadrant.subtitle, fontSize = 9.sp, color = Faint)
        Spacer(Modifier.height(6.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxSize()) {
            items(tasks, key = { it.id }) { task ->
                var rowOrigin by remember { mutableStateOf(Offset.Zero) }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .onGloballyPositioned { rowOrigin = it.positionInWindow() }
                        .background(SurfaceBg, RoundedCornerShape(8.dp))
                        .pointerInput(task.id) {
                            detectDragGestures(
                                onDragStart = { offset -> onDragStart(task, rowOrigin + offset) },
                                onDragEnd = { onDrop() },
                                onDragCancel = { onDrop() },
                            ) { change, delta ->
                                change.consume()
                                onDrag(delta)
                            }
                        }
                        .clickable { onOpenTask(task) }
                        .padding(horizontal = 8.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.width(2.dp).height(16.dp).background(priorityColor(task.priority), RoundedCornerShape(1.dp)))
                    Spacer(Modifier.width(6.dp))
                    Text(task.title, fontSize = 11.sp, maxLines = 2, color = Ink, modifier = Modifier.weight(1f))
                }
            }
            if (tasks.isEmpty()) {
                item { Text("把任务拖到这里", fontSize = 10.sp, color = Faint, modifier = Modifier.padding(vertical = 10.dp)) }
            }
        }
    }
}
