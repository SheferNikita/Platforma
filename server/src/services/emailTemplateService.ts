import { prisma } from '../db';
import { getWelcomeEmailTemplate } from '../templates/welcomeEmail';
import { getNewLessonEmailTemplate } from '../templates/newLessonEmail';
import { getTeamInviteEmailTemplate } from '../templates/teamInviteEmail';

export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: 'Супер-администратор',
  ADMIN: 'Администратор',
  CURATOR: 'Куратор',
  MENTOR: 'Наставник',
  PSYCHOLOGIST: 'Психолог',
  INTERN: 'Стажер',
  MODERATOR: 'Модератор',
  ADMIN_ASSISTANT: 'Помощник админа'
};

export const emailTemplateService = {
  async getTemplateByCode(code: string): Promise<{ subject: string; body: string } | null> {
    const template = await prisma.emailTemplate.findFirst({
      where: { 
        code,
        isEnabled: true
      }
    });

    if (!template) {
      return null;
    }

    return {
      subject: template.subject,
      body: template.body
    };
  },

  renderTemplate(template: string, variables: TemplateVariables): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }
    return result;
  },

  async getRenderedTemplate(
    code: string, 
    variables: TemplateVariables
  ): Promise<{ subject: string; body: string } | null> {
    const template = await this.getTemplateByCode(code);
    
    if (!template) {
      return null;
    }

    return {
      subject: this.renderTemplate(template.subject, variables),
      body: this.renderTemplate(template.body, variables)
    };
  },

  async getWelcomeEmail(data: {
    name: string;
    email: string;
    password: string;
    loginUrl: string;
  }): Promise<{ subject: string; body: string }> {
    const dbTemplate = await this.getRenderedTemplate('welcome_email', {
      name: data.name,
      email: data.email,
      password: data.password,
      loginUrl: data.loginUrl
    });

    if (dbTemplate) {
      return dbTemplate;
    }

    return {
      subject: 'Добро пожаловать на платформу',
      body: getWelcomeEmailTemplate(data)
    };
  },

  async getNewLessonEmail(data: {
    studentName: string;
    lessonTitle: string;
    moduleName: string;
    lessonUrl: string;
  }): Promise<{ subject: string; body: string }> {
    const dbTemplate = await this.getRenderedTemplate('new_lesson', {
      studentName: data.studentName,
      lessonTitle: data.lessonTitle,
      moduleName: data.moduleName,
      lessonUrl: data.lessonUrl
    });

    if (dbTemplate) {
      return dbTemplate;
    }

    return {
      subject: `Открыт новый урок: ${data.lessonTitle}`,
      body: getNewLessonEmailTemplate(data)
    };
  },

  async getTeamInviteEmail(data: {
    name: string;
    email: string;
    password: string;
    role: string;
    loginUrl: string;
  }): Promise<{ subject: string; body: string }> {
    const roleName = ROLE_NAMES[data.role] || data.role;
    
    const dbTemplate = await this.getRenderedTemplate('team_invite', {
      name: data.name,
      email: data.email,
      password: data.password,
      role: roleName,
      loginUrl: data.loginUrl
    });

    if (dbTemplate) {
      return dbTemplate;
    }

    return {
      subject: 'Приглашение в команду администраторов',
      body: getTeamInviteEmailTemplate(data)
    };
  },

  async getPaymentConfirmationEmail(data: {
    name: string;
    productName: string;
    amount: string;
  }, templateIdOrBody?: string): Promise<{ subject: string; body: string }> {
    if (templateIdOrBody) {
      const dbTemplate = await prisma.emailTemplate.findFirst({
        where: { 
          OR: [
            { id: templateIdOrBody },
            { code: templateIdOrBody }
          ],
          isEnabled: true
        }
      });

      if (dbTemplate) {
        return {
          subject: this.renderTemplate(dbTemplate.subject, data),
          body: this.renderTemplate(dbTemplate.body, data)
        };
      }

      return {
        subject: 'Подтверждение оплаты',
        body: this.renderTemplate(templateIdOrBody, data)
      };
    }

    const defaultTemplate = await this.getRenderedTemplate('payment_confirmation', data);
    
    if (defaultTemplate) {
      return defaultTemplate;
    }

    return {
      subject: 'Подтверждение оплаты',
      body: `
        <p>Здравствуйте, ${data.name}!</p>
        <p>Благодарим за оплату продукта "${data.productName}".</p>
        <p>Сумма: ${data.amount} руб.</p>
      `
    };
  }
};
