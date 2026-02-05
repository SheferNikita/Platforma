import { prisma } from '../db';

const EMAIL_TEMPLATES_HTML = {
  new_lesson: {
    subject: 'Открыт новый урок: {{lessonTitle}}',
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Открыт новый урок</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">📚</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Открыт новый урок!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{studentName}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Для вас открыт новый урок. Не пропустите новый материал!</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Модуль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{moduleName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Урок:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #a67c52; font-size: 16px; font-weight: 600;">{{lessonTitle}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{lessonUrl}}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">Перейти к уроку</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  team_invite: {
    subject: 'Приглашение в команду администраторов',
    body: `<!DOCTYPE html>
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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  payment_confirmation: {
    subject: 'Подтверждение оплаты',
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Подтверждение оплаты</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #38a169 0%, #48bb78 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Оплата прошла успешно!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Благодарим вас за покупку. Ваш платёж успешно обработан.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Продукт:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{productName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Сумма:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #38a169; font-size: 16px; font-weight: 600;">{{amount}} ₽</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #3d3527; font-size: 16px; line-height: 1.6;">Доступ к материалам уже открыт в вашем личном кабинете.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  module_access: {
    subject: 'Вам открыт доступ к модулю: {{moduleName}}',
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Доступ к модулю открыт</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔓</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Доступ к модулю открыт!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Вам открыт доступ к новому учебному модулю. Можете приступать к обучению!</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Модуль:</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #667eea; font-size: 16px; font-weight: 600;">{{moduleName}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Доступ до:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{expiresAt}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Перейти к обучению</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  mentor_reply: {
    subject: 'Наставник ответил на вашу запись',
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ответ наставника</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #ed8936 0%, #f6ad55 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">💬</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Наставник ответил!</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;"><strong>{{mentorName}}</strong> ответил на вашу запись в разделе «{{entryType}}».</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 12px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Превью ответа</p>
                    <p style="margin: 0; color: #3d3527; font-size: 16px; line-height: 1.6; font-style: italic;">«{{replyPreview}}»</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{viewUrl}}" style="display: inline-block; background: linear-gradient(135deg, #ed8936 0%, #f6ad55 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(237, 137, 54, 0.3);">Прочитать ответ</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">Это письмо отправлено автоматически.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  password_reset: {
    subject: 'Ваш новый пароль',
    body: `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Сброс пароля</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f3ed;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #e53e3e 0%, #fc8181 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Пароль сброшен</h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Платформа обучения трезвости</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">Здравствуйте, <strong>{{name}}</strong>!</p>
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">Ваш пароль был сброшен. Ниже вы найдёте новые данные для входа.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="margin: 0 0 16px; color: #3d3527; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Новые данные для входа</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Логин (email):</span></td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;"><span style="color: #3d3527; font-size: 16px; font-weight: 600;">{{email}}</span></td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;"><span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Новый пароль:</span></td>
                        <td style="padding: 12px 0; text-align: right;"><span style="color: #e53e3e; font-size: 16px; font-weight: 600; font-family: monospace; background-color: #fff; padding: 4px 8px; border-radius: 4px;">{{newPassword}}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="{{loginUrl}}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">Войти в личный кабинет</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 30px 0 0; color: #3d3527; opacity: 0.7; font-size: 14px; line-height: 1.6; text-align: center;">Рекомендуем сменить пароль после входа в настройках профиля.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center; border-top: 1px solid #d4c9b0;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 13px;">Если вы не запрашивали сброс пароля, свяжитесь с нами.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
};

export async function runEmailTemplatesMigration(): Promise<{ updated: string[], created: string[], skipped: string[] }> {
  const results = { updated: [] as string[], created: [] as string[], skipped: [] as string[] };
  
  const templateConfigs: Record<string, { name: string; description: string; variables: string[] }> = {
    new_lesson: {
      name: 'Новый урок',
      description: 'Отправляется при публикации нового урока',
      variables: ['studentName', 'lessonTitle', 'moduleName', 'lessonUrl']
    },
    team_invite: {
      name: 'Приглашение в команду',
      description: 'Отправляется при создании нового администратора',
      variables: ['name', 'email', 'password', 'role', 'loginUrl']
    },
    payment_confirmation: {
      name: 'Подтверждение оплаты',
      description: 'Отправляется после успешной оплаты продукта',
      variables: ['name', 'productName', 'amount']
    },
    module_access: {
      name: 'Доступ к модулю',
      description: 'Отправляется при выдаче доступа к модулю',
      variables: ['name', 'moduleName', 'expiresAt', 'loginUrl']
    },
    mentor_reply: {
      name: 'Ответ наставника',
      description: 'Отправляется когда наставник отвечает на дневник или заметку',
      variables: ['name', 'mentorName', 'entryType', 'replyPreview', 'viewUrl']
    },
    password_reset: {
      name: 'Сброс пароля',
      description: 'Отправляется при сбросе пароля пользователя',
      variables: ['name', 'email', 'newPassword', 'loginUrl']
    }
  };

  for (const [code, template] of Object.entries(EMAIL_TEMPLATES_HTML)) {
    try {
      const existing = await prisma.emailTemplate.findFirst({
        where: { code }
      });

      const config = templateConfigs[code];
      
      if (existing) {
        if (existing.body.startsWith('<!DOCTYPE html>')) {
          console.log(`[Migration] ${code} already has HTML format, skipping`);
          results.skipped.push(code);
          continue;
        }

        await prisma.emailTemplate.update({
          where: { id: existing.id },
          data: {
            subject: template.subject,
            body: template.body,
            description: config?.description
          }
        });
        console.log(`[Migration] ${code} updated to HTML format`);
        results.updated.push(code);
      } else {
        await prisma.emailTemplate.create({
          data: {
            code,
            name: config?.name || code,
            subject: template.subject,
            body: template.body,
            description: config?.description || '',
            variables: config?.variables || [],
            isEnabled: true
          }
        });
        console.log(`[Migration] ${code} created with HTML format`);
        results.created.push(code);
      }
    } catch (error) {
      console.error(`[Migration] Failed to process ${code}:`, error);
    }
  }

  return results;
}
