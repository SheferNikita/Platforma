const UNISENDER_API_URL = 'https://go2.unisender.ru/ru/transactional/api/v1/email/send.json';

interface UnisenderResponse {
  status: string;
  job_id?: string;
  emails?: Array<{ email: string; status: string; id?: string }>;
  failed_emails?: Record<string, string>;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.UNISENDER_API_KEY;
  
  if (!apiKey) {
    console.error('UNISENDER_API_KEY is not configured');
    throw new Error('Email service not configured');
  }

  const fromEmail = process.env.EMAIL_FROM || 'support@schkola-trezvosti.ru';
  const fromName = process.env.EMAIL_FROM_NAME || 'Платформа школы трезвости';

  const payload = {
    message: {
      recipients: [{ email: to }],
      body: {
        html: html,
        plaintext: html.replace(/<[^>]*>/g, '')
      },
      subject: subject,
      from_email: fromEmail,
      from_name: fromName
    }
  };

  try {
    const response = await fetch(UNISENDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as UnisenderResponse;

    if (!response.ok) {
      console.error('Unisender API error:', data);
      throw new Error(`Unisender API error: ${response.status}`);
    }

    if (data.status !== 'success') {
      console.error('Unisender sending failed:', data);
      throw new Error('Email sending failed');
    }

    console.log(`Email sent successfully to ${to}, job_id: ${data.job_id}`);
  } catch (error) {
    console.error('Error sending email via Unisender:', error);
    throw error;
  }
}

export async function sendPaymentConfirmationEmail(
  to: string,
  subject: string,
  template: string,
  variables: Record<string, string>
): Promise<void> {
  let html = template;
  
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  await sendEmail(to, subject, html);
}

export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ success: number; failed: number; errors: string[] }> {
  const apiKey = process.env.UNISENDER_API_KEY;
  
  if (!apiKey) {
    throw new Error('Email service not configured');
  }

  const fromEmail = process.env.EMAIL_FROM || 'support@schkola-trezvosti.ru';
  const fromName = process.env.EMAIL_FROM_NAME || 'Платформа школы трезвости';

  const payload = {
    message: {
      recipients: recipients.map(email => ({ email })),
      body: {
        html: html,
        plaintext: html.replace(/<[^>]*>/g, '')
      },
      subject: subject,
      from_email: fromEmail,
      from_name: fromName
    }
  };

  try {
    const response = await fetch(UNISENDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as UnisenderResponse;

    if (!response.ok) {
      console.error('Unisender API error:', data);
      return { success: 0, failed: recipients.length, errors: ['API error'] };
    }

    const successCount = data.emails?.filter(e => e.status === 'sent' || e.status === 'queued').length || 0;
    const failedCount = recipients.length - successCount;
    const errors = data.failed_emails ? Object.values(data.failed_emails) : [];

    console.log(`Bulk email: ${successCount} sent, ${failedCount} failed`);
    return { success: successCount, failed: failedCount, errors };
  } catch (error) {
    console.error('Error sending bulk email via Unisender:', error);
    return { success: 0, failed: recipients.length, errors: [(error as Error).message] };
  }
}
