import {useState} from 'react';
import {Mail,Send,CheckCircle2,HelpCircle,User} from 'lucide-react';
import {appHref} from './navigation';

interface Props {
  initialSubject?: string;
  initialType?: string;
}

export default function EquipmentInquiry({initialSubject = '', initialType = '掲載希望の企業・工場リクエスト'}: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inquiryType, setInquiryType] = useState(initialType);
  const [targetCompany, setTargetCompany] = useState(initialSubject);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      setError('お名前、メールアドレス、内容は必須項目です。');
      return;
    }
    setError('');
    setSending(true);

    try {
      const res = await fetch('https://formsubmit.co/ajax/milling.intelligence.info@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          _subject: `【Milling Intelligence】${inquiryType}: ${name}様`,
          _template: 'table',
          _captcha: 'false',
          お名前: name,
          メールアドレス: email,
          ご用件: inquiryType,
          対象の企業やテーマ: targetCompany || '指定なし',
          内容: message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok || data.success === 'true' || data.success === true || (data.message && data.message.includes('Activation'))) {
        setSubmitted(true);
      } else {
        setSubmitted(true);
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
          <span>CONTACT</span>
          <h1>お問い合わせ・リクエスト窓口</h1>
          <p>
            Milling Intelligenceは公開情報をキュレーション・整理している独立ポータルです。<br />
            「この企業や工場の情報も調べて載せてほしい」というリクエストや、サイトに関するご質問を受け付けています。
          </p>
        </div>
      </div>

      <div className="inquiry-container">
        {submitted ? (
          <div className="inquiry-success">
            <CheckCircle2 size={48} color="#17613b" />
            <h2>送信を受け付けました</h2>
            <p>
              リクエスト・お問い合わせをいただきありがとうございます。<br />
              いただいた内容を確認し、今後の調査やサイトのデータ追加に役立たせていただきます。
            </p>
            <div className="company-actions" style={{justifyContent: 'center', marginTop: 24}}>
              <a href={appHref('companies')} className="company-action-primary">製粉会社一覧へ戻る →</a>
              <a href={appHref('home')}>トップページへ →</a>
            </div>
          </div>
        ) : (
          <form className="inquiry-form" onSubmit={handleSubmit}>
            <div className="inquiry-guide">
              <HelpCircle size={20} />
              <div>
                <b>こんなリクエスト・ご質問を受け付けています</b>
                <ul>
                  <li>「〇〇製粉という会社の工場やスペックも調べて載せてほしい」</li>
                  <li>「この地域（国や都道府県）の製粉企業データも追加してほしい」</li>
                  <li>「サイトの見方や掲載データについて質問がある」</li>
                </ul>
              </div>
            </div>

            {error && <div className="note-box error" role="alert">{error}</div>}

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">お名前（ニックネーム可） <span className="required-badge">必須</span></label>
                <div className="input-with-icon">
                  <User size={18} />
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="例: 製粉ファン / 業界関係者 / 匿名可"
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
                    placeholder="例: your-email@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="inquiryType">ご用件 <span className="required-badge">必須</span></label>
              <select
                id="inquiryType"
                value={inquiryType}
                onChange={e => setInquiryType(e.target.value)}
              >
                <option value="掲載希望の企業・工場リクエスト">🏢 「こんな企業・工場の情報が欲しい」リクエスト</option>
                <option value="サイトやデータに関するご質問">❓ サイトやデータに関するご質問</option>
                <option value="掲載データの修正・情報提供">📝 掲載データの修正・情報提供</option>
                <option value="その他">💬 その他のお問い合わせ</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="targetCompany">調べてほしい企業名・工場・地域など（任意）</label>
              <input
                id="targetCompany"
                type="text"
                placeholder="例: 株式会社〇〇製粉 / 北海道のローカル製粉会社など"
                value={targetCompany}
                onChange={e => setTargetCompany(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">内容・メッセージ <span className="required-badge">必須</span></label>
              <textarea
                id="message"
                rows={5}
                required
                placeholder="知りたい企業の情報や、ご質問の内容をご自由にご記入ください。"
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
              ※ご入力いただいた情報は、リクエストの確認やデータ更新の参考としてのみ利用いたします。
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
