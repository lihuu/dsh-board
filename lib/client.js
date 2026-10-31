/**
 * dsh-board — browser half (plain JS, no build step).
 *
 * A frame-wide task board for DeepSeek Harness:
 *   - a "看板" row at the sidebar foot opens the overlay,
 *   - tasks are user-authored cards in three columns (待办 / 进行中 / 完成),
 *     each bound to exactly one DSH Session,
 *   - every card shows the Session's live status (空闲 / 运行中 / 等待你确认 /
 *     已完成) and its run duration,
 *   - clicking a card opens that Session's *native* Conversation inside the
 *     same overlay (the shipped `conversation.content` Factory bound through a
 *     SessionProvider), so the page underneath never unmounts,
 *   - keyboard: ↑/↓ moves / switches, Enter opens, Esc backs out one layer.
 *
 * Tasks persist in localStorage; the Session stays the source of truth for the
 * transcript and the live status. The Host half is a no-op.
 */

(function () {
  var PLUGIN_ID = '@lihuu/dsh-board'
  var NS = 'dsh-board'
  var STYLE_ID = 'dsh-board-styles'
  var TASKS_KEY = 'dshBoard.tasks.v1'

  /** Platform modules, bound by the ModuleLoader factory before anything renders. */
  var React = null
  var StateDot = null

  /** Copy for the two shipped locales. */
  var DICTS = {
    zh: {
      open: '任务浮层',
      title: '任务看板',
      subtitle: '{n} 个任务 · {doing} 进行中 · {waiting} 等你确认',
      close: '关闭看板',
      back: '返回看板',
      newTask: '新建任务',
      'col.todo': '待办',
      'col.doing': '进行中',
      'col.done': '完成',
      'col.empty.todo': '把任务写下来，绑定一个会话。',
      'col.empty.doing': '会话来开始跑时，任务会自动移到这里。',
      'col.empty.done': '跑完的任务会落在这里。',
      'column.add': '添加列',
      'column.namePlaceholder': '列名称',
      'column.empty': '把任务拖到这里。',
      'column.renameHint': '双击重命名',
      'column.remove': '删除这一列（任务移到待办）',
      'column.confirmRemove': '确认删除',
      'status.running': '运行中',
      'status.confirm': '等待你确认',
      'status.done': '已完成',
      'status.idle': '空闲',
      'status.noSession': '未绑定会话',
      'time.justNow': '刚刚',
      'time.minutes': '{n} 分钟前',
      'time.hours': '{n} 小时前',
      'time.days': '{n} 天前',
      'card.session': '会话：{title}',
      'card.sessionMissing': '会话不可用（可能已删除）',
      'card.noRun': '未运行',
      'action.open': '打开对话',
      'action.run': '开始执行',
      'action.rerun': '重新执行',
      'action.edit': '编辑',
      'action.delete': '删除',
      'action.confirmDelete': '确认删除？',
      'action.confirm': '删除',
      'action.cancel': '取消',
      'action.answer': '去回答',
      'form.new': '新建任务',
      'form.edit': '编辑任务',
      'form.title': '标题',
      'form.titlePlaceholder': '例如：修复登录跳转',
      'form.note': '备注（会作为第一条指令发送给会话）',
      'form.notePlaceholder': '写清楚要做什么；留空则发送标题。',
      'form.session': '绑定会话',
      'form.mode.new': '新建会话',
      'form.mode.existing': '使用已有会话',
      'form.workspace': '工作区',
      'form.pickSession': '选择会话',
      'form.runNow': '创建后立即执行',
      'form.save': '保存',
      'form.saving': '保存中…',
      'form.requiredTitle': '标题不能为空',
      'form.failed': '创建失败：{message}',
      'form.editBinding': '绑定的会话不可更改',
      'form.noWorkspace': '还没有工作区，请先在左侧新建工作区。',
      'form.noSession': '还没有可用会话。',
      'chat.missing': '这个会话已经不可用了（可能被删除或归档）。',
      'chat.prev': '上一个任务',
      'chat.next': '下一个任务',
      'error.prompt': '发送失败：{message}',
      'hint.board': '↑↓ 选择 · Enter 打开 · N 新建 · Esc 关闭',
      'hint.chat': '↑↓ 切换任务 · Esc 返回看板',
      'error.render': '对话视图渲染失败：{message}',
      'view.board': '看板视图',
      'view.classic': '经典视图',
      'board.search': '搜索会话',
      'board.searchTask': '搜索任务',
      'board.newSession': '新会话',
      'board.empty': '这个工作区还没有会话。',
      'board.noMatch': '没有匹配的会话。',
      'board.noWorkspace': '还没有工作区。先在左侧新建一个工作区。',
      'board.closeDetail': '关闭对话',
    },
    en: {
      open: 'Quick board',
      title: 'Task board',
      subtitle: '{n} tasks · {doing} in progress · {waiting} waiting for you',
      close: 'Close board',
      back: 'Back to board',
      newTask: 'New task',
      'col.todo': 'To do',
      'col.doing': 'In progress',
      'col.done': 'Done',
      'col.empty.todo': 'Write a task down and bind it to a session.',
      'col.empty.doing': 'A task moves here once its session starts running.',
      'col.empty.done': 'Finished tasks land here.',
      'column.add': 'Add column',
      'column.namePlaceholder': 'Column name',
      'column.empty': 'Drop tasks here.',
      'column.renameHint': 'Double-click to rename',
      'column.remove': 'Delete this column (tasks move to To do)',
      'column.confirmRemove': 'Confirm',
      'status.running': 'Running',
      'status.confirm': 'Waiting for you',
      'status.done': 'Done',
      'status.idle': 'Idle',
      'status.noSession': 'No session',
      'time.justNow': 'just now',
      'time.minutes': '{n} min ago',
      'time.hours': '{n} h ago',
      'time.days': '{n} d ago',
      'card.session': 'Session: {title}',
      'card.sessionMissing': 'Session unavailable (deleted?)',
      'card.noRun': 'Not run yet',
      'action.open': 'Open conversation',
      'action.run': 'Start',
      'action.rerun': 'Run again',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.confirmDelete': 'Delete this task?',
      'action.confirm': 'Delete',
      'action.cancel': 'Cancel',
      'action.answer': 'Answer',
      'form.new': 'New task',
      'form.edit': 'Edit task',
      'form.title': 'Title',
      'form.titlePlaceholder': 'e.g. fix the login redirect',
      'form.note': 'Note (sent to the session as its first instruction)',
      'form.notePlaceholder': 'Say what to do; empty sends the title.',
      'form.session': 'Bound session',
      'form.mode.new': 'Create a session',
      'form.mode.existing': 'Use an existing session',
      'form.workspace': 'Workspace',
      'form.pickSession': 'Pick a session',
      'form.runNow': 'Run right after creating',
      'form.save': 'Save',
      'form.saving': 'Saving…',
      'form.requiredTitle': 'Title is required',
      'form.failed': 'Could not create: {message}',
      'form.editBinding': 'The bound session cannot be changed',
      'form.noWorkspace': 'No workspace yet — create one in the sidebar first.',
      'form.noSession': 'No session available yet.',
      'chat.missing': 'This session is no longer available (deleted or archived).',
      'chat.prev': 'Previous task',
      'chat.next': 'Next task',
      'error.prompt': 'Send failed: {message}',
      'hint.board': '↑↓ select · Enter open · N new · Esc close',
      'hint.chat': '↑↓ switch task · Esc back to board',
      'error.render': 'Conversation view failed to render: {message}',
      'view.board': 'Board view',
      'view.classic': 'Classic view',
      'board.search': 'Search sessions',
      'board.searchTask': 'Search tasks',
      'board.newSession': 'New session',
      'board.empty': 'No sessions in this workspace yet.',
      'board.noMatch': 'No matching sessions.',
      'board.noWorkspace': 'No workspace yet — create one in the sidebar first.',
      'board.closeDetail': 'Close conversation',
    },
  }

  // ------------------------------------------------------------------ css ---

  var CSS = [
    '.dsh-board-layer{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;font-family:inherit;color:var(--dsw-alias-label-primary);}',
    '.dsh-board-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.45));backdrop-filter:blur(6px);}',
    '.dsh-board-panel{position:relative;display:flex;flex-direction:column;width:min(1240px,95vw);height:min(88vh,940px);background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;}',
    '.dsh-board-panel[data-view="chat"]{height:min(92vh,980px);}',
    '.dsh-board-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:0 0 auto;}',
    '.dsh-board-head-titles{display:flex;flex-direction:column;gap:2px;min-width:0;}',
    '.dsh-board-title{font-size:16px;font-weight:600;line-height:22px;margin:0;}',
    '.dsh-board-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dsh-board-spacer{flex:1 1 auto;}',
    '.dsh-board-iconbtn{appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;flex:0 0 auto;}',
    '.dsh-board-iconbtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);}',
    '.dsh-board-iconbtn:disabled{opacity:.35;cursor:default;}',
    '.dsh-board-back{gap:6px;width:auto;padding:0 10px;height:30px;font-size:13px;color:var(--dsw-alias-label-secondary);}',
    '.dsh-board-new{height:30px;padding:0 12px;border-radius:8px;border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}',
    '.dsh-board-new:hover{background:var(--dsw-alias-button-primary-hover);}',
    '.dsh-board-body{flex:1 1 auto;min-height:0;display:flex;}',
    '.dsh-board-columns{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px 14px 6px;}',
    '.dsh-board-column[data-drop="true"]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover);}',
    '.dsh-board-mini[data-primary="true"]{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground);}',
    '.dsh-board-column{display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;overflow:hidden;}',
    '.dsh-board-column-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto;}',
    '.dsh-board-col-input{font:inherit;font-size:12.5px;min-width:0;flex:1 1 auto;background:var(--dsw-alias-bg-base);color:inherit;border:1px solid var(--dsw-alias-brand-primary);border-radius:6px;padding:2px 6px;outline:none;}',
    '.dsh-board-col-remove{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:4px;flex:0 0 auto;}',
    '.dsh-board-col-remove-confirm{color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary);border-radius:6px;font-size:10.5px;line-height:16px;padding:0 5px;}',
    '.dsh-board-col-remove:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);}',
    '.dsh-board-column-add{border-style:dashed;background:transparent;align-items:center;justify-content:center;}',
    '.dsh-board-addcol{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12.5px;cursor:pointer;padding:10px;width:100%;height:100%;}',
    '.dsh-board-addcol:hover{color:var(--dsw-alias-label-secondary);}',
    '.dsh-board-column-title{font-size:12.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);cursor:text;}',
    '.dsh-board-column-count{font-size:11.5px;line-height:18px;min-width:18px;text-align:center;padding:0 5px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);}',
    '.dsh-board-column-body{flex:1 1 auto;min-height:0;overflow:auto;padding:8px;display:flex;flex-direction:column;gap:8px;}',
    '.dsh-board-col-empty{padding:18px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);text-align:center;}',
    '.dsh-board-card{display:flex;flex-direction:column;gap:6px;min-width:0;cursor:grab;padding:10px 11px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);cursor:pointer;transition:border-color .12s,background .12s;}',
    '.dsh-board-card:hover{border-color:var(--dsw-alias-border-l3);}',
    '.dsh-board-card[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary);}',
    '.dsh-board-card[data-status="running"]{border-left:3px solid var(--dsw-alias-brand-primary);}',
    '.dsh-board-card[data-status="confirm"]{border-left:3px solid var(--dsw-alias-state-error-primary);}',
    '.dsh-board-card[data-status="done"]{border-left:3px solid var(--dsw-alias-state-success-primary);}',
    '.dsh-board-card-top{display:flex;align-items:center;gap:6px;}',
    '.dsh-board-card-title{font-size:13.5px;font-weight:600;line-height:19px;margin:0;word-break:break-word;}',
    '.dsh-board-card-note{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;word-break:break-word;}',
    '.dsh-board-card-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dsh-board-card-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;row-gap:4px;white-space:nowrap;font-size:11.5px;color:var(--dsw-alias-label-tertiary);}',
    '.dsh-board-card-dur{font-variant-numeric:tabular-nums;}',
    '.dsh-board-card-actions{display:flex;gap:3px;margin-left:auto;flex:0 0 auto;}',
    '.dsh-board-mini{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;font-size:10.5px;line-height:18px;padding:0 5px;cursor:pointer;white-space:nowrap;}',
    '.dsh-board-mini:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}',
    '.dsh-board-mini[data-danger="true"]:hover{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);}',
    '.dsh-board-live{flex:0 0 auto;font-size:10.5px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
    '.dsh-board-live[data-kind="running"]{color:var(--dsw-alias-brand-primary);background:transparent;border:1px solid var(--dsw-alias-brand-primary);}',
    '.dsh-board-live[data-kind="confirm"]{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);}',
    '.dsh-board-chip{flex:0 0 auto;font-size:11px;line-height:19px;padding:0 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
    '.dsh-board-chip[data-kind="running"]{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);}',
    '.dsh-board-chip[data-kind="confirm"]{color:var(--dsw-alias-label-primary-foreground);background:var(--dsw-alias-button-primary-fill);border-color:transparent;}',
    '.dsh-board-chip[data-kind="done"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);}',
    '.dsh-board-dot{flex:0 0 auto;display:inline-flex;width:10px;justify-content:center;}',
    '.dsh-board-foot{flex:0 0 auto;padding:7px 18px;border-top:1px solid var(--dsw-alias-border-l2);font-size:11.5px;color:var(--dsw-alias-label-tertiary);display:flex;gap:14px;align-items:center;}',
    '.dsh-board-notice{margin-left:auto;color:var(--dsw-alias-state-error-primary);}',
    '.dsh-board-form{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.35));z-index:2;}',
    '.dsh-board-form-card{width:min(560px,92%);max-height:88%;overflow:auto;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.3);padding:18px 20px;display:flex;flex-direction:column;gap:12px;}',
    '.dsh-board-form-title{font-size:15px;font-weight:600;margin:0;}',
    '.dsh-board-field{display:flex;flex-direction:column;gap:5px;}',
    '.dsh-board-label{font-size:12px;color:var(--dsw-alias-label-secondary);}',
    '.dsh-board-input,.dsh-board-textarea,.dsh-board-select{font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 9px;outline:none;}',
    '.dsh-board-input:focus,.dsh-board-textarea:focus,.dsh-board-select:focus{border-color:var(--dsw-alias-brand-primary);}',
    '.dsh-board-textarea{resize:vertical;min-height:72px;line-height:18px;}',
    '.dsh-board-radios{display:flex;gap:14px;font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
    '.dsh-board-radios label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;}',
    '.dsh-board-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;}',
    '.dsh-board-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:2px;}',
    '.dsh-board-btn{height:30px;padding:0 14px;border-radius:8px;font-size:13px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);}',
    '.dsh-board-btn[data-primary="true"]{border-color:transparent;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);}',
    '.dsh-board-btn:hover{background:var(--dsw-alias-interactive-bg-hover);}',
    '.dsh-board-btn[data-primary="true"]:hover{background:var(--dsw-alias-button-primary-hover);}',
    '.dsh-board-btn:disabled{opacity:.55;cursor:default;}',
    '.dsh-board-form-error{font-size:12px;color:var(--dsw-alias-state-error-primary);}',
    '.dsh-board-chat{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);}',
    '.dsh-board-chat-body{flex:1 1 auto;min-height:0;overflow:auto;}',
    '.dsh-board-chat-error{margin:20px;padding:14px 16px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);font-size:13px;color:var(--dsw-alias-label-secondary);}',
    '.dsh-board-trigger.dsh-board-trigger{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;min-width:32px;padding:0;margin:0;appearance:none;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:50%;}',
    '.dsh-board-trigger.dsh-board-trigger:hover{background:var(--dsw-alias-interactive-bg-hover);}',
    '.dsh-board-trigger-badge{position:absolute;top:0;right:0;transform:translate(25%,-20%);font-size:10px;line-height:14px;min-width:14px;text-align:center;padding:0 3px;border-radius:999px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);pointer-events:none;}',
    '.dsh-board-view{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;position:relative;}',
    '.dsh-bv-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:0 0 auto;}',
    '.dsh-bv-tabs{display:flex;gap:4px;overflow-x:auto;flex:1 1 auto;min-width:0;}',
    '.dsh-bv-tab{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:8px;padding:5px 10px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;}',
    '.dsh-bv-tab:hover{background:var(--dsw-alias-interactive-bg-hover);}',
    '.dsh-bv-tab[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);}',
    '.dsh-bv-head-actions{display:flex;gap:8px;align-items:center;flex:0 0 auto;}',
    '.dsh-bv-search{height:28px;width:160px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12.5px;padding:0 9px;outline:none;}',
    '.dsh-bv-search:focus{border-color:var(--dsw-alias-brand-primary);}',
    '.dsh-bv-body{flex:1 1 auto;min-height:0;display:flex;}',
    '.dsh-bv-board{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0;}',
    '.dsh-bv-board .dsh-board-columns{padding:10px 12px 4px;grid-template-columns:repeat(3,minmax(200px,1fr));overflow-x:auto;}',
    '.dsh-bv-board .dsh-board-column{min-width:200px;}',
    '.dsh-bv-grid{flex:1 1 auto;min-width:0;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;align-content:start;}',
    '.dsh-bv-card{display:flex;flex-direction:column;gap:6px;padding:11px 12px;text-align:left;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:inherit;font:inherit;cursor:pointer;}',
    '.dsh-bv-card:hover{border-color:var(--dsw-alias-border-l3);}',
    '.dsh-bv-card[data-active="true"]{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 1px var(--dsw-alias-brand-primary);}',
    '.dsh-bv-card[data-status="running"]{border-left:3px solid var(--dsw-alias-brand-primary);}',
    '.dsh-bv-card[data-status="confirm"]{border-left:3px solid var(--dsw-alias-state-error-primary);}',
    '.dsh-bv-card[data-status="done"]{border-left:3px solid var(--dsw-alias-state-success-primary);}',
    '.dsh-bv-card-head{display:flex;align-items:center;gap:6px;}',
    '.dsh-bv-card-title{font-size:13px;font-weight:600;line-height:18px;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
    '.dsh-bv-card-meta{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dsh-bv-card-dur{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;}',
    '.dsh-bv-empty{padding:30px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-tertiary);}',
    '.dsh-bv-detail{flex:0 0 min(520px,44%);min-width:320px;display:flex;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l2);min-height:0;}',
    '.dsh-bv-detail-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:0 0 auto;}',
    '.dsh-bv-detail-titles{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto;}',
    '.dsh-bv-detail-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
    '.dsh-bv-detail-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);}',
    '.dsh-bv-detail-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto;}',
    '.dsh-board-hdbtn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:7px;height:26px;padding:0 8px;font:inherit;font-size:12px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;}',
    '.dsh-board-hdbtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}',
  ].join('\n')

  /**
   * Install or refresh the plugin's stylesheet. A client-module reload (HMR)
   * re-runs apply without reloading the document, so a one-shot guard would
   * leave the previous generation's rules in place and the new class names
   * unstyled. Rewriting the same element keeps the stylesheet current.
   */
  function installStyles() {
    var existing = document.getElementById(STYLE_ID)
    if (existing === null) {
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = CSS
      document.head.appendChild(style)
      return
    }
    if (existing.textContent !== CSS) existing.textContent = CSS
  }

  // --------------------------------------------------------------- stores ---

  /** Minimal observable store. */
  function createStore(initial) {
    var state = initial
    var listeners = new Set()
    return {
      get: function () { return state },
      set: function (patch) {
        var next = Object.assign({}, state, patch)
        var changed = false
        for (var key in next) if (next[key] !== state[key]) { changed = true; break }
        if (!changed) return
        state = next
        listeners.forEach(function (listener) { listener() })
      },
      subscribe: function (listener) {
        listeners.add(listener)
        return function () { listeners.delete(listener) }
      },
    }
  }

  /** Normalize a persisted task array, dropping malformed rows. */
  function normalizeTasks(parsed) {
    if (!Array.isArray(parsed)) return []
    return parsed.filter(function (task) {
      return task !== null && typeof task === 'object' && typeof task.id === 'string' && typeof task.title === 'string'
    }).map(function (task) {
      return {
        id: task.id,
        title: task.title,
        note: typeof task.note === 'string' ? task.note : '',
        sessionId: typeof task.sessionId === 'string' ? task.sessionId : null,
        workspaceId: typeof task.workspaceId === 'string' ? task.workspaceId : null,
        column: task.column === 'doing' || task.column === 'done' ? task.column : 'todo',
        createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
        updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : Date.now(),
        startedAt: typeof task.startedAt === 'number' ? task.startedAt : null,
        lastRunMs: typeof task.lastRunMs === 'number' ? task.lastRunMs : null,
        doneAt: typeof task.doneAt === 'number' ? task.doneAt : null,
      }
    })
  }

  /** Read the persisted task list, tolerating a missing or corrupt entry. */
  function loadTasks() {
    try {
      var raw = window.localStorage.getItem(TASKS_KEY)
      if (raw === null || raw === '') return []
      return normalizeTasks(JSON.parse(raw))
    } catch (error) {
      return []
    }
  }

  /** Task list store; every commit rewrites localStorage. */
  var taskStore = (function () {
    var tasks = loadTasks()
    var listeners = new Set()
    function emit() { listeners.forEach(function (listener) { listener() }) }
    return {
      list: function () { return tasks },
      subscribe: function (listener) {
        listeners.add(listener)
        return function () { listeners.delete(listener) }
      },
      commit: function (next) {
        tasks = next
        try {
          window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
        } catch (error) {
          // Quota or a disabled storage backend: the in-memory board still works.
        }
        emit()
        schedulePersist()
      },
      hydrate: function (next) {
        tasks = next
        try {
          window.localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
        } catch (error) { /* storage unavailable */ }
        emit()
      },
    }
  })()

  /** Session runs started from a task card, keyed by Session id. */
  var activeRuns = new Map()
  /** Latest snapshots read by the settle timer. */
  var latestStatuses = null
  var latestList = null

  /** Whether a Session currently runs (including awaiting the user). */
  function isSessionRunning(status, row) {
    if (status !== undefined && status !== null) {
      return status.running === true || (status.pendingInteraction !== undefined && status.pendingInteraction !== null)
    }
    return row !== undefined && row.running === true
  }

  /** Clear a run's pending settle timer. */
  function clearRun(run) {
    if (run !== undefined && run.settleTimer !== undefined && run.settleTimer !== null) {
      window.clearTimeout(run.settleTimer)
      run.settleTimer = null
    }
  }

  /** Close a task that its attributed run finished. */
  function finishTask(taskId, startedAt) {
    var tasks = taskStore.list()
    var changed = false
    var next = tasks.map(function (task) {
      if (task.id !== taskId) return task
      changed = true
      return Object.assign({}, task, {
        column: 'done',
        lastRunMs: Math.max(0, Date.now() - startedAt),
        doneAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
    if (changed) taskStore.commit(next)
  }

  /** Host route that owns the durable board state (both halves ship together). */
  var STATE_ROUTE = '/dsh-board/state'
  var hydrated = false
  var persistTimer = null
  var persistInFlight = false
  var persistDirty = false
  var lastLocalChangeAt = 0
  var pollTimer = null
  var deletedTasks = {}
  var activeT = null

  /** Debounced push of tasks + view selection to the Host state file. */
  function schedulePersist() {
    lastLocalChangeAt = Date.now()
    if (!hydrated) return
    if (persistTimer !== null) return
    persistTimer = window.setTimeout(function () {
      persistTimer = null
      void flushState()
    }, 400)
  }

  /**
   * Merge this window's state with the durable one before writing. The Host
   * also merges, but a pre-merge Host build replaces the file wholesale, so the
   * client reconciles first and a stale snapshot can never drop another
   * window's tasks or resurrect deleted ones.
   * @param remote - state just read from the Host, or null when unavailable.
   * @returns the state to POST.
   */
  function reconcileState(remote) {
    var remoteTasks = remote !== null && typeof remote === 'object' && Array.isArray(remote.tasks)
      ? normalizeTasks(remote.tasks)
      : []
    var remoteDeleted = remote !== null && typeof remote === 'object' && remote.deleted !== null && typeof remote.deleted === 'object'
      ? remote.deleted
      : {}
    var mergedDeleted = Object.assign({}, remoteDeleted, deletedTasks)
    deletedTasks = mergedDeleted
    var byId = new Map()
    for (var i = 0; i < remoteTasks.length; i++) byId.set(remoteTasks[i].id, remoteTasks[i])
    var localTasks = taskStore.list()
    for (var j = 0; j < localTasks.length; j++) {
      var task = localTasks[j]
      var previous = byId.get(task.id)
      if (previous === undefined || (Number(task.updatedAt) || 0) >= (Number(previous.updatedAt) || 0)) {
        byId.set(task.id, task)
      }
    }
    var tasks = []
    byId.forEach(function (candidate, id) {
      if (mergedDeleted[id] === undefined) tasks.push(candidate)
    })
    var remoteColumns = remote !== null && typeof remote === 'object' && Array.isArray(remote.columns) ? remote.columns : []
    var localColumns = columnList(activeT)
    return {
      version: 3,
      tasks: tasks,
      deleted: mergedDeleted,
      columns: localColumns.length > 0 ? localColumns : remoteColumns,
      view: viewStore.get(),
    }
  }

  /** Reconcile with the Host, then POST the merged state. */
  async function flushState() {
    if (persistInFlight) { persistDirty = true; return }
    persistInFlight = true
    try {
      var remote = null
      try {
        var currentResponse = await fetch(STATE_ROUTE, { credentials: 'same-origin' })
        if (currentResponse.ok) {
          var currentPayload = await currentResponse.json()
          remote = currentPayload !== null && currentPayload !== undefined && currentPayload.state ? currentPayload.state : null
        }
      } catch (error) {
        remote = null
      }
      var merged = reconcileState(remote)
      await fetch(STATE_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (JSON.stringify(merged.tasks) !== JSON.stringify(taskStore.list())) {
        taskStore.hydrate(merged.tasks)
      }
    } catch (error) {
      // Host half unavailable (e.g. older row): localStorage stays the fallback.
    }
    persistInFlight = false
    if (persistDirty) {
      persistDirty = false
      schedulePersist()
    }
  }

  /**
   * Load the durable state and merge it with this origin's localStorage.
   * Host rows win for the same task id; local-only rows (first migration from
   * an older build) are kept and pushed back up.
   */
  async function hydrateState() {
    var hostState = null
    try {
      var response = await fetch(STATE_ROUTE, { credentials: 'same-origin' })
      if (response.ok) {
        var payload = await response.json()
        hostState = payload !== null && payload !== undefined && payload.state ? payload.state : null
      }
    } catch (error) {
      hostState = null
    }
    if (hostState !== null && typeof hostState === 'object') {
      var hostDeleted = hostState.deleted !== null && typeof hostState.deleted === 'object' ? hostState.deleted : {}
      deletedTasks = Object.assign({}, hostDeleted)
      var hostTasks = normalizeTasks(hostState.tasks).filter(function (task) { return deletedTasks[task.id] === undefined })
      var byId = {}
      for (var i = 0; i < hostTasks.length; i++) byId[hostTasks[i].id] = hostTasks[i]
      var local = loadTasks()
      var merged = hostTasks.slice()
      for (var j = 0; j < local.length; j++) {
        if (byId[local[j].id] === undefined && deletedTasks[local[j].id] === undefined) merged.push(local[j])
      }
      taskStore.hydrate(merged)
      if (Array.isArray(hostState.columns) && hostState.columns.length > 0) {
        columnsStore.hydrate({ columns: hostState.columns.filter(function (column) {
          return column !== null && typeof column === 'object' && typeof column.id === 'string' && typeof column.title === 'string'
        }) })
      }
      if (hostState.view !== null && typeof hostState.view === 'object') {
        viewStore.hydrate({
          workspaceId: typeof hostState.view.workspaceId === 'string' ? hostState.view.workspaceId : null,
          taskId: typeof hostState.view.taskId === 'string' ? hostState.view.taskId : null,
          search: typeof hostState.view.search === 'string' ? hostState.view.search : '',
        })
      }
    }
    hydrated = true
    schedulePersist()
    if (pollTimer === null) pollTimer = window.setInterval(function () { void pollRemote() }, 2500)
  }

  /** Pull the shared state from the Host so other windows converge. */
  async function pollRemote() {
    if (!hydrated) return
    if (persistTimer !== null || persistInFlight) return
    if (Date.now() - lastLocalChangeAt < 1500) return
    try {
      var response = await fetch(STATE_ROUTE, { credentials: 'same-origin' })
      if (!response.ok) return
      var payload = await response.json()
      var state = payload !== null && payload !== undefined ? payload.state : null
      if (state === null || typeof state !== 'object' || !Array.isArray(state.tasks)) return
      // Adopt columns only when this window has none: they are shared config,
      // and a stale remote copy must not overwrite local edits mid-flight.
      if (Array.isArray(state.columns) && state.columns.length > 0 && columnsStore.get().columns.length === 0) {
        columnsStore.hydrate({ columns: state.columns.filter(function (column) {
          return column !== null && typeof column === 'object' && typeof column.id === 'string' && typeof column.title === 'string'
        }) })
      }
      // Union, never replace: tasks this window created but has not uploaded yet
      // (or that another window has not received) must survive a poll.
      var merged = reconcileState(state)
      var remoteIds = {}
      var remoteTasks = normalizeTasks(state.tasks)
      for (var ri = 0; ri < remoteTasks.length; ri++) remoteIds[remoteTasks[ri].id] = true
      var localOnly = false
      for (var mi = 0; mi < merged.tasks.length; mi++) {
        if (remoteIds[merged.tasks[mi].id] !== true) { localOnly = true; break }
      }
      if (localOnly) schedulePersist()
      if (JSON.stringify(merged.tasks) !== JSON.stringify(taskStore.list())) taskStore.hydrate(merged.tasks)
    } catch (error) {
      // Host route unavailable: keep local state.
    }
  }

  /** Transient UI state (never persisted). */
  var uiStore = createStore({
    open: false,
    view: 'board',
    activeTaskId: null,
    cursorId: null,
    form: null,
    notice: '',
  })

  // ------------------------------------------------------------- columns ---

  /** Built-in task-state columns; they keep their ids and cannot be removed. */
  var BUILTIN_COLUMNS = ['todo', 'doing', 'done']

  /** Ordered board columns (built-ins + user-defined), persisted like tasks. */
  var columnsStore = createPersistedStore('dshBoard.columns.v1', { columns: [] })

  /** Cached fallback list: getSnapshot must return a stable reference. */
  var fallbackColumns = []

  /** Ordered columns, with localized built-ins when nothing is stored yet. */
  function columnList(t) {
    var stored = columnsStore.get().columns
    if (Array.isArray(stored) && stored.length > 0) return stored
    if (fallbackColumns.length === 0) {
      fallbackColumns = [
        { id: 'todo', title: t('col.todo') },
        { id: 'doing', title: t('col.doing') },
        { id: 'done', title: t('col.done') },
      ]
    }
    return fallbackColumns
  }

  /** Seed the persisted column list with the localized built-ins. */
  function seedColumns(t) {
    if (columnsStore.get().columns.length === 0) {
      saveColumns([
        { id: 'todo', title: t('col.todo') },
        { id: 'doing', title: t('col.doing') },
        { id: 'done', title: t('col.done') },
      ])
    }
  }

  /** Subscribe to the ordered column list. */
  function useColumns(t) {
    return React.useSyncExternalStore(columnsStore.subscribe, function () { return columnList(t) })
  }

  /** Title of one column id, falling back to the id itself. */
  function columnTitle(columns, id) {
    for (var i = 0; i < columns.length; i++) {
      if (columns[i].id === id) return columns[i].title
    }
    return id
  }

  /** Resolve a stored task column against the live column list. */
  function resolveColumn(columns, id) {
    for (var i = 0; i < columns.length; i++) {
      if (columns[i].id === id) return id
    }
    return columns.length > 0 ? columns[0].id : 'todo'
  }

  /** Replace the ordered column list and persist it. */
  function saveColumns(next) {
    columnsStore.set({ columns: next })
  }

  // -------------------------------------------------------------- helpers ---

  /** Fresh task identity. */
  function newTaskId() {
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)
  }

  /** Live status discriminator for one task. */
  function taskStatus(task, row, status) {
    if (task.sessionId === null) return 'noSession'
    if (status !== undefined && status !== null && status.pendingInteraction !== undefined && status.pendingInteraction !== null) return 'confirm'
    var statusRunning = status !== undefined && status !== null && status.running === true
    if (statusRunning || (row !== undefined && row.running === true)) return 'running'
    // A task that has never run reflects no Session history: it is idle even
    // when the bound Session already carries an older finished turn.
    if (task.column === 'todo' && task.startedAt === null && task.lastRunMs === null) return 'idle'
    if (task.column === 'done') return 'done'
    if (status !== undefined && status !== null && status.completionUnread === true) return 'done'
    return 'idle'
  }

  /** Column a task renders in: the stored task state (never the Session's). */
  function displayColumn(task) {
    return task.column
  }

  /** StateDot state for a task status. */
  function dotStateOf(status) {
    if (status === 'running') return 'ongoing'
    if (status === 'confirm') return 'warning'
    if (status === 'done') return 'done'
    return 'idle'
  }

  /** Human duration. */
  function formatDuration(ms) {
    if (ms === null || ms === undefined || ms < 0) return ''
    var total = Math.floor(ms / 1000)
    if (total < 60) return total + 's'
    var minutes = Math.floor(total / 60)
    var seconds = total % 60
    if (minutes < 60) return minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's'
    var hours = Math.floor(minutes / 60)
    return hours + 'h ' + (minutes % 60) + 'm'
  }

  /** Human relative time. */
  function relativeTime(t, timestamp) {
    if (timestamp === undefined || timestamp === null || timestamp === 0) return ''
    var delta = Date.now() - timestamp
    if (delta < 60 * 1000) return t('time.justNow')
    if (delta < 60 * 60 * 1000) return t('time.minutes', { n: Math.floor(delta / 60000) })
    if (delta < 24 * 60 * 60 * 1000) return t('time.hours', { n: Math.floor(delta / 3600000) })
    return t('time.days', { n: Math.floor(delta / 86400000) })
  }

  /** Basename of a workspace path. */
  function baseName(path) {
    if (path === undefined || path === null || path === '') return ''
    var parts = String(path).split('/').filter(Boolean)
    return parts.length === 0 ? '' : parts[parts.length - 1]
  }

  /** Send `text` to one Session as a queued user message. */
  async function sendPrompt(sessions, sessionId, text) {
    var reference = sessions.retain(sessionId, { source: 'boardTask' })
    try {
      await reference.ready
      var result = await reference.binding.session.prompt([{ type: 'text', text: text }], 'queue')
      if (result !== undefined && result !== null && result.ok === false) {
        throw new Error((result.error && result.error.message) || 'prompt rejected')
      }
    } finally {
      reference.release()
    }
  }

  /** Move a task to a column and reset/keep run bookkeeping. */
  function withColumn(task, column) {
    var now = Date.now()
    if (column === 'doing') {
      return Object.assign({}, task, { column: column, startedAt: now, lastRunMs: null, doneAt: null, updatedAt: now })
    }
    if (column === 'done') {
      var started = task.startedAt === null ? now : task.startedAt
      return Object.assign({}, task, {
        column: column,
        lastRunMs: task.lastRunMs !== null ? task.lastRunMs : Math.max(0, now - started),
        doneAt: now,
        updatedAt: now,
      })
    }
    return Object.assign({}, task, { column: column, updatedAt: now })
  }

  /** Patch one task by id. */
  function patchTask(id, patch) {
    var changed = false
    var next = taskStore.list().map(function (task) {
      if (task.id !== id) return task
      changed = true
      return Object.assign({}, task, patch)
    })
    if (changed) taskStore.commit(next)
  }

  /** Task currently dragged between columns (HTML5 DnD carries no state). */
  var dragTaskId = null

  /** Delete a task, recording a tombstone so stale clients cannot resurrect it. */
  function deleteTask(id) {
    deletedTasks[id] = Date.now()
    taskStore.commit(taskStore.list().filter(function (task) { return task.id !== id }))
  }

  /** Move a task to another task-state column by hand. */
  function moveTaskTo(id, column) {
    var now = Date.now()
    var tasks = taskStore.list()
    var task = tasks.filter(function (candidate) { return candidate.id === id })[0]
    if (task === undefined || task.column === column) return
    var patch = { column: column, updatedAt: now }
    if (column === 'done') {
      patch.doneAt = now
      if (task.startedAt !== null && task.lastRunMs === null) patch.lastRunMs = Math.max(0, now - task.startedAt)
    }
    if (column === 'todo') {
      patch.startedAt = null
      patch.lastRunMs = null
      patch.doneAt = null
    }
    patchTask(id, patch)
  }

  /** Start (or restart) a task: move to 进行中 and send its instruction. */
  async function startTask(sessions, task, t) {
    var text = (task.note || '').trim() === '' ? task.title : task.note.trim()
    var previous = task
    patchTask(task.id, withColumn(task, 'doing'))
    activeRuns.set(task.sessionId, { taskId: task.id, startedAt: Date.now(), seenRunning: false })
    try {
      await sendPrompt(sessions, task.sessionId, text)
      uiStore.set({ notice: '' })
    } catch (error) {
      console.error('dsh-board: task start failed', error)
      activeRuns.delete(task.sessionId)
      patchTask(task.id, {
        column: previous.column,
        startedAt: previous.startedAt,
        lastRunMs: previous.lastRunMs,
        doneAt: previous.doneAt,
        updatedAt: previous.updatedAt,
      })
      uiStore.set({ notice: t('error.prompt', { message: String((error && error.message) || error) }) })
    }
  }

  // ---------------------------------------------------------------- icons ---

  var svgProps = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  /** Board glyph: three columns, uneven cards. */
  function BoardIcon() {
    return React.createElement('svg', svgProps,
      React.createElement('rect', { x: 2, y: 2.5, width: 3.6, height: 11, rx: 1.2 }),
      React.createElement('rect', { x: 6.2, y: 2.5, width: 3.6, height: 7, rx: 1.2 }),
      React.createElement('rect', { x: 10.4, y: 2.5, width: 3.6, height: 9, rx: 1.2 }))
  }

  /** Back arrow glyph. */
  function BackIcon() {
    return React.createElement('svg', svgProps,
      React.createElement('path', { d: 'M10.5 3.5 5.5 8l5 4.5' }))
  }

  /** Close glyph. */
  function CloseIcon() {
    return React.createElement('svg', svgProps,
      React.createElement('path', { d: 'M4 4l8 8M12 4l-8 8' }))
  }

  /** Plus glyph. */
  function PlusIcon() {
    return React.createElement('svg', svgProps,
      React.createElement('path', { d: 'M8 3v10M3 8h10' }))
  }

  // ------------------------------------------------------------ components ---

  /** Sidebar-foot trigger that opens the board. */
  function BoardTrigger(props) {
    var t = props.t
    var open = React.useSyncExternalStore(uiStore.subscribe, function () { return uiStore.get().open })
    var tasks = React.useSyncExternalStore(taskStore.subscribe, taskStore.list)
    var list = props.useSessions(function (value) { return value })
    var statuses = props.useSessionStatus(function (value) { return value })
    var activeCount = 0
    for (var i = 0; i < tasks.length; i++) {
      var status = taskStatus(tasks[i], list.byId[tasks[i].sessionId], statuses.get(tasks[i].sessionId))
      if (status === 'running' || status === 'confirm') activeCount += 1
    }
    // The sidebar footer lays actions out in its own compact cells, so this
    // trigger is always a fixed 32px icon button; the label lives in the
    // tooltip and accessible name, never in flowing text.
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-board-trigger',
      title: t('open'),
      'aria-label': t('open'),
      'aria-pressed': open ? 'true' : 'false',
      style: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        minWidth: '32px',
        padding: 0,
        margin: 0,
        border: 0,
        borderRadius: '50%',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      onClick: function () {
        var current = uiStore.get()
        uiStore.set(current.open ? { open: false, view: 'board', activeTaskId: null, form: null } : { open: true })
      },
    },
    React.createElement(BoardIcon),
    activeCount > 0 ? React.createElement('span', { className: 'dsh-board-trigger-badge' }, String(activeCount)) : null)
  }

  /** Ticking clock used for live run durations. */
  function useNow(active) {
    var state = React.useState(Date.now())
    React.useEffect(function () {
      if (!active) return undefined
      var id = window.setInterval(function () { state[1](Date.now()) }, 1000)
      return function () { window.clearInterval(id) }
    }, [active])
    return state[0]
  }

  /**
   * Overlay root: board columns, task form and the native Conversation.
   * Receives the shell.overlay kit plus the client services captured by apply.
   */
  function BoardOverlay(props) {
    var ui = React.useSyncExternalStore(uiStore.subscribe, uiStore.get)
    var columns = useColumns(props.t)
    var tasks = React.useSyncExternalStore(taskStore.subscribe, taskStore.list)
    var list = props.useSessions(function (value) { return value })
    var statuses = props.useSessionStatus(function (value) { return value })
    var t = props.t
    var sessions = props.services.sessions

    var decorated = React.useMemo(function () {
      var rows = tasks.map(function (task) {
        var row = task.sessionId === null ? undefined : list.byId[task.sessionId]
        var status = taskStatus(task, row, statuses.get(task.sessionId))
        return { task: task, row: row, status: status, column: resolveColumn(columns, displayColumn(task, status)) }
      })
      var rank = {}
      for (var i = 0; i < columns.length; i++) rank[columns[i].id] = i
      rows.sort(function (left, right) {
        var leftRank = rank[left.column] === undefined ? columns.length : rank[left.column]
        var rightRank = rank[right.column] === undefined ? columns.length : rank[right.column]
        if (leftRank !== rightRank) return leftRank - rightRank
        return right.task.createdAt - left.task.createdAt
      })
      return rows
    }, [tasks, list, statuses, columns])

    var runningAny = false
    for (var i = 0; i < decorated.length; i++) if (decorated[i].status === 'running') { runningAny = true; break }
    var now = useNow(runningAny)

    // Task-state sync for runs this board started: only the task that sent the
    // instruction moves to 进行中, and only it completes once that Session has
    // stayed idle after having run (the settle delay absorbs queued prompts and
    // short gaps between turns).
    React.useEffect(function () {
      latestStatuses = statuses
      latestList = list
      var tasks = taskStore.list()
      // Recover attribution after a module reload or page restart: a task left
      // in 进行中 owns its Session's current run, or its run already ended.
      for (var rec = 0; rec < tasks.length; rec++) {
        var candidate = tasks[rec]
        if (candidate.column !== 'doing' || candidate.sessionId === null) continue
        if (activeRuns.has(candidate.sessionId)) continue
        var age = candidate.startedAt === null ? 0 : Date.now() - candidate.startedAt
        if (age < 5000) continue
        if (statuses.get(candidate.sessionId) === undefined && list.byId[candidate.sessionId] === undefined) continue
        var wasRunning = isSessionRunning(statuses.get(candidate.sessionId), list.byId[candidate.sessionId])
        if (wasRunning) {
          activeRuns.set(candidate.sessionId, {
            taskId: candidate.id,
            startedAt: candidate.startedAt === null ? Date.now() : candidate.startedAt,
            seenRunning: true,
          })
        } else {
          finishTask(candidate.id, candidate.startedAt === null ? Date.now() : candidate.startedAt)
        }
      }
      if (activeRuns.size === 0) return
      var next = null
      activeRuns.forEach(function (run, sessionId) {
        var task = tasks.filter(function (candidate) { return candidate.id === run.taskId })[0]
        if (task === undefined) { clearRun(run); activeRuns.delete(sessionId); return }
        var status = statuses.get(sessionId)
        var row = list.byId[sessionId]
        if (status === undefined && row === undefined) return
        var running = isSessionRunning(status, row)
        if (running) {
          run.seenRunning = true
          if (run.settleTimer !== undefined && run.settleTimer !== null) {
            window.clearTimeout(run.settleTimer)
            run.settleTimer = null
          }
          if (task.column !== 'doing') {
            next = next === null ? tasks.slice() : next
            var at = -1
            for (var i = 0; i < tasks.length; i++) if (tasks[i].id === task.id) { at = i; break }
            if (at >= 0) {
              next[at] = Object.assign({}, task, {
                column: 'doing',
                startedAt: task.startedAt === null ? run.startedAt : task.startedAt,
                lastRunMs: null,
                doneAt: null,
                updatedAt: Date.now(),
              })
            }
          }
          return
        }
        if (!run.seenRunning) return
        if (run.settleTimer !== undefined && run.settleTimer !== null) return
        run.settleTimer = window.setTimeout(function () {
          run.settleTimer = null
          var liveStatus = latestStatuses === null ? undefined : latestStatuses.get(sessionId)
          var liveRow = latestList === null ? undefined : latestList.byId[sessionId]
          if (liveStatus !== undefined || liveRow !== undefined) {
            if (isSessionRunning(liveStatus, liveRow)) return
          }
          finishTask(run.taskId, run.startedAt)
          activeRuns.delete(sessionId)
        }, 2500)
      })
      if (next !== null) taskStore.commit(next)
    }, [statuses, list])

    var close = React.useCallback(function () {
      uiStore.set({ open: false, view: 'board', activeTaskId: null, cursorId: null, form: null, notice: '' })
    }, [])
    var back = React.useCallback(function () {
      uiStore.set({ view: 'board', activeTaskId: null })
    }, [])

    var openConversation = React.useCallback(function (taskId) {
      var target = taskStore.list().filter(function (task) { return task.id === taskId })[0]
      if (target === undefined) return
      if (target.sessionId === null) {
        uiStore.set({ form: { mode: 'edit', taskId: taskId }, view: 'board' })
        return
      }
      uiStore.set({ view: 'chat', activeTaskId: taskId, cursorId: taskId })
    }, [])

    var moveCursor = React.useCallback(function (delta) {
      if (decorated.length === 0) return
      var current = uiStore.get().cursorId
      var index = -1
      for (var i = 0; i < decorated.length; i++) if (decorated[i].task.id === current) { index = i; break }
      if (index < 0) index = delta > 0 ? -1 : 0
      var next = ((index + delta) % decorated.length + decorated.length) % decorated.length
      uiStore.set({ cursorId: decorated[next].task.id })
    }, [decorated])

    var switchConversation = React.useCallback(function (delta) {
      var current = uiStore.get().activeTaskId
      var conversationTasks = decorated.filter(function (entry) { return entry.task.sessionId !== null })
      if (conversationTasks.length === 0) return
      var index = -1
      for (var i = 0; i < conversationTasks.length; i++) if (conversationTasks[i].task.id === current) { index = i; break }
      if (index < 0) index = 0
      var next = ((index + delta) % conversationTasks.length + conversationTasks.length) % conversationTasks.length
      uiStore.set({ activeTaskId: conversationTasks[next].task.id, cursorId: conversationTasks[next].task.id })
    }, [decorated])

    React.useEffect(function () {
      if (!ui.open) return undefined
      function onKeyDown(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          var state = uiStore.get()
          if (state.form !== null) uiStore.set({ form: null })
          else if (state.view === 'chat') back()
          else close()
          return
        }
        if (uiStore.get().form !== null) return
        if (uiStore.get().view === 'chat') {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            switchConversation(event.key === 'ArrowDown' ? 1 : -1)
          }
          return
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          moveCursor(event.key === 'ArrowDown' ? 1 : -1)
          return
        }
        if (event.key === 'Enter') {
          var cursor = uiStore.get().cursorId
          var entry = null
          for (var i = 0; i < decorated.length; i++) if (decorated[i].task.id === cursor) { entry = decorated[i]; break }
          if (entry === null) return
          event.preventDefault()
          openConversation(entry.task.id)
          return
        }
        if (event.key === 'n' || event.key === 'N') {
          event.preventDefault()
          uiStore.set({ form: { mode: 'new' } })
        }
      }
      document.addEventListener('keydown', onKeyDown, true)
      return function () { document.removeEventListener('keydown', onKeyDown, true) }
    }, [ui.open, back, close, moveCursor, openConversation, switchConversation, decorated])

    if (!ui.open) return null

    var activeEntry = null
    for (var k = 0; k < decorated.length; k++) if (decorated[k].task.id === ui.activeTaskId) { activeEntry = decorated[k]; break }

    var doingCount = 0
    var waitingCount = 0
    for (var d = 0; d < decorated.length; d++) {
      if (decorated[d].column === 'doing') doingCount += 1
      if (decorated[d].status === 'confirm') waitingCount += 1
    }

    var title = activeEntry === null ? t('title') : activeEntry.task.title
    var subtitle = activeEntry === null
      ? t('subtitle', { n: decorated.length, doing: doingCount, waiting: waitingCount })
      : t('status.' + activeEntry.status)

    return React.createElement('div', { className: 'dsh-board-layer' },
      React.createElement('div', { className: 'dsh-board-mask', onClick: close }),
      React.createElement('div', {
        className: 'dsh-board-panel',
        'data-view': ui.view,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': t('title'),
      },
      React.createElement('div', { className: 'dsh-board-head' },
        ui.view === 'chat'
          ? React.createElement('button', {
            type: 'button',
            className: 'dsh-board-iconbtn dsh-board-back',
            onClick: back,
            title: t('back'),
          }, React.createElement(BackIcon), t('back'))
          : null,
        React.createElement('div', { className: 'dsh-board-head-titles' },
          React.createElement('h2', { className: 'dsh-board-title' }, title),
          React.createElement('span', { className: 'dsh-board-sub' }, subtitle)),
        React.createElement('div', { className: 'dsh-board-spacer' }),
        ui.view === 'chat'
          ? React.createElement('div', { style: { display: 'flex', gap: 4 } },
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-iconbtn',
              title: t('chat.prev'),
              'aria-label': t('chat.prev'),
              onClick: function () { switchConversation(-1) },
            }, React.createElement('span', { style: { fontSize: 13 } }, '↑')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-iconbtn',
              title: t('chat.next'),
              'aria-label': t('chat.next'),
              onClick: function () { switchConversation(1) },
            }, React.createElement('span', { style: { fontSize: 13 } }, '↓')))
          : React.createElement('button', {
            type: 'button',
            className: 'dsh-board-new',
            onClick: function () { uiStore.set({ form: { mode: 'new' } }) },
            title: t('newTask'),
          }, React.createElement(PlusIcon), t('newTask')),
        React.createElement('button', {
          type: 'button',
          className: 'dsh-board-iconbtn',
          onClick: close,
          title: t('close'),
          'aria-label': t('close'),
        }, React.createElement(CloseIcon))),
      ui.view === 'chat'
        ? React.createElement(BoardConversation, {
          entry: activeEntry,
          sessions: sessions,
          SessionProvider: props.SessionProvider,
          renderSlot: props.renderSlot,
          t: t,
        })
        : React.createElement(BoardColumns, {
          decorated: decorated,
          cursorId: ui.cursorId,
          now: now,
          t: t,
          onOpen: openConversation,
          onCursor: function (id) { uiStore.set({ cursorId: id }) },
          onEdit: function (id) { uiStore.set({ form: { mode: 'edit', taskId: id } }) },
          onDelete: function (id) { deleteTask(id) },
          onStart: function (task) { startTask(sessions, task, t) },
          onMove: function (id, column) { moveTaskTo(id, column) },
        }),
      React.createElement('div', { className: 'dsh-board-foot' },
        React.createElement('span', null, ui.view === 'chat' ? t('hint.chat') : t('hint.board')),
        ui.notice === '' ? null : React.createElement('span', { className: 'dsh-board-notice' }, ui.notice)),
      ui.form === null
        ? null
        : React.createElement(TaskForm, {
          mode: ui.form.mode,
          task: ui.form.taskId === undefined
            ? undefined
            : taskStore.list().filter(function (task) { return task.id === ui.form.taskId })[0],
          sessions: sessions,
          workspaces: props.services.workspaces,
          list: list,
          t: t,
          onClose: function () { uiStore.set({ form: null }) },
          onCreated: function (taskId) { uiStore.set({ form: null, cursorId: taskId }) },
        })))
  }

  /** Three columns of task cards. */
  function BoardColumns(props) {
    var t = props.t
    var columns = useColumns(t)
    var overState = React.useState(null)
    var over = overState[0]
    var setOver = overState[1]
    var editState = React.useState(null)
    var edit = editState[0]
    var setEdit = editState[1]
    var addState = React.useState(null)
    var adding = addState[0]
    var setAdding = addState[1]
    var removeState = React.useState(null)
    var confirmingRemove = removeState[0]
    var setConfirmingRemove = removeState[1]

    var commitRename = function () {
      if (edit === null) return
      var title = edit.title.trim()
      if (title !== '') {
        saveColumns(columns.map(function (column) {
          return column.id === edit.id ? { id: column.id, title: title } : column
        }))
      }
      setEdit(null)
    }
    var commitAdd = function () {
      var title = (adding === null ? '' : adding).trim()
      if (title !== '') {
        saveColumns(columns.concat([{ id: 'col_' + Date.now().toString(36), title: title }]))
      }
      setAdding(null)
    }
    var removeColumn = function (id) {
      setConfirmingRemove(null)
      taskStore.commit(taskStore.list().map(function (task) {
        return task.column === id ? Object.assign({}, task, { column: 'todo', updatedAt: Date.now() }) : task
      }))
      saveColumns(columns.filter(function (column) { return column.id !== id }))
    }

    var columnNodes = columns.map(function (column) {
      var entries = props.decorated.filter(function (entry) { return entry.column === column.id })
      var editing = edit !== null && edit.id === column.id
      return React.createElement('section', {
        className: 'dsh-board-column',
        key: column.id,
        'data-drop': over === column.id ? 'true' : 'false',
        onDragOver: function (event) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(column.id) },
        onDragLeave: function () { setOver(function (current) { return current === column.id ? null : current }) },
        onDrop: function (event) {
          event.preventDefault()
          setOver(null)
          var id = event.dataTransfer.getData('text/plain') || dragTaskId
          dragTaskId = null
          if (id !== null && id !== '') props.onMove(id, column.id)
        },
      },
      React.createElement('div', { className: 'dsh-board-column-head' },
        editing
          ? React.createElement('input', {
            className: 'dsh-board-col-input',
            value: edit.title,
            autoFocus: true,
            onChange: function (event) { setEdit({ id: column.id, title: event.target.value }) },
            onBlur: commitRename,
            onKeyDown: function (event) {
              if (event.key === 'Enter') { event.preventDefault(); commitRename() }
              else if (event.key === 'Escape') { event.preventDefault(); setEdit(null) }
            },
          })
          : React.createElement('span', {
            className: 'dsh-board-column-title',
            title: t('column.renameHint'),
            onDoubleClick: function () { setEdit({ id: column.id, title: column.title }) },
          }, column.title),
        React.createElement('span', { className: 'dsh-board-column-count' }, String(entries.length)),
        BUILTIN_COLUMNS.indexOf(column.id) === -1
          ? (confirmingRemove === column.id
            ? React.createElement('button', {
              type: 'button',
              className: 'dsh-board-col-remove dsh-board-col-remove-confirm',
              title: t('column.remove'),
              onClick: function () { removeColumn(column.id) },
              onBlur: function () { setConfirmingRemove(null) },
            }, t('column.confirmRemove'))
            : React.createElement('button', {
              type: 'button',
              className: 'dsh-board-col-remove',
              title: t('column.remove'),
              'aria-label': t('column.remove'),
              onClick: function () {
                setConfirmingRemove(column.id)
                window.setTimeout(function () {
                  setConfirmingRemove(function (current) { return current === column.id ? null : current })
                }, 3000)
              },
            }, '\u00d7'))
          : null),
      React.createElement('div', { className: 'dsh-board-column-body' },
        entries.length === 0
          ? React.createElement('div', { className: 'dsh-board-col-empty' }, t('column.empty'))
          : entries.map(function (entry) {
            return React.createElement(TaskCard, {
              key: entry.task.id,
              entry: entry,
              columns: columns,
              now: props.now,
              selected: entry.task.id === props.cursorId,
              t: t,
              onOpen: props.onOpen,
              onCursor: props.onCursor,
              onEdit: props.onEdit,
              onDelete: props.onDelete,
              onStart: props.onStart,
            })
          })))
    })

    columnNodes.push(React.createElement('section', {
      className: 'dsh-board-column dsh-board-column-add',
      key: '__add-column',
    },
    adding === null
      ? React.createElement('button', {
        type: 'button',
        className: 'dsh-board-addcol',
        onClick: function () { setAdding('') },
      }, '+ ' + t('column.add'))
      : React.createElement('input', {
        className: 'dsh-board-col-input',
        value: adding,
        autoFocus: true,
        placeholder: t('column.namePlaceholder'),
        onChange: function (event) { setAdding(event.target.value) },
        onBlur: commitAdd,
        onKeyDown: function (event) {
          if (event.key === 'Enter') { event.preventDefault(); commitAdd() }
          else if (event.key === 'Escape') { event.preventDefault(); setAdding(null) }
        },
      })))

    return React.createElement('div', { className: 'dsh-board-body' },
      React.createElement('div', {
        className: 'dsh-board-columns',
        style: { gridTemplateColumns: 'repeat(' + (columns.length + 1) + ', minmax(200px, 1fr))' },
      }, columnNodes))
  }

  /** One task card with live status, duration and inline actions. */
  function TaskCard(props) {
    var entry = props.entry
    var task = entry.task
    var t = props.t
    var confirming = React.useState(false)
    var confirmDelete = confirming[0]
    var setConfirmDelete = confirming[1]
    var sessionTitle = entry.row === undefined ? null : entry.row.displayTitle
    var activeRun = entry.status === 'running' || entry.status === 'confirm'
    var runMs = activeRun && task.startedAt !== null
      ? Math.max(0, props.now - task.startedAt)
      : task.lastRunMs
    var duration = runMs === null || runMs === undefined ? t('card.noRun') : formatDuration(runMs)
    var running = entry.status === 'running' || entry.status === 'confirm'

    return React.createElement('article', {
      className: 'dsh-board-card',
      'data-status': entry.status,
      'data-selected': props.selected ? 'true' : 'false',
      tabIndex: -1,
      draggable: true,
      onClick: function () { props.onOpen(task.id) },
      onMouseEnter: function () { props.onCursor(task.id) },
      onDragStart: function (event) {
        dragTaskId = task.id
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', task.id)
      },
      onDragEnd: function () { dragTaskId = null },
    },
    React.createElement('div', { className: 'dsh-board-card-top' },
      React.createElement('span', { className: 'dsh-board-dot' },
        React.createElement(StateDot, { state: dotStateOf(entry.status) })),
      React.createElement('span', { className: 'dsh-board-chip' }, columnTitle(props.columns || [], entry.column)),
      entry.column === 'doing' && (entry.status === 'running' || entry.status === 'confirm')
        ? React.createElement('span', { className: 'dsh-board-live', 'data-kind': entry.status }, t('status.' + entry.status))
        : null,
      React.createElement('span', { className: 'dsh-board-card-foot', style: { marginLeft: 'auto' } },
        React.createElement('span', { className: 'dsh-board-card-dur' }, duration))),
    React.createElement('h3', { className: 'dsh-board-card-title' }, task.title),
    task.note === '' ? null : React.createElement('p', { className: 'dsh-board-card-note' }, task.note),
    React.createElement('div', { className: 'dsh-board-card-meta' },
      sessionTitle === null ? t('card.sessionMissing') : t('card.session', { title: sessionTitle })),
    React.createElement('div', { className: 'dsh-board-card-foot' },
      React.createElement('span', null, relativeTime(t, task.updatedAt)),
      React.createElement('span', { className: 'dsh-board-card-actions' },
        confirmDelete
          ? React.createElement('span', { style: { display: 'inline-flex', gap: 4, alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: 11 } }, t('action.confirmDelete')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              'data-danger': 'true',
              onClick: function (event) { event.stopPropagation(); props.onDelete(task.id) },
            }, t('action.confirm')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              onClick: function (event) { event.stopPropagation(); setConfirmDelete(false) },
            }, t('action.cancel')))
          : React.createElement(React.Fragment, null,
            entry.column === 'doing' && entry.status === 'confirm'
              ? React.createElement('button', {
                type: 'button',
                className: 'dsh-board-mini',
                'data-primary': 'true',
                title: t('action.answer'),
                onClick: function (event) { event.stopPropagation(); props.onOpen(task.id) },
              }, t('action.answer'))
              : null,
            task.sessionId === null ? null : React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              disabled: running,
              title: running ? t('status.running') : t('action.run'),
              onClick: function (event) { event.stopPropagation(); props.onStart(task) },
            }, task.lastRunMs === null && !running ? t('action.run') : t('action.rerun')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              onClick: function (event) { event.stopPropagation(); props.onEdit(task.id) },
            }, t('action.edit')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              'data-danger': 'true',
              onClick: function (event) { event.stopPropagation(); setConfirmDelete(true) },
            }, t('action.delete'))))))
  }

  /** Native Conversation for the active task's Session. */
  function BoardConversation(props) {
    var entry = props.entry
    var sessions = props.sessions
    var t = props.t
    var sessionId = entry === null ? null : entry.task.sessionId
    var reference = React.useMemo(function () {
      if (sessionId === null) return { error: new Error('no session') }
      try {
        return { value: sessions.retain(sessionId, { source: 'boardOverlay' }) }
      } catch (error) {
        return { error: error }
      }
    }, [sessions, sessionId])

    React.useEffect(function () {
      var held = reference
      return function () {
        if (held !== undefined && held.value !== undefined && typeof held.value.release === 'function') held.value.release()
      }
    }, [reference])

    if (reference.error !== undefined || reference.value === undefined) {
      return React.createElement('div', { className: 'dsh-board-chat-error' }, t('chat.missing'))
    }

    return React.createElement(props.SessionProvider, { session: reference.value, key: sessionId },
      props.renderSlot('board.chat', {}))
  }

  /** Session-scoped entry: renders the shipped Conversation Factory occurrence. */
  function BoardChat(props) {
    var t = props.t
    var Boundary = boundaryClass()
    return React.createElement('div', { className: 'dsh-board-chat' },
      React.createElement(Boundary, { t: t },
        props.renderFactorySlot('conversation.content', {
          variant: 'embedded',
          phase: 'active',
          hero: false,
        })))
  }

  /**
   * Error boundary class, built on first use: the platform React binding only
   * exists once the ModuleLoader factory has run, after this script's top level.
   */
  var BoardChatBoundaryClass = null
  function boundaryClass() {
    if (BoardChatBoundaryClass !== null) return BoardChatBoundaryClass
    class BoardChatBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }

      static getDerivedStateFromError(error) {
        return { error: error }
      }

      render() {
        if (this.state.error !== null) {
          var message = String((this.state.error && this.state.error.message) || this.state.error)
          return React.createElement('div', { className: 'dsh-board-chat-error' },
            this.props.t('error.render', { message: message }))
        }
        return this.props.children
      }
    }
    BoardChatBoundaryClass = BoardChatBoundary
    return BoardChatBoundaryClass
  }

  /** New-task and edit-task form. */
  function TaskForm(props) {
    var t = props.t
    var list = props.list
    var workspaces = (function () {
      try {
        return props.workspaces.list.getSnapshot().items
      } catch (error) {
        return []
      }
    })()
    var sessionRows = React.useMemo(function () {
      var rows = []
      var ids = list.ids
      for (var i = 0; i < ids.length; i++) if (list.byId[ids[i]] !== undefined) rows.push(list.byId[ids[i]])
      rows.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0) })
      return rows
    }, [list])

    var editing = props.mode === 'edit' && props.task !== undefined
    var titleState = React.useState(editing ? props.task.title : '')
    var title = titleState[0]
    var setTitle = titleState[1]
    var noteState = React.useState(editing ? props.task.note : '')
    var note = noteState[0]
    var setNote = noteState[1]
    var modeState = React.useState(props.defaultMode === 'existing' && sessionRows.length > 0 ? 'existing' : 'new')
    var sessionMode = modeState[0]
    var setSessionMode = modeState[1]
    var workspaceState = React.useState(props.defaultWorkspaceId !== undefined && props.defaultWorkspaceId !== null
      ? props.defaultWorkspaceId
      : (workspaces.length > 0 ? workspaces[0].workspaceId : null))
    var workspaceId = workspaceState[0]
    var setWorkspaceId = workspaceState[1]
    var sessionState = React.useState(props.defaultSessionId !== undefined && props.defaultSessionId !== null
      ? props.defaultSessionId
      : (sessionRows.length > 0 ? sessionRows[0].id : null))
    var sessionId = sessionState[0]
    var setSessionId = sessionState[1]
    var runState = React.useState(props.defaultMode === 'existing' ? false : true)
    var runNow = runState[0]
    var setRunNow = runState[1]
    var busyState = React.useState(false)
    var busy = busyState[0]
    var setBusy = busyState[1]
    var errorState = React.useState('')
    var error = errorState[0]
    var setError = errorState[1]
    var titleRef = React.useRef(null)

    React.useEffect(function () {
      if (sessionRows.length === 0) setSessionMode('new')
    }, [sessionRows.length])

    React.useEffect(function () {
      if (titleRef.current !== null) titleRef.current.focus()
    }, [])

    if (editing && props.task === undefined) return null

    function submit(event) {
      if (event !== undefined) event.preventDefault()
      var trimmed = title.trim()
      if (trimmed === '') {
        setError(t('form.requiredTitle'))
        return
      }
      setBusy(true)
      setError('')
      var work = editing
        ? Promise.resolve(patchTask(props.task.id, { title: trimmed, note: note, updatedAt: Date.now() }))
        : (sessionMode === 'new'
          ? props.sessions.create(workspaceId === null ? undefined : { workspaceId: workspaceId })
          : Promise.resolve(sessionId))
        .then(function (resolvedSessionId) {
          var task = {
            id: newTaskId(),
            title: trimmed,
            note: note,
            sessionId: resolvedSessionId,
            workspaceId: sessionMode === 'new'
              ? workspaceId
              : (props.defaultWorkspaceId === undefined ? null : props.defaultWorkspaceId),
            column: 'todo',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            startedAt: null,
            lastRunMs: null,
            doneAt: null,
          }
          taskStore.commit([task].concat(taskStore.list()))
          if (runNow) startTask(props.sessions, task, t)
          return task.id
        })
      work.then(function (id) {
        props.onCreated(editing ? props.task.id : id)
      }).catch(function (caught) {
        setBusy(false)
        setError(t('form.failed', { message: String((caught && caught.message) || caught) }))
      })
    }

    return React.createElement('div', { className: 'dsh-board-form', onClick: function (event) { event.stopPropagation() } },
      React.createElement('form', { className: 'dsh-board-form-card', onSubmit: submit },
        React.createElement('h3', { className: 'dsh-board-form-title' }, editing ? t('form.edit') : t('form.new')),
        React.createElement('div', { className: 'dsh-board-field' },
          React.createElement('label', { className: 'dsh-board-label' }, t('form.title')),
          React.createElement('input', {
            ref: titleRef,
            className: 'dsh-board-input',
            value: title,
            placeholder: t('form.titlePlaceholder'),
            onChange: function (event) { setTitle(event.target.value) },
          })),
        React.createElement('div', { className: 'dsh-board-field' },
          React.createElement('label', { className: 'dsh-board-label' }, t('form.note')),
          React.createElement('textarea', {
            className: 'dsh-board-textarea',
            value: note,
            placeholder: t('form.notePlaceholder'),
            onChange: function (event) { setNote(event.target.value) },
          })),
        editing
          ? React.createElement('div', { className: 'dsh-board-field' },
            React.createElement('span', { className: 'dsh-board-label' }, t('form.session')),
            React.createElement('span', { className: 'dsh-board-card-meta' }, t('form.editBinding')))
          : React.createElement(React.Fragment, null,
            React.createElement('div', { className: 'dsh-board-field' },
              React.createElement('span', { className: 'dsh-board-label' }, t('form.session')),
              React.createElement('div', { className: 'dsh-board-radios' },
                React.createElement('label', null,
                  React.createElement('input', {
                    type: 'radio',
                    checked: sessionMode === 'new',
                    onChange: function () { setSessionMode('new') },
                  }), t('form.mode.new')),
                React.createElement('label', null,
                  React.createElement('input', {
                    type: 'radio',
                    checked: sessionMode === 'existing',
                    disabled: sessionRows.length === 0,
                    onChange: function () { setSessionMode('existing') },
                  }), t('form.mode.existing')))),
            sessionMode === 'new'
              ? React.createElement('div', { className: 'dsh-board-field' },
                React.createElement('label', { className: 'dsh-board-label' }, t('form.workspace')),
                workspaces.length === 0
                  ? React.createElement('span', { className: 'dsh-board-form-error' }, t('form.noWorkspace'))
                  : React.createElement('select', {
                    className: 'dsh-board-select',
                    value: workspaceId === null ? '' : workspaceId,
                    onChange: function (event) { setWorkspaceId(event.target.value) },
                  }, workspaces.map(function (workspace) {
                    return React.createElement('option', { key: workspace.workspaceId, value: workspace.workspaceId },
                      workspace.title + ' — ' + baseName(workspace.path))
                  })))
              : React.createElement('div', { className: 'dsh-board-field' },
                React.createElement('label', { className: 'dsh-board-label' }, t('form.pickSession')),
                sessionRows.length === 0
                  ? React.createElement('span', { className: 'dsh-board-form-error' }, t('form.noSession'))
                  : React.createElement('select', {
                    className: 'dsh-board-select',
                    value: sessionId === null ? '' : sessionId,
                    onChange: function (event) { setSessionId(event.target.value) },
                  }, sessionRows.map(function (row) {
                    var cwd = baseName(row.cwd)
                    return React.createElement('option', { key: row.id, value: row.id },
                      row.displayTitle + (cwd === '' ? '' : ' — ' + cwd))
                  }))),
            React.createElement('label', { className: 'dsh-board-check' },
              React.createElement('input', {
                type: 'checkbox',
                checked: runNow,
                onChange: function (event) { setRunNow(event.target.checked) },
              }), t('form.runNow'))),
        error === '' ? null : React.createElement('span', { className: 'dsh-board-form-error' }, error),
        React.createElement('div', { className: 'dsh-board-form-actions' },
          React.createElement('button', {
            type: 'button',
            className: 'dsh-board-btn',
            onClick: props.onClose,
            disabled: busy,
          }, t('action.cancel')),
          React.createElement('button', {
            type: 'submit',
            className: 'dsh-board-btn',
            'data-primary': 'true',
            disabled: busy || (editing === false && sessionMode === 'new' && workspaces.length === 0),
          }, busy ? t('form.saving') : t('form.save')))))
  }



  // ---------------------------------------------------------- board view ---

  /** Session status for a card (same four states as the overlay). */
  function sessionStatusOf(row, status) {
    if (status !== undefined && status !== null && status.pendingInteraction !== undefined && status.pendingInteraction !== null) return 'confirm'
    if ((status !== undefined && status !== null && status.running === true) || (row !== undefined && row.running === true)) return 'running'
    if (status !== undefined && status !== null && status.completionUnread === true) return 'done'
    return 'idle'
  }

  /** Persisted store for the main-panel view's selection. */
  function createPersistedStore(key, initial) {
    var loaded = Object.assign({}, initial)
    try {
      var raw = window.localStorage.getItem(key)
      if (raw !== null && raw !== '') loaded = Object.assign(loaded, JSON.parse(raw))
    } catch (error) {
      loaded = Object.assign({}, initial)
    }
    var store = createStore(loaded)
    var write = store.set
    store.set = function (patch) {
      write(patch)
      try { window.localStorage.setItem(key, JSON.stringify(store.get())) } catch (error) { /* storage unavailable */ }
      schedulePersist()
    }
    store.hydrate = function (next) {
      write(next)
      try { window.localStorage.setItem(key, JSON.stringify(store.get())) } catch (error) { /* storage unavailable */ }
    }
    return store
  }

  var viewStore = createPersistedStore('dshBoard.view.v1', { workspaceId: null, taskId: null, search: '' })

  /** Register the sidebar icon for the board panel. */
  function BoardPanelIcon(props) {
    var size = props !== undefined && typeof props.size === 'number' ? props.size : 16
    return React.createElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
    React.createElement('rect', { x: 2, y: 2.5, width: 3.6, height: 11, rx: 1.2 }),
    React.createElement('rect', { x: 6.2, y: 2.5, width: 3.6, height: 7, rx: 1.2 }),
    React.createElement('rect', { x: 10.4, y: 2.5, width: 3.6, height: 9, rx: 1.2 }))
  }

  /** The workspace a Session belongs to, by membership or cwd. */
  function workspaceOfSession(workspaces, row) {
    if (row === undefined) return null
    for (var i = 0; i < workspaces.length; i++) {
      var workspace = workspaces[i]
      var ids = workspace.sessionIds || []
      for (var j = 0; j < ids.length; j++) {
        if (ids[j] === row.id) return workspace
      }
    }
    if (row.cwd !== undefined) {
      for (var k = 0; k < workspaces.length; k++) {
        if (workspaces[k].path === row.cwd) return workspaces[k]
      }
    }
    return null
  }

  /** Workspace a task renders under: explicit binding, then its Session's workspace. */
  function workspaceOfTask(workspaces, list, task) {
    if (task.workspaceId !== null && task.workspaceId !== undefined) {
      for (var i = 0; i < workspaces.length; i++) {
        if (workspaces[i].workspaceId === task.workspaceId) return workspaces[i].workspaceId
      }
    }
    var row = task.sessionId === null ? undefined : list.byId[task.sessionId]
    var workspace = workspaceOfSession(workspaces, row)
    return workspace === null ? null : workspace.workspaceId
  }

  /** Resolve a client service lazily: boot order may not expose it at apply time. */
  function serviceOf(services, name) {
    if (services === undefined || services === null) return undefined
    if (typeof services.resolve === 'function') return services.resolve(name)
    return services[name]
  }

  /** Switch the main column back to the classic Conversation for one Session. */
  function openClassicView(services, sessionId) {
    var uiWorkspace = serviceOf(services, 'uiWorkspace')
    var layout = serviceOf(services, 'layout')
    try {
      if (sessionId !== null && sessionId !== undefined) uiWorkspace.openSession(sessionId)
    } catch (error) { /* navigation is best-effort */ }
    try {
      layout.selectPanel('conversation')
    } catch (error) { /* navigation is best-effort */ }
  }

  /** Open the board panel focused on one Session (from the classic header). */
  function openBoardView(services, sessionId) {
    var workspaces = []
    try { workspaces = services.workspaces.list.getSnapshot().items || [] } catch (error) { workspaces = [] }
    var row = undefined
    try { row = sessionId === null || sessionId === undefined ? undefined : services.sessions.list.getSnapshot().byId[sessionId] } catch (error) { row = undefined }
    var workspace = workspaceOfSession(workspaces, row)
    var taskId = null
    if (sessionId !== null && sessionId !== undefined) {
      var bound = taskStore.list().filter(function (task) { return task.sessionId === sessionId })[0]
      if (bound !== undefined) taskId = bound.id
    }
    viewStore.set({
      workspaceId: workspace === null ? viewStore.get().workspaceId : workspace.workspaceId,
      taskId: taskId,
    })
    try {
      var layout = serviceOf(services, 'layout')
      layout.selectPanel('board')
    } catch (error) { /* navigation is best-effort */ }
  }

  /** Header toggle shown inside a classic Conversation: back to the board. */
  function BoardConversationToggle(props) {
    var t = props.t
    var services = props.services
    var sessionId = props.sessionId
    return React.createElement('button', {
      type: 'button',
      className: 'dsh-board-hdbtn',
      title: t('view.board'),
      'aria-label': t('view.board'),
      onClick: function () { openBoardView(services, sessionId) },
    }, React.createElement(BoardPanelIcon, { size: 15 }), React.createElement('span', null, t('view.board')))
  }

  /** Native Conversation for the Session bound to the selected task. */
  function BoardDetailConversation(props) {
    var sessions = props.sessions
    var sessionId = props.sessionId
    var t = props.t
    var reference = React.useMemo(function () {
      if (sessionId === null) return { error: new Error('no session') }
      try { return { value: sessions.retain(sessionId, { source: 'boardPanel' }) } } catch (error) { return { error: error } }
    }, [sessions, sessionId])
    React.useEffect(function () {
      var held = reference
      return function () {
        if (held !== undefined && held.value !== undefined && typeof held.value.release === 'function') held.value.release()
      }
    }, [reference])
    if (reference.error !== undefined || reference.value === undefined) {
      return React.createElement('div', { className: 'dsh-board-chat-error' }, t('chat.missing'))
    }
    return React.createElement(props.SessionProvider, { session: reference.value, key: sessionId },
      props.renderSlot('board.detail', {}))
  }

  /** Session-scoped body for the board's detail pane: the shipped Conversation. */
  function BoardDetailBody(props) {
    var t = props.t
    var session = props.useSession(function (value) { return value })
    var phase = session !== undefined && session !== null && session.blank
      ? (session.openState === 'loading' ? 'settling' : 'hero')
      : 'active'
    var Boundary = boundaryClass()
    return React.createElement('div', { className: 'dsh-board-chat' },
      React.createElement(Boundary, { t: t },
        props.renderFactorySlot('conversation.content', {
          variant: 'embedded',
          phase: phase,
          hero: phase === 'hero',
        })))
  }

  /**
   * Main-panel task board: one board per workspace, task cards in the three
   * task-state columns, and the selected task's Session Conversation beside it.
   */
  function BoardView(props) {
    var t = props.t
    var services = props.services
    var list = props.useSessions(function (value) { return value })
    var statuses = props.useSessionStatus(function (value) { return value })
    var workspaceSnap = props.useWorkspaces(function (value) { return value })
    var tasks = React.useSyncExternalStore(taskStore.subscribe, taskStore.list)
    var columns = useColumns(t)
    var view = React.useSyncExternalStore(viewStore.subscribe, viewStore.get)
    var workspaces = (workspaceSnap !== undefined && workspaceSnap !== null && workspaceSnap.items) || []

    var current = null
    for (var i = 0; i < workspaces.length; i++) {
      if (workspaces[i].workspaceId === view.workspaceId) { current = workspaces[i]; break }
    }
    if (current === null && workspaces.length > 0) current = workspaces[0]

    var decorated = React.useMemo(function () {
      if (current === null) return []
      var rows = tasks.filter(function (task) {
        return workspaceOfTask(workspaces, list, task) === current.workspaceId
      }).map(function (task) {
        var row = task.sessionId === null ? undefined : list.byId[task.sessionId]
        var status = taskStatus(task, row, statuses.get(task.sessionId))
        return { task: task, row: row, status: status, column: resolveColumn(columns, displayColumn(task, status)) }
      })
      var rank = {}
      for (var i = 0; i < columns.length; i++) rank[columns[i].id] = i
      rows.sort(function (left, right) {
        var leftRank = rank[left.column] === undefined ? columns.length : rank[left.column]
        var rightRank = rank[right.column] === undefined ? columns.length : rank[right.column]
        if (leftRank !== rightRank) return leftRank - rightRank
        return right.task.createdAt - left.task.createdAt
      })
      return rows
    }, [current, tasks, list, statuses, workspaces, columns])

    var query = (view.search || '').trim().toLowerCase()
    var visible = query === ''
      ? decorated
      : decorated.filter(function (entry) {
        var haystack = (entry.task.title + ' ' + (entry.task.note || '')).toLowerCase()
        return haystack.indexOf(query) !== -1
      })

    var running = false
    for (var r = 0; r < decorated.length; r++) {
      if (decorated[r].status === 'running' || decorated[r].status === 'confirm') { running = true; break }
    }
    var now = useNow(running)

    var selectedEntry = null
    for (var s = 0; s < decorated.length; s++) {
      if (decorated[s].task.id === view.taskId) { selectedEntry = decorated[s]; break }
    }

    var formState = React.useState(null)
    var form = formState[0]
    var setForm = formState[1]

    // Default execution target for a new task: the Session this board last ran,
    // then the most recently updated Session in the workspace. Related tasks
    // therefore keep one long Session instead of opening a new one each time.
    var boardSessions = React.useMemo(function () {
      if (current === null) return []
      var seen = {}
      var rows = []
      var ids = current.sessionIds || []
      for (var i = 0; i < ids.length; i++) {
        var row = list.byId[ids[i]]
        if (row !== undefined && seen[row.id] !== true) { seen[row.id] = true; rows.push(row) }
      }
      for (var j = 0; j < decorated.length; j++) {
        var bound = decorated[j].row
        if (bound !== undefined && seen[bound.id] !== true) { seen[bound.id] = true; rows.push(bound) }
      }
      rows.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0) })
      return rows
    }, [current, decorated, list])

    var lastUsedSession = null
    for (var u = decorated.length - 1; u >= 0; u--) {
      if (decorated[u].task.sessionId !== null && decorated[u].row !== undefined) { lastUsedSession = decorated[u].task.sessionId; break }
    }
    var defaultSessionId = lastUsedSession !== null ? lastUsedSession : (boardSessions.length > 0 ? boardSessions[0].id : null)

    var setWorkspace = React.useCallback(function (workspaceId) {
      viewStore.set({ workspaceId: workspaceId, taskId: null })
    }, [])

    var tabs = workspaces.map(function (workspace) {
      return React.createElement('button', {
        key: workspace.workspaceId,
        type: 'button',
        className: 'dsh-bv-tab',
        'data-active': current !== null && workspace.workspaceId === current.workspaceId ? 'true' : 'false',
        onClick: function () { setWorkspace(workspace.workspaceId) },
        title: workspace.path,
      }, workspace.title)
    })

    var detail = null
    if (selectedEntry !== null && selectedEntry.task.sessionId !== null) {
      detail = React.createElement('section', { className: 'dsh-bv-detail' },
        React.createElement('div', { className: 'dsh-bv-detail-head' },
          React.createElement('div', { className: 'dsh-bv-detail-titles' },
            React.createElement('span', { className: 'dsh-bv-detail-title' }, selectedEntry.task.title),
            React.createElement('span', { className: 'dsh-bv-detail-sub' }, t('status.' + selectedEntry.status))),
          React.createElement('div', { className: 'dsh-bv-detail-actions' },
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-mini',
              onClick: function () { openClassicView(services, selectedEntry.task.sessionId) },
            }, t('view.classic')),
            React.createElement('button', {
              type: 'button',
              className: 'dsh-board-iconbtn',
              title: t('board.closeDetail'),
              'aria-label': t('board.closeDetail'),
              onClick: function () { viewStore.set({ taskId: null }) },
            }, React.createElement(CloseIcon)))),
        React.createElement(BoardDetailConversation, {
          sessions: services.sessions,
          sessionId: selectedEntry.task.sessionId,
          SessionProvider: props.SessionProvider,
          renderSlot: props.renderSlot,
          t: t,
        }))
    }

    return React.createElement('div', { className: 'dsh-board-view' },
      React.createElement('div', { className: 'dsh-bv-head' },
        React.createElement('div', { className: 'dsh-bv-tabs' }, tabs),
        React.createElement('div', { className: 'dsh-bv-head-actions' },
          React.createElement('input', {
            className: 'dsh-bv-search',
            value: view.search || '',
            placeholder: t('board.searchTask'),
            onChange: function (event) { viewStore.set({ search: event.target.value }) },
          }),
          React.createElement('button', {
            type: 'button',
            className: 'dsh-board-btn',
            title: t('view.classic'),
            onClick: function () { openClassicView(services, selectedEntry === null ? null : selectedEntry.task.sessionId) },
          }, t('view.classic')),
          React.createElement('button', {
            type: 'button',
            className: 'dsh-board-new',
            disabled: current === null,
            onClick: function () { setForm({ mode: 'new' }) },
            title: t('form.new'),
          }, React.createElement(PlusIcon), t('form.new')))),
      workspaces.length === 0
        ? React.createElement('div', { className: 'dsh-bv-empty' }, t('board.noWorkspace'))
        : React.createElement('div', { className: 'dsh-bv-body' },
          React.createElement('div', { className: 'dsh-bv-board' },
            React.createElement(BoardColumns, {
              decorated: visible,
              cursorId: view.taskId,
              now: now,
              t: t,
              onOpen: function (id) { viewStore.set({ taskId: id }) },
              // Hover only paints CSS; opening the detail pane is click-only.
              onCursor: function () {},
              onEdit: function (id) { setForm({ mode: 'edit', taskId: id }) },
              onDelete: function (id) {
                deleteTask(id)
                if (viewStore.get().taskId === id) viewStore.set({ taskId: null })
              },
              onStart: function (task) { startTask(services.sessions, task, t) },
              onMove: function (id, column) { moveTaskTo(id, column) },
            }),
            visible.length === 0 && decorated.length > 0
              ? React.createElement('div', { className: 'dsh-bv-empty' }, t('board.noMatch'))
              : null),
          detail),
      form === null
        ? null
        : React.createElement(TaskForm, {
          mode: form.mode,
          task: form.taskId === undefined ? undefined : taskStore.list().filter(function (task) { return task.id === form.taskId })[0],
          sessions: services.sessions,
          workspaces: services.workspaces,
          list: list,
          t: t,
          defaultMode: form.mode === 'edit' ? 'new' : (defaultSessionId === null ? 'new' : 'existing'),
          defaultWorkspaceId: current === null ? null : current.workspaceId,
          defaultSessionId: defaultSessionId,
          onClose: function () { setForm(null) },
          onCreated: function (taskId) { setForm(null); viewStore.set({ taskId: taskId }) },
        }))
  }

  // ----------------------------------------------------------------- apply ---

  /** Plugin row name (must equal the client module id). */
  var name = PLUGIN_ID
  /** Required client services. */
  var inject = ['slots', 'locale', 'sessions', 'workspaces']

  /**
   * Register the trigger, the overlay entry and its session-scoped child slot.
   * @param ctx - client root context.
   */
  function apply(ctx) {
    installStyles()
    var locale = ctx.locale
    var slots = ctx.slots
    if (ctx.get('sessions') === undefined) return
    ctx.effect(function () { return locale.register(NS, DICTS) }, 'dsh-board: copy dictionaries')
    ctx.effect(function () {
      return function () {
        if (pollTimer !== null) {
          window.clearInterval(pollTimer)
          pollTimer = null
        }
      }
    }, 'dsh-board: state poll')
    var t = locale.bind(NS)
    void hydrateState()
    var services = {
      sessions: ctx.sessions,
      workspaces: ctx.workspaces,
      resolve: function (name) {
        if (name === 'sessions') return ctx.sessions
        if (name === 'workspaces') return ctx.workspaces
        try {
          return ctx.get(name)
        } catch (error) {
          return undefined
        }
      },
    }

    ctx.effect(function () {
      return slots.inject('sidebar.footer.action', function () {
        return slots.register({
          name: 'sidebar.footer.action',
          id: 'board',
          order: -100,
          label: function () { return t('open') },
          locale: NS,
        }, BoardTrigger)
      })
    }, 'dsh-board: sidebar entry')

    ctx.effect(function () {
      return slots.inject('shell.overlay', function () {
        return slots.register({
          name: 'shell.overlay',
          id: 'board.overlay',
          locale: NS,
          children: {
            'board.chat': { kind: 'single', scope: 'session' },
          },
        }, function OverlayRoot(props) {
          return React.createElement(BoardOverlay, Object.assign({ services: services }, props))
        })
      })
    }, 'dsh-board: overlay entry')

    ctx.effect(function () {
      return slots.inject('board.chat', function () {
        return slots.register({
          name: 'board.chat',
          id: 'native',
          locale: NS,
        }, BoardChat)
      })
    }, 'dsh-board: conversation body')

    // ---- board view (main panel) ----

    ctx.effect(function () {
      return slots.inject('sidebar.panellist', function () {
        return slots.register({
          name: 'sidebar.panellist',
          id: 'board',
          order: 12,
          label: function () { return t('view.board') },
        }, BoardPanelIcon)
      })
    }, 'dsh-board: board panel icon')

    ctx.effect(function () {
      return slots.inject('main', function () {
        return slots.register({
          name: 'main',
          key: 'board',
          locale: NS,
          children: {
            'board.detail': { kind: 'single', scope: 'session' },
          },
        }, function BoardPanelRoot(props) {
          return React.createElement(BoardView, Object.assign({ services: services }, props))
        })
      })
    }, 'dsh-board: board panel')

    ctx.effect(function () {
      return slots.inject('board.detail', function () {
        return slots.register({
          name: 'board.detail',
          id: 'native',
          locale: NS,
        }, BoardDetailBody)
      })
    }, 'dsh-board: board detail body')

    ctx.effect(function () {
      return slots.inject('conversation.session.header.utilities', function () {
        return slots.register({
          name: 'conversation.session.header.utilities',
          id: 'board',
          order: 10,
          locale: NS,
        }, function ToggleRoot(props) {
          return React.createElement(BoardConversationToggle, Object.assign({ services: services }, props))
        })
      })
    }, 'dsh-board: conversation header toggle')
  }

  window.__ModuleLoader__.load({
    id: PLUGIN_ID,
    factory: function (require) {
      React = require('react')
      StateDot = require('@deepseek-ai/dsh-client-ui-primitives').StateDot
      return { name: name, inject: inject, apply: apply }
    },
  })
})()
