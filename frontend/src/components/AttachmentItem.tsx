import React from 'react'
import { downloadAttachment, AttachmentOut } from '../api'

type Props = {
    file: AttachmentOut
}

export default function AttachmentItem({ file }: Props) {
    return (
        <div className="flex items-center gap-3 py-1 border-b">
            <div className="flex-1">
                <span>{file.original_name}</span>{' '}
                <small className="text-gray-500">
                    ({Math.round(file.size / 1024)} KB)
                </small>
            </div>

            <a
                href="#"
                onClick={(e) => {
                    e.preventDefault()
                    downloadAttachment(file.id, file.original_name)
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md"
            >
                ¬³¬Ü¬Ñ¬é¬Ñ¬ä¬î
            </a>
        </div>
    )
}
