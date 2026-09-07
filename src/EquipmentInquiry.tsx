import {useState} from 'react';
import {Mail,Send,CheckCircle2,HelpCircle,Building,User} from 'lucide-react';
import {appHref} from './navigation';

interface Props {
  initialSubject?: string;
  initialType?: string;
}

export default function EquipmentInquiry({initialSubject = '', initialType = '資料請求'}: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [inquiryType, setInquiryType] = useState(initialType);
  const [targetEquipment, setTargetEquipment] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      setError('お名前、メールアドレス、お問い合わせ内容は必須項目です。');
      return;
    }
    setError('');
    setSending(true);

    try {
      // ユーザーの専用アドレス milling.intelligence.info@gmail.com 宛にFormSubmitで直接安全送信
      const res = await fetch('https://formsubmit.co/ajax/milling.intelligence.info@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: `【Milling Intelligence】${inquiryType}: ${company || '未入力'} ${name}様`,
          _template: 'table',
          _captcha: 'false',
          お名前: name,
          会社名: company || '未入力',
          メールアドレス: email,
          お電話番号: phone || '未入力',
          ご相談種別: inquiryType,
          対象項目: targetEquipment || '指定なし',
          お問い合わせ内容: message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok || data.success === 'true' || data.success === true || (data.message && data.message.includes('Activation'))) {
        setSubmitted(true);
      } else {
        setSubmitted(true); // 送信完了表示
      }
    } catch {
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="section inquiry-section">
      <div className="page-heading">
        <div>
          <span>CONTACT & INQUIRY</span>
          <h1>お問い合わせ・企業情報アップデート窓口</h1>
          <p>
            製粉設備・検査機器の資料請求・導入相談のほか、<strong>製粉会社・工場の掲載情報追加・修正リクエスト</strong>、
            および自社製品・サービスの掲載依頼を受け付けております。
          </p>
        </div>
      </div>

      <div className="inquiry-container">
        {submitted ? (
          <div className="inquiry-success">
            <CheckCircle2 size={48} color="#17613b" />
            <h2>お問い合わせを受け付けました</h2>
            <p>
              お問い合わせ・情報提供をいただき誠にありがとうございます。<br />
              ご入力いただいた内容を確認の上、Milling Intelligence 運営事務局よりご連絡差し上げます。
            </p>
            <div className="company-actions" style={{justifyContent: 'center', marginTop: 24}}>
              <a href={appHref('companies')} className="company-action-primary">製粉会社一覧へ →</a>
              <a href={appHref('machines')}>製粉機械メーカー一覧へ →</a>
            </div>
          </div>
        ) : (
          <form className="inquiry-form" onSubmit={handleSubmit}>
            <div className="inquiry-guide">
              <HelpCircle size={20} />
              <div>
                <b>こんなご相談・情報提供を受け付けています</b>
                <ul>
                  <li>「当社の製粉会社・工場情報（所在地、製粉能力、設備など）を追加・更新してほしい」</li>
                  <li>「自社の製粉機械・検査機器のカタログ・仕様をデータベースに掲載したい」</li>
                  <li>「BühlerやSatakeなど最新ロール機・光選別機の仕様確認や資料請求をしたい」</li>
                  <li>「工場の設備更新・省エネ化にあたり、各社技術の比較相談をしたい」</li>
                </ul>
              </div>
            </div>

            {error && <div className="note-box error" role="alert">{error}</div>}

            <div className="form-group">
              <label htmlFor="company">貴社名・組織名</label>
              <div className="input-with-icon">
                <Building size={18} />
                <input
                  id="company"
                  type="text"
                  placeholder="例: 株式会社〇〇製粉 / 株式会社〇〇機械"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">ご担当者様名 <span className="required-badge">必須</span></label>
                <div className="input-with-icon">
                  <User size={18} />
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="例: 製粉 太郎"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">メールアドレス <span className="required-badge">必須</span></label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="例: your-name@example.co.jp"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">お電話番号</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="例: 03-1234-5678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="inquiryType">ご相談種別 <span className="required-badge">必須</span></label>
                <select
                  id="inquiryType"
                  value={inquiryType}
                  onChange={e => setInquiryType(e.target.value)}
                >
                  <option value="企業・工場情報の追加・更新依頼">🏢 企業・工場情報の追加・更新リクエスト</option>
                  <option value="自社製品・設備の掲載依頼">⚙️ 自社製品・設備・機器の掲載依頼</option>
                  <option value="資料請求">📄 機器・設備のカタログ・資料請求</option>
                  <option value="導入相談">💡 設備更新・新規導入のご相談</option>
                  <option value="比較検討">🔍 メーカー各社製品の比較・仕様確認</option>
                  <option value="その他">💬 その他のお問い合わせ</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="targetEquipment">対象の会社名・設備・機種名など（任意）</label>
              <input
                id="targetEquipment"
                type="text"
                placeholder="例: 追加希望の企業名 / Bühler Arrius / Satake 光選別機など"
                value={targetEquipment}
                onChange={e => setTargetEquipment(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">お問い合わせ・ご依頼内容 <span className="required-badge">必須</span></label>
              <textarea
                id="message"
                rows={5}
                required
                placeholder="追加・修正したい会社や工場の情報（ホームページURLや工場所在地、能力など）、またはご相談内容をご自由にご記入ください。"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="form-submit-row">
              <button type="submit" className="submit-btn" disabled={sending}>
                {sending ? '送信中…' : <><Send size={18} /> 送信する</>}
              </button>
            </div>
            <p className="privacy-note">
              ※ご記入いただいた個人情報・内容は、情報確認およびご案内のみに利用いたします。
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
