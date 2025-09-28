import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

export default function VerifyView() {
    const { public_id } = useParams();
    const [data, setData] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        api.get(`/verify/${public_id}`)
            .then(r => setData(r.data))
            .catch(() => setErr("Document not found or inactive"));
    }, [public_id]);

    if (err) return <div className="p-8 text-center text-red-600">{err}</div>;
    if (!data) return <div className="p-8 text-center">Yuklanmoqda...</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 card">
            <h2 className="text-2xl font-bold mb-4">Document Verification</h2>
            <div className="space-y-2">
                <div><b>Document No:</b> {data.doc_number}</div>
                <div><b>Title:</b> {data.doc_title}</div>
                <div><b>Translator:</b> {data.translator_name}</div>
                <div><b>Date:</b> {data.issued_date}</div>
                <div className="mt-2 italic text-green-700">{data.note_en}</div>
                <div className="text-sm text-gray-500 mt-4">Organization: LINGUA TRANSLATION</div>
            </div>
        </div>
    );
}
