import React, { useState, useRef } from 'react';
import {
  Mail,
  Send,
  ShieldCheck,
  Check,
  Copy,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  HelpCircle,
  Bug,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../lib/version';
import { sendContactMessage, validateContactInput } from '../../lib/contact/web3forms';

/**
 * Obfuscated email getter.
 * Prevents automated email harvesters from extracting jwlsync@redpandaium.com via static regexes.
 */
export const getSecureContactEmail = (): string => {
  const p1 = ['j', 'w', 'l', 's', 'y', 'n', 'c'].join('');
  const p2 = ['r', 'e', 'd', 'p', 'a', 'n', 'd', 'a', 'i', 'u', 'm'].join('');
  const p3 = ['c', 'o', 'm'].join('');
  return `${p1}@${p2}.${p3}`;
};

export const ContactSupportSection: React.FC = () => {
  const { t } = useTranslation();

  // Form state
  const [category, setCategory] = useState<'question' | 'bug' | 'feature' | 'other'>('question');
  const [name, setName] = useState('');
  const [replyEmail, setReplyEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // Math Captcha state
  const [num1, setNum1] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [num2, setNum2] = useState(() => Math.floor(Math.random() * 7) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showDirectEmail, setShowDirectEmail] = useState(false);

  // Prepared links for direct mail fallback
  const [preparedLinks, setPreparedLinks] = useState<{
    mailtoUrl: string;
    gmailUrl: string;
    outlookUrl: string;
    fullSubject: string;
    fullBody: string;
    recipient: string;
  } | null>(null);

  // Anti-bot time trap: track mount time
  const mountTimeRef = useRef<number>(Date.now());

  const resetCaptcha = () => {
    setNum1(Math.floor(Math.random() * 8) + 2);
    setNum2(Math.floor(Math.random() * 7) + 1);
    setCaptchaAnswer('');
  };

  const handleCopyEmail = async () => {
    try {
      const email = getSecureContactEmail();
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch (_) {}
  };

  const handleCopyMessage = async () => {
    if (!preparedLinks) return;
    try {
      await navigator.clipboard.writeText(preparedLinks.fullBody);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch (_) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Bot Trap (Honeypot check)
    if (honeypot.trim().length > 0) {
      // Silently pretend to work for bots
      setIsSuccess(true);
      return;
    }

    // 2. Anti-bot speed trap: must have taken at least 2.5 seconds
    const elapsedMs = Date.now() - mountTimeRef.current;
    if (elapsedMs < 2500) {
      setError(t('help.botTooFast', 'Please wait a moment before submitting the form.'));
      return;
    }

    // 3. Anti-bot cooldown check (25 seconds between sends)
    try {
      const lastSend = sessionStorage.getItem('jwsync_last_contact_ts');
      if (lastSend && Date.now() - Number(lastSend) < 25000) {
        setError(t('help.botCooldown', 'Please wait 30 seconds before sending another message.'));
        return;
      }
    } catch (_) {}

    // 4. Math Captcha verification
    const parsedAnswer = parseInt(captchaAnswer.trim(), 10);
    if (isNaN(parsedAnswer) || parsedAnswer !== num1 + num2) {
      setError(t('help.botWrongAnswer', 'Incorrect anti-bot calculation. Please try again.'));
      resetCaptcha();
      return;
    }

    // 5. Typed Schema Validation
    const validation = validateContactInput({
      name,
      email: replyEmail,
      subject,
      message,
      category,
    });

    if (!validation.isValid) {
      setError(t(validation.errorKey || 'help.contactErrSubject', validation.defaultMessage || 'Please verify form fields.'));
      return;
    }

    // 6. Build message details & direct URLs for optional fallback
    const recipient = getSecureContactEmail();
    const categoryLabels: Record<string, string> = {
      question: t('help.contactCatQuestion', 'Question / General Help'),
      bug: t('help.contactCatBug', 'Bug Report / Technical Issue'),
      feature: t('help.contactCatFeature', 'Feature Suggestion'),
      other: t('help.contactCatOther', 'Other Inquiry'),
    };

    const fullSubject = `[Panda JWL-Sync] [${categoryLabels[category] || category}] ${subject.trim()}`;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    const fullBody = [
      `=== Panda JWL-Sync Contact ===`,
      `${t('help.emailReqType', 'Request type')} : ${categoryLabels[category] || category}`,
      `${t('help.contactName', 'Name')} : ${name.trim()}`,
      `${t('help.contactReplyEmail', 'Email')} : ${replyEmail.trim()}`,
      `${t('help.emailSubject', 'Subject')} : ${subject.trim()}`,
      `Date : ${new Date().toLocaleString()}`,
      `Browser / OS : ${userAgent}`,
      `Application : Panda JWL-Sync v${APP_VERSION}`,
      ``,
      `=== Message ===`,
      message.trim(),
    ].join('\n');

    setPreparedLinks({
      mailtoUrl: `mailto:${recipient}?subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`,
      gmailUrl: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`,
      outlookUrl: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(fullSubject)}&body=${encodeURIComponent(fullBody)}`,
      fullSubject,
      fullBody,
      recipient,
    });

    // 7. Dispatch via Web3Forms API
    setIsSubmitting(true);
    try {
      const result = await sendContactMessage({
        name,
        email: replyEmail,
        subject,
        message,
        category,
        userAgent,
        appVersion: APP_VERSION,
        botcheck: honeypot,
      });

      if (result.success) {
        try {
          sessionStorage.setItem('jwsync_last_contact_ts', String(Date.now()));
        } catch (_) {}
        setIsSuccess(true);
      } else {
        setError(result.message || t('help.contactErrSend', 'An error occurred while sending your message. Please try again or use direct email.'));
      }
    } catch (err: any) {
      setError(err?.message || t('help.contactErrSend', 'An error occurred while sending your message. Please try again or use direct email.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName('');
    setSubject('');
    setMessage('');
    setReplyEmail('');
    setCaptchaAnswer('');
    setIsSuccess(false);
    setPreparedLinks(null);
    setError(null);
    resetCaptcha();
    mountTimeRef.current = Date.now();
  };

  return (
    <div className="rounded-3xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-[#101625] p-6 sm:p-8 shadow-sm transition-all space-y-6">
      {/* ── HEADER ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/[0.06] pb-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <Mail className="w-3.5 h-3.5" />
            <span>{t('help.contactBadge', 'Direct Support')}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {t('help.contactTitle', 'Contact & Support')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            {t(
              'help.contactSubtitle',
              'Have a question, encountered a bug, or have an idea to improve Panda JWL-Sync? Send us an inquiry!'
            )}
          </p>
        </div>

        {/* Anti-spam security guarantee badge */}
        <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-3 py-1.5 rounded-xl self-start sm:self-center">
          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>{t('help.contactProtectedNotice', 'Anti-bot & anti-spam protected')}</span>
        </div>
      </div>

      {/* ── SUCCESS VIEW ─────────────────────────────────────── */}
      {isSuccess ? (
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('help.contactSentSuccessTitle', 'Message sent successfully!')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t(
                  'help.contactSentSuccessDesc',
                  'Thank you for reaching out! Your message has been transmitted to our support team. We will reply to your email as soon as possible.'
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('help.contactNewMessage', 'Write another message')}</span>
            </button>

            {preparedLinks && (
              <>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? t('help.contactMessageCopied', 'Message text copied!') : t('help.contactCopyMessage', 'Copy Full Text')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEmail ? t('help.contactEmailCopied', 'Email address copied!') : t('help.contactCopyEmail', 'Copy Email Address')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── CONTACT FORM ─────────────────────────────────────── */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot anti-spam field (hidden for humans, catches bots) */}
          <div style={{ display: 'none', position: 'absolute', left: '-9999px', opacity: 0 }} aria-hidden="true">
            <label htmlFor="hp_website_contact">Leave this blank</label>
            <input
              id="hp_website_contact"
              type="text"
              name="hp_website_contact"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Category selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <span>{t('help.contactCategory', 'Inquiry Type')}</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'question', label: t('help.contactCatQuestion', 'Question'), icon: HelpCircle },
                { id: 'bug', label: t('help.contactCatBug', 'Bug Report'), icon: Bug },
                { id: 'feature', label: t('help.contactCatFeature', 'Suggestion'), icon: Sparkles },
                { id: 'other', label: t('help.contactCatOther', 'Other'), icon: MessageSquare },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = category === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as any)}
                    className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name & Required Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="contact_name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('help.contactName', 'Your Name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('help.contactNamePlaceholder', 'e.g. John Doe')}
                maxLength={100}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="contact_reply_email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('help.contactReplyEmail', 'Your Email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact_reply_email"
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder={t('help.contactReplyEmailPlaceholder', 'your.name@example.com')}
                maxLength={254}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label htmlFor="contact_subject" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('help.contactSubject', 'Subject')} <span className="text-red-500">*</span>
            </label>
            <input
              id="contact_subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('help.contactSubjectPlaceholder', 'e.g. Issue merging highlights on Android...')}
              maxLength={200}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              required
            />
          </div>

          {/* Message Area */}
          <div className="space-y-1.5">
            <label htmlFor="contact_message" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('help.contactMessage', 'Message')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="contact_message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('help.contactMessagePlaceholder', 'Please describe your request, issue, or suggestion in detail...')}
              maxLength={5000}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-y"
              required
            />
          </div>

          {/* Math Anti-Bot Verification */}
          <div className="bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                  <span>{t('help.contactCaptcha', `Security check: What is ${num1} + ${num2} ?`, { n1: num1, n2: num2 })}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('help.contactCaptchaHint', 'Human verification required before sending')}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder={t('help.contactCaptchaPlaceholder', 'Answer')}
                className="w-24 px-3 py-2 text-center font-bold text-xs sm:text-sm rounded-xl bg-white dark:bg-[#070A12] border border-slate-200/80 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={resetCaptcha}
                title={t('help.contactChangeQuestion', 'Change question')}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* GDPR / Privacy transparency badge */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start space-x-2 bg-slate-50/60 dark:bg-white/[0.015] p-3 rounded-xl border border-slate-200/60 dark:border-white/[0.05]">
            <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">
              {t(
                'help.contactGdprNotice',
                'Messages sent via this form are securely transmitted via Web3Forms and retained for a maximum of 7 days for support processing before automated deletion, in compliance with GDPR.'
              )}
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit button & Direct option */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs tracking-wide transition-all shadow-md shadow-blue-600/20 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('help.contactSendingBtn', 'Sending...')}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('help.contactSendBtn', 'Send Message')}</span>
                </>
              )}
            </button>

            {/* Direct Email Toggle */}
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('help.contactOrDirect', 'Or without the form:')}</span>
              <button
                type="button"
                onClick={() => setShowDirectEmail(!showDirectEmail)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center space-x-1"
              >
                {showDirectEmail ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showDirectEmail ? t('help.contactHideEmail', 'Hide') : t('help.contactRevealEmail', 'Reveal email address')}</span>
              </button>
            </div>
          </div>

          {/* Obfuscated Direct Email Reveal */}
          {showDirectEmail && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>{getSecureContactEmail()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.08] text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors"
                >
                  {copiedEmail ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEmail ? t('help.contactEmailCopied', 'Email address copied!') : t('help.contactCopyEmail', 'Copy Email Address')}</span>
                </button>
                <a
                  href={`mailto:${getSecureContactEmail()}`}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-all"
                >
                  <Mail className="w-3 h-3" />
                  <span>{t('help.contactWriteEmail', 'Write')}</span>
                </a>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
