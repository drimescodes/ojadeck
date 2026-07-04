import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { queryKeys } from '../query';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export default function Catalogue() {
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', price: '', inStock: true });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const queryClient = useQueryClient();
    const { data: products = [], isLoading } = useQuery({
        queryKey: queryKeys.products,
        queryFn: api.getProducts,
    });
    const loading = isLoading && products.length === 0;
    const saveProductMutation = useMutation({
        mutationFn: async ({ productId, payload, file }) => {
            let savedProductId = productId;
            if (savedProductId) {
                await api.updateProduct(savedProductId, payload);
            } else {
                const created = await api.addProduct(payload);
                savedProductId = created.id;
            }

            if (file && savedProductId) {
                await api.uploadProductImage(savedProductId, file);
            }
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
    });
    const deleteProductMutation = useMutation({
        mutationFn: api.deleteProduct,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
    });
    const productActionBusy = saveProductMutation.isPending || deleteProductMutation.isPending;

    useBodyScrollLock(showModal);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    };

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', description: '', price: '', inStock: true });
        setImageFile(null);
        setImagePreview('');
        setShowModal(true);
    };

    const openEdit = (product) => {
        setEditing(product);
        setForm({
            name: product.name,
            description: product.description || '',
            price: (product.price / 100).toString(),
            inStock: product.inStock,
        });
        setImageFile(null);
        setImagePreview(product.imageUrl || '');
        setShowModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        const payload = {
            name: form.name,
            description: form.description || null,
            price: Math.round(parseFloat(form.price) * 100),
            inStock: form.inStock,
        };

        try {
            await saveProductMutation.mutateAsync({ productId: editing?.id, payload, file: imageFile });
            setShowModal(false);
            setImageFile(null);
            setImagePreview('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this product?')) return;
        try {
            await deleteProductMutation.mutateAsync(id);
        } catch (err) {
            alert(err.message);
        }
    };

    const formatPrice = (kobo) => `₦${(kobo / 100).toLocaleString()}`;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                        Catalogue
                    </div>
                    <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.05em] text-[#18231d]">
                        Product Catalogue
                    </h1>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627168]">
                        These are the products the assistant can confidently recommend, price, and convert into payment-link orders.
                    </p>
                </div>
                <button
                    className="rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                    onClick={openAdd}
                >
                    + Add Product
                </button>
            </div>

            {loading ? (
                <CatalogueSkeleton />
            ) : products.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#d8cfbc] bg-[#fbf8f2] px-6 py-16 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">Inventory Empty</div>
                    <h3 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#1a2a22]">No products yet</h3>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#627168]">
                        Add products so the assistant knows what it can sell, price, and convert into a payment link.
                    </p>
                    <button
                        className="mt-8 rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d]"
                        onClick={openAdd}
                    >
                        Add Your First Product
                    </button>
                </div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {products.map((p) => (
                        <div key={p.id} className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                            {p.imageUrl && (
                                <div className="mb-5 aspect-[4/3] overflow-hidden rounded-2xl border border-[#eee5d4] bg-[#f7f3ea]">
                                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                </div>
                            )}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-lg font-bold tracking-[-0.03em] text-[#18231d]">{p.name}</div>
                                    <div className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-[#153d32]">
                                        {formatPrice(p.price)}
                                    </div>
                                </div>
                                <span
                                    className={[
                                        'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                                        p.inStock
                                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                            : 'bg-red-50 text-red-700 ring-1 ring-red-200',
                                    ].join(' ')}
                                >
                                    {p.inStock ? 'In Stock' : 'Out of Stock'}
                                </span>
                            </div>
                            <p className="mt-4 min-h-16 text-sm leading-7 text-[#627168]">
                                {p.description || 'No extra description added yet.'}
                            </p>
                            <div className="mt-6 flex gap-3">
                                <button
                                    className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-4 py-2.5 text-sm font-semibold text-[#294136] transition hover:border-[#b8ac95] hover:bg-[#f1ebdf]"
                                    onClick={() => openEdit(p)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => handleDelete(p.id)}
                                    disabled={productActionBusy}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#15231d]/45 px-4 py-4 backdrop-blur-sm sm:py-8" onClick={() => setShowModal(false)}>
                    <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-[30px] border border-[#e8decc] bg-[#fffdf8] shadow-[0_24px_70px_rgba(21,35,29,0.18)] sm:max-h-[calc(100dvh-4rem)]" onClick={(e) => e.stopPropagation()}>
                        <div className="shrink-0 px-6 pt-6 md:px-7 md:pt-7">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b6b48]">
                                {editing ? 'Edit Product' : 'Add Product'}
                            </div>
                            <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#18231d] sm:text-3xl">
                                {editing ? 'Refine this listing' : 'Create a sellable product card'}
                            </h2>
                        </div>
                        <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5 md:px-7">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Product Name</label>
                                <input
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="e.g. Jollof Rice"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[#294136]">Description</label>
                                <input
                                    className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    placeholder="e.g. Smoky party jollof with chicken"
                                />
                            </div>
                            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-[#294136]">Price (₦)</label>
                                    <input
                                        className="w-full rounded-2xl border border-[#d9d1bf] bg-[#fffdf8] px-4 py-3 text-sm text-[#18231d] outline-none transition placeholder:text-[#8b8f83] focus:border-[#1f9d63] focus:ring-4 focus:ring-[#1f9d63]/10"
                                        name="price"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.price}
                                        onChange={handleChange}
                                        placeholder="e.g. 2500"
                                        required
                                    />
                                </div>
                                <label className="flex items-center gap-3 rounded-2xl border border-[#ddd4c3] bg-[#f7f3ea] px-4 py-3 text-sm font-semibold text-[#294136]">
                                    <input
                                        type="checkbox"
                                        name="inStock"
                                        checked={form.inStock}
                                        onChange={handleChange}
                                        id="inStock"
                                        className="h-4 w-4 rounded border-[#c5b89f] text-[#1f9d63] focus:ring-[#1f9d63]"
                                    />
                                    In Stock
                                </label>
                            </div>
                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-[#294136]">Product Image</label>
                                {imagePreview ? (
                                    <div className="h-36 overflow-hidden rounded-2xl border border-[#ddd4c3] bg-[#f7f3ea] sm:h-44">
                                        <img src={imagePreview} alt="Product preview" className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-[#d8cfbc] bg-[#f7f3ea] text-sm font-semibold text-[#7b6b48] sm:h-32">
                                        No image selected
                                    </div>
                                )}
                                <input
                                    className="block w-full text-sm text-[#294136] file:mr-4 file:rounded-xl file:border-0 file:bg-[#153d32] file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-[#1b4a3d]"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleImageChange}
                                />
                                <p className="text-xs leading-6 text-[#6d776f]">
                                    JPG, PNG, or WEBP. Max 3MB.
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#eee5d4] bg-[#fffdf8] px-6 py-4 sm:flex-row sm:justify-end md:px-7">
                            <button className="rounded-2xl border border-[#d8cfbc] bg-[#f8f4ec] px-5 py-3 text-sm font-semibold text-[#294136] transition hover:border-[#b8ac95] hover:bg-[#f1ebdf] disabled:cursor-not-allowed disabled:opacity-60" onClick={() => setShowModal(false)} disabled={productActionBusy}>
                                Cancel
                            </button>
                            <button className="rounded-2xl bg-[#153d32] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(21,61,50,0.18)] transition hover:bg-[#1b4a3d] disabled:cursor-not-allowed disabled:opacity-60" onClick={handleSave} disabled={productActionBusy}>
                                {saveProductMutation.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function CatalogueSkeleton() {
    return (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="rounded-[26px] border border-[#e7dfcf] bg-white p-5 shadow-[0_12px_30px_rgba(104,85,45,0.05)]">
                    <div className="skeleton aspect-[4/3] rounded-2xl" />
                    <div className="mt-5 flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="skeleton h-5 w-40 rounded-full" />
                            <div className="skeleton mt-3 h-8 w-28 rounded-full" />
                        </div>
                        <div className="skeleton h-7 w-20 rounded-full" />
                    </div>
                    <div className="mt-5 space-y-2">
                        <div className="skeleton h-3 w-full rounded-full" />
                        <div className="skeleton h-3 w-4/5 rounded-full" />
                        <div className="skeleton h-3 w-2/3 rounded-full" />
                    </div>
                    <div className="mt-6 flex gap-3">
                        <div className="skeleton h-10 w-20 rounded-2xl" />
                        <div className="skeleton h-10 w-20 rounded-2xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}
