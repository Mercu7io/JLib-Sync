/**
 * Web3Forms Contact Form Service
 * Transmits contact submissions securely to https://api.web3forms.com/submit.
 * Access key is loaded from environment configuration (never committed in code).
 * Submissions are retained for up to 7 days by Web3Forms before automatic purge (GDPR).
 */

export interface IContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: 'question' | 'bug' | 'feature' | 'other';
  userAgent?: string;
  appVersion?: string;
  botcheck?: string;
  hCaptchaResponse?: string;
}

export interface IValidationResult {
  isValid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

export interface IWeb3FormsResponse {
  success: boolean;
  message: string;
}

/**
 * Retrieves the Web3Forms access key from the environment.
 * Priority: runtime window.__ENV__ (Docker) -> import.meta.env (Vite local dev)
 */
export const getWeb3FormsAccessKey = (): string => {
  if (typeof window !== 'undefined' && (window as any).__ENV__) {
    const env = (window as any).__ENV__;
    if (env.WEB3FORMS_ACCESS_KEY) return String(env.WEB3FORMS_ACCESS_KEY).trim();
    if (env.VITE_WEB3FORMS_ACCESS_KEY) return String(env.VITE_WEB3FORMS_ACCESS_KEY).trim();
  }
  return (import.meta as any).env?.VITE_WEB3FORMS_ACCESS_KEY?.trim() || '';
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates contact form inputs according to typed schema constraints.
 */
export function validateContactInput(input: Partial<IContactInput>): IValidationResult {
  const name = (input.name || '').trim();
  const email = (input.email || '').trim();
  const subject = (input.subject || '').trim();
  const message = (input.message || '').trim();

  if (!name || name.length < 2) {
    return {
      isValid: false,
      errorKey: 'help.contactErrName',
      defaultMessage: 'Please provide your name (at least 2 characters).',
    };
  }
  if (name.length > 100) {
    return {
      isValid: false,
      errorKey: 'help.contactErrNameTooLong',
      defaultMessage: 'Name must not exceed 100 characters.',
    };
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    return {
      isValid: false,
      errorKey: 'help.contactErrEmail',
      defaultMessage: 'Please provide a valid email address.',
    };
  }
  if (email.length > 254) {
    return {
      isValid: false,
      errorKey: 'help.contactErrEmailTooLong',
      defaultMessage: 'Email must not exceed 254 characters.',
    };
  }

  if (!subject) {
    return {
      isValid: false,
      errorKey: 'help.contactErrSubject',
      defaultMessage: 'Please provide a subject for your message.',
    };
  }
  if (subject.length > 200) {
    return {
      isValid: false,
      errorKey: 'help.contactErrSubjectTooLong',
      defaultMessage: 'Subject must not exceed 200 characters.',
    };
  }

  if (!message || message.length < 10) {
    return {
      isValid: false,
      errorKey: 'help.contactErrMessage',
      defaultMessage: 'Please enter a message with at least 10 characters.',
    };
  }
  if (message.length > 5000) {
    return {
      isValid: false,
      errorKey: 'help.contactErrMessageTooLong',
      defaultMessage: 'Message must not exceed 5000 characters.',
    };
  }

  return { isValid: true };
}

/**
 * Submits contact inquiry to Web3Forms API.
 */
export async function sendContactMessage(
  input: IContactInput,
  customAccessKey?: string,
  fetchFn: typeof fetch = fetch
): Promise<IWeb3FormsResponse> {
  const validation = validateContactInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      message: validation.defaultMessage || 'Validation error',
    };
  }

  // Honeypot trap: silently simulate success for automated spam bots
  if (input.botcheck && input.botcheck.trim().length > 0) {
    return {
      success: true,
      message: 'Message processed successfully.',
    };
  }

  const accessKey = customAccessKey || getWeb3FormsAccessKey();
  if (!accessKey) {
    return {
      success: false,
      message: 'Web3Forms access key is not configured. Please set VITE_WEB3FORMS_ACCESS_KEY in .env.',
    };
  }

  const formData = new FormData();
  formData.append('access_key', accessKey);
  formData.append('name', input.name.trim());
  formData.append('email', input.email.trim());
  formData.append('subject', `[Panda JWL-Sync] [${input.category || 'Inquiry'}] ${input.subject.trim()}`);
  formData.append('from_name', 'Panda JWL-Sync Support');

  const formattedMessage = [
    `=== Panda JWL-Sync Support Submission ===`,
    `Category: ${input.category || 'General'}`,
    `Sender: ${input.name.trim()} <${input.email.trim()}>`,
    `Date: ${new Date().toISOString()}`,
    input.appVersion ? `Application Version: Panda JWL-Sync v${input.appVersion}` : null,
    input.userAgent ? `User Agent / Environment: ${input.userAgent}` : null,
    ``,
    `=== Message ===`,
    input.message.trim(),
  ]
    .filter(Boolean)
    .join('\n');

  formData.append('message', formattedMessage);

  if (input.hCaptchaResponse && input.hCaptchaResponse.trim()) {
    formData.append('h-captcha-response', input.hCaptchaResponse.trim());
  }

  try {
    const response = await fetchFn('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData,
    });

    const data = typeof response.json === 'function' ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      return {
        success: false,
        message: data?.message || `HTTP error: ${response.status}`,
      };
    }

    return {
      success: Boolean(data?.success),
      message: data?.message || (data?.success ? 'Success!' : 'Error'),
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Network request failed',
    };
  }
}
