import { prisma } from '../db';

const TEAM_INVITE_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Приглашение в команду</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #3d3527 0%, #5a4d3a 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Добро пожаловать в команду!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Вы приглашены в команду платформы обучения трезвости с ролью <strong>{{role}}</strong>. Ниже вы найдёте данные для входа в панель администрирования.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Ваши данные для входа</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Роль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #a67c52; font-size: 16px; font-weight: 600;">{{role}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Логин (email):</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{email}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Пароль:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #fff; padding: 4px 8px; border-radius: 4px;">{{password}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #3d3527 0%, #5a4d3a 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(61, 53, 39, 0.3);">Войти в админ-панель</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; color: #3d3527; opacity: 0.7; font-size: 14px; line-height: 1.6; text-align: center;">Рекомендуем сменить пароль после первого входа в настройках профиля.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center; border-top: 1px solid #d4c9b0;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 13px;">Если у вас возникли вопросы, свяжитесь с руководством.</p>
              <p style="margin: 10px 0 0; color: #3d3527; opacity: 0.5; font-size: 12px;">© 2026 Платформа обучения трезвости</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export async function runTeamInviteTemplateMigration(): Promise<boolean> {
  try {
    const existingTemplate = await prisma.emailTemplate.findFirst({
      where: { code: 'team_invite' }
    });

    if (!existingTemplate) {
      console.log('[Migration] team_invite template not found, skipping update');
      return false;
    }

    if (existingTemplate.body.startsWith('<!DOCTYPE html>')) {
      console.log('[Migration] team_invite template already has HTML format, skipping');
      return true;
    }

    await prisma.emailTemplate.update({
      where: { id: existingTemplate.id },
      data: {
        body: TEAM_INVITE_HTML_TEMPLATE,
        subject: 'Приглашение в команду администраторов',
        description: 'Отправляется при создании нового администратора'
      }
    });

    console.log('[Migration] team_invite template updated to HTML format successfully');
    return true;
  } catch (error) {
    console.error('[Migration] Failed to update team_invite template:', error);
    return false;
  }
}
