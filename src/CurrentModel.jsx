import { useState } from 'react';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { liveApi } from './api.js';
import ModelEvaluation from './ModelEvaluation.jsx';
import { Badge, Card, number, Resource, Table, useResource } from './ui.jsx';

const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 2 });
const score = new Intl.NumberFormat('fa-IR', { maximumSignificantDigits: 6 });
const formats = { standard: 'رکورد استاندارد', matrix: 'ماتریس', raw: 'رکورد خام' };
const technical = value => <bdi className="mono">{value}</bdi>;
const columns = [
  { key: 'position', label: 'ستون', render: row => number.format(row.position) },
  { key: 'id', label: 'ویژگی', render: row => technical(row.id) },
  { key: 'light', label: 'اهمیت LightGBM (Gain)', render: row => row.light == null ? '—' : score.format(row.light) },
  { key: 'cat', label: 'اهمیت CatBoost', render: row => row.cat == null ? '—' : score.format(row.cat) },
];

function download(model) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'siem-current-model.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Prediction({ model, rawAvailable, maxRows }) {
  const [format, setFormat] = useState('standard');
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setResult(null);
    setError('');
    let rows;
    try {
      rows = JSON.parse(input);
    } catch {
      setError('ورودی باید JSON معتبر باشد.');
      return;
    }
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > maxRows) {
      setError(`آرایه‌ای با ۱ تا ${number.format(maxRows)} ردیف وارد کنید.`);
      return;
    }
    setBusy(true);
    try {
      const matrix = format === 'matrix';
      setResult(await liveApi(matrix ? '/ml/predict-matrix' : '/ml/predict', {
        method: 'POST',
        body: matrix ? { matrix: rows } : { records: rows, input_format: format, persist: false },
      }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  function fillExample() {
    const values = model.features.map(() => 0);
    const row = format === 'matrix' ? values : Object.fromEntries(model.features.map((name, index) => [name, values[index]]));
    setInput(JSON.stringify([row], null, 2));
    setError('');
    setResult(null);
  }

  return <Card title="آزمایش پیش‌بینی" detail="یک آرایهٔ JSON ارسال کنید. نتیجه در پایگاه داده ذخیره نمی‌شود.">
    <form className="model-form" onSubmit={submit}>
      <label>قالب ورودی <select value={format} disabled={busy} onChange={event => {
        setFormat(event.target.value);
        setInput('');
        setResult(null);
        setError('');
      }}>
        {Object.entries(formats).filter(([key]) => key !== 'raw' || rawAvailable)
          .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>آرایهٔ JSON
        <textarea dir="ltr" rows={6} value={input} required disabled={busy}
          onChange={event => setInput(event.target.value)} />
      </label>
      <div className="model-actions">
        <button className="button primary" disabled={busy || model.serving_eligible === false}>
          {busy ? 'در حال پیش‌بینی…' : 'اجرای پیش‌بینی'}
        </button>
        {format !== 'raw' && <button type="button" className="button" disabled={busy} onClick={fillExample}>درج نمونه</button>}
      </div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {result && <div role="status">
        <p>{number.format(result.count)} پیش‌بینی انجام شد.</p>
        <pre dir="ltr" tabIndex={0}>{JSON.stringify(result, null, 2)}</pre>
      </div>}
    </form>
  </Card>;
}

function ModelDetails({ model, canWrite }) {
  const { features, ensemble = {} } = model;
  const requirements = model.input_requirements;
  const rawAvailable = requirements?.raw.available ?? Boolean(model.normalization_schema?.length && model.behavior_bounds);
  const maxRows = requirements?.max_rows ?? 10000;
  const rows = features.map((id, index) => ({
    id, position: index + 1,
    light: model.feature_importance_gain?.[id],
    cat: model.feature_importance_catboost?.[id],
  }));
  const models = [
    ['LightGBM', ensemble.lightgbm_weight],
    ['CatBoost', ensemble.catboost_weight],
  ];
  return <>
    <Card title={model.algorithm} action={<Badge tone={model.serving_eligible === false ? 'amber' : 'green'}>
      {model.serving_eligible === false ? 'پیش‌بینی غیرفعال' : 'آمادهٔ پیش‌بینی'}
    </Badge>}>
      <div className="model-summary">
        <span>تعداد ویژگی‌ها <strong>{number.format(features.length)}</strong></span>
        <span>آستانهٔ تشخیص <strong>{percent.format(model.threshold)}</strong></span>
        {model.created_at && <span>زمان آموزش <time dateTime={model.created_at}>{new Date(model.created_at).toLocaleString('fa-IR')}</time></span>}
      </div>
      {model.serving_block_reason && <p className="notice" role="status">{model.serving_block_reason}</p>}
    </Card>
    <Card title="نمای شماتیک و وزن‌های ترکیب" detail="مدل‌ها احتمال تولید می‌کنند. وزن‌ها سهم هر مدل را در ترکیب احتمال‌ها تعیین می‌کنند.">
      <ol className="model-flow">
        <li>رکورد یا ماتریس ورودی<br /><small>{rawAvailable ? 'پیش‌پردازش رکورد خام در صورت انتخاب' : 'رکورد استاندارد یا ماتریس آماده'}</small></li>
        <li>ماتریس ویژگی‌ها<br /><small>{number.format(features.length)} ستون مرتب</small></li>
        <li className="model-branches">{models.map(([name, weight]) =>
          <div key={name}>{technical(name)} <strong>{weight == null ? '—' : percent.format(weight)}</strong></div>)}</li>
        <li>ترکیب وزنی احتمال‌ها<br /><small>کالیبراسیون Platt</small></li>
        <li>احتمال حمله و برچسب<br /><small>آستانهٔ {percent.format(model.threshold)}</small></li>
      </ol>
    </Card>
    <ModelEvaluation model={model} />
    <Card title="ویژگی‌ها به ترتیب ورودی" detail="اهمیت‌ها با معیار همان مدل نمایش داده می‌شوند و مقیاس‌های متفاوتی دارند.">
      <Table columns={columns} rows={rows} />
    </Card>
    <Card title="نیازمندی‌های ورودی" detail={`هر درخواست ${number.format(requirements?.min_rows ?? 1)} تا ${number.format(maxRows)} ردیف می‌پذیرد.`}>
      <dl className="model-requirements">
        <dt>رکورد استاندارد</dt>
        <dd>هر رکورد باید تمام ویژگی‌های جدول را با نام دقیق و مقادیر عددی متناهی از ۰ تا ۱ داشته باشد.
          {requirements?.standard.ignored_fields.length > 0 && <> فیلدهای نادیده‌گرفته‌شده {technical(requirements.standard.ignored_fields.join(', '))}</>}
        </dd>
        <dt>ماتریس</dt>
        <dd>هر ردیف باید {number.format(requirements?.matrix.columns ?? features.length)} مقدار متناهی از ۰ تا ۱، دقیقاً به ترتیب جدول داشته باشد. داده به {technical(requirements?.matrix.dtype ?? 'float32')} تبدیل می‌شود.</dd>
        <dt>رکورد خام</dt>
        <dd>{rawAvailable ? <>
          فیلدها باید تخت و مطابق طرح آموزش باشند. ردیف‌های هر درخواست با هم یک بلوک رفتاری تشکیل می‌دهند.
          {requirements?.raw.ignored_fields.length > 0 && <> فیلدهای مستثنا {technical(requirements.raw.ignored_fields.join(', '))}</>}
          <details><summary>فیلدهای خام مدل</summary><ul>
            {(requirements?.raw.fields ?? model.normalization_schema.map(stat => ({ name: stat.field, kind: stat.kind })))
              .map(field => <li key={field.name}>{technical(field.name)} ({technical(field.kind)})</li>)}
          </ul></details>
        </> : 'مدل جاری اطلاعات پیش‌پردازش ورودی خام را ندارد.'}</dd>
      </dl>
    </Card>
    {canWrite && <Prediction model={model} rawAvailable={rawAvailable} maxRows={maxRows} />}
  </>;
}

export default function CurrentModel({ canWrite, showAnalytics }) {
  const [revision, setRevision] = useState(0);
  const model = useResource('/ml/model', {}, revision, liveApi);
  const unavailable = model.error === 'No trained model is active';
  return <div className="model-page">
    <div className="model-actions">
      <button className="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /> تازه‌سازی</button>
      <button className="button" disabled={!model.data} onClick={() => download(model.data)}><Download size={16} /> دریافت JSON</button>
      {showAnalytics && <a className="button" href="#analytics"><ArrowLeft size={16} /> تحلیل هوشمند</a>}
    </div>
    {unavailable ? <p className="notice" role="status">هنوز مدل آموزش‌دیده‌ای فعال نیست.</p>
      : <Resource result={model}>{data => <ModelDetails key={revision} model={data} canWrite={canWrite} />}</Resource>}
  </div>;
}
