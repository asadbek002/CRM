import { useState } from "react";
import api from "../api";

export default function VerifyCreate() {
    const [doc_number, setNum] = useState("");
    const [doc_title, setTitle] = useState("");
    const [translator_name, setTr] = useState("");
    const [issued_date, setDate] = useState("");
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    async function submit() {
        setLoading(true);
        try {
            const form = new FormData();
            form.append("doc_number", doc_number);
            form.append("doc_title", doc_title);
            form.append("translator_name", translator_name);
            form.append("issued_date", issued_date);

            const r = await api.post("/verify/create", form);
            setResult(r.data);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-xl mx-auto p-4 card">
            <h2 className="text-xl font-semibold mb-3">Hujjatni tasdiqlash (QR)</h2>

            <div className="space-y-3">
                <div>
                    <label className="text-sm">Tartib raqami</label>
                    <input value={doc_number} onChange={e => setNum(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Hujjat nomi</label>
                    <input value={doc_title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Tarjimon F.I.O</label>
                    <input value={translator_name} onChange={e => setTr(e.target.value)} />
                </div>
                <div>
                    <label className="text-sm">Sana</label>
                    <input type="date" value={issued_date} onChange={e => setDate(e.target.value)} />
                </div>
                <button onClick={submit} disabled={loading}>
                    {loading ? "Yaratilmoqda..." : "QR yaratish"}
                </button>
            </div>

            {result && (
                <div className="mt-5 space-y-2">
                    <div className="text-sm">
                        Verify link:{" "}
                        <a className="text-blue-600 underline" href={result.verify_url} target="_blank" rel="noreferrer">
                            {result.verify_url}
                        </a>
                    </div>
                    <img src={result.qr_image} alt="QR" style={{ width: 180 }} />
                </div>
            )}
        </div>
    );
}
