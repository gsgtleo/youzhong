import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CalendarEvent } from '@youzhong/shared';
import { dateKey, formatHHmm, parseDateTime, toDateTime } from '@youzhong/shared';
import { Button, Input } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { createEvent, deleteEvent, updateEvent } from '@/api/mutations';
import { cn } from '@/lib/utils';

const COLORS = ['#0E9F8A', '#22A06B', '#F59E0B', '#E5484D', '#8B5CF6'];

export interface EventEditorProps {
  open: boolean;
  /** 有值即为编辑态 */
  event?: CalendarEvent;
  /** 新建时预填日期 yyyy-MM-dd */
  presetDate?: string;
  /** 新建时预填开始时间 HH:mm */
  presetTime?: string;
  onClose: () => void;
}

interface Draft {
  summary: string;
  date: string;
  start: string;
  end: string;
  isAllDay: boolean;
  color: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

function minutesToTime(total: number): string {
  const capped = Math.min(total, 23 * 60 + 59);
  return `${pad(Math.floor(capped / 60))}:${pad(capped % 60)}`;
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function draftFrom(event?: CalendarEvent, presetDate?: string, presetTime?: string): Draft {
  if (event) {
    const start = parseDateTime(event.startDate) ?? new Date();
    const end = parseDateTime(event.endDate);
    return {
      summary: event.summary,
      date: dateKey(start),
      start: formatHHmm(start),
      end: end ? formatHHmm(end) : minutesToTime(timeToMinutes(formatHHmm(start)) + 60),
      isAllDay: Boolean(event.isAllDay),
      color: event.color ?? '#0E9F8A',
    };
  }
  const start = presetTime ?? '10:00';
  return {
    summary: '',
    date: presetDate ?? dateKey(new Date()),
    start,
    end: minutesToTime(timeToMinutes(start) + 60),
    isAllDay: false,
    color: '#0E9F8A',
  };
}

/** 日程新建 / 编辑弹窗：内置提交中状态与签名去重，避免连点生成重复日程 */
export function EventEditor({ open, event, presetDate, presetTime, onClose }: EventEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(event, presetDate, presetTime));
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastSignature = useRef('');

  useEffect(() => {
    if (!open) return;
    setDraft(draftFrom(event, presetDate, presetTime));
    setConfirmDelete(false);
    setSubmitting(false);
    lastSignature.current = '';
  }, [open, event, presetDate, presetTime]);

  const isValid =
    draft.summary.trim().length > 0 && (draft.isAllDay || timeToMinutes(draft.end) > timeToMinutes(draft.start));

  const submit = async () => {
    if (submitting || !isValid) return;
    const signature = `${draft.summary.trim()}|${draft.date}|${draft.start}|${draft.end}|${draft.isAllDay}`;
    if (signature === lastSignature.current && !event) return; // 双击/连点的第二道防线
    lastSignature.current = signature;
    setSubmitting(true);

    const start = new Date(`${draft.date}T${draft.isAllDay ? '00:00' : draft.start}:00`);
    const end = new Date(`${draft.date}T${draft.isAllDay ? '23:59' : draft.end}:00`);
    try {
      if (event) {
        await updateEvent({
          ...event,
          summary: draft.summary.trim(),
          startDate: toDateTime(start, draft.isAllDay),
          endDate: toDateTime(end, draft.isAllDay),
          isAllDay: draft.isAllDay,
          color: draft.color,
        });
      } else {
        await createEvent({
          summary: draft.summary.trim(),
          startDate: toDateTime(start, draft.isAllDay),
          endDate: toDateTime(end, draft.isAllDay),
          isAllDay: draft.isAllDay,
          color: draft.color,
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!event || submitting) return;
    setSubmitting(true);
    try {
      await deleteEvent(event.id);
      onClose();
    } finally {
      setSubmitting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? '编辑日程' : '新建日程'}
      subtitle="日程与任务会一起出现在日历视图中"
      footer={
        <>
          {event ? (
            <Button
              variant={confirmDelete ? 'danger' : 'ghost'}
              size="sm"
              className="mr-auto"
              loading={confirmDelete && submitting}
              onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
            >
              <Trash2 size={13} />
              {confirmDelete ? '确认删除？' : '删除'}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={() => void submit()} loading={submitting} disabled={!isValid}>
            {event ? '保存' : '创建日程'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          autoFocus
          placeholder="日程标题，例如「产品评审会」"
          value={draft.summary}
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          aria-label="日程标题"
        />

        <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
          <span className="text-xs text-muted">全天</span>
          <button
            type="button"
            role="switch"
            aria-checked={draft.isAllDay}
            aria-label="全天日程"
            onClick={() => setDraft({ ...draft, isAllDay: !draft.isAllDay })}
            className={cn(
              'relative h-5 w-9 cursor-pointer rounded-full transition-colors',
              draft.isAllDay ? 'bg-brand' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
                draft.isAllDay ? 'left-[18px]' : 'left-0.5',
              )}
            />
          </button>
        </div>

        <div className={cn('grid gap-2', draft.isAllDay ? 'grid-cols-1' : 'grid-cols-3')}>
          <label className="flex flex-col gap-1 text-2xs text-faint">
            日期
            <input
              type="date"
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              className="h-9 cursor-pointer rounded-xl border border-line bg-panel px-2 text-xs text-ink"
              aria-label="日程日期"
            />
          </label>
          {!draft.isAllDay ? (
            <>
              <label className="flex flex-col gap-1 text-2xs text-faint">
                开始
                <input
                  type="time"
                  value={draft.start}
                  onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                  className="h-9 cursor-pointer rounded-xl border border-line bg-panel px-2 text-xs text-ink"
                  aria-label="开始时间"
                />
              </label>
              <label className="flex flex-col gap-1 text-2xs text-faint">
                结束
                <input
                  type="time"
                  value={draft.end}
                  onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                  className="h-9 cursor-pointer rounded-xl border border-line bg-panel px-2 text-xs text-ink"
                  aria-label="结束时间"
                />
              </label>
            </>
          ) : null}
        </div>

        {!draft.isAllDay && timeToMinutes(draft.end) <= timeToMinutes(draft.start) ? (
          <p className="text-2xs text-red-500">结束时间需要晚于开始时间</p>
        ) : null}

        <div className="flex items-center gap-2">
          <span className="text-2xs text-faint">颜色</span>
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`颜色 ${color}`}
              onClick={() => setDraft({ ...draft, color })}
              className={cn(
                'h-5 w-5 cursor-pointer rounded-full border-2 transition-transform hover:scale-110',
                draft.color === color ? 'border-ink/60' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
