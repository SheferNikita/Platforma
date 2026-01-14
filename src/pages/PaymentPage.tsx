import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { ShoppingBag, User, Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  offerUrl?: string | null;
}

export function PaymentPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!productId) return;

    api.get<Product>(`/public/orders/product/${productId}`)
      .then(setProduct)
      .catch(() => setError('Продукт не найден'))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !email.trim()) {
      toast.error('Заполните все поля');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Введите корректный email');
      return;
    }

    setSubmitting(true);

    try {
      const order = await api.post<{ id: string }>('/public/orders', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        productId
      });

      const { paymentUrl } = await api.get<{ paymentUrl: string | null }>(`/public/orders/${order.id}/payment-url`);

      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        toast.success('Заявка создана! Ожидайте подтверждения оплаты.');
        navigate('/');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Ошибка создания заявки');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f3ed] to-[#ebe8dc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#a67c52]" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f3ed] to-[#ebe8dc] flex items-center justify-center p-4">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-[#3d3527] mb-4">Продукт не найден</h1>
          <p className="text-[#3d3527]/60 mb-6">К сожалению, запрашиваемый продукт недоступен.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f3ed] to-[#ebe8dc] flex items-center justify-center p-4">
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-8 w-full max-w-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#3d3527]">{product.name}</h1>
            <p className="text-2xl font-bold text-[#a67c52]">{product.price.toLocaleString()} ₽</p>
          </div>
        </div>

        {product.description && (
          <div 
            className="text-sm text-[#3d3527]/70 mb-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Имя</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                  placeholder="Иван"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Фамилия</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="Иванов"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Телефон</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="+7 (999) 123-45-67"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#3d3527]/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                Перейти к оплате
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-center text-[#3d3527]/50 mt-4">
          Нажимая кнопку, вы соглашаетесь с{' '}
          {product.offerUrl ? (
            <a 
              href={product.offerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#a67c52] underline hover:text-[#8b6a47]"
            >
              условиями оферты
            </a>
          ) : (
            'условиями оферты'
          )}
        </p>
      </div>
    </div>
  );
}
