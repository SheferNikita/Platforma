import { Router, Request, Response } from 'express';
import express from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { sendEmail } from '../services/email';
import { getWelcomeEmailTemplate } from '../templates/welcomeEmail';

const PLATFORM_URL = 'https://schkola-trezvosti.ru';

const router = Router();

// Add urlencoded parser for Tilda webhooks (Tilda sends form data, not JSON)
router.use(express.urlencoded({ extended: true }));

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
    const rawProducts = req.body.products;
    const productsType = typeof rawProducts;
    const productsPreview = productsType === 'string' 
      ? rawProducts.substring(0, 200) 
      : (Array.isArray(rawProducts) ? `array[${rawProducts.length}]` : productsType);
    
    const logData = {
      email: req.body.email ? `${req.body.email.substring(0, 3)}***` : undefined,
      hasName: !!req.body.name,
      tranid: req.body.tranid,
      orderid: req.body.orderid,
      productsType,
      productsPreview,
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
      products,
      utm_source,
      utm_medium,
      utm_campaign
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
    } else if (!existingUser.student) {
      // User exists but without student record - create student
      const student = await prisma.student.create({
        data: {
          userId: existingUser.id,
          phone: customerPhone,
          surveyCompleted: false
        }
      });
      existingUser = await prisma.user.findUnique({
        where: { id: existingUser.id },
        include: { student: true }
      });
      console.log(`Tilda webhook: Created student for existing user ${customerEmail.substring(0, 3)}***`);
    }

    let productNames: string[] = [];
    let totalAmount = 0;
    let matchedProducts: any[] = [];

    // Parse products - Tilda may send as JSON string or array
    let parsedProducts: any[] = [];
    if (products) {
      if (Array.isArray(products)) {
        parsedProducts = products;
      } else if (typeof products === 'string') {
        try {
          const parsed = JSON.parse(products);
          parsedProducts = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`Tilda webhook: Parsed products from JSON string, count: ${parsedProducts.length}`);
        } catch (e) {
          console.warn('Tilda webhook: Failed to parse products JSON:', products);
        }
      } else if (typeof products === 'object') {
        // Single product object
        parsedProducts = [products];
      }
    }

    if (parsedProducts.length > 0) {
      for (const product of parsedProducts) {
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
          
          console.log(`Tilda webhook: Searching for product "${productName}" among ${allProducts.length} active products: ${allProducts.map(p => p.name).join(', ')}`);
          
          const productNameLower = productName.toLowerCase().trim();
          
          // Try exact substring match first
          dbProduct = allProducts.find(p => 
            p.name.toLowerCase().includes(productNameLower) ||
            productNameLower.includes(p.name.toLowerCase())
          ) || null;
          
          // Try normalized match (remove special chars, numbers variations)
          if (!dbProduct) {
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-яё]/gi, '');
            const normalizedInput = normalize(productName);
            dbProduct = allProducts.find(p => {
              const normalizedDb = normalize(p.name);
              return normalizedDb === normalizedInput || 
                     normalizedDb.includes(normalizedInput) || 
                     normalizedInput.includes(normalizedDb);
            }) || null;
            
            if (dbProduct) {
              console.log(`Tilda webhook: Found product by normalized match: "${dbProduct.name}" for "${productName}"`);
            }
          }
          
          // Try matching by base name (e.g., "Базовый" matches "ШТ-3.Базовый" or "ШТ-4.Базовый")
          if (!dbProduct) {
            const baseNames = ['базовый', 'семейный', 'с ментором', 'с психологом', 'индивидуальный'];
            for (const baseName of baseNames) {
              if (productNameLower.includes(baseName)) {
                dbProduct = allProducts.find(p => p.name.toLowerCase().includes(baseName)) || null;
                if (dbProduct) {
                  console.log(`Tilda webhook: Found product by base name "${baseName}": "${dbProduct.name}" for "${productName}"`);
                  break;
                }
              }
            }
          }
          
          if (dbProduct) {
            console.log(`Tilda webhook: Found product by partial match: "${dbProduct.name}" for "${productName}"`);
          } else {
            console.warn(`Tilda webhook: No product match found for "${productName}". Available products: ${allProducts.map(p => `"${p.name}"`).join(', ')}`);
          }
        }

        if (dbProduct) {
          matchedProducts.push(dbProduct);
          
          console.log(`Tilda webhook: Product found: "${dbProduct.name}" with ${dbProduct.modules?.length || 0} modules`);
          console.log(`Tilda webhook: Student check - existingUser: ${!!existingUser}, student: ${!!existingUser?.student}, studentId: ${existingUser?.student?.id || 'none'}`);

          if (existingUser?.student) {
            if (!dbProduct.modules || dbProduct.modules.length === 0) {
              console.warn(`Tilda webhook: Product "${dbProduct.name}" has no modules attached! Cannot grant access.`);
            }
            
            for (const pm of dbProduct.modules) {
              const expiresAt = calculateAccessExpiry(dbProduct);
              const accessFrom = (dbProduct as any).startDate ? new Date((dbProduct as any).startDate) : null;
              
              console.log(`Tilda webhook: Creating ModuleAccess - studentId: ${existingUser.student.id}, moduleId: ${pm.moduleId}, expiresAt: ${expiresAt}, accessFrom: ${accessFrom}`);
              
              try {
                await prisma.moduleAccess.upsert({
                  where: {
                    studentId_moduleId: {
                      studentId: existingUser.student.id,
                      moduleId: pm.moduleId
                    }
                  },
                  update: {
                    isActive: true,
                    expiresAt,
                    accessFrom
                  },
                  create: {
                    studentId: existingUser.student.id,
                    moduleId: pm.moduleId,
                    isActive: true,
                    expiresAt,
                    accessFrom
                  }
                });
                console.log(`Tilda webhook: ModuleAccess created/updated successfully for module ${pm.moduleId}`);
              } catch (accessError) {
                console.error(`Tilda webhook: Failed to create ModuleAccess:`, accessError);
              }
            }
            console.log(`Tilda webhook: Granted access to ${dbProduct.modules.length} modules for product ${dbProduct.name}`);
            
            if (dbProduct.defaultTariff) {
              await prisma.student.update({
                where: { id: existingUser.student.id },
                data: { tariff: dbProduct.defaultTariff }
              });
              console.log(`Tilda webhook: Updated student tariff to ${dbProduct.defaultTariff}`);
            }
          } else {
            console.error(`Tilda webhook: Cannot grant access - no student record found for user`);
          }
        } else {
          console.warn(`Tilda webhook: No matching product found for "${productName}"`);
        }
      }
    }

    if (matchedProducts.length === 0 && parsedProducts.length > 0) {
      console.warn(`Tilda webhook: No products matched from Tilda order. Received: ${productNames.join(', ')}`);
    }

    const primaryProductId = matchedProducts.length > 0 
      ? matchedProducts[0].id 
      : null;

    // Always create order for tracking, even if no product matched
    // Use first available product as fallback if none matched
    let orderProductId = primaryProductId;
    let fallbackProduct: any = null;
    
    if (!orderProductId) {
      fallbackProduct = await prisma.product.findFirst({
        where: { isActive: true },
        include: {
          modules: {
            include: { module: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });
      orderProductId = fallbackProduct?.id || null;
      
      // CRITICAL FIX: If no products matched from Tilda but we have a fallback,
      // grant access to fallback product's modules
      if (fallbackProduct && existingUser?.student && fallbackProduct.modules?.length > 0) {
        console.log(`Tilda webhook: No products matched from Tilda, using fallback product "${fallbackProduct.name}" with ${fallbackProduct.modules.length} modules`);
        
        for (const pm of fallbackProduct.modules) {
          const expiresAt = calculateAccessExpiry(fallbackProduct);
          const accessFrom = (fallbackProduct as any).startDate ? new Date((fallbackProduct as any).startDate) : null;
          
          console.log(`Tilda webhook: Creating ModuleAccess (fallback) - studentId: ${existingUser.student.id}, moduleId: ${pm.moduleId}`);
          
          try {
            await prisma.moduleAccess.upsert({
              where: {
                studentId_moduleId: {
                  studentId: existingUser.student.id,
                  moduleId: pm.moduleId
                }
              },
              update: {
                isActive: true,
                expiresAt,
                accessFrom
              },
              create: {
                studentId: existingUser.student.id,
                moduleId: pm.moduleId,
                isActive: true,
                expiresAt,
                accessFrom
              }
            });
            console.log(`Tilda webhook: ModuleAccess (fallback) created successfully for module ${pm.moduleId}`);
          } catch (accessError) {
            console.error(`Tilda webhook: Failed to create fallback ModuleAccess:`, accessError);
          }
        }
        
        // Update tariff if fallback product has default
        if (fallbackProduct.defaultTariff) {
          await prisma.student.update({
            where: { id: existingUser.student.id },
            data: { tariff: fallbackProduct.defaultTariff }
          });
          console.log(`Tilda webhook: Updated student tariff to ${fallbackProduct.defaultTariff} (fallback)`);
        }
      }
    }

    if (orderProductId) {
      try {
        await prisma.order.create({
          data: {
            firstName: customerName.split(' ')[0] || customerName,
            lastName: customerName.split(' ').slice(1).join(' ') || '',
            phone: customerPhone || '',
            email: customerEmail,
            productId: orderProductId,
            status: 'PAID',
            amount: totalAmount,
            paidAt: new Date(),
            robokassaInvId: orderHash,
            source: 'TILDA',
            tildaTranId: tranid || null,
            tildaOrderId: orderid || null,
            utmSource: utm_source || null,
            utmMedium: utm_medium || null,
            utmCampaign: utm_campaign || null,
            comment: matchedProducts.length === 0 ? `Tilda products: ${productNames.join(', ')} (not matched, fallback used)` : null
          }
        });
        console.log(`Tilda webhook: Created order, amount: ${totalAmount}, tranId: ${tranid}, orderId: ${orderid}, matched: ${matchedProducts.length > 0}, fallback: ${!!fallbackProduct}`);
      } catch (orderError: any) {
        if (orderError.code === 'P2002') {
          console.log(`Tilda webhook: Order already exists for hash ${orderHash}`);
        } else {
          console.error('Tilda webhook: Failed to create order:', orderError);
        }
      }
    } else {
      console.error(`Tilda webhook: No products in database to create order`);
    }

    if (isNewUser && generatedPassword) {
      const emailHtml = getWelcomeEmailTemplate({
        name: customerName,
        email: customerEmail,
        password: generatedPassword,
        loginUrl: PLATFORM_URL
      });

      try {
        await sendEmail(
          customerEmail,
          'Добро пожаловать на платформу обучения трезвости',
          emailHtml
        );
        console.log(`Tilda webhook: Sent welcome email`);
      } catch (emailError) {
        console.error('Tilda webhook: Failed to send email:', emailError);
      }
    } else if (!isNewUser && matchedProducts.length > 0) {
      // Send purchase confirmation to existing user
      const purchaseEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #a67c52;">Спасибо за покупку!</h2>
          <p>Здравствуйте, ${customerName}!</p>
          <p>Ваша оплата успешно получена. Вам открыт доступ к материалам:</p>
          <ul>
            ${matchedProducts.map(p => `<li><strong>${p.name}</strong></li>`).join('')}
          </ul>
          <p>Вы можете войти в личный кабинет и начать обучение:</p>
          <p><a href="${PLATFORM_URL}" style="display: inline-block; padding: 12px 24px; background-color: #a67c52; color: white; text-decoration: none; border-radius: 8px;">Войти на платформу</a></p>
          <p style="color: #666; font-size: 14px;">С уважением,<br>Платформа школы трезвости</p>
        </body>
        </html>
      `;

      try {
        await sendEmail(
          customerEmail,
          'Оплата получена - доступ открыт',
          purchaseEmailHtml
        );
        console.log(`Tilda webhook: Sent purchase confirmation email`);
      } catch (emailError) {
        console.error('Tilda webhook: Failed to send purchase email:', emailError);
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
