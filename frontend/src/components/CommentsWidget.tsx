import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
    fetchComments,
    addComment,
    deleteComment,
    type CommentOut,
} from "@/api";

type Props = {
    orderId: number;
    currentUser?: string | null;
    // опционально: запретить удаление
    canDelete?: boolean;
    className?: string;
};

export default function CommentsWidget({
    orderId,
    currentUser,
    canDelete = true,
    className = "",
}: Props) {
    const [comments, setComments] = useState<CommentOut[]>([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const rows = await fetchComments(orderId);
            setComments(rows);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    const submit = async () => {
        const val = text.trim();
        if (!val) return;
        setSending(true);
        try {
            const created = await addComment(orderId, {
                text: val,
                author: currentUser || "User",
            });
            setComments((prev) => [created, ...prev]);
            setText("");
        } finally {
            setSending(false);
        }
    };

    const remove = async (c: CommentOut) => {
        if (!canDelete) return;
        if (!confirm("Haqiqatan ham o‘chirasizmi?")) return;
        await deleteComment(orderId, c.id);
        setComments((p) => p.filter((x) => x.id !== c.id));
    };

    return (
        <div className={`rounded-xl border p-4 ${className}`}>
            {/* input row */}
            <div className="flex gap-2 mb-4">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Комментарий yozish..."
                    className="flex-1 border rounded-md px-3 py-2 outline-none focus:ring focus:ring-blue-300"
                />
                <button
                    onClick={submit}
                    disabled={!text.trim() || sending}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    Yuborish
                </button>
            </div>

            {/* list */}
            {loading ? (
                <div className="text-sm text-gray-500">Yuklanmoqda...</div>
            ) : comments.length === 0 ? (
                <div className="text-sm text-gray-500">Hozircha izoh yo‘q.</div>
            ) : (
                <ul className="space-y-3">
                    {comments.map((c) => (
                        <li key={c.id} className="border rounded-md p-3">
                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">{c.author || "User"}</div>
                                <div className="text-xs text-gray-400">
                                    {dayjs(c.created_at).format("YYYY-MM-DD HH:mm")}
                                </div>
                            </div>
                            <div className="mt-1 text-sm whitespace-pre-wrap break-words">
                                {c.text}
                            </div>
                            {canDelete && (
                                <button
                                    onClick={() => remove(c)}
                                    className="text-xs text-red-500 mt-2 hover:underline"
                                >
                                    O‘chirish
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
