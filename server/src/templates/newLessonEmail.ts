export function getNewLessonEmailTemplate(data: {
  studentName: string;
  lessonTitle: string;
  moduleName: string;
  lessonUrl: string;
}): string {
  return `
<!DOCTYPE html>
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
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); padding: 40px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 10px;">📚</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Открыт новый урок!
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Платформа обучения трезвости
              </p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #3d3527; font-size: 18px; line-height: 1.6;">
                Здравствуйте, <strong>${data.studentName}</strong>!
              </p>
              
              <p style="margin: 0 0 30px; color: #3d3527; font-size: 16px; line-height: 1.6;">
                Для вас открыт новый урок. Не пропустите новый материал!
              </p>
              
              <!-- Lesson Info Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f3ed; border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0;">
                          <span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Модуль:</span>
                        </td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #d4c9b0; text-align: right;">
                          <span style="color: #3d3527; font-size: 16px; font-weight: 600;">${data.moduleName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #3d3527; opacity: 0.7; font-size: 14px;">Урок:</span>
                        </td>
                        <td style="padding: 12px 0; text-align: right;">
                          <span style="color: #a67c52; font-size: 16px; font-weight: 600;">${data.lessonTitle}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${data.lessonUrl}" style="display: inline-block; background: linear-gradient(135deg, #a67c52 0%, #c4a57b 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(166, 124, 82, 0.3);">
                      Перейти к уроку
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f5f3ed; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; color: #3d3527; opacity: 0.6; font-size: 14px;">
                Это письмо отправлено автоматически.
              </p>
              <p style="margin: 8px 0 0; color: #3d3527; opacity: 0.6; font-size: 14px;">
                © Школа трезвости
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
