import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Circle, Hash, LayoutGrid, MessageSquare, Pencil, Plus, RefreshCw, Star, UserRound, UsersRound, X } from 'lucide-react';
import { liveApi } from './api.js';
import { Badge, Card, number, Pagination, Resource, Table, useResource } from './ui.jsx';

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

function tagValues(value) {
  return value.split(/[,،]/).map(tag => tag.trim()).filter(Boolean);
}

function TagField({ tags = [] }) {
  return <label>تگ‌ها<input name="tags" placeholder="مثلاً طراحی، پیگیری" defaultValue={tags.join('، ')} maxLength={220} />
    <small>حداکثر ۸ تگ با جداکنندهٔ ویرگول</small></label>;
}

function Tags({ tags }) {
  if (!tags?.length) return null;
  return <div className="task-tags">{tags.map(tag => <bdi key={tag}>{tag}</bdi>)}</div>;
}

function TaskCard({ task, onOpen }) {
  const stars = Object.keys(priorities).indexOf(task.priority) + 1;
  return <button className="kanban-card task-record-card" type="button" onClick={onOpen}>
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
      <span title={task.assignees.map(person => person.name).join('، ')}><UsersRound size={15} />
        <span>{number.format(task.assignees.length)}</span></span>
      <span title="کامنت‌ها"><MessageSquare size={15} />{number.format(task.comment_count)}</span>
    </div>
  </button>;
}

function NewTask({ candidates, onSave }) {
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
        priority: fields.get('priority'), assignees, tags: tagValues(fields.get('tags')),
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
    <label>شرح<textarea name="description" rows={3} maxLength={4000} /></label>
    <TagField />
    <AssignmentFields candidates={candidates} />
    {error && <p className="notice error" role="alert">{error}</p>}
    <div><button className="button primary" disabled={busy || !candidates.length}><Plus size={16} />ثبت تسک</button></div>
  </form>;
}

function TaskDetails({ task, columns, candidates, onUpdate }) {
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
    send('', 'PATCH', { priority: fields.get('priority'), assignees, tags: tagValues(fields.get('tags')) });
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
      <TagField tags={task.tags} />
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
        <label>کامنت جدید<textarea name="text" rows={2} maxLength={2000} required /></label>
        <div><button className="button primary" disabled={busy}><MessageSquare size={15} />ارسال کامنت</button></div>
      </form>}
    </section>
    {error && <p className="notice error" role="alert">{error}</p>}
  </div>;
}

function OpenTask({ id, columns, candidates, onUpdate }) {
  const details = useResource('/tasks/' + id, {}, 0, liveApi);
  const [updated, setUpdated] = useState(null);
  return <Resource result={details}>{task => <TaskDetails task={updated ?? task} columns={columns} candidates={candidates}
    onUpdate={item => { setUpdated(item); onUpdate(); }} />}</Resource>;
}

function Board({ board }) {
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const page = useResource('/tasks', { board, offset }, revision, liveApi);
  const [openPage, setOpenPage] = useState(null);
  const refresh = () => setRevision(value => value + 1);
  const close = () => setSelected(null);
  useEffect(() => {
    const deadlines = (page.data?.items ?? []).filter(task => task.closed_at).map(task => ({
      id: task.id, until: Date.parse(task.closed_at) + 86_400_000,
    }));
    if (!deadlines.length) return;
    const next = Math.min(...deadlines.map(item => item.until));
    const timer = window.setTimeout(() => {
      setSelected(current => deadlines.some(item => item.id === current?.id && item.until <= Date.now()) ? null : current);
      setRevision(value => value + 1);
    }, Math.max(250, next - Date.now()));
    return () => window.clearTimeout(timer);
  }, [page.data]);

  return <>
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
          const tasks = data.items.filter(task => task.column_id === column.id);
          return <section className="kanban-column" key={column.id} aria-label={column.title}>
            <header><h2>{column.id === 'done' ? <Check size={17} /> : <Circle size={14} />}{column.title}</h2>
              <span>{number.format(tasks.length)}</span></header>
            {tasks.map(task => <TaskCard key={task.id} task={task} onOpen={() => {
              setOpenPage(data);
              setSelected(task);
            }} />)}
            {!tasks.length && <p className="kanban-empty">تسکی ندارد</p>}
          </section>;
        })}
      </div>
      <Pagination page={data} onOffset={setOffset} />
    </>}</Resource>
    {selected && <TaskDialog title={selected === 'new' ? 'تسک جدید' : selected.title} close={close}>
      {selected === 'new' ? <NewTask candidates={openPage.assignees} onSave={() => {
        close(); setOffset(0); refresh();
      }} /> : <OpenTask id={selected.id} columns={openPage.columns} candidates={openPage.assignees} onUpdate={refresh} />}
    </TaskDialog>}
  </>;
}

export default function Tasks() {
  const boards = useResource('/tasks/boards', {}, 0, liveApi);
  const [selected, setSelected] = useState(null);
  return <Resource result={boards}>{data => {
    const board = data.items.find(item => item.id === selected) ?? data.items[0];
    return <div className="task-page">
      <label className="task-board-picker"><LayoutGrid size={18} />تابلو
        <select aria-label="تابلو" value={board.id} onChange={event => setSelected(event.target.value)}>
          {data.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <Board key={board.id} board={board.id} />
    </div>;
  }}</Resource>;
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
