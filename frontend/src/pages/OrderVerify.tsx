// src/pages/OrderVerify.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api";

type Order = {
    id: number;
    client_name: string;
    doc_type?: string;
    manager?: string;
    created_at?: string;
};

// Pydantic xatolarini o‘qiladigan ko‘rinishga aylantirish
function parseApiError(e: any): string[] {
    const d = e?.response?.data?.detail;
    if (Array.isArray(d)) {
        return d.map((it: any) => {
            const path = Array.isArray(it.loc) ? it.loc.join(".") : String(it.loc ?? "");
            return `${path}: ${it.msg}`;
        });
    }
    const msg = d || e?.response?.data?.message || e?.message || "Xatolik yuz berdi";
    return [String(msg)];
}

export default function OrderVerify() {
    const { id } = useParams();
    const nav = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);

    // Form maydonlari (state nomlari backend maydonlari bilan mos)
    const [doc_number, setNum] = useState("");
    const [doc_title, setTitle] = useState("");
    const [translator_name, setTr] = useState("");
    const [issued_date, setDate] = useState<string>(() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${m}-${day}`; // 'YYYY-MM-DD'
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [errors, setErrors] = useState<string[]>([]);

    const oid = Number(id);

    useEffect(() => {
        async function load() {
            try {
                const r = await api.get(`/orders/${oid}`);
                const o: Order = r.data;
                setOrder(o);
                // Avto-to‘ldirish
                setNum(`${o.id}-${new Date().getFullYear()}`);
                setTitle(o.doc_type || "Document");
                setTr(o.manager || "");
            } catch {
                nav("/orders");
            }
        }
        if (Number.isFinite(oid)) load();
    }, [oid, nav]);

    async function submit(e?: React.FormEvent) {
        e?.preventDefault?.();
        setLoading(true);
        setErrors([]);

        try {
            // FormData yuboramiz (backend Form(...) kutyapti)
            const form = new FormData();
            form.append("doc_number", (doc_number || "").trim());
            form.append("doc_title", (doc_title || "").trim());
            form.append("translator_name", (translator_name || "").trim());
            if (issued_date) form.append("issued_date", issued_date);
            if (Number.isFinite(oid)) form.append("order_id", String(oid));
            form.append(
                "note_en",
                "This document is certified and verified by LINGUA TRANSLATION."
            );

            const r = await api.post("/verify/create", form);
            // Backend javobi: { id, public_id, verify_url, qr_image }
            setResult(r.data);
        } catch (e: any) {
            setErrors(parseApiError(e));
            console.error("API error:", e);
        } finally {
            setLoading(false);
        }
    }

    if (!order) return <div className="p-8 text-center">Yuklanmoqda...</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 card">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Buyurtma #{order.id} → Tasdiqlash (QR)</h2>
                <Link to="/orders" className="underline">← Buyurtmalar</Link>
            </div>

            <div className="mb-4 text-sm text-gray-600">
                <div><b>Mijoz:</b> {order.client_name}</div>
                <div><b>Hujjat turi:</b> {order.doc_type || "-"}</div>
                <div><b>Hodim/Translator:</b> {order.manager || "-"}</div>
            </div>

            <form onSubmit={submit} className="space-y-3">
                <div>
                    <label className="text-sm">Tartib raqami</label>
                    <input value={doc_number} onChange={(e) => setNum(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Hujjat nomi</label>
                    <input value={doc_title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Tarjimon F.I.O</label>
                    <input value={translator_name} onChange={(e) => setTr(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Sana</label>
                    <input type="date" value={issued_date} onChange={(e) => setDate(e.target.value)} />
                </div>

                <div className="flex gap-3">
                    <button type="submit" disabled={loading}>
                        {loading ? "Yaratilmoqda..." : "QR yaratish"}
                    </button>
                    <Link to="/orders">
                        <button type="button" style={{ background: "#e5e7eb", color: "#111" }}>
                            Bekor qilish
                        </button>
                    </Link>
                </div>

                {errors.length > 0 && (
                    <div className="text-red-600 text-sm space-y-1">
                        {errors.map((line, i) => <div key={i}>• {line}</div>)}
                    </div>
                )}
            </form>

            {result && (
                <div className="mt-6 space-y-2">
                    <div className="text-sm">
                        Verify link:{" "}
                        <a className="text-blue-600 underline" href={result.verify_url} target="_blank" rel="noreferrer">
                            {result.verify_url}
                        </a>
                    </div>
                    {result.qr_image && (
                        <>
                            <img src={result.qr_image} alt="QR" style={{ width: 220 }} />
                            <a className="underline text-sm" href={result.qr_image} download>
                                QR PNG’ni yuklab olish
                            </a>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
