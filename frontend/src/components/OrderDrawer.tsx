// src/components/OrderDrawer.tsx
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    fetchComments,
    addCommentText,
    deleteComment,
    type CommentOut,
    fetchOrderAttachments,
    buildAttachmentDownloadUrl,
    type AttachmentOut,
    type AttachmentKind,
} from "@/api";

type Props = {
    order: any;            // объект строки из Orders.tsx
    open: boolean;
    onClose: () => void;
    currentUser?: string;  // автор комментария
};

const KIND_ORDER: AttachmentKind[] = ["translation", "apostille", "notary"];
const KIND_LABEL: Record<AttachmentKind, string> = {
    translation: "Tarjima",
    apostille: "Apostille",
    notary: "Notarius",
};

// аккуратно нормализуем kind
function normalizeKind(v?: string | null): AttachmentKind {
    if (v === "apostille" || v === "notary") return v;
    return "translation";
}

export default function OrderDrawer({ order, open, onClose, currentUser }: Props) {
    // ===== вычисляемые поля заказа (без undefined) =====
    const total = Number(order?.total_amount || 0);
    const paid = Number(order?.paid_sum || 0);
    const debt = Math.max(total - paid, 0);

    const paymentText = `${paid.toLocaleString()} / Qoldiq: ${debt.toLocaleString()}`;

    const statusText = useMemo(() => {
        const raw = (order?.status || "").toString().toLowerCase();
        if (!raw) return "-";
        if (["tayyor", "topshirildi", "yakunlandi"].includes(raw)) return "Yakunlandi";
        if (["hali_boshlanmagan"].includes(raw)) return "Hali boshlanmadi";
        return "Jarayonda";
    }, [order?.status]);

    // ===== вложения =====
    const [filesByKind, setFilesByKind] = useState<Record<AttachmentKind, AttachmentOut[]>>({
        translation: [],
        apostille: [],
        notary: [],
    });
    const [loadingFiles, setLoadingFiles] = useState(false);

    const loadFiles = async () => {
        if (!order?.id) return;
        setLoadingFiles(true);
        try {
            const list = await fetchOrderAttachments(order.id);
            const grouped: Record<AttachmentKind, AttachmentOut[]> = {
                translation: [], apostille: [], notary: []
            };
            for (const it of list) grouped[normalizeKind(it.kind)].push(it);
            setFilesByKind(grouped);
        } finally {
            setLoadingFiles(false);
        }
    };

    // ===== комментарии =====
    const [comments, setComments] = useState<CommentOut[]>([]);
    const [text, setText] = useState("");

    const loadComments = async () => {
        if (!order?.id) return;
        const data = await fetchComments(order.id);
        // сортировка по убыванию даты
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setComments(data);
    };

    useEffect(() => {
        if (!open || !order?.id) return;
        loadFiles();
        loadComments();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, order?.id]);

    const submitComment = async () => {
        const t = text.trim();
        if (!t) return;
        const created = await addCommentText(order.id, t, currentUser);
        setComments((p) => [created, ...p]);
        setText("");
    };

    const removeComment = async (c: CommentOut) => {
        await deleteComment(order.id, c.id);
        setComments((p) => p.filter((x) => x.id !== c.id));
    };

    return (
        <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
            {/* backdrop */}
            <div
                className={`absolute inset-0 bg-black/30 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
                onClick={onClose}
            />
            {/* panel */}
            <div
                className={`absolute right-0 top-0 h-full w-full max-w-[820px] bg-white shadow-xl transition-transform overflow-y-auto ${open ? "translate-x-0" : "translate-x-full"
                    }`}
                style={{ maxHeight: "100vh" }}
            >

                {/* header */}
                <div className="p-6 flex items-start justify-between border-b">
                    <div>
                        <h3 className="text-xl font-semibold">Buyurtma #{order?.id ?? "-"}</h3>
                        <p className="text-sm text-gray-500">
                            {order?.client_name || "-"} • {order?.client_phone || order?.phone || "-"}
                        </p>
                    </div>
                    <button onClick={onClose} className="px-3 py-1 rounded-md border hover:bg-gray-50">
                        Yopish
                    </button>
                </div>

                {/* info blocks */}
                <div className="p-6 grid md:grid-cols-2 gap-4">
                    <Info title="HOLATI" value={statusText} />
                    <Info title="TO‘LOV" value={paymentText} />
                    <Info title="HUJJAT TURI" value={order?.doc_type || order?.document_type || "-"} />
                    <Info title="DAVLAT" value={order?.country || "-"} />
                    <Info title="FILIAL" value={order?.branch || "-"} />
                    <Info title="HODIM" value={order?.manager || order?.owner || "-"} />
                    <Info title="DEADLINE" value={order?.deadline || "-"} />
                    <Info title="IZOH" value={order?.note || "-"} />
                </div>

                {/* attachments */}
                <div className="px-6">
                    {KIND_ORDER.map((k) => (
                        <FilesRow
                            key={k}
                            title={KIND_LABEL[k]}
                            files={filesByKind[k]}
                            loading={loadingFiles}
                        />
                    ))}
                </div>

                {/* comments */}
                <div className="p-6 border-t">
                    <h4 className="font-semibold mb-3">Izohlar</h4>
                    <div className="flex gap-2 mb-4">
                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Комментарий..."
                            className="flex-1 border rounded-md px-3 py-2 outline-none focus:ring"
                        />
                        <button
                            onClick={submitComment}
                            className="px-4 py-2 rounded-md bg-black text-white hover:opacity-90"
                        >
                            Yuborish
                        </button>
                    </div>

                    <ul className="space-y-3">
                        {comments.map((c) => (
                            <li key={c.id} className="border rounded-md p-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-gray-600">{c.author || "User"}</div>
                                    <div className="text-xs text-gray-400">
                                        {dayjs(c.created_at).format("YYYY-MM-DD HH:mm")}
                                    </div>
                                </div>
                                <div className="mt-1">{c.text}</div>
                                <button
                                    onClick={() => removeComment(c)}
                                    className="text-xs text-red-500 mt-2"
                                >
                                    O‘chirish
                                </button>
                            </li>
                        ))}
                        {comments.length === 0 && (
                            <div className="text-sm text-gray-500">Hozircha izoh yo‘q.</div>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

function Info({ title, value }: { title: string; value: any }) {
    return (
        <div className="rounded-xl border p-3">
            <div className="text-xs uppercase text-gray-500">{title}</div>
            <div className="mt-1">{value ?? "-"}</div>
        </div>
    );
}

function FilesRow({
    title,
    files,
    loading,
}: {
    title: string;
    files: AttachmentOut[];
    loading?: boolean;
}) {
    const [showAll, setShowAll] = useState(false);

    if (loading) {
        return (
            <div className="py-3 border-t first:border-t-0">
                <div className="text-sm font-medium mb-2">{title}</div>
                <div className="text-gray-400 text-sm">Yuklanmoqda…</div>
            </div>
        );
    }

    const head = files.slice(0, 2);
    const rest = files.slice(2);

    return (
        <div className="py-3 border-t first:border-t-0">
            <div className="text-sm font-medium mb-2">{title}</div>

            {files.length === 0 ? (
                <div className="text-gray-400 text-sm">— Fayl yo‘q</div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        {head.map((f) => (
                            <a
                                key={f.id}
                                href={buildAttachmentDownloadUrl(f.id)}
                                className="file-chip"
                                title={f.original_name}
                            >
                                <span className="file-chip__icon">📎</span>
                                <span className="file-chip__name">{f.original_name}</span>
                                <span className="file-chip__size">
                                    {(f.size / 1024).toFixed(0)} KB
                                </span>
                            </a>
                        ))}

                        {rest.length > 0 && !showAll && (
                            <button
                                onClick={() => setShowAll(true)}
                                className="px-2 py-1 text-sm rounded border hover:bg-gray-50"
                            >
                                Ko‘proq (+{rest.length})
                            </button>
                        )}
                    </div>

                    {showAll && (
                        <div className="mt-3 flex flex-col gap-1">
                            {rest.map((f) => (
                                <a
                                    key={f.id}
                                    href={buildAttachmentDownloadUrl(f.id)}
                                    className="file-row"
                                    title={f.original_name}
                                >
                                    <span className="file-row__icon">📎</span>
                                    <span className="file-row__name">{f.original_name}</span>
                                    <span className="file-row__size">
                                        {(f.size / 1024).toFixed(0)} KB
                                    </span>
                                </a>
                            ))}
                            <button
                                onClick={() => setShowAll(false)}
                                className="self-start mt-1 text-xs text-blue-600 hover:underline"
                            >
                                Yopish
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
