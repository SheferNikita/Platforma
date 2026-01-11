import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, ShoppingBag, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  accessType: string;
  accessDuration: number;
  emailSubject: string;
  emailTemplate: string;
  isActive: boolean;
  _count: { payments: number; enrollments: number };
}

export function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await api.get<Product[]>('/products');
      setProducts(data);
    } catch (error) {
      toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  async function saveProduct(data: Partial<Product>) {
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, data);
        toast.success('Продукт обновлен');
      } else {
        await api.post('/products', data);
        toast.success('Продукт создан');
      }
      loadProducts();
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Удалить продукт?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Продукт удален');
      loadProducts();
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#3d3527]">Продукты</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление продуктами и ценами</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow"
        >
          <Plus className="w-5 h-5" /> Добавить продукт
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Продукты не найдены</div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingProduct(product); setShowModal(true); }}
                    className="p-2 hover:bg-[#f5f3ed] rounded-lg"
                  >
                    <Edit className="w-4 h-4 text-[#3d3527]" />
                  </button>
                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="p-2 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-[#3d3527] mb-2">{product.name}</h3>
              <p className="text-sm text-[#3d3527]/60 mb-4 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-[#3d3527]">{product.price.toLocaleString()} ₽</p>
                <span className={`px-2 py-1 rounded-full text-xs ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {product.isActive ? 'Активен' : 'Неактивен'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#d4c9b0]/30 text-sm text-[#3d3527]/60">
                <span>{product._count.payments} платежей</span>
                <span>{product._count.enrollments} подписок</span>
              </div>
              {product.emailTemplate && (
                <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                  <Mail className="w-4 h-4" />
                  <span>Email настроен</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={saveProduct}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}

function ProductModal({ product, onSave, onClose }: { product: Product | null; onSave: (data: Partial<Product>) => void; onClose: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price || 0);
  const [accessType, setAccessType] = useState(product?.accessType || 'course');
  const [accessDuration, setAccessDuration] = useState(product?.accessDuration || 365);
  const [emailSubject, setEmailSubject] = useState(product?.emailSubject || '');
  const [emailTemplate, setEmailTemplate] = useState(product?.emailTemplate || '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold text-[#3d3527] mb-4">{product ? 'Редактировать продукт' : 'Новый продукт'}</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Цена (₽)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Тип доступа</label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              >
                <option value="course">Курс</option>
                <option value="subscription">Подписка</option>
                <option value="consultation">Консультация</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Срок доступа (дней)</label>
              <input
                type="number"
                value={accessDuration}
                onChange={(e) => setAccessDuration(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
            </div>
          </div>

          <div className="border-t border-[#d4c9b0]/30 pt-4 mt-4">
            <h3 className="font-semibold text-[#3d3527] mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5" /> Email после оплаты
            </h3>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Тема письма</label>
              <input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
                placeholder="Добро пожаловать на курс!"
              />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium text-[#3d3527] mb-1">
                Шаблон письма (HTML)
                <span className="text-[#3d3527]/60 ml-2">Переменные: {'{{name}}'}, {'{{productName}}'}, {'{{amount}}'}</span>
              </label>
              <textarea
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52] font-mono text-sm"
                rows={6}
                placeholder="<h1>Здравствуйте, {{name}}!</h1>..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-[#d4c9b0]"
            />
            <label htmlFor="isActive" className="text-sm text-[#3d3527]">Продукт активен</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl">Отмена</button>
          <button
            onClick={() => onSave({ name, description, price, accessType, accessDuration, emailSubject, emailTemplate, isActive })}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
