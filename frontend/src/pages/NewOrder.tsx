// frontend/src/pages/NewOrder.tsx
import React, { useState, FormEvent } from 'react';
import api from '../api';
import { useNavigate, Link } from 'react-router-dom';

type Staff = { id: number; full_name: string };

// faqat shu ikki hodimni tanlash
const staffList: Staff[] = [
	{ id: 2, full_name: 'Shukrullo' },
	{ id: 3, full_name: 'Olimjon' },
];

export default function NewOrder() {
	const nav = useNavigate();

	const [clientName, setClientName] = useState('');
	const [clientPhone, setClientPhone] = useState('');

	const [customerType, setCustomerType] = useState<'office' | 'sns' | 'consulting'>('office');
	const [docType, setDocType] = useState('');
	const [country, setCountry] = useState('');
	const [branchId, setBranchId] = useState<number | ''>(''); // 1=Namangan, 2=Toshkent
	const [deadline, setDeadline] = useState('');
	const [total, setTotal] = useState<number>(0);
	const [payMethod, setPayMethod] = useState<'naqd' | 'plastik' | 'payme' | 'terminal'>('naqd');

	// hodim tanlash
	const [staffId, setStaffId] = useState<number | ''>('');

	const [saving, setSaving] = useState(false);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (saving) return;

		if (!clientName.trim()) return alert('Mijoz ismini kiriting');
		if (!clientPhone.trim()) return alert('Telefon raqam kiriting');

		try {
			setSaving(true);

			// 1) Mijozni yaratish
			const c = await api.post('/clients', {
				full_name: clientName.trim(),
				phone: clientPhone.trim(),
			});
			const client_id = Number(c.data.id);

			// 2) Buyurtma yaratish (MUHIM: manager_id!)
			const payload = {
				client_id,
				customer_type: customerType,
				doc_type: docType || null,
				country: country || null,
				branch_id: branchId === '' ? null : Number(branchId),
				payment_method: payMethod,
				deadline: deadline || null,
				total_amount: Number(total) || 0,
				manager_id: staffId === '' ? null : Number(staffId), // ✅ backendga mos nom
			};

			const res = await api.post('/orders', payload);

			// 3) Yuklash sahifasiga o'tish
			nav(`/orders/${res.data.id}/upload`);
		} catch (err: any) {
			console.error(err);
			alert(err?.response?.data?.detail || err?.response?.data?.message || 'Saqlashda xato yuz berdi');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="w-full px-4 py-6">
			<form onSubmit={onSubmit} className="grid grid-cols-2 gap-4 w-full">
				<h2 className="text-xl col-span-full mb-4">Buyurtma kiritish</h2>

				<div>
					<label className="text-sm">Mijoz ismi</label>
					<input
						value={clientName}
						onChange={(e) => setClientName(e.target.value)}
						placeholder="Masalan: Ali Valiyev"
					/>
				</div>

				<div>
					<label className="text-sm">Telefon raqam</label>
					<input
						value={clientPhone}
						onChange={(e) => setClientPhone(e.target.value)}
						placeholder="+99890xxxxxxx"
					/>
				</div>

				<div>
					<label className="text-sm">Mijoz turi</label>
					<select value={customerType} onChange={(e) => setCustomerType(e.target.value as any)}>
						<option value="office">Offisga keldi</option>
						<option value="sns">SNS</option>
						<option value="consulting">Consulting</option>
					</select>
				</div>

				{/* hodim tanlash */}
				<div>
					<label className="text-sm">Hodim</label>
					<select
						value={staffId === '' ? '' : String(staffId)}
						onChange={(e) => (e.target.value === '' ? setStaffId('') : setStaffId(Number(e.target.value)))}
					>
						<option value="">— tanlang —</option>
						{staffList.map((s) => (
							<option key={s.id} value={s.id}>
								{s.full_name}
							</option>
						))}
					</select>
				</div>

				<div>
					<label className="text-sm">Hujjat turi</label>
					<input
						value={docType}
						onChange={(e) => setDocType(e.target.value)}
						placeholder="Hujjat turini kiriting"
					/>
				</div>

				<div>
					<label className="text-sm">Davlat</label>
					<input
						value={country}
						onChange={(e) => setCountry(e.target.value)}
						placeholder="Davlat nomini kiriting"
					/>
				</div>

				<div>
					<label className="text-sm">Filial (Namangan/Toshkent)</label>
					<select
						value={branchId === '' ? '' : String(branchId)}
						onChange={(e) =>
							e.target.value === '' ? setBranchId('') : setBranchId(Number(e.target.value))
						}
					>
						<option value="">— tanlang —</option>
						<option value="1">Namangan</option>
						<option value="2">Toshkent</option>
					</select>
				</div>

				<div>
					<label className="text-sm">Deadline</label>
					<input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
				</div>

				<div>
					<label className="text-sm">Umumiy to‘lov</label>
					<input
						type="number"
						value={Number.isNaN(total) ? 0 : total}
						onChange={(e) => setTotal(Number(e.target.value))}
						placeholder="0"
					/>
				</div>

				<div>
					<label className="text-sm">To‘lov turi</label>
					<select value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
						<option value="naqd">naqd</option>
						<option value="plastik">plastik</option>
						<option value="payme">payme</option>
						<option value="terminal">terminal</option>
					</select>
				</div>

				<div className="col-span-2 flex gap-3">
					<button type="submit" disabled={saving}>
						{saving ? 'Saqlanmoqda…' : 'Saqlash'}
					</button>
					<Link to="/orders" className="bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded text-white">
						Bekor qilish
					</Link>
				</div>
			</form>
		</div>
	);
}
