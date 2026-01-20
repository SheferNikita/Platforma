import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { sendEmail } from '../services/email';

const router = Router();

const TILDA_WEBHOOK_SECRET = process.env.TILDA_WEBHOOK_SECRET || '';

function generatePassword(length: number = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function verifyTildaWebhook(req: Request): boolean {
  if (!TILDA_WEBHOOK_SECRET) {
    console.log('Tilda webhook: No secret configured, allowing all requests');
    return true;
  }
  
  const secret = req.query.secret as string || req.body.secret;
  
  if (secret === TILDA_WEBHOOK_SECRET) {
    return true;
  }
  
  console.warn('Tilda webhook: Invalid secret provided');
  return false;
}

function calculateAccessExpiry(product: any): Date | null {
  if (product.accessDurationType === 'unlimited') {
    return null;
  }
  
  if (product.accessDurationType === 'fixed' && product.accessExpiresAt) {
    return new Date(product.accessExpiresAt);
  }
  
  if (product.accessDuration && product.accessDuration > 0) {
    return new Date(Date.now() + product.accessDuration * 24 * 60 * 60 * 1000);
  }
  
  return null;
}

function generateOrderHash(email: string, tranid: string | undefined, orderid: string | undefined): number {
  const identifier = `${email}-${tranid || ''}-${orderid || ''}-${Date.now().toString().slice(0, -3)}`;
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

router.post('/tilda', async (req: Request, res: Response) => {
  try {
    // Log full incoming data for debugging (mask sensitive info)
    const logData = {
      email: req.body.email ? `${req.body.email.substring(0, 3)}***` : undefined,
      hasName: !!req.body.name,
      tranid: req.body.tranid,
      orderid: req.body.orderid,
      productsCount: req.body.products?.length || 0,
      productNames: req.body.products?.map((p: any) => p.name || p.title) || [],
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body)
    };
    console.log('Tilda webhook received:', JSON.stringify(logData));

    const {
      name,
      email,
      phone,
      tranid,
      orderid,
      products
    } = req.body;

    if (!email) {
      console.log('Tilda webhook: Test connection request (no email provided)');
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook connection test successful',
        test: true 
      });
    }

    if (!verifyTildaWebhook(req)) {
      console.error('Tilda webhook: Authentication failed');
      return res.status(401).json({ error: 'Unauthorized - invalid or missing secret' });
    }

    const customerEmail = email.toLowerCase().trim();
    
    const orderHash = generateOrderHash(customerEmail, tranid, orderid);
    
    const existingOrder = await prisma.order.findFirst({
      where: {
        email: customerEmail,
        robokassaInvId: orderHash
      }
    });

    if (existingOrder && existingOrder.status === 'PAID') {
      console.log(`Tilda webhook: Order for ${customerEmail} with hash ${orderHash} already processed`);
      return res.status(200).json({
        success: true,
        message: 'Order already processed',
        orderId: existingOrder.id,
        duplicate: true
      });
    }

    const customerName = name || customerEmail.split('@')[0];
    const customerPhone = phone || null;

    let existingUser = await prisma.user.findUnique({
      where: { email: customerEmail },
      include: { student: true }
    });

    let generatedPassword: string | null = null;
    let isNewUser = false;

    if (!existingUser) {
      generatedPassword = generatePassword(10);
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      existingUser = await prisma.user.create({
        data: {
          email: customerEmail,
          password: hashedPassword,
          name: customerName,
          role: 'STUDENT',
          isActive: true,
          student: {
            create: {
              phone: customerPhone,
              surveyCompleted: false
            }
          }
        },
        include: { student: true }
      });

      isNewUser = true;
      console.log(`Tilda webhook: Created new user for ${customerEmail.substring(0, 3)}***`);
    }

    let productNames: string[] = [];
    let totalAmount = 0;
    let matchedProducts: any[] = [];

    if (products && Array.isArray(products)) {
      for (const product of products) {
        const productName = product.name || 'Неизвестный продукт';
        const productSku = product.sku || product.uid || product.externalid;
        const productPrice = parseFloat(product.price) || 0;
        const productQuantity = parseInt(product.quantity) || 1;
        
        productNames.push(productName);
        totalAmount += productPrice * productQuantity;

        let dbProduct = null;

        if (productSku) {
          dbProduct = await prisma.product.findFirst({
            where: {
              name: productSku,
              isActive: true
            },
            include: {
              modules: {
                include: { module: true }
              }
            }
          });
        }

        if (!dbProduct) {
          dbProduct = await prisma.product.findFirst({
            where: {
              name: productName,
              isActive: true
            },
            include: {
              modules: {
                include: { module: true }
              }
            }
          });
        }

        // Try case-insensitive partial match if exact match fails
        if (!dbProduct) {
          const allProducts = await prisma.product.findMany({
            where: { isActive: true },
            include: {
              modules: {
                include: { module: true }
              }
            }
          });
          
          const productNameLower = productName.toLowerCase().trim();
          dbProduct = allProducts.find(p => 
            p.name.toLowerCase().includes(productNameLower) ||
            productNameLower.includes(p.name.toLowerCase())
          ) || null;
          
          if (dbProduct) {
            console.log(`Tilda webhook: Found product by partial match: "${dbProduct.name}" for "${productName}"`);
          }
        }

        if (dbProduct) {
          matchedProducts.push(dbProduct);

          if (existingUser?.student) {
            for (const pm of dbProduct.modules) {
              const expiresAt = calculateAccessExpiry(dbProduct);
              
              await prisma.moduleAccess.upsert({
                where: {
                  studentId_moduleId: {
                    studentId: existingUser.student.id,
                    moduleId: pm.moduleId
                  }
                },
                update: {
                  isActive: true,
                  expiresAt
                },
                create: {
                  studentId: existingUser.student.id,
                  moduleId: pm.moduleId,
                  isActive: true,
                  expiresAt
                }
              });
            }
            console.log(`Tilda webhook: Granted access to ${dbProduct.modules.length} modules for product ${dbProduct.name}`);
          }
        } else {
          console.warn(`Tilda webhook: No matching product found for "${productName}"`);
        }
      }
    }

    if (matchedProducts.length === 0 && products?.length > 0) {
      console.warn(`Tilda webhook: No products matched from Tilda order. User created but no access granted.`);
    }

    const primaryProductId = matchedProducts.length > 0 
      ? matchedProducts[0].id 
      : null;

    if (primaryProductId) {
      await prisma.order.create({
        data: {
          firstName: customerName.split(' ')[0] || customerName,
          lastName: customerName.split(' ').slice(1).join(' ') || '',
          phone: customerPhone || '',
          email: customerEmail,
          productId: primaryProductId,
          status: 'PAID',
          amount: totalAmount,
          paidAt: new Date(),
          robokassaInvId: orderHash
        }
      });
      console.log(`Tilda webhook: Created order, amount: ${totalAmount}`);
    } else if (matchedProducts.length === 0) {
      console.log(`Tilda webhook: No order created - no matching products found`);
    }

    if (isNewUser && generatedPassword) {
      const platformUrl = process.env.PLATFORM_URL || 
        (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '');
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Добро пожаловать на платформу!</h2>
          
          <p>Здравствуйте, ${customerName}!</p>
          
          <p>Спасибо за покупку! Для вас создан личный кабинет на нашей платформе.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Данные для входа:</h3>
            <p><strong>Email:</strong> ${customerEmail}</p>
            <p><strong>Пароль:</strong> ${generatedPassword}</p>
            ${platformUrl ? `<p><a href="${platformUrl}" style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Войти в личный кабинет</a></p>` : ''}
          </div>
          
          <p>Рекомендуем сменить пароль после первого входа в целях безопасности.</p>
          
          ${productNames.length > 0 ? `<p><strong>Ваша покупка:</strong> ${productNames.join(', ')}</p>` : ''}
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Если у вас возникнут вопросы, свяжитесь с нами.
          </p>
        </div>
      `;

      try {
        await sendEmail(
          customerEmail,
          'Добро пожаловать на платформу! Данные для входа',
          emailHtml
        );
        console.log(`Tilda webhook: Sent welcome email`);
      } catch (emailError) {
        console.error('Tilda webhook: Failed to send email:', emailError);
      }
    }

    console.log(`Tilda webhook: Successfully processed`);

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      userId: existingUser?.id,
      isNewUser,
      matchedProducts: matchedProducts.length,
      accessGranted: matchedProducts.length > 0
    });

  } catch (error) {
    console.error('Tilda webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tilda/test', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Tilda webhook endpoint is working',
    timestamp: new Date().toISOString(),
    secretConfigured: !!TILDA_WEBHOOK_SECRET
  });
});

export default router;
