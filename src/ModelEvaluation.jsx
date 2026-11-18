import { useState } from 'react';
import { Card, number } from './ui.jsx';

const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 2 });
const choices = [
  ['ensemble', 'مدل ترکیبی'],
  ['lightgbm', 'LightGBM'],
  ['catboost', 'CatBoost'],
];
const metrics = [
  ['accuracy', 'درستی کل', 'سهم پیش‌بینی‌های درست از کل نمونه‌ها'],
  ['precision', 'دقت تشخیص حمله', 'سهم حملات واقعی از مواردی که مدل حمله تشخیص داده است'],
  ['recall', 'نرخ کشف حمله', 'سهم حملات کشف‌شده از کل حملات واقعی'],
  ['f1', 'امتیاز F1', 'میانگین هارمونیک دقت و نرخ کشف حمله'],
  ['false_positive_rate', 'نرخ هشدار کاذب', 'سهم هشدارهای کاذب از کل نمونه‌های سالم'],
  ['roc_auc', 'مساحت زیر منحنی ROC', 'توان تفکیک حمله از نمونهٔ سالم در آستانه‌های مختلف'],
];

function ConfusionMatrix({ matrix }) {
  const [[tn, fp], [fn, tp]] = matrix;
  const total = tn + fp + fn + tp;
  return <div className="evaluation-matrix">
    <table>
      <caption>ماتریس خطا · {number.format(total)} نمونهٔ آزمون</caption>
      <thead><tr><th scope="col">کلاس واقعی</th><th scope="col">پیش‌بینی سالم</th><th scope="col">پیش‌بینی حمله</th></tr></thead>
      <tbody>
        <tr>
          <th scope="row">سالم</th>
          <td className="evaluation-correct"><strong>{number.format(tn)}</strong><span>سالمِ درست</span></td>
          <td className="evaluation-error"><strong>{number.format(fp)}</strong><span>هشدار کاذب</span></td>
        </tr>
        <tr>
          <th scope="row">حمله</th>
          <td className="evaluation-error"><strong>{number.format(fn)}</strong><span>حملهٔ کشف‌نشده</span></td>
          <td className="evaluation-correct"><strong>{number.format(tp)}</strong><span>حملهٔ کشف‌شده</span></td>
        </tr>
      </tbody>
    </table>
    <p>از {number.format(tp + fn)} نمونهٔ حمله، {number.format(tp)} مورد درست تشخیص داده شد.</p>
  </div>;
}

export default function ModelEvaluation({ model }) {
  const [selected, setSelected] = useState('ensemble');
  const reports = { ...model.evaluation, ensemble: model.evaluation?.ensemble ?? model.test_metrics };
  const available = choices.filter(([key]) => reports[key]);
  const current = available.find(([key]) => key === selected) ?? available[0];
  const report = current && reports[current[0]];
  const reportedMetrics = metrics.filter(([key]) => Number.isFinite(report?.[key]));

  return <Card title="ارزیابی روی مجموعهٔ آزمون"
    detail={Number.isFinite(model.threshold) ? `آستانهٔ تصمیم برای ماتریس خطا ${percent.format(model.threshold)}` : undefined}
    action={available.length > 1 && <select aria-label="مدل ارزیابی" value={current[0]} onChange={event => setSelected(event.target.value)}>
      {available.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>}>
    {!report ? <p className="notice">گزارش ارزیابی برای این مدل در دسترس نیست.</p> :
      <div className="evaluation-grid">
        {report.confusion_matrix && <ConfusionMatrix matrix={report.confusion_matrix} />}
        {reportedMetrics.length > 0 && <ul className="evaluation-metrics" aria-label="نمودار معیارهای ارزیابی">
          {reportedMetrics.map(([key, label, description]) => <li key={key}>
            <div><strong>{label}</strong><bdi>{percent.format(report[key])}</bdi></div>
            <meter aria-label={label} min={0} max={1} value={report[key]}
              className={key === 'false_positive_rate' ? 'evaluation-false-rate' : undefined} />
            <small>{description}</small>
          </li>)}
        </ul>}
      </div>}
  </Card>;
}
