import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Plus, Edit, Trash2, ShoppingBag, Link as LinkIcon, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '../../components/RichTextEditor';

interface Module {
  id: string;
  title: string;
}

interface ProductModule {
  module: Module;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  accessDurationType: 'unlimited' | 'days' | 'date';
  accessDuration: number | null;
  accessExpiresAt: string | null;
  startDate: string | null;
  emailSubject: string;
  emailTemplate: string;
  offerUrl: string | null;
  isActive: boolean;
  modules: ProductModule[];
  _count: { payments: number; enrollments: number; orders: number };
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#3d3527]">Продукты</h1>
          <p className="text-[#3d3527]/60 mt-1">Управление продуктами и ценами</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl hover:shadow-lg transition-shadow w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" /> Добавить продукт
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#a67c52]"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#3d3527]/60">Продукты не найдены</div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="bg-white/80 backdrop-blur-md rounded-2xl border border-[#d4c9b0]/30 p-4 md:p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#a67c52] to-[#c4a57b] rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-white" />
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
              <h3 className="text-base md:text-lg font-bold text-[#3d3527] mb-2 truncate">{product.name}</h3>
              <p className="text-sm text-[#3d3527]/60 mb-4 line-clamp-2">{product.description}</p>
              <div className="flex items-center justify-end">
                <span className={`px-2 py-1 rounded-full text-xs ${product.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {product.isActive ? 'Активен' : 'Неактивен'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#d4c9b0]/30 text-sm text-[#3d3527]/60">
                <span>{product._count.orders} заявок</span>
                <span>{product._count.payments} платежей</span>
              </div>
              {product.modules?.length > 0 && (
                <div className="mt-3 text-xs text-[#3d3527]/60 truncate">
                  Модули: {product.modules.map(m => m.module.title).join(', ')}
                </div>
              )}
              <PaymentLinkButton productId={product.id} />
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

function PaymentLinkButton({ productId }: { productId: string }) {
  const [copied, setCopied] = useState(false);
  const paymentUrl = `${window.location.origin}/pay/${productId}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Ссылка скопирована');
  };

  return (
    <div className="mt-3 pt-3 border-t border-[#d4c9b0]/30">
      <div className="flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-[#a67c52] flex-shrink-0" />
        <span className="text-xs text-[#3d3527]/60 truncate flex-1">{paymentUrl}</span>
        <button
          onClick={copyLink}
          className="p-1.5 hover:bg-[#f5f3ed] rounded-lg transition-colors flex-shrink-0"
          title="Копировать ссылку"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-[#3d3527]" />}
        </button>
      </div>
    </div>
  );
}

const TARIFF_OPTIONS = [
  { value: '', label: 'Не задан' },
  { value: 'BASIC', label: 'Базовый', description: 'Только просмотр уроков' },
  { value: 'FAMILY', label: 'Для родственников', description: 'Только просмотр уроков' },
  { value: 'RELATIVE', label: 'Родственник участника', description: 'Только просмотр уроков' },
  { value: 'WITH_MENTOR', label: 'С наставником', description: 'Полный доступ + мини-группы' },
  { value: 'WITH_PSYCHOLOGIST', label: 'С психологом', description: 'Полный доступ + мини-группы' },
  { value: 'INDIVIDUAL_PSYCHOLOGIST', label: 'Индивидуально с психологом', description: 'Полный доступ, без мини-групп' },
];

function ProductModal({ product, onSave, onClose }: { product: Product | null; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [startDate, setStartDate] = useState(product?.startDate?.split('T')[0] || '');
  const [accessExpiresAt, setAccessExpiresAt] = useState(product?.accessExpiresAt?.split('T')[0] || '');
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [defaultTariff, setDefaultTariff] = useState((product as any)?.defaultTariff || '');
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>(
    product?.modules?.map(m => m.module.id) || []
  );
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);

  useEffect(() => {
    api.get<any[]>('/content/modules').then(modules => {
      setAllModules(modules.map(m => ({ id: m.id, title: m.title })));
      setLoadingModules(false);
    }).catch(() => setLoadingModules(false));
  }, []);

  const toggleModule = (moduleId: string) => {
    setSelectedModuleIds(prev =>
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSave = () => {
    onSave({
      name,
      description,
      price: 0,
      startDate: startDate || null,
      accessDurationType: accessExpiresAt ? 'date' : 'unlimited',
      accessExpiresAt: accessExpiresAt || null,
      isActive,
      moduleIds: selectedModuleIds,
      defaultTariff: defaultTariff || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-3xl my-4 md:my-8 max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
        <h2 className="text-lg md:text-xl font-bold text-[#3d3527] mb-4">{product ? 'Редактировать продукт' : 'Новый продукт'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Описание</label>
            <RichTextEditor
              content={description}
              onChange={setDescription}
              placeholder="Описание продукта..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата старта</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
              <p className="text-xs text-[#3d3527]/60 mt-1">Доступ откроется в эту дату</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3527] mb-1">Дата окончания доступа</label>
              <input
                type="date"
                value={accessExpiresAt}
                onChange={(e) => setAccessExpiresAt(e.target.value)}
                className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
              />
              <p className="text-xs text-[#3d3527]/60 mt-1">Оставьте пустым для бессрочного доступа</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3527] mb-1">Тариф по умолчанию</label>
            <select
              value={defaultTariff}
              onChange={(e) => setDefaultTariff(e.target.value)}
              className="w-full px-4 py-2 border border-[#d4c9b0] rounded-xl focus:outline-none focus:border-[#a67c52]"
            >
              {TARIFF_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-[#3d3527]/60 mt-1">
              {TARIFF_OPTIONS.find(o => o.value === defaultTariff)?.description || 'При покупке ученику будет назначен этот тариф'}
            </p>
          </div>

          <div className="border-t border-[#d4c9b0]/30 pt-4">
            <label className="block text-sm font-medium text-[#3d3527] mb-2">Доступ к модулям</label>
            {loadingModules ? (
              <div className="text-sm text-[#3d3527]/60">Загрузка...</div>
            ) : allModules.length === 0 ? (
              <div className="text-sm text-[#3d3527]/60">Модули не найдены</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-[#f5f3ed] rounded-xl">
                {allModules.map(module => (
                  <label key={module.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModuleIds.includes(module.id)}
                      onChange={() => toggleModule(module.id)}
                      className="w-4 h-4 rounded border-[#d4c9b0]"
                    />
                    <span className="text-sm text-[#3d3527]">{module.title}</span>
                  </label>
                ))}
              </div>
            )}
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
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-[#3d3527] hover:bg-gray-100 rounded-xl w-full sm:w-auto">Отмена</button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gradient-to-r from-[#a67c52] to-[#c4a57b] text-white rounded-xl w-full sm:w-auto"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
