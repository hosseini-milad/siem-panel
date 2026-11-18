import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Circle, Hash, MessageSquare, Pencil, Plus, RefreshCw, Star, UserRound, UsersRound, X } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { liveApi } from './api.js';
import { Badge, Card, number, Resource, Table, useResource } from './ui.jsx';

const priorities = {
  low: ['کم', 'muted'], normal: ['عادی', 'blue'], high: ['زیاد', 'amber'], urgent: ['فوری', 'red'],
};
const audiences = { participants: 'اعضای تسک', branch: 'دارندگان دسترسی تسک در شاخه', selected: 'اعضای تسک و کاربران منتخب' };
const date = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Tehran' });

function TaskDialog({ title, close, children }) {
  const dialog = useRef(null);
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} className="record-dialog task-dialog" onClose={close} aria-labelledby="task-dialog-title">
    <header className="card-header"><h2 id="task-dialog-title">{title}</h2>
      <button className="icon-button" type="button" aria-label="بستن" onClick={() => dialog.current.close()}><X size={18} /></button>
    </header>
    {children}
  </dialog>;
}

function Priority({ value }) {
  const [label, tone] = priorities[value];
  return <Badge tone={tone}>{label}</Badge>;
}

function PeopleFields({ candidates, selected, name, label }) {
  return <fieldset className="task-assignees"><legend>{label}</legend>
    {candidates.map(person => <label key={person.id} className="task-checkbox">
      <input name={name} type="checkbox" value={person.id} defaultChecked={selected.includes(person.id)} />
      <span>{person.name} · <bdi>{person.username}</bdi></span>
    </label>)}
    {!candidates.length && <small>حساب فعالی در این محدوده وجود ندارد.</small>}
  </fieldset>;
}

function AssignmentFields({ candidates, task }) {
  return <>
    <label>اولویت<select name="priority" aria-label="اولویت" defaultValue={task?.priority ?? 'normal'}>
      {Object.entries(priorities).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <PeopleFields candidates={candidates} selected={task?.assignees.map(item => item.id) ?? []}
      name="assignees" label="ارجاع به یک یا چند نفر" />
  </>;
}

function readTags(fields) {
  const tags = fields.getAll('tags');
  const draft = fields.get('tag-draft')?.trim();
  if (draft && !tags.some(tag => tag.toLowerCase() === draft.toLowerCase())) tags.push(draft);
  return tags;
}

function TagField({ tags = [], suggestions = [] }) {
  const [selected, setSelected] = useState(tags);
  const [draft, setDraft] = useState('');
  const found = new Set(selected.map(tag => tag.toLowerCase()));
  const available = [...new Map(suggestions.map(tag => [tag.toLowerCase(), tag])).values()]
    .filter(tag => !found.has(tag.toLowerCase()) && tag.toLowerCase().includes(draft.trim().toLowerCase()));

  function add(value) {
    const tag = value.trim();
    if (tag && selected.length < 8 && !found.has(tag.toLowerCase())) setSelected([...selected, tag]);
    setDraft('');
  }

  return <fieldset className="task-tag-editor"><legend>تگ‌ها</legend>
    <div className="task-tags">
      {selected.map(tag => <span className="task-tag-choice" key={tag}>
        <input type="hidden" name="tags" value={tag} />
        <bdi>{tag}</bdi>
        <button type="button" aria-label={`حذف تگ ${tag}`}
          onClick={() => setSelected(selected.filter(item => item !== tag))}><X size={12} /></button>
      </span>)}
    </div>
    <input name="tag-draft" aria-label="تگ جدید" placeholder="نام تگ، سپس Enter" maxLength={24}
      disabled={selected.length >= 8} value={draft} onChange={event => setDraft(event.target.value)}
      onKeyDown={event => {
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
        event.preventDefault();
        add(draft);
      }} />
    {selected.length < 8 && available.length > 0 && <div className="task-tag-suggestions" aria-label="تگ‌های موجود">
      {available.map(tag => <button type="button" className="button" key={tag} onClick={() => add(tag)}><Plus size={12} />{tag}</button>)}
    </div>}
    <small>حداکثر ۸ تگ</small>
  </fieldset>;
}

function Tags({ tags }) {
  if (!tags?.length) return null;
  return <div className="task-tags">{tags.map(tag => <bdi key={tag}>{tag}</bdi>)}</div>;
}

function TaskCard({ task, user, onOpen, onDragStart, onDragEnd, draggable }) {
  const stars = Object.keys(priorities).indexOf(task.priority) + 1;
  return <button className="kanban-card task-record-card" type="button" onClick={onOpen} draggable={draggable}
    onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <strong>{task.title}</strong>
    <div className="task-record-meta">
      <span><Hash size={15} />شمارهٔ تسک <bdi dir="ltr">{task.id.slice(0, 8)}</bdi></span>
      <span><UserRound size={15} />ایجادکننده <bdi>{task.creator}</bdi></span>
      <span><CalendarDays size={15} />تاریخ ایجاد <bdi>{date.format(new Date(task.created_at))}</bdi></span>
      <span><Pencil size={15} />آخرین تغییردهنده <bdi>{task.updated_by ?? task.creator}</bdi></span>
    </div>
    <Tags tags={task.tags} />
    <div className="task-record-footer">
      <span className="task-stars" title={`اولویت ${priorities[task.priority][0]}`}>
        <span className="task-star-label">{priorities[task.priority][0]}</span>
        {Array.from({ length: 4 }, (_, index) =>
          <Star key={index} size={14} className={index < stars ? 'is-filled' : ''} aria-hidden="true" />)}
      </span>
      <span className="task-avatar-stack">
        {task.assignees.map(person => <Avatar key={person.id} person={person.id === user.id ? user : person} />)}
      </span>
      <span title="کامنت‌ها"><MessageSquare size={15} />{number.format(task.comment_count)}</span>
    </div>
  </button>;
}

function NewTask({ candidates, suggestions, onSave }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const assignees = fields.getAll('assignees');
    if (!assignees.length || assignees.length > 20) {
      setError('بین ۱ تا ۲۰ نفر انتخاب کنید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await liveApi('/tasks', { method: 'POST', body: {
        title: fields.get('title').trim(), description: fields.get('description').trim(),
        priority: fields.get('priority'), assignees, tags: readTags(fields),
      } });
      onSave();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return <form className="account-form user-editor" onSubmit={submit}>
    <label>عنوان<input name="title" required maxLength={120} /></label>
    <label>شرح<textarea className="task-description-input" name="description" rows={3} maxLength={4000} /></label>
    <TagField suggestions={suggestions} />
    <AssignmentFields candidates={candidates} />
    {error && <p className="notice error" role="alert">{error}</p>}
    <div><button className="button primary" disabled={busy || !candidates.length}><Plus size={16} />ثبت تسک</button></div>
  </form>;
}

function TaskDetails({ task, columns, candidates, suggestions, onUpdate }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(path, method, body) {
    setError('');
    setBusy(true);
    try {
      onUpdate(await liveApi('/tasks/' + task.id + path, { method,
        body: method === 'PATCH' ? { ...body, revision: task.revision } : body }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function assign(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const assignees = fields.getAll('assignees');
    if (!assignees.length || assignees.length > 20) {
      setError('بین ۱ تا ۲۰ نفر انتخاب کنید.');
      return;
    }
    send('', 'PATCH', { priority: fields.get('priority'), assignees, tags: readTags(fields) });
  }

  return <div className="task-detail">
    <div className="task-meta"><Priority value={task.priority} />
      <span>ثبت‌کننده {task.creator}</span>
      <span>{task.closed_at ? 'خاتمه ' : 'ثبت '}{date.format(new Date(task.closed_at ?? task.created_at))}</span>
    </div>
    <Tags tags={task.tags} />
    {task.description && <p className="task-description">{task.description}</p>}
    <p className="task-people"><UsersRound size={17} />{task.assignees.map(person => person.name).join('، ')}</p>
    {task.can_move && <form className="account-form" key={task.revision} onSubmit={event => {
      event.preventDefault();
      send('', 'PATCH', { column_id: new FormData(event.currentTarget).get('column') });
    }}>
      <label>وضعیت<select name="column" aria-label="وضعیت" defaultValue={task.column_id}>
        {columns.filter(column => column.id !== 'done').map(column => <option key={column.id} value={column.id}>{column.title}</option>)}
      </select></label>
      <div className="account-actions">
        <button className="button" disabled={busy}>ثبت وضعیت</button>
        <button type="button" className="button" disabled={busy} onClick={() => {
          if (window.confirm('تسک خاتمه یابد؟')) send('', 'PATCH', { column_id: 'done' });
        }}><Check size={16} />خاتمهٔ تسک</button>
      </div>
    </form>}
    {task.can_assign && <form className="account-form" key={'assignment-' + task.revision} onSubmit={assign}>
      <TagField tags={task.tags} suggestions={suggestions} />
      <AssignmentFields candidates={candidates} task={task} />
      <div><button className="button" disabled={busy}>به‌روزرسانی ارجاع و اولویت</button></div>
    </form>}
    <section className="task-thread">
      <h3><MessageSquare size={17} />کامنت‌ها</h3>
      {task.comments.length === 0 && <small>هنوز کامنتی ثبت نشده است.</small>}
      {task.comments.map(comment => <article key={comment.id}>
        <header><strong>{comment.author}</strong><small>{date.format(new Date(comment.created_at))}</small></header>
        <p>{comment.text}</p>
      </article>)}
      {task.can_comment && <form className="account-form" key={task.comment_count} onSubmit={event => {
        event.preventDefault();
        const text = new FormData(event.currentTarget).get('text').trim();
        if (text) send('/comments', 'POST', { text });
      }}>
        <label>کامنت جدید<textarea className="task-comment-input" name="text" rows={2} maxLength={2000} required /></label>
        <div><button className="button primary" disabled={busy}><MessageSquare size={15} />ارسال کامنت</button></div>
      </form>}
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

function OpenTask({ id, columns, candidates, suggestions, onUpdate }) {
  const details = useResource('/tasks/' + id, {}, 0, liveApi);
  const [updated, setUpdated] = useState(null);
  return <Resource result={details}>{task => <TaskDetails task={updated ?? task} columns={columns} candidates={candidates} suggestions={suggestions}
    onUpdate={item => { setUpdated(item); onUpdate(); }} />}</Resource>;
}

function ColumnTasks({ column, renderCard, onExpire }) {
  const [state, setState] = useState({ items: [], cursor: null, total: 0 });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  async function load(before) {
    if (pending.current) return;
    const request = generation.current;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const query = { column_id: column.id, limit: 5, before };
      const data = await liveApi('/tasks', { query });
      if (!mounted.current || request !== generation.current) return;
      setState(previous => ({
        items: before ? [...new Map([...previous.items, ...data.items].map(item => [item.id, item])).values()] : data.items,
        cursor: data.next_cursor, total: data.total ?? previous.total,
      }));
    } catch (failure) {
      if (mounted.current && request === generation.current) setError(failure.message);
    } finally {
      if (mounted.current && request === generation.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    generation.current += 1;
    mounted.current = true;
    pending.current = false;
    load(null);
    return () => { mounted.current = false; };
  }, [column.id]);

  useEffect(() => {
    const deadlines = state.items.filter(task => task.closed_at).map(task => ({
      id: task.id, until: Date.parse(task.closed_at) + 86_400_000,
    }));
    if (!deadlines.length) return;
    const next = Math.min(...deadlines.map(item => item.until));
    const timer = window.setTimeout(() => {
      const expired = new Set(deadlines.filter(item => item.until <= Date.now()).map(item => item.id));
      setState(previous => ({
        ...previous, items: previous.items.filter(task => !expired.has(task.id)),
        total: Math.max(0, previous.total - expired.size),
      }));
      onExpire(expired);
    }, Math.max(100, next - Date.now()));
    return () => window.clearTimeout(timer);
  }, [state.items, onExpire]);

  return <>
    <header><h2>{column.id === 'done' ? <Check size={17} /> : <Circle size={14} />}{column.title}</h2>
      <span>{number.format(state.total)}</span></header>
    <div className="kanban-scroll" tabIndex={0} aria-label={`تسک‌های ${column.title}`}
      onScroll={event => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        if (state.cursor && !error && scrollHeight - scrollTop - clientHeight < 64) load(state.cursor);
      }}>
      {state.items.map(renderCard)}
      {busy && <p className="kanban-empty" role="status">در حال بارگذاری…</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
      {!busy && !error && state.items.length === 0 && <p className="kanban-empty">تسکی ندارد</p>}
      {!busy && (state.cursor || error) && <button className="button" type="button"
        onClick={() => load(state.cursor)}>{error ? 'تلاش دوباره' : 'تسک‌های بیشتر'}</button>}
    </div>
  </>;
}

export default function Tasks({ user }) {
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const page = useResource('/tasks', { metadata_only: true }, revision, liveApi);
  const [openPage, setOpenPage] = useState(null);
  const dragging = useRef(null);
  const [dragSource, setDragSource] = useState(null);
  const [target, setTarget] = useState(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  const refresh = () => setRevision(value => value + 1);
  const close = () => setSelected(null);
  const expire = expired => setSelected(current => expired.has(current?.id) ? null : current);

  function endDrag() {
    dragging.current = null;
    setDragSource(null);
    setTarget(null);
  }

  async function drop(event, column) {
    const task = dragging.current;
    if (!task || column === task.column_id || !task.move_columns.includes(column)) return;
    event.preventDefault();
    endDrag();
    if (column === 'done' && !window.confirm('تسک خاتمه یابد؟')) return;
    setMoveError('');
    setMoving(true);
    try {
      await liveApi('/tasks/' + task.id, {
        method: 'PATCH', body: { column_id: column, revision: task.revision },
      });
    } catch (error) {
      setMoveError(error.message);
    } finally {
      setMoving(false);
      refresh();
    }
  }

  return <div className="task-page">
    {moveError && <p className="notice error" role="alert">{moveError}</p>}
    <Resource result={page}>{data => <>
      <div className="task-toolbar">
        {data.can_create && <button className="button primary" onClick={() => {
          setOpenPage(data);
          setSelected('new');
        }}><Plus size={17} />تسک جدید</button>}
        <button className="button" onClick={refresh}><RefreshCw size={16} />تازه‌سازی تابلو</button>
      </div>
      <div className="kanban" role="region" aria-label="تابلوی کانبان" tabIndex={0}>
        {data.columns.map(column => {
          return <section className={`kanban-column ${target === column.id ? 'is-drop-target' : ''}`}
            key={column.id} aria-label={column.title}
            onDragOver={event => {
              if (dragging.current?.move_columns.includes(column.id) && dragging.current.column_id !== column.id) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setTarget(column.id);
              }
            }}
            onDragLeave={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setTarget(current => current === column.id ? null : current);
            }}
            onDrop={event => drop(event, column.id)}>
            <ColumnTasks key={revision} column={column} onExpire={expire} renderCard={task =>
              <TaskCard key={task.id} task={task} user={user} draggable={task.can_move && !moving}
                onDragStart={event => {
                  dragging.current = task;
                  setDragSource(task.column_id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', task.id);
                }}
                onDragEnd={endDrag} onOpen={() => {
                  if (dragSource || moving) return;
                  setOpenPage(data);
                  setSelected(task);
                }} />} />
          </section>;
        })}
      </div>
    </>}</Resource>
    {selected && <TaskDialog title={selected === 'new' ? 'تسک جدید' : selected.title} close={close}>
      {selected === 'new' ? <NewTask candidates={openPage.assignees} suggestions={openPage.tag_suggestions} onSave={() => {
        close(); refresh();
      }} /> : <OpenTask id={selected.id} columns={openPage.columns.filter(column => selected.move_columns.includes(column.id))} candidates={openPage.assignees} suggestions={openPage.tag_suggestions} onUpdate={refresh} />}
    </TaskDialog>}
  </div>;
}

export function TaskColumns({ canWrite }) {
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(null);
  const [audience, setAudience] = useState('participants');
  function open(column) {
    setError('');
    setAudience(column.audience ?? 'participants');
    setEditing(column);
  }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const result = useResource('/task-columns', {}, revision, liveApi);

  async function save(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    try {
      await liveApi('/task-columns' + (editing.id ? '/' + editing.id : ''), {
        method: editing.id ? 'PATCH' : 'POST',
        body: { title: values.get('title').trim(), position: Number(values.get('position')), audience, viewers: values.getAll('viewers') },
      });
      setEditing(null);
      setRevision(value => value + 1);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'title', label: 'ستون' },
    { key: 'position', label: 'ترتیب', render: row => row.id === 'done' ? 'پایانی' : number.format(row.position) },
    { key: 'audience', label: 'مشاهده', render: row => audiences[row.audience] },
    ...(canWrite ? [{ key: 'actions', label: 'عملیات', render: row => <button className="button" type="button"
      onClick={() => open(row)}><Pencil size={15} />ویرایش</button> }] : []),
  ];
  return <Resource result={result}>{data => <div className="task-page">
    <Card title="ستون‌های تابلو" detail="مقدار کمتر، ستون را زودتر در تابلو نشان می‌دهد."
      action={<div className="account-actions">
        {canWrite && <button className="button primary" onClick={() => open({})}><Plus size={17} />ستون جدید</button>}
        <button className="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />تازه‌سازی ستون‌ها</button>
      </div>}>
      <Table columns={columns} rows={data.items} />
    </Card>
    {canWrite && editing && <TaskDialog title={editing.id ? 'ویرایش ستون' : 'ستون جدید'} close={() => setEditing(null)}>
      <form className="account-form user-editor" onSubmit={save}>
        <label>نام ستون<input name="title" required maxLength={60} defaultValue={editing.title ?? ''} /></label>
        <label>ترتیب<input name="position" type="number" min="1" max="999" required
          readOnly={editing.id === 'done'} defaultValue={editing.id === 'done' ? 999 : editing.position ?? 30} /></label>
        <label>مجوز مشاهده<select name="audience" aria-label="مجوز مشاهده" value={audience} onChange={event => setAudience(event.target.value)}>
          <option value="participants">{audiences.participants}</option>
          {data.allow_branch && <><option value="branch">{audiences.branch}</option>
            <option value="selected">{audiences.selected}</option></>}
        </select></label>
        {audience === 'selected' && <PeopleFields candidates={data.members} selected={editing.viewers ?? []}
          name="viewers" label="مشاهده‌کنندگان ستون" />}
        {error && <p className="notice error" role="alert">{error}</p>}
        <button className="button primary" disabled={busy}><Check size={16} />ذخیره ستون</button>
      </form>
    </TaskDialog>}
  </div>}</Resource>;
}
